/**
 * app/api/permissions/[id]/route.ts
 *
 * GET    /api/permissions/[id]  -> fetch single permission (requires 'view-permissions')
 * PATCH  /api/permissions/[id]  -> update permission name (requires 'update-permissions')
 * DELETE /api/permissions/[id]  -> delete permission (requires 'delete-permissions')
 *
 * Next.js 16: params is a Promise — must be awaited before accessing .id
 *
 * SECURITY: previously unauthenticated. All three verbs now gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

type Params = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('view-permissions');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    try {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
        }
        return NextResponse.json({
            id: permission.id,
            name: permission.name,
            // slug may not exist in schema — fallback gracefully
            slug: (permission as any).slug ?? null,
        });
    } catch (error) {
        console.error('[GET /api/permissions/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const auth = await requirePermission('update-permissions');
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
            return NextResponse.json({ error: 'Permission name is required' }, { status: 422 });
        }

        const slug = name
            .toLowerCase()
            .replace(/[^\w\s]+/g, '-')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/-$/, '')
            .trim();

        // Try with slug first; if slug column missing in schema, retry without it
        try {
            await prisma.permission.update({ where: { id }, data: { name, slug } });
            return NextResponse.json({ success: true });
        } catch (slugErr: any) {
            if (slugErr?.code === 'P2025') {
                return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
            }
            // Slug column likely missing — retry without it
            await prisma.permission.update({ where: { id }, data: { name } });
            return NextResponse.json({ success: true });
        }
    } catch (error: any) {
        console.error('[PATCH /api/permissions/:id]', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission('delete-permissions');
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    try {
        await prisma.permission.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/permissions/:id]', error);

        // Record not found
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
        }

        // Foreign key constraint — permission assigned to a role
        if (error?.code === 'P2003' || error?.code === 'P2014') {
            return NextResponse.json(
                { error: 'Cannot delete: this permission is assigned to one or more roles. Remove it from all roles first.' },
                { status: 409 }
            );
        }

        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
