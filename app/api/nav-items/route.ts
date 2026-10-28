/**
 * GET  /api/nav-items?siteKey=blog  -> nested navbar tree (public)
 * POST /api/nav-items               -> create a nav item (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function GET(req: NextRequest) {
    const siteKey = req.nextUrl.searchParams.get('siteKey') || 'blog';
    try {
        const items = await prisma.navItem.findMany({
            where: { siteKey },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        // Build a 1-level tree: top-level items each with a children[] array.
        const top = items.filter(i => i.parentId == null);
        const tree = top.map(t => ({ ...t, children: items.filter(c => c.parentId === t.id) }));
        return NextResponse.json(tree);
    } catch (e) {
        console.error('[GET /api/nav-items]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const b = await req.json();
        const label = (b.label ?? '').trim();
        if (!label) return NextResponse.json({ error: 'Label is required' }, { status: 422 });
        const item = await prisma.navItem.create({
            data: {
                siteKey: b.siteKey || 'blog',
                label,
                url: (b.url ?? '#').trim() || '#',
                icon: b.icon || null,
                parentId: b.parentId ? Number(b.parentId) : null,
                sortOrder: Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 0,
                visible: b.visible !== false,
            },
        });
        return NextResponse.json(item, { status: 201 });
    } catch (e) {
        console.error('[POST /api/nav-items]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
