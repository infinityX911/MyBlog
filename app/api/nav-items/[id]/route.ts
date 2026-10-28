/**
 * PUT    /api/nav-items/:id  -> update a nav item (admin)
 * DELETE /api/nav-items/:id  -> delete (children cascade) (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

async function getId(ctx: { params: Promise<{ id: string }> }) {
    const { id } = await ctx.params;
    return Number(id);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        const b = await req.json();
        const item = await prisma.navItem.update({
            where: { id },
            data: {
                label: (b.label ?? '').trim() || undefined,
                url: (b.url ?? '').trim() || undefined,
                icon: b.icon ?? null,
                parentId: b.parentId ? Number(b.parentId) : null,
                sortOrder: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : undefined,
                visible: typeof b.visible === 'boolean' ? b.visible : undefined,
            },
        });
        return NextResponse.json(item);
    } catch (e) {
        console.error('[PUT /api/nav-items/:id]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const id = await getId(ctx);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        await prisma.navItem.delete({ where: { id } });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error('[DELETE /api/nav-items/:id]', e);
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
}
