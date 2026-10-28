/**
 * app/api/users/[id]/route.ts
 *
 * GET    /api/users/[id]  -> fetch single user with roles + permissions (requires 'view-users')
 * PATCH  /api/users/[id]  -> update user (requires 'update-users')
 * DELETE /api/users/[id]  -> delete user (requires 'delete-users')
 *
 * Next.js 16: params is a Promise — must be awaited
 *
 * SECURITY: previously unauthenticated. All three verbs now gated.
 * DELETE also refuses to let an account delete itself, to avoid an admin
 * accidentally locking themselves out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requirePermission, userId as sessionUserId, guardAssignablePermissions, guardWithinRolePool } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES = ['approved', 'pending', 'blocked'];

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('view-users');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                roles: { include: { role: true } },
                permissions: { include: { permission: true } },
            },
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        return NextResponse.json({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            status: user.status,
            isTrusted: user.isTrusted,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            roles: user.roles.map(ur => ur.role),
            permissions: user.permissions.map(up => up.permission),
        });
    } catch (error) {
        console.error('[GET /api/users/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('update-users');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    try {
        const body = await req.json();
        const name: string = (body.name ?? '').trim();
        const email: string = (body.email ?? '').trim().toLowerCase();

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required.' }, { status: 422 });
        }

        const roleId: number | null = body.roleId ? Number(body.roleId) : null;
        // The checked permissions (a subset of the role's pool) become this
        // user's ASSIGNED (direct) permissions — that's their actual access.
        const permissionIds: number[] = Array.isArray(body.permissions)
            ? body.permissions.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
            : [];

        // ── PRIVILEGE-ESCALATION GUARDS ─────────────────────────────────────
        // (1) An actor may only grant permissions they themselves hold.
        const escalation = await guardAssignablePermissions(auth.session, permissionIds);
        if (escalation) return escalation;

        // (1b) The grant must sit inside the pool of the role being assigned.
        //      The UI only offers the role's own permissions, but the UI is not
        //      a security boundary.
        const poolViolation = await guardWithinRolePool(roleId ? [roleId] : [], permissionIds);
        if (poolViolation) return poolViolation;

        // (2) An actor may not edit their OWN role/permission set here — the
        //     classic self-escalation path. Profile self-service is /account.
        if (id === sessionUserId(auth.session)) {
            return NextResponse.json(
                { error: 'You cannot modify your own roles or permissions from user management.' },
                { status: 403 }
            );
        }

        // Build update data
        const updateData: any = { name, email };
        if (body.password?.trim()) {
            updateData.password = await bcrypt.hash(body.password.trim(), 10);
        }
        if (body.username !== undefined) {
            const uname = String(body.username).trim().replace(/^@+/, '');
            updateData.username = uname === '' ? null : uname;
        }

        // Status (admin-controlled): approved | pending | blocked
        let statusChange: { from: string; to: string } | null = null;
        if (body.status !== undefined) {
            const status = String(body.status).trim().toLowerCase();
            if (!VALID_STATUSES.includes(status)) {
                return NextResponse.json(
                    { error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` },
                    { status: 422 }
                );
            }
            const before = await prisma.user.findUnique({ where: { id }, select: { status: true } });
            if (before && before.status !== status) statusChange = { from: before.status, to: status };
            updateData.status = status;
        }

        // Replace the user's role + their assigned (direct) permissions.
        await prisma.userRole.deleteMany({ where: { userId: id } });
        await prisma.userPermission.deleteMany({ where: { userId: id } });

        const user = await prisma.user.update({
            where: { id },
            data: {
                ...updateData,
                ...(roleId && {
                    roles: { create: [{ roleId }] },
                }),
                ...(permissionIds.length > 0 && {
                    permissions: { create: permissionIds.map(pid => ({ permissionId: pid })) },
                }),
            },
            include: {
                roles: { include: { role: true } },
                permissions: { include: { permission: true } },
            },
        });

        // ── Audit + notify the affected user about admin changes ──────────
        const actor = sessionUserId(auth.session);
        if (statusChange) {
            await recordEvent({
                type: 'user.status',
                action: `${user.name}'s status changed to ${statusChange.to}`,
                description: `Changed from ${statusChange.from} to ${statusChange.to} by an administrator.`,
                link: '/admin/account',
                actorUserId: actor,
                subjectUserId: id,
                notify: id, // direct notification to the affected user
            });
        }
        await recordEvent({
            type: 'user.update',
            action: `${user.name}'s account was updated`,
            description: 'Role / permissions / profile updated by an administrator.',
            link: `/admin/management/users/${id}/edit`,
            actorUserId: actor,
            subjectUserId: id,
            notify: 'admins',
        });

        return NextResponse.json({
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            status: user.status,
            roles: user.roles.map(ur => ur.role),
            permissions: user.permissions.map(up => up.permission),
        });
    } catch (error: any) {
        console.error('[PATCH /api/users/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 });
        if (error?.code === 'P2002') return NextResponse.json({ error: 'Email already in use.' }, { status: 409 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('delete-users');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    if (id === sessionUserId(auth.session)) {
        return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    try {
        await prisma.user.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/users/:id]', error);
        if (error?.code === 'P2025') return NextResponse.json({ error: 'User not found' }, { status: 404 });
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
