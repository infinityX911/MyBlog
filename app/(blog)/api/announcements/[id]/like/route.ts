/**
 * POST /api/announcements/[id]/like   [logged-in]
 * Toggle the current user's like on an announcement. Returns the new state.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId } from '@/lib/rbac';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const me = userId(auth.session);
    const announcementId = Number((await params).id);
    if (!announcementId || Number.isNaN(announcementId)) {
        return NextResponse.json({ error: 'Invalid announcement.' }, { status: 400 });
    }

    const existing = await prisma.announcementLike.findUnique({
        where: { announcementId_userId: { announcementId, userId: me } },
    });

    if (existing) {
        await prisma.announcementLike.delete({ where: { announcementId_userId: { announcementId, userId: me } } });
    } else {
        // Ensure the announcement exists before liking.
        const a = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true } });
        if (!a) return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
        await prisma.announcementLike.create({ data: { announcementId, userId: me } });
    }

    const likeCount = await prisma.announcementLike.count({ where: { announcementId } });
    return NextResponse.json({ liked: !existing, likeCount });
}
