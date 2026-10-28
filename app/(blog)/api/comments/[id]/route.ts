/**
 * app/(blog)/api/comments/[id]/route.ts
 *
 * DELETE /api/comments/:id
 *   - The comment's OWNER can always delete their own comment.
 *   - Anyone whose role has the `delete-comments` permission (or the broader
 *     `access-admin-panel`) can delete ANY comment (moderation).
 *   Replies cascade-delete via the schema relation.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId, userPermissions } from '@/lib/rbac';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await ctx.params;
    const cid = Number(id);
    if (!Number.isInteger(cid)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

    const c = await prisma.comment.findUnique({ where: { id: cid }, select: { userId: true } });
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = c.userId === userId(auth.session);
    const perms = userPermissions(auth.session);
    const canModerate = perms.includes('delete-comments') || perms.includes('access-admin-panel');
    if (!isOwner && !canModerate) {
        return NextResponse.json({ error: 'You cannot delete this comment.' }, { status: 403 });
    }

    try {
        await prisma.comment.delete({ where: { id: cid } });
        return NextResponse.json({ success: true });
    } catch (e: any) {
        if (e?.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 });
        console.error('[DELETE /api/comments/:id]', e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
