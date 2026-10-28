/**
 * app/api/users/route.ts
 *
 * GET  /api/users  -> list all users with their roles and permissions (requires 'view-users')
 * POST /api/users  -> create a new user (requires 'create-users')
 *
 * SECURITY: previously unauthenticated — anyone could list every user
 * (including which roles/permissions they hold) or create new accounts
 * directly, bypassing the public signup flow's Viewer-only restriction.
 *
 * Schema uses explicit join tables:
 *   UserRole      (users_roles)
 *   UserPermission (users_permissions)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requirePermission } from '@/lib/rbac';

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const auth = await requirePermission('view-users');
    if (auth.error) return auth.error;

    try {
        const users = await prisma.user.findMany({
            include: {
                roles: { include: { role: true } },
                permissions: { include: { permission: true } },
            },
            orderBy: { id: 'asc' },
        });

        // Show each user's ASSIGNED (direct) permissions — their actual access.
        const formatted = users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            status: u.status,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            roles: u.roles.map(ur => ur.role),
            permissions: u.permissions.map(up => up.permission),
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[GET /api/users]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('create-users');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const name: string = (body.name ?? '').trim();
        const email: string = (body.email ?? '').trim().toLowerCase();
        const password: string = (body.password ?? '').trim();

        if (!name || !email || !password) {
            return NextResponse.json({ error: 'Name, email and password are required.' }, { status: 422 });
        }

        // Assign a role + the checked permissions (subset of the role's pool)
        // as the new user's assigned (direct) permissions.
        const roleId: number | null = body.roleId ? Number(body.roleId) : null;
        const permissionIds: number[] = Array.isArray(body.permissions)
            ? body.permissions.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
            : [];

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
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

        const formatted = {
            id: user.id,
            name: user.name,
            email: user.email,
            roles: user.roles.map(ur => ur.role),
            permissions: user.permissions.map(up => up.permission),
        };

        return NextResponse.json(formatted, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/users]', error);
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
