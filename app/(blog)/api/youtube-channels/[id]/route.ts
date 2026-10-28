/**
 * app/(blog)/api/youtube-channels/[id]/route.ts
 * DELETE -> remove a channel (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    const { id } = await ctx.params;
    const n = Number(id);
    if (!Number.isInteger(n)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
    try {
        await prisma.youtubeChannel.delete({ where: { id: n } });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        console.error('[DELETE /api/youtube-channels/:id]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
