/**
 * app/api/notifications/[id]/route.ts
 *
 * DELETE /api/notifications/[id]
 *
 * Deletes a notification. The caller must be able to SEE the notification
 * (own it OR hold view-admin-notifications) — same visibility rule as the
 * GET/PATCH in /api/notifications/route.ts. Prevents any logged-in user
 * from deleting notifications that don't belong to them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, userId, userPermissions } from '@/lib/rbac';

const ADMIN_FEED_PERMISSION = 'view-admin-notifications';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid ID.' }, { status: 400 });
    }

    const me = userId(auth.session);
    const canSeeAdminFeed = userPermissions(auth.session).includes(ADMIN_FEED_PERMISSION);

    // Build the same visibility filter used in GET/PATCH
    const visibilityWhere = canSeeAdminFeed
        ? { OR: [{ userId: null }, { userId: me }] }
        : { userId: me };

    try {
        // Verify the notification is actually visible to this user before deleting
        const notif = await prisma.notification.findFirst({
            where: { id, ...visibilityWhere },
        });

        if (!notif) {
            return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
        }

        await prisma.notification.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[DELETE /api/notifications/:id]', error);
        if (error?.code === 'P2025') {
            return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
