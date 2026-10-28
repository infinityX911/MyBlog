/**
 * app/(blog)/api/comments/[id]/react/route.ts
 *
 * POST /api/comments/[id]/react   { type: "like" | "heart" }
 *
 * Toggles the current user's reaction on a comment (login required).
 * Returns updated counts + which reactions the caller now has. Notifies the
 * comment author (not on self-reaction) and logs an activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

type Params = { params: Promise<{ id: string }> };
const TYPES = ['like', 'heart'];

export async function POST(req: NextRequest, { params }: Params) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const { id: rawId } = await params;
    const commentId = Number(rawId);
    if (!commentId || Number.isNaN(commentId)) {
        return NextResponse.json({ error: 'Invalid comment id.' }, { status: 422 });
    }

    try {
        const body = await req.json();
        const type = String(body.type ?? '').toLowerCase();
        if (!TYPES.includes(type)) {
            return NextResponse.json({ error: 'Reaction type must be "like" or "heart".' }, { status: 422 });
        }

        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            select: { id: true, userId: true, postId: true },
        });
        if (!comment) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 });

        // Toggle
        const existing = await prisma.commentReaction.findUnique({
            where: { commentId_userId_type: { commentId, userId: me, type } },
        });

        let added: boolean;
        if (existing) {
            await prisma.commentReaction.delete({ where: { id: existing.id } });
            added = false;
        } else {
            await prisma.commentReaction.create({ data: { commentId, userId: me, type } });
            added = true;

            // Notify the comment author (not on self-reaction).
            if (comment.userId !== me) {
                const actor = await prisma.user.findUnique({ where: { id: me }, select: { name: true } });
                const post = await prisma.post.findUnique({ where: { id: comment.postId }, select: { slug: true } });
                await recordEvent({
                    type: 'comment.reaction',
                    action: `${actor?.name ?? 'Someone'} ${type === 'heart' ? 'loved' : 'liked'} a comment`,
                    link: post ? `/posts/${post.slug}#comment-${commentId}` : undefined,
                    actorUserId: me,
                    subjectUserId: comment.userId,
                    notify: comment.userId, // direct notification to the comment author
                });
            }
        }

        // Fresh counts + caller's reactions
        const reactions = await prisma.commentReaction.findMany({
            where: { commentId },
            select: { userId: true, type: true },
        });
        const counts = { like: 0, heart: 0 } as Record<string, number>;
        const mine = { like: false, heart: false } as Record<string, boolean>;
        for (const r of reactions) {
            counts[r.type] = (counts[r.type] ?? 0) + 1;
            if (r.userId === me) mine[r.type] = true;
        }

        return NextResponse.json({ success: true, added, counts, mine });
    } catch (err) {
        console.error('[POST /api/comments/:id/react]', err);
        return NextResponse.json({ error: 'Could not save reaction.' }, { status: 500 });
    }
}
