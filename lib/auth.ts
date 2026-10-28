import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { recordEvent } from './activity';
import { rateLimit, rateLimitReset, getClientIp } from './rateLimit';
import { getSiteSetting } from './siteSettings';
import { saveGoogleAvatar } from './google-avatar';

/**
 * Google sign-in only appears when both credentials are configured, so a
 * deployment without them keeps working and simply shows no Google button
 * instead of crashing on an undefined client id.
 */
export const googleEnabled =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    // The PUBLIC login page, not the admin one.
    //
    // NextAuth sends people here whenever it needs a sign-in screen — including
    // when signIn() names a provider that is not configured. With this set to
    // /admin/login, a reader clicking "Continue with Google" while the Google
    // credentials were still blank landed on the admin panel's login form,
    // which is both confusing and looks like a security problem.
    //
    // The admin area does not depend on this value: proxy.ts redirects to
    // /admin/login explicitly for admin routes.
    signIn: '/login',
    // Send NextAuth's own failures (OAuthCallback, AccessDenied, …) to the same
    // public page, where the error codes are turned into real sentences.
    error: '/login',
  },

  providers: [
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                // Always show the account chooser. Without it a shared computer
                // silently reuses whichever Google account is already signed in,
                // and the person never sees which one they used.
                prompt: 'select_account',
                access_type: 'online',
              },
            },
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // ── Rate limits: TWO of them, because they stop different attacks ──
        //
        // Per IP (10 / 10 min) stops one machine spraying many accounts.
        //
        // Per ACCOUNT (10 / 15 min) stops the opposite and more dangerous case:
        // many IPs — a botnet, or just a VPN being rotated — grinding away at
        // ONE account's password. The IP limit never fires there, because no
        // single address makes enough attempts. Without this second key the
        // most valuable account on the site can be attacked indefinitely.
        //
        // Keyed on the submitted email, so it costs nothing to check and works
        // even for addresses that do not exist.
        const ip = getClientIp((req as any)?.headers);
        const ipKey = `login:${ip}`;
        const acctKey = `login-acct:${email}`;

        const ipRl = rateLimit(ipKey, 10, 10 * 60 * 1000);
        if (!ipRl.ok) {
          throw new Error('Too many login attempts. Please try again in a few minutes.');
        }
        const acctRl = rateLimit(acctKey, 10, 15 * 60 * 1000);
        if (!acctRl.ok) {
          // Same wording as the IP case on purpose: telling an attacker they
          // have found a real, worth-attacking account is free information.
          throw new Error('Too many login attempts. Please try again in a few minutes.');
        }

        // User find karo with roles + permissions
        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            roles: {
              include: {
                role: {
                  include: {
                    permissions: { include: { permission: true } },
                  },
                },
              },
            },
            permissions: {
              include: { permission: true },
            },
          },
        });

        if (!user) {
          // Security audit: failed login for an unknown email (recorded, not notified — avoids brute-force spam).
          await recordEvent({
            type: 'auth.failed',
            action: 'Failed login attempt',
            description: `Unknown email "${credentials.email}" from IP ${ip}.`,
          }).catch(() => {});
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          await recordEvent({
            type: 'auth.failed',
            action: `Failed login attempt for ${user.name || user.email}`,
            description: `Wrong password from IP ${ip}.`,
            subjectUserId: user.id,
          }).catch(() => {});
          return null;
        }

        // Must have confirmed their email (new signups start unverified).
        if (!user.emailVerified) {
          throw new Error('Please verify your email first — check your inbox for the verification link.');
        }

        // Blocked accounts cannot sign in (this is what "Account Status" controls).
        if (user.status === 'blocked') {
          throw new Error('Your account has been blocked. Please contact an administrator.');
        }

        // Successful login — clear both counters. Resetting the account key
        // matters: without it the real owner would still be locked out for the
        // rest of the window by someone else's failed guesses.
        rateLimitReset(ipKey);
        rateLimitReset(acctKey);

        // Effective permissions = the user's ASSIGNED (direct) permissions only.
        // A role is a *pool/template* of assignable permissions, not an
        // automatic grant — so having a role does NOT, by itself, give a user
        // its permissions. The admin checks which of the role's permissions to
        // actually grant each user (stored as direct user permissions).
        const allPermissions = user.permissions.map(up => up.permission.slug);

        const roles = user.roles.map(ur => ur.role.slug);

        // Audit successful login (notifies admins + powers Recent Activities).
        await recordEvent({
          type: 'auth.login',
          action: `${user.name} logged in`,
          description: 'Account signed in successfully.',
          link: '/admin/dashboard',
          actorUserId: user.id,
          subjectUserId: user.id,
          notify: 'admins',
        });

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          roles,
          permissions: allPermissions,
          avatarUrl: user.avatarUrl ?? null,
          isTrusted: user.isTrusted,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * The Google gate. Everything security-relevant about that path happens
     * here, before any session exists. The credentials provider does its own
     * checks inside authorize(), so it is waved straight through.
     *
     * THE RULE: an address identifies one account, however you sign in to it.
     * Signing in with Google on an address that already has a password account
     * attaches Google to THAT account rather than creating a second one — so an
     * administrator keeps their role whichever button they press. Sign-in method
     * is authentication; roles and permissions are authorisation, and the two
     * have nothing to do with each other.
     *
     * What makes the attaching safe is the email_verified check below, not
     * keeping the methods apart. The attack people picture is a provider that
     * will claim an address it never confirmed; refusing those is the control.
     *
     * Still refused, always: an unverified address, an address already tied to a
     * different Google account, a blocked account, and a brand-new account while
     * registration is closed.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;

      const p = profile as any;
      const email: string = (p?.email ?? '').trim().toLowerCase();
      const googleId: string = String(p?.sub ?? '');

      if (!email || !googleId) return '/login?error=google';

      // The single most important check here. An OAuth provider asserting an
      // address it has not verified would let anyone sign in as the owner of
      // that address — the classic OAuth account takeover. Google does verify,
      // but we do not take its word for it implicitly.
      if (p?.email_verified !== true) return '/login?error=google-unverified';

      // Google id first: it is stable even if the person later renames the
      // address on their Google account, so a returning user is still matched.
      const byGoogle = await prisma.user.findFirst({
        where: { googleId },
        select: { id: true, status: true },
      });
      if (byGoogle) {
        if (byGoogle.status === 'blocked') return '/login?error=blocked';
        return true;
      }

      // No Google account with this id yet. Does the address already exist?
      //
      // Gmail ignores dots and anything after a "+", so umair.ali@gmail.com and
      // umairali@gmail.com are ONE mailbox but two different strings. Matching
      // on the exact string alone would create a SECOND account for the same
      // person — not a security hole, but a confusing one to unpick afterwards.
      //
      // Both sides have to be reduced to the same form to compare them, and SQL
      // cannot strip dots, so the fallback pulls the gmail accounts and compares
      // in JS. It only runs when the incoming address is gmail AND the exact
      // lookup already missed, which is rare.
      const gmailCanonical = (addr: string): string => {
        const [local, domain] = addr.split('@');
        if (domain !== 'gmail.com' && domain !== 'googlemail.com') return addr;
        return `${local.split('+')[0].split('.').join('')}@gmail.com`;
      };

      const SELECT_USER = { id: true, name: true, email: true, googleId: true, status: true } as const;

      let byEmail = await prisma.user.findUnique({ where: { email }, select: SELECT_USER });

      // Runs for ANY gmail address that missed the exact lookup — not only ones
      // that differ from their own canonical form. The stored address may be the
      // dotted one while the incoming is plain, and that direction has to match
      // too.
      if (!byEmail && (email.endsWith('@gmail.com') || email.endsWith('@googlemail.com'))) {
        const target = gmailCanonical(email);
        const gmailUsers = await prisma.user.findMany({
          where: {
            OR: [
              { email: { endsWith: '@gmail.com' } },
              { email: { endsWith: '@googlemail.com' } },
            ],
          },
          select: SELECT_USER,
          // Bounded so this can never turn into a full-table read on a site
          // with thousands of members. If a match is somewhere past the cap the
          // worst case is a duplicate account, which is recoverable — an
          // unbounded query on every Google sign-in would not be.
          take: 2000,
        });
        byEmail = gmailUsers.find((u) => gmailCanonical(u.email) === target) ?? null;
      }

      if (byEmail) {
        // Already tied to a DIFFERENT Google account. Linking here would hand
        // one person's account to another, so refuse and let a human sort it.
        if (byEmail.googleId && byEmail.googleId !== googleId) {
          return '/login?error=google-mismatch';
        }
        if (byEmail.status === 'blocked') return '/login?error=blocked';

        // First Google sign-in on an existing email/password account: attach
        // the two, so from now on either method reaches the same account and
        // the same role.
        //
        // This is safe because of the email_verified check above, and it is
        // what Google, Microsoft and every major identity provider do. The
        // danger people have in mind is a provider that will assert an address
        // it has not confirmed — that is exactly what the check rules out.
        //
        // Recorded and notified, so an account gaining a second way in is never
        // something that happened quietly.
        if (!byEmail.googleId) {
          await prisma.user.update({
            where: { id: byEmail.id },
            data: { googleId, emailVerified: true },
          });
          await recordEvent({
            type: 'auth.link',
            action: `${byEmail.name} linked a Google account`,
            description: `Google sign-in is now enabled for ${byEmail.email}.`,
            actorUserId: byEmail.id,
            subjectUserId: byEmail.id,
            notify: 'admins',
          }).catch(() => {});
        }
        return true;
      }

      // ── Brand-new account ────────────────────────────────────────────────
      // Google must not become a side door around the registration switch.
      const settings = await getSiteSetting('blog').catch(() => null);
      if (settings && settings.registrationEnabled === false) {
        return '/login?error=registration-closed';
      }

      const viewerRole = await prisma.role.findFirst({ where: { slug: 'viewer' } });
      if (!viewerRole) return '/login?error=server-not-ready';

      // The same starter permissions the email/password signup grants, taken
      // from the Viewer role's pool — so a Google account can never end up with
      // more (or less) than one created through the form. Querying through
      // rolePermission is what makes granting outside the pool impossible.
      const starter = (
        await prisma.rolePermission.findMany({
          where: {
            roleId: viewerRole.id,
            permission: {
              slug: {
                in: ['create-comment', 'upload-avatar', 'use-messages', 'use-contact-form'],
              },
            },
          },
          select: { permissionId: true },
        })
      ).map((rp) => rp.permissionId);

      // `password` is a required column, so it gets a bcrypt hash of 48 random
      // bytes. Nobody has ever seen the input, so bcrypt.compare in the
      // credentials provider can never match it: this account stays Google-only
      // unless its owner sets a password through the normal reset flow.
      const unusablePassword = await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 12);

      try {
        const created = await prisma.user.create({
          data: {
            name: String(p?.name ?? email.split('@')[0]).slice(0, 80),
            email,
            googleId,
            password: unusablePassword,
            // Google has already proven the address; our own verification email
            // would be asking for the same proof twice.
            emailVerified: true,
            isTrusted: false,
            // Google's profile picture, downloaded and re-encoded into our own
            // /avatars folder (see lib/google-avatar.ts) rather than stored as a
            // third-party URL. Falls back to the default if anything fails, and
            // the person can replace it from the account page like any avatar.
            avatarUrl: (await saveGoogleAvatar(p?.picture)) ?? '/avatars/male.svg',
            roles: { create: { roleId: viewerRole.id } },
            ...(starter.length > 0 && {
              permissions: { create: starter.map((id) => ({ permissionId: id })) },
            }),
          },
          select: { id: true, name: true },
        });

        await recordEvent({
          type: 'user.register',
          action: `${created.name} created a new account with Google`,
          description: 'New member registered via Google sign-in.',
          link: `/admin/management/users/${created.id}/edit`,
          actorUserId: created.id,
          subjectUserId: created.id,
          notify: 'admins',
        }).catch(() => {});
      } catch (e: any) {
        // P2002 = unique violation on `email`. Two sign-ins racing for the same
        // brand-new address; the loser just retries and finds the winner's row.
        if (e?.code === 'P2002') return '/login?error=account-exists';
        console.error('[signIn:google] could not create user:', e);
        return '/login?error=google';
      }

      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // Google hands back its own profile, not our user row, so the id, roles
      // and permissions have to be looked up. Without this the token would
      // carry Google's "sub" as the user id and no permissions at all.
      if (account?.provider === 'google' && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.trim().toLowerCase() },
          include: {
            roles: { include: { role: true } },
            permissions: { include: { permission: true } },
          },
        });
        if (dbUser) {
          token.id = String(dbUser.id);
          token.roles = dbUser.roles.map((ur) => ur.role.slug);
          // Same rule as the credentials path: the user's GRANTED permissions.
          // A role is the pool an admin picks from, not an automatic grant.
          token.permissions = dbUser.permissions.map((up) => up.permission.slug);
          token.avatarUrl = dbUser.avatarUrl ?? null;
          token.isTrusted = dbUser.isTrusted;

          await recordEvent({
            type: 'auth.login',
            action: `${dbUser.name} logged in with Google`,
            description: 'Account signed in successfully.',
            link: '/admin/dashboard',
            actorUserId: dbUser.id,
            subjectUserId: dbUser.id,
            notify: 'admins',
          }).catch(() => {});
        }
        return token;
      }

      if (user) {
        token.id = user.id;
        token.roles = (user as any).roles;
        token.permissions = (user as any).permissions;
        token.avatarUrl = (user as any).avatarUrl;
        token.isTrusted = (user as any).isTrusted;
      } else if (trigger === 'update' && token.id) {
        // Re-pull fresh data from the DB when the client calls updateSession().
        // Lets avatar changes AND permission grants/revokes take effect without
        // a full logout/login. Effective permissions = the user's direct perms.
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: Number(token.id) },
            include: {
              roles: { include: { role: true } },
              permissions: { include: { permission: true } },
            },
          });
          if (fresh) {
            token.avatarUrl = fresh.avatarUrl ?? null;
            token.roles = fresh.roles.map(ur => ur.role.slug);
            token.permissions = fresh.permissions.map(up => up.permission.slug);
            token.isTrusted = fresh.isTrusted;
          }
        } catch { /* keep existing token on failure */ }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).roles = token.roles;
        (session.user as any).permissions = token.permissions;
        (session.user as any).avatarUrl = token.avatarUrl;
        (session.user as any).isTrusted = token.isTrusted;
      }
      return session;
    },
  },
};
