/**
 * app/(blog)/api/auth/register/route.ts
 *
 * POST /api/auth/register
 * Public signup for blog visitors. Creates a User row, assigns the
 * "Viewer" role plus the starter permissions that role offers (see
 * SIGNUP_PERMISSIONS — a user's grants are always a subset of their role's
 * pool), and auto-sets avatarUrl based on gender (server decides the file path,
 * never trusts a client-supplied URL — prevents stored-XSS / arbitrary
 * URL injection via the avatar field).
 *
 * Security notes:
 * - Password hashed with bcrypt (12 rounds) before storage.
 * - Email normalized (trim + lowercase) before uniqueness check, to
 *   prevent duplicate accounts via case variation.
 * - Generic error messages returned for auth-adjacent failures so we
 *   don't leak whether an email exists (timing-safe-ish enumeration
 *   defense) — though the @unique constraint still surfaces a 409,
 *   which is an accepted minor trade-off for good UX.
 * - Rate limiting should be added at the reverse-proxy / middleware
 *   layer in production (not implemented here).
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { recordEvent } from '@/lib/activity';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { getSiteUrl } from '@/lib/siteSettings';
import { deliverEmail } from '@/lib/delivery';

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AVATARS = {
    MALE: '/avatars/male.svg',
    FEMALE: '/avatars/female.svg',
} as const;

/**
 * What a brand-new account is granted, on top of the Viewer role.
 *
 * This mirrors by hand what an admin does in Admin → Users: pick a role, then
 * tick which of THAT ROLE'S permissions the person actually gets. So this list
 * is a wish list — it is intersected with the Viewer role's pool below, and
 * anything Viewer does not offer is dropped.
 *
 * THE INTERSECTION IS NOT DECORATION. Granting outside the role's pool breaks
 * the rule the whole system rests on, and it had already happened: this list
 * used to include `auto-approve-comments`, which the seed deliberately withholds
 * from Viewer so new readers' comments stay in moderation. The direct grant won,
 * and moderation was silently bypassed for every single person who signed up.
 *
 * To change what new members can do, edit the Viewer role in Admin → Roles.
 * That is the control surface — not this file.
 */
const SIGNUP_PERMISSIONS = [
    'create-comment',
    'upload-avatar',
    'use-messages',
    'use-contact-form',
] as const;

export async function POST(req: NextRequest) {
    try {
        // ── Rate limit: max 5 signups per IP per 10 minutes ──────────────
        const ip = getClientIp(req.headers);
        const rl = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
        if (!rl.ok) {
            return NextResponse.json(
                { error: 'Too many sign-up attempts. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
            );
        }

        const body = await req.json();

        const name: string = (body.name ?? '').trim();
        const email: string = (body.email ?? '').trim().toLowerCase();
        const password: string = body.password ?? '';
        const gender: string = (body.gender ?? 'MALE').toUpperCase();

        // ── Validation ──────────────────────────────────────────
        if (!name || name.length < 2 || name.length > 80) {
            return NextResponse.json({ error: 'Please enter a valid name.' }, { status: 422 });
        }
        if (!EMAIL_RE.test(email) || email.length > 190) {
            return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 422 });
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });
        }
        if (gender !== 'MALE' && gender !== 'FEMALE') {
            return NextResponse.json({ error: 'Invalid gender value.' }, { status: 422 });
        }

        // ── Duplicate check ─────────────────────────────────────
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
        }

        // ── Resolve "Viewer" role ────────────────────────────────
        const viewerRole = await prisma.role.findFirst({ where: { slug: 'viewer' } });
        if (!viewerRole) {
            // Defensive fallback — should never happen if seed.ts has run.
            return NextResponse.json({ error: 'Server is not ready for registration. Please try again later.' }, { status: 503 });
        }

        // The starter set INTERSECTED with what the Viewer role actually offers.
        // Querying through rolePermission rather than permission is the whole
        // point: it makes it impossible to grant something outside the pool, so
        // the earlier auto-approve-comments leak cannot recur even if someone
        // adds a slug to the list above without checking the role.
        const starterPermissions = (
            await prisma.rolePermission.findMany({
                where: {
                    roleId: viewerRole.id,
                    permission: { slug: { in: [...SIGNUP_PERMISSIONS] } },
                },
                select: { permissionId: true },
            })
        ).map((rp) => ({ id: rp.permissionId }));

        const hashedPassword = await bcrypt.hash(password, 12);
        const avatarUrl = gender === 'FEMALE' ? AVATARS.FEMALE : AVATARS.MALE;

        // Email-verification token (raw emailed; only its hash is stored).
        const verifyTokenRaw = crypto.randomBytes(32).toString('hex');

        // New users get the Viewer role, plus the starter permissions that role
        // offers. They start UNVERIFIED and must confirm their email before
        // they can log in.
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                gender: gender as 'MALE' | 'FEMALE',
                avatarUrl,
                isTrusted: false,
                emailVerified: false,
                verifyToken: sha256(verifyTokenRaw),
                verifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
                roles: {
                    create: { roleId: viewerRole.id },
                },
                ...(starterPermissions.length > 0 && {
                    permissions: {
                        create: starterPermissions.map(p => ({ permissionId: p.id })),
                    },
                }),
            },
            select: { id: true, name: true, email: true },
        });

        // Send the verification email (link uses the request's own origin, so
        // it works on localhost in dev and the real domain in prod).
        const baseUrl = await getSiteUrl(); // public site URL (Settings → websiteUrl), not the internal 0.0.0.0:3000 origin behind nginx
        const verifyLink = `${baseUrl}/verify-email?token=${verifyTokenRaw}`;
        void deliverEmail(
            email,
            'Verify your email',
            `Hi ${name},\n\nWelcome! Please confirm your email to activate your account (link valid 24 hours):\n${verifyLink}\n\nIf you didn't sign up, ignore this email.`,
            `<p>Hi ${name},</p><p>Welcome! Please confirm your email to activate your account (link valid 24 hours):</p>` +
            `<p><a href="${verifyLink}" style="background:#0858f7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify my email</a></p>` +
            `<p>Or open this link:<br>${verifyLink}</p>`,
        ).catch((e) => console.error('[register] verify email failed:', e));

        await recordEvent({
            type: 'user.register',
            action: `${user.name} created a new account`,
            description: 'New member registered on the site.',
            link: `/admin/management/users/${user.id}/edit`,
            actorUserId: user.id,
            subjectUserId: user.id,
            notify: 'admins',
        });

        return NextResponse.json({
            success: true,
            user,
            message: 'Account created! Please check your email and click the verification link before logging in.',
        }, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/auth/register]', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}