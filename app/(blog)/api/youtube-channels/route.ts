/**
 * app/(blog)/api/youtube-channels/route.ts
 * GET  -> list configured channels (admin)
 * POST -> add a channel { channelRef, label? }  (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function GET() {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const rows = await prisma.youtubeChannel.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
        return NextResponse.json(rows);
    } catch (e) {
        console.error('[GET /api/youtube-channels]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;
    try {
        const b = await req.json();
        const channelRef: string = (b.channelRef ?? '').trim();
        if (!channelRef) return NextResponse.json({ error: 'channelRef is required (a UC… id or @handle)' }, { status: 422 });
        const count = await prisma.youtubeChannel.count();
        const row = await prisma.youtubeChannel.create({
            data: { channelRef, label: (b.label ?? '').trim() || null, sortOrder: count },
        });
        return NextResponse.json(row);
    } catch (e) {
        console.error('[POST /api/youtube-channels]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
