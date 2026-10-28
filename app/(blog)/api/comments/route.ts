/**
 * app/api/comments/route.ts
 *
 * GET  /api/comments?postId=123   → list approved comments + replies
 * POST /api/comments              → create comment/reply (login required)
 *
 * Change from previous version:
 *   notification.link now includes the comment ID:
 *     /admin/myprojects/blog/comments?commentId=${comment.id}
 *   This lets the comment DELETE handler find and clean up the exact
 *   notification row when a comment is deleted, without a schema change.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId as getUserId, userPermissions } from '@/lib/rbac';
import { logActivity } from '@/lib/activity';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { extractMentionIds } from '@/lib/mentions';

const MAX_COMMENT_LENGTH = 2000;

function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '').trim();
}

export async function GET(req: NextRequest) {
    try {
        const postId = Number(req.nextUrl.searchParams.get('postId'));
        const downloadId = Number(req.nextUrl.searchParams.get('downloadId'));
        const cmsPageId = Number(req.nextUrl.searchParams.get('cmsPageId'));
        const announcementId = Number(req.nextUrl.searchParams.get('announcementId'));
        const target = (cmsPageId && !Number.isNaN(cmsPageId))
            ? { cmsPageId }
            : (downloadId && !Number.isNaN(downloadId))
            ? { downloadId }
            : (announcementId && !Number.isNaN(announcementId))
            ? { announcementId }
            : (postId && !Number.isNaN(postId)) ? { postId } : null;
        if (!target) {
            return NextResponse.json({ error: 'A valid postId or downloadId is required.' }, { status: 422 });
        }

        const comments = await prisma.comment.findMany({
            where: { ...target, status: 'approved', parentId: null },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                replies: {
                    where: { status: 'approved' },
                    include: {
                        user: { select: { id: true, name: true, avatarUrl: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Attach reactions defensively — if the comment_reactions table hasn't
        // been migrated yet, comments still load (just without reaction counts).
        try {
            const ids = comments.flatMap((c) => [c.id, ...c.replies.map((r) => r.id)]);
            if (ids.length) {
                const reactions = await prisma.commentReaction.findMany({
                    where: { commentId: { in: ids } },
                    select: { commentId: true, userId: true, type: true },
                });
                const byComment = new Map<number, { userId: number; type: string }[]>();
                for (const r of reactions) {
                    const arr = byComment.get(r.commentId) ?? [];
                    arr.push({ userId: r.userId, type: r.type });
                    byComment.set(r.commentId, arr);
                }
                for (const c of comments) {
                    (c as any).reactions = byComment.get(c.id) ?? [];
                    for (const r of c.replies) (r as any).reactions = byComment.get(r.id) ?? [];
                }
            }
        } catch (e) {
            console.warn('[GET /api/comments] reactions unavailable (run the migration):', e);
        }

        return NextResponse.json({ comments });
    } catch (error) {
        console.error('[GET /api/comments]', error);
        return NextResponse.json({ error: 'Could not load comments.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        // Commenting now requires the 'create-comment' permission. Every user
        // gets it by default (seed + registration); an admin can revoke it
        // per-user from Management → Users to mute someone.
        const auth = await requirePermission('create-comment');
        if (auth.error) return auth.error;

        const userId = getUserId(auth.session);

        // ── Rate limit: stop comment spam (max 8 per 5 min per user+IP) ──────
        const ip = getClientIp(req.headers);
        const rl = rateLimit(`comment:${userId}:${ip}`, 8, 5 * 60 * 1000);
        if (!rl.ok) {
            return NextResponse.json(
                { error: `You're commenting too fast. Try again in ${rl.retryAfter}s.` },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
            );
        }

        const body   = await req.json();

        const postId: number       = Number(body.postId);
        const downloadId: number   = Number(body.downloadId);
        const isDownload           = !!downloadId && !Number.isNaN(downloadId);
        const cmsPageId: number    = Number(body.cmsPageId);
        const isCmsPage            = !!cmsPageId && !Number.isNaN(cmsPageId);
        const announcementId: number = Number(body.announcementId);
        const isAnnouncement       = !!announcementId && !Number.isNaN(announcementId);
        const parentId: number | null = body.parentId ? Number(body.parentId) : null;
        const content = stripHtml(typeof body.content === 'string' ? body.content : '');

        if (!isDownload && !isCmsPage && !isAnnouncement && (!postId || Number.isNaN(postId))) {
            return NextResponse.json({ error: 'A valid target is required.' }, { status: 422 });
        }
        if (!content || content.length < 2) {
            return NextResponse.json({ error: 'Comment cannot be empty.' }, { status: 422 });
        }
        if (content.length > MAX_COMMENT_LENGTH) {
            return NextResponse.json({ error: `Comments must be under ${MAX_COMMENT_LENGTH} characters.` }, { status: 422 });
        }

        // The target this comment belongs to (post / download / cms page).
        // We capture its title + public URL up front so the notification /
        // activity code below works for ALL three types (the old code assumed
        // a `post` object, which crashed for downloads and CMS pages → 500).
        const targetWhere = isCmsPage ? { cmsPageId } : isDownload ? { downloadId } : isAnnouncement ? { announcementId } : { postId };
        let targetTitle = '';
        let targetUrl = '';
        if (isAnnouncement) {
            const an = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true, title: true } });
            if (!an) return NextResponse.json({ error: 'This announcement no longer exists.' }, { status: 404 });
            targetTitle = an.title || 'Announcement'; targetUrl = `/announcements#a${an.id}`;
        } else if (isCmsPage) {
            const pg = await prisma.cmsPage.findFirst({ where: { id: cmsPageId, status: 'published' }, select: { title: true, slug: true } });
            if (!pg) return NextResponse.json({ error: 'This page no longer exists.' }, { status: 404 });
            targetTitle = pg.title; targetUrl = `/${pg.slug}`;
        } else if (isDownload) {
            const dl = await prisma.download.findFirst({ where: { id: downloadId, status: 'published' }, select: { title: true, slug: true } });
            if (!dl) return NextResponse.json({ error: 'This download no longer exists.' }, { status: 404 });
            targetTitle = dl.title; targetUrl = `/downloads/${dl.slug}`;
        } else {
            const post = await prisma.post.findFirst({
                where: { id: postId, status: 'published' },
                select: {
                    title: true, slug: true,
                    primaryCategory: { select: { slug: true } },
                    categories: { take: 1, select: { category: { select: { slug: true } } } },
                },
            });
            if (!post) return NextResponse.json({ error: 'This post no longer exists.' }, { status: 404 });
            const cat = (post as any).primaryCategory?.slug || (post as any).categories?.[0]?.category?.slug || 'uncategorized';
            targetTitle = post.title; targetUrl = `/${cat}/${post.slug}`;
        }

        let parent: { id: number; userId: number } | null = null;
        if (parentId) {
            // Match the parent within the SAME target (not just postId — that
            // broke replies on downloads and CMS pages).
            parent = await prisma.comment.findFirst({
                where: { id: parentId, ...targetWhere },
                select: { id: true, userId: true },
            });
            if (!parent) {
                return NextResponse.json({ error: 'Invalid reply target.' }, { status: 422 });
            }
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, avatarUrl: true },
        });
        if (!user) {
            return NextResponse.json({ error: 'Your account could not be found.' }, { status: 404 });
        }

        // Auto-approve is now a ROLE permission: a user whose role grants
        // 'auto-approve-comments' posts straight to approved; everyone else's
        // comments go to pending for moderation.
        const status = userPermissions(auth.session).includes('auto-approve-comments') ? 'approved' : 'pending';

        const comment = await prisma.comment.create({
            data: { postId: (isDownload || isCmsPage || isAnnouncement) ? null : postId, downloadId: isDownload ? downloadId : null, cmsPageId: isCmsPage ? cmsPageId : null, announcementId: isAnnouncement ? announcementId : null, userId, parentId, content, status },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        // ── Broadcast notification (visible to anyone with view-admin-notifications)
        // Link includes the comment ID so the DELETE handler can find this exact
        // notification row when the comment is deleted later.
        const notification = await prisma.notification.create({
            data: {
                type: 'comment',
                message: `${user.name} ${parentId ? 'replied to a comment' : 'left a comment'} on "${targetTitle}"${status === 'pending' ? ' (needs approval)' : ''}.`,
                link: `/admin/myprojects/blog/comments?commentId=${comment.id}`,
                actorUserId: userId,
                // userId: null → broadcast (visible to admin-feed permission holders)
            },
        });

        // ── Direct notification to parent comment author on replies
        if (parent && parent.userId !== userId) {
            await prisma.notification.create({
                data: {
                    type: 'comment_reply',
                    userId: parent.userId,
                    message: `${user.name} replied to your comment on "${targetTitle}".`,
                    link: `${targetUrl}#comment-${comment.id}`,
                    actorUserId: userId,
                },
            });
        }

        // ── Real-time push to admin Socket.io room
        const io = (globalThis as any).__io;
        if (io) {
            io.to('admins').emit('new-notification', {
                id: notification.id,
                type: notification.type,
                message: notification.message,
                link: notification.link,
                createdAt: notification.createdAt,
                actorAvatarUrl: user.avatarUrl ?? null,
                actorName: user.name,
            });
            // Live comment feed: only approved comments are public, so only
            // those are broadcast to everyone viewing this target.
            if (status === 'approved') {
                const room = `comments:${isCmsPage ? 'cmsPage' : isDownload ? 'download' : 'post'}:${isCmsPage ? cmsPageId : isDownload ? downloadId : postId}`;
                io.to(room).emit('comment:new', { room });
            }
        }

        // ── @mentions → notify each mentioned user (approved comments only, so
        //    nobody gets pinged for a comment that never becomes visible).
        if (status === 'approved') {
            const mentionIds = extractMentionIds(content).filter((mid) => mid && mid !== userId && mid !== parent?.userId);
            for (const mid of mentionIds) {
                try {
                    const notif = await prisma.notification.create({
                        data: {
                            type: 'mention',
                            userId: mid,
                            message: `${user.name} mentioned you in a comment on "${targetTitle}".`,
                            link: `${targetUrl}#comment-${comment.id}`,
                            actorUserId: userId,
                        },
                    });
                    if (io) io.to(`user:${mid}`).emit('new-notification', {
                        id: notif.id, type: notif.type, message: notif.message, link: notif.link,
                        createdAt: notif.createdAt, actorAvatarUrl: user.avatarUrl ?? null, actorName: user.name,
                    });
                } catch { /* one bad id shouldn't fail the whole comment */ }
            }
        }

        // Audit trail (notification already raised above, so audit-only here).
        await logActivity({
            type: 'comment.create',
            action: `${user.name} ${parentId ? 'replied to a comment' : 'left a comment'}`,
            description: `On "${targetTitle}"${status === 'pending' ? ' (pending approval)' : ''}.`,
            link: `/admin/myprojects/blog/comments?commentId=${comment.id}`,
            actorUserId: userId,
        });

        return NextResponse.json({ success: true, comment }, { status: 201 });
    } catch (error) {
        console.error('[POST /api/comments]', error);
        return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
}
