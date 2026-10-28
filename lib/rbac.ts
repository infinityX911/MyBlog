/**
 * lib/rbac.ts
 *
 * Thin guard layer for API route handlers, built ON TOP OF the existing
 * lib/permissions.ts (getSession / hasPermission / hasRole) — that file is
 * left untouched on purpose. This just gives every route handler a
 * one-line way to say "require X" and get back either a usable session or
 * a ready-to-return NextResponse error, instead of every route re-writing
 * its own 401/403 boilerplate.
 *
 * Usage in any app/api/.../route.ts:
 *
 *   const auth = await requirePermission('view-users');
 *   if (auth.error) return auth.error;
 *   // auth.session is now guaranteed to exist and have this permission
 *
 * NEW MODULES: whatever you build next, gate it the same way — pick (or
 * add) a permission slug in prisma/seed.ts and call requirePermission()
 * at the top of the handler. That's the whole pattern.
 */

import { NextResponse } from 'next/server';
import { getSession } from './permissions';
import { prisma } from './prisma';
import { recordEvent } from './activity';
import { rateLimit } from './rateLimit';

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Record an access-denied security event, deduped to 1 per user+permission
 *  per 10 min so a polling client can't flood the activity log. */
async function logDenied(session: Session, need: string): Promise<void> {
    try {
        const uid = userId(session);
        if (!rateLimit(`denied:${uid}:${need}`, 1, 10 * 60 * 1000).ok) return;
        const name = (session.user as any)?.name ?? 'A user';
        await recordEvent({
            type: 'access.denied',
            action: `${name} was denied access (missing "${need}")`,
            description: 'A logged-in user tried to reach a resource their role does not allow.',
            actorUserId: uid, subjectUserId: uid,
        });
    } catch { /* logging must never break auth */ }
}

type AuthResult =
    | { session: Session; error: null }
    | { session: null; error: NextResponse };

const SUPER_ADMIN_ROLE = 'administrator';

export function isSuperAdmin(session: Session): boolean {
    return userRoles(session).includes(SUPER_ADMIN_ROLE);
}

function unauthorized(): NextResponse {
    return NextResponse.json({ error: 'Unauthorized. Please log in.' }, { status: 401 });
}

function forbidden(): NextResponse {
    return NextResponse.json(
        { error: 'You do not have permission to perform this action.' },
        { status: 403 }
    );
}

export function userId(session: Session): number {
    return Number((session.user as any).id);
}

export function userPermissions(session: Session): string[] {
    return ((session.user as any).permissions ?? []) as string[];
}

export function userRoles(session: Session): string[] {
    return ((session.user as any).roles ?? []) as string[];
}

/** Just require a logged-in user — no specific permission. */
export async function requireAuth(): Promise<AuthResult> {
    const session = await getSession();
    if (!session?.user) {
        return { session: null, error: unauthorized() };
    }
    return { session: session as Session, error: null };
}

/** Require a logged-in user who has this exact permission slug. */
export async function requirePermission(slug: string): Promise<AuthResult> {
    const auth = await requireAuth();
    if (auth.error) return auth;
    if (isSuperAdmin(auth.session)) return auth;
    if (!userPermissions(auth.session).includes(slug)) {
        await logDenied(auth.session, slug);
        return { session: null, error: forbidden() };
    }
    return auth;
}

/** Require a logged-in user who has AT LEAST ONE of these permission slugs. */
export async function requireAnyPermission(slugs: string[]): Promise<AuthResult> {
    const auth = await requireAuth();
    if (auth.error) return auth;
    if (isSuperAdmin(auth.session)) return auth;
    const perms = userPermissions(auth.session);
    if (!slugs.some((s) => perms.includes(s))) {
        await logDenied(auth.session, slugs.join(' | '));
        return { session: null, error: forbidden() };
    }
    return auth;
}

/** Require a logged-in user with this exact role slug (rarely needed — prefer permissions). */
export async function requireRole(slug: string): Promise<AuthResult> {
    const auth = await requireAuth();
    if (auth.error) return auth;
    if (!userRoles(auth.session).includes(slug)) {
        return { session: null, error: forbidden() };
    }
    return auth;
}


/**
 * ROLE-POOL GUARD.
 *
 * A user may only be granted permissions their ROLE offers. That is what a role
 * IS in this system — the pool an admin picks from. Granting outside it means
 * the role stops describing what its holders can do, and two users with the
 * same role can quietly differ in ways nothing on the roles page explains.
 *
 * The admin UI already only renders the role's own permissions, so this cannot
 * happen by clicking. But the UI is not a security boundary: a hand-crafted
 * PATCH could attach any permission id to any user, and the only thing standing
 * in the way was "you must hold it yourself" — which an administrator always
 * does, for everything.
 *
 * Pass the role ids the user will hold AFTER the update, so a simultaneous role
 * change is judged against the new role rather than the old one.
 *
 * Returns null when every requested permission is inside the pool, otherwise a
 * ready-to-return 403 naming the offenders.
 */
export async function guardWithinRolePool(
    roleIds: number[],
    permissionIds: number[]
): Promise<NextResponse | null> {
    const perms = [...new Set(permissionIds.filter((n) => Number.isFinite(n) && n > 0))];
    if (perms.length === 0) return null;

    const roles = [...new Set(roleIds.filter((n) => Number.isFinite(n) && n > 0))];

    // No role means no pool, so nothing may be granted.
    const pool = roles.length
        ? new Set(
              (
                  await prisma.rolePermission.findMany({
                      where: { roleId: { in: roles } },
                      select: { permissionId: true },
                  })
              ).map((rp) => rp.permissionId)
          )
        : new Set<number>();

    const outside = perms.filter((id) => !pool.has(id));
    if (outside.length === 0) return null;

    const named = await prisma.permission.findMany({
        where: { id: { in: outside } },
        select: { slug: true },
    });
    return NextResponse.json(
        {
            error:
                'These permissions are not part of the selected role and cannot be granted: ' +
                named.map((p) => p.slug).join(', '),
        },
        { status: 403 }
    );
}

/**
 * PRIVILEGE-ESCALATION GUARD.
 *
 * When an actor assigns permissions to another user (or to a role), enforce
 * that they can only grant permissions they themselves already hold. Without
 * this, any holder of `update-users` / `create-roles` could hand out
 * `access-admin-panel`, `delete-users`, etc. — vertical privilege escalation
 * up to full takeover. Administrators hold every permission, so they are
 * unaffected; a scoped Editor/Manager is correctly boxed in.
 *
 * Returns `null` when every requested permission is grantable, otherwise a
 * ready-to-return 403 naming the offending slugs.
 */
export async function guardAssignablePermissions(
    session: Session,
    permissionIds: number[]
): Promise<NextResponse | null> {
    const ids = [...new Set(permissionIds.filter((n) => Number.isFinite(n) && n > 0))];
    if (ids.length === 0) return null;

    const held = new Set(userPermissions(session));

    const rows = await prisma.permission.findMany({
        where: { id: { in: ids } },
        select: { slug: true },
    });

    const notGrantable = rows.map((r) => r.slug).filter((slug) => !held.has(slug));

    if (notGrantable.length > 0) {
        return NextResponse.json(
            { error: 'You cannot grant permissions you do not hold yourself: ' + notGrantable.join(', ') },
            { status: 403 }
        );
    }
    return null;
}
