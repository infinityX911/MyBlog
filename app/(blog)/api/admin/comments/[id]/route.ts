/**
 * app/(blog)/api/admin/comments/[id]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ id: string }> };

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    try {
        const body   = await req.json();
        const status: string = body.status;

        if (!['approved', 'rejected', 'pending'].includes(status)) {
            return NextResponse.json(
                { error: 'status must be approved, rejected, or pending.' },
                { status: 422 }
            );
        }

        const existing = await prisma.comment.findUnique({
            where: { id },
            select: { userId: true },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }

        const comment = await prisma.comment.update({
            where: { id },
            data: { status },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        });

        // Live update: a comment just became approved → push it to everyone
        // viewing that post/download/CMS page so it appears without a reload.
        if (status === 'approved') {
            const io = (globalThis as any).__io;
            if (io) {
                const room = comment.cmsPageId ? `comments:cmsPage:${comment.cmsPageId}`
                    : comment.downloadId ? `comments:download:${comment.downloadId}`
                    : comment.postId ? `comments:post:${comment.postId}` : null;
                if (room) io.to(room).emit('comment:new', { room });
            }
        }

        // Auto-approval is controlled by the 'auto-approve-comments' role
        // permission now, so approving a single comment no longer flips a
        // per-user "trusted" flag. To let a user auto-approve in future, give
        // their role that permission (or assign a role that has it).

        return NextResponse.json({ success: true, comment });
    } catch (error: any) {
        console.error('[PATCH comments/:id]', error);
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    console.log('[DELETE comments/:id] Handler called');

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        console.log('[DELETE comments/:id] No session — 401');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = Number(rawId);
    console.log('[DELETE comments/:id] Comment ID:', id);

    if (Number.isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // ── Step 1: Find comment ──────────────────────────────────────────────
    let comment: { userId: number; createdAt: Date } | null = null;
    try {
        comment = await prisma.comment.findUnique({
            where: { id },
            select: { userId: true, createdAt: true },
        });
        console.log('[DELETE comments/:id] Comment found:', comment);
    } catch (err) {
        console.error('[DELETE comments/:id] Error finding comment:', err);
        return NextResponse.json({ error: 'Server error finding comment' }, { status: 500 });
    }

    if (!comment) {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // ── Step 2: Delete comment ────────────────────────────────────────────
    try {
        await prisma.comment.delete({ where: { id } });
        console.log('[DELETE comments/:id] Comment deleted successfully');
    } catch (err: any) {
        console.error('[DELETE comments/:id] Error deleting comment:', err);
        if (err?.code === 'P2025') {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Server error deleting comment' }, { status: 500 });
    }

    // ── Step 3: Delete notifications — wrapped in own try-catch ──────────
    // Even if this fails, comment is already deleted — return success.
    try {
        // Fetch all notifications, filter in JS to avoid any DB-level issues
        const allNotifs = await prisma.notification.findMany({
            select: { id: true, link: true, createdAt: true },
        });

        console.log('[DELETE comments/:id] Total notifications in DB:', allNotifs.length);
        console.log('[DELETE comments/:id] All notification links:', allNotifs.map(n => n.link));

        const WINDOW_MS   = 15 * 60 * 1000; // 15 minutes
        const commentTime = new Date(comment.createdAt).getTime();

        const toDelete = allNotifs.filter(n => {
            const link  = n.link ?? '';
            const nTime = new Date(n.createdAt).getTime();

            return (
                link.includes(`commentId=${id}`)                                    // new format
                || (link.includes('blog/comments') && Math.abs(nTime - commentTime) <= WINDOW_MS) // old format
                || link.includes(`comment-${id}`)                                   // reply format
            );
        });

        console.log('[DELETE comments/:id] Notifications to delete:', toDelete.map(n => ({ id: n.id, link: n.link })));

        if (toDelete.length > 0) {
            await prisma.notification.deleteMany({
                where: { id: { in: toDelete.map(n => n.id) } },
            });
            console.log('[DELETE comments/:id] Deleted', toDelete.length, 'notification(s)');
        } else {
            console.warn('[DELETE comments/:id] No matching notifications found');
        }
    } catch (notifErr) {
        // Log but don't fail — comment is already deleted
        console.error('[DELETE comments/:id] Notification cleanup error (non-fatal):', notifErr);
    }

    return NextResponse.json({ success: true });
}
