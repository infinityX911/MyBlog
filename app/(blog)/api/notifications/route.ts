/**
 * app/api/notifications/route.ts
 *
 * GET   /api/notifications  → list notifications visible to the caller
 * PATCH /api/notifications  → mark one (or all visible) as read
 *
 * Visibility rule (this is the actual "admin notification permission"
 * you asked for):
 *   - Every notification row either targets a specific user (userId set —
 *     e.g. "X replied to your comment") or is a broadcast (userId: null —
 *     e.g. "new comment needs approval", "new contact message").
 *   - A user ALWAYS sees their own (userId = them).
 *   - A user additionally sees broadcast notifications ONLY if they hold
 *     the 'view-admin-notifications' permission. Granted to Administrator
 *     by seed.ts by default; assignable to any other role/user from the
 *     Roles/Users admin pages.
 *
 * This single endpoint serves both the admin panel and the public site —
 * there's nothing admin-specific about the path itself, the response is
 * just scoped differently per caller. /api/admin/notifications still
 * exists as a thin alias for backward compatibility with the existing
 * admin hook/context.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId, userPermissions } from '@/lib/rbac';

const ADMIN_FEED_PERMISSION = 'view-admin-notifications';

function visibilityWhere(me: number, canSeeAdminFeed: boolean) {
    const base = canSeeAdminFeed ? { OR: [{ userId: null }, { userId: me }] } : { userId: me };
    // You're never notified about your OWN actions (e.g. publishing your own
    // post) — hide any notification whose actor is you.
    return { AND: [base, { NOT: { actorUserId: me } }] };
}

export async function GET() {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const canSeeAdminFeed = userPermissions(auth.session).includes(ADMIN_FEED_PERMISSION);
    const where = visibilityWhere(me, canSeeAdminFeed);

    try {
        const [notifications, unreadCount] = await Promise.all([
            prisma.notification.findMany({
                where,
                // Include the actor so the UI can show a real name/avatar
                // instead of a generic placeholder — the Socket.io push in
                // /api/comments already sends this for live notifications,
                // this just makes the initial REST fetch match.
                include: { actor: { select: { name: true, avatarUrl: true } } },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.notification.count({ where: { ...where, read: false } }),
        ]);

        return NextResponse.json({ notifications, unreadCount });
    } catch (error) {
        console.error('[GET /api/notifications]', error);
        return NextResponse.json({ error: 'Could not load notifications.' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const canSeeAdminFeed = userPermissions(auth.session).includes(ADMIN_FEED_PERMISSION);
    const where = visibilityWhere(me, canSeeAdminFeed);

    try {
        const body = await req.json();

        if (body.markAll) {
            // read defaults to true (mark all read); pass read:false to mark all unread.
            const setRead = body.read !== false;
            await prisma.notification.updateMany({
                where,
                data: { read: setRead },
            });
            return NextResponse.json({ success: true });
        }

        const notificationId = Number(body.notificationId);
        if (!notificationId || Number.isNaN(notificationId)) {
            return NextResponse.json({ error: 'A valid notificationId is required.' }, { status: 422 });
        }

        // Confirm this notification is actually visible to the caller
        // before marking it read — otherwise any logged-in user could
        // mark/probe arbitrary notification IDs belonging to someone else.
        const notif = await prisma.notification.findFirst({ where: { id: notificationId, ...where } });
        if (!notif) {
            return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
        }

        await prisma.notification.update({
            where: { id: notificationId },
            data: { read: true },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PATCH /api/notifications]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}

// ── DELETE — remove one (?id=) or ALL notifications visible to the caller ────────
export async function DELETE(req: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const canSeeAdminFeed = userPermissions(auth.session).includes(ADMIN_FEED_PERMISSION);
    const where = visibilityWhere(me, canSeeAdminFeed);

    try {
        const id = Number(req.nextUrl.searchParams.get('id') || 0);
        if (id) {
            // Single delete — only if it's actually visible to this caller.
            const notif = await prisma.notification.findFirst({ where: { id, ...where }, select: { id: true } });
            if (!notif) return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
            await prisma.notification.delete({ where: { id } });
            return NextResponse.json({ success: true });
        }
        await prisma.notification.deleteMany({ where });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[DELETE /api/notifications]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
