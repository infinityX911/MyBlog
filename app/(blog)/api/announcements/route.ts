/**
 * /api/announcements
 *   GET  → list announcements (public, when the feature is enabled) + like/comment counts
 *   POST → create an announcement   [manage-announcements]
 *
 * Body is stored as plain text and rendered as text on the client (React escapes
 * it), so there's no XSS surface. Members like via /api/announcements/[id]/like
 * and comment via the shared /api/comments endpoint (announcementId).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { getSession } from '@/lib/permissions';
import { recordEvent } from '@/lib/activity';
import { pingIndexNow } from '@/lib/indexnow';

export async function GET() {
    const setting = await prisma.siteSetting.findUnique({
        where: { siteKey: 'blog' }, select: { announcementsEnabled: true },
    });
    if (!setting?.announcementsEnabled) {
        return NextResponse.json({ error: 'Announcements are disabled.' }, { status: 404 });
    }

    const session = await getSession();
    const me = session?.user ? Number((session.user as any).id) : 0;

    const rows = await prisma.announcement.findMany({
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        include: {
            author: { select: { id: true, name: true, username: true, avatarUrl: true } },
            _count: { select: { likes: true, comments: { where: { status: 'approved' } } } },
            likes: me ? { where: { userId: me }, select: { id: true } } : false,
        },
    });

    const items = rows.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        image: a.image,
        pinned: a.pinned,
        createdAt: a.createdAt,
        author: a.author,
        likeCount: a._count.likes,
        commentCount: a._count.comments,
        likedByMe: Array.isArray(a.likes) ? a.likes.length > 0 : false,
    }));

    return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
    const auth = await requirePermission('manage-announcements');
    if (auth.error) return auth.error;
    const me = userId(auth.session);

    const body = await req.json().catch(() => ({}));
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 160) : '';
    const image = typeof body.image === 'string' ? body.image.trim() : '';
    if (!text) return NextResponse.json({ error: 'Announcement text is required.' }, { status: 422 });
    if (text.length > 5000) return NextResponse.json({ error: 'Announcement is too long (max 5000 chars).' }, { status: 422 });

    const a = await prisma.announcement.create({
        data: { body: text, title: title || null, image: image || null, pinned: !!body.pinned, authorId: me },
    });

    await recordEvent({
        type: 'announcement.create',
        action: `${(auth.session.user as any)?.name ?? 'Admin'} posted an announcement`,
        description: title || text.slice(0, 80),
        link: `/announcements#a${a.id}`,
        actorUserId: me,
    }).catch(() => {});

    // /announcements is a public, sitemapped page — its content just changed.
    void pingIndexNow(['/announcements', '/sitemap.xml']);

    return NextResponse.json({ id: a.id }, { status: 201 });
}
