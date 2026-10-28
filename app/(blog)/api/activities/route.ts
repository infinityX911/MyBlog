/**
 * app/(blog)/api/activities/route.ts
 *
 * GET    /api/activities       → recent activity feed (dashboard "Recent Activities")
 * DELETE /api/activities       → clear the feed (requires 'manage-activities')
 *
 * Visibility:
 *   - A user with 'view-activities' sees the GLOBAL feed (everyone's actions).
 *   - Everyone else sees only their own activity (audit of their own account).
 *
 * This is the read side of lib/activity.ts → recordEvent(), which writes the
 * rows from every action across the app.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requirePermission, userId, userPermissions } from '@/lib/rbac';

// Either of these grants the GLOBAL activity feed. We accept the existing
// admin-notification permission too so current admins see the feed
// immediately (before re-seeding adds the dedicated 'view-activities').
const VIEW_ALL = ['view-activities', 'view-admin-notifications'];

export async function GET(req: NextRequest) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const perms = userPermissions(auth.session);
    const canViewAll = VIEW_ALL.some((p) => perms.includes(p));

    const take = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 20, 100);

    try {
        const activities = await prisma.activity.findMany({
            where: canViewAll ? {} : { OR: [{ userId: me }, { actorUserId: me }] },
            include: {
                actor: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take,
        });

        return NextResponse.json({
            activities: activities.map((a) => ({
                id: a.id,
                type: a.type,
                action: a.action,
                description: a.description,
                link: a.link,
                createdAt: a.createdAt,
                actorName: a.actor?.name ?? null,
                actorAvatarUrl: a.actor?.avatarUrl ?? null,
            })),
        });
    } catch (err) {
        console.error('[GET /api/activities]', err);
        return NextResponse.json({ error: 'Could not load activities.' }, { status: 500 });
    }
}

export async function DELETE() {
    const auth = await requirePermission('manage-activities');
    if (auth.error) return auth.error;

    try {
        await prisma.activity.deleteMany({});
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[DELETE /api/activities]', err);
        return NextResponse.json({ error: 'Could not clear activities.' }, { status: 500 });
    }
}
