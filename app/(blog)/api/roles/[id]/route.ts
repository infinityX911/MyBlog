/**
 * app/api/roles/[id]/route.ts
 *
 * GET    /api/roles/[id]  -> fetch single role with permissions (requires 'view-roles')
 * PATCH  /api/roles/[id]  -> update role name, slug, permissions (requires 'update-roles')
 * DELETE /api/roles/[id]  -> delete role (requires 'delete-roles')
 *
 * Next.js 16: params is a Promise — must be awaited before accessing .id
 *
 * SECURITY: previously unauthenticated. All three verbs now gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

const toSlug = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('view-roles');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    try {
        const role = await prisma.role.findUnique({
            where: { id },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });
        if (!role) {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }

        // Flatten join rows into plain permission objects
        const formatted = {
            ...role,
            permissions: role.permissions.map(rp => rp.permission),
        };

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('[GET /api/roles/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('update-roles');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

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

        // Which permissions are being REMOVED from this role's pool?
        const before = await prisma.rolePermission.findMany({
            where: { roleId: id },
            select: { permissionId: true },
        });
        const beforeIds = before.map(rp => rp.permissionId);
        const removedIds = beforeIds.filter(pid => !permissionIds.includes(pid));

        // Delete existing role permissions then recreate the new pool
        await prisma.rolePermission.deleteMany({ where: { roleId: id } });

        const role = await prisma.role.update({
            where: { id },
            data: {
                name,
                slug,
                ...(permissionIds.length > 0 && {
                    permissions: {
                        create: permissionIds.map(pid => ({ permissionId: pid })),
                    },
                }),
            },
            include: {
                permissions: {
                    include: { permission: true },
                },
            },
        });

        // ── Cascade: a permission removed from the role is removed from every
        //    user who has this role (their assigned/direct permission is revoked
        //    too). Adding a permission to a role does NOT auto-grant it. ────────
        if (removedIds.length > 0) {
            const userIds = (await prisma.userRole.findMany({
                where: { roleId: id },
                select: { userId: true },
            })).map(ur => ur.userId);
            if (userIds.length > 0) {
                await prisma.userPermission.deleteMany({
                    where: { userId: { in: userIds }, permissionId: { in: removedIds } },
                });
            }
        }

        const formatted = {
            ...role,
            permissions: role.permissions.map(rp => rp.permission),
        };

        return NextResponse.json(formatted);
    } catch (error: any) {
        console.error('[PATCH /api/roles/:id]', error);
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }
        if (error?.code === 'P2002') {
            return NextResponse.json({ error: 'A role with this name or slug already exists.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('delete-roles');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    try {
        await prisma.role.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/roles/:id]', error);
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }
        if (error?.code === 'P2003' || error?.code === 'P2014') {
            return NextResponse.json(
                { error: 'Cannot delete: this role is assigned to one or more users.' },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
