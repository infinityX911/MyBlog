/**
 * app/api/roles/route.ts
 *
 * GET  /api/roles  -> list all roles with their permissions (requires 'view-roles')
 * POST /api/roles  -> create a new role with optional permissions (requires 'create-roles')
 *
 * SECURITY: previously unauthenticated — anyone could create new roles or
 * read the full role/permission matrix.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, guardAssignablePermissions } from '@/lib/rbac';

const toSlug = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
    const auth = await requirePermission('view-roles');
    if (auth.error) return auth.error;

    try {
        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
            orderBy: { id: 'asc' },
        });

        // Flatten RolePermission join rows into plain permission objects
        const formatted = roles.map(role => ({
            ...role,
            permissions: role.permissions.map(rp => rp.permission),
        }));

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[GET /api/roles]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    const auth = await requirePermission('create-roles');
    if (auth.error) return auth.error;

    try {
        const body = await req.json();
        const name: string = (body.name ?? '').trim();
        if (!name) {
            return NextResponse.json({ error: 'Role name is required' }, { status: 422 });
        }

        const slug: string = (body.slug ?? '').trim() || toSlug(name);
        const permissionIds: number[] = Array.isArray(body.permissions)
            ? body.permissions.map(Number).filter(Boolean)
            : [];

        // PRIVILEGE-ESCALATION GUARD: a role is a pool of grantable permissions.
        // Stop a scoped `create-roles` holder from baking permissions they don't
        // hold into a new role (which could then be handed out downstream).
        const escalation = await guardAssignablePermissions(auth.session, permissionIds);
        if (escalation) return escalation;

        const role = await prisma.role.create({
            data: {
                name,
                slug,
                ...(permissionIds.length > 0 && {
                    permissions: {
                        create: permissionIds.map(id => ({ permissionId: id })),
                    },
                }),
            },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        const formatted = {
            ...role,
            permissions: role.permissions.map(rp => rp.permission),
        };

        return NextResponse.json(formatted, { status: 201 });
    } catch (error: any) {
        console.error('[POST /api/roles]', error);
        // Unique constraint violation
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A role with this name or slug already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
