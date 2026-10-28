/**
 * app/api/admin/support/route.ts
 *
 * GET /api/admin/support  → list active visitor support chats (waiting + live)
 * for the support inbox. Requires the 'manage-support' permission.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, userId } from '@/lib/rbac';
import { SUPPORT_STAFF_SLUGS } from '@/lib/support';

// Gate on manage-support, but also accept view-admin-notifications so existing
// admins work even before the manage-support permission is (re)seeded.
const SUPPORT_PERMS = ['manage-support', 'view-admin-notifications'];

export async function GET() {
    const auth = await requireAnyPermission(SUPPORT_PERMS);
    if (auth.error) return auth.error;
    const meId = userId(auth.session);

    try {
        const rows = await prisma.conversation.findMany({
            // Include 'closed' too so the admin keeps the full record of a user's
            // past support chats (even after the user ended them).
            where: { isSupport: true, status: { in: ['waiting', 'live', 'busy', 'closed'] } },
            orderBy: { lastMessageAt: 'desc' },
            take: 100,
            include: {
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
                // The seeker = the NON-staff participant (matched by permission,
                // not join-order). The staff-probe fetches at most one matching
                // permission row just to flag who is an agent.
                participants: {
                    orderBy: { createdAt: 'asc' },
                    include: { user: { select: {
                        id: true, name: true, username: true, avatarUrl: true,
                        permissions: { where: { permission: { slug: { in: SUPPORT_STAFF_SLUGS } } }, select: { permissionId: true }, take: 1 },
                    } } },
                },
            },
        });

        const conversations = rows.filter(c => {
            // If this admin soft-deleted the chat from their view, hide it
            // (unless a newer message has since arrived).
            const mine = c.participants.find(p => p.userId === meId);
            return !(mine?.hiddenAt && (!c.lastMessageAt || c.lastMessageAt <= mine.hiddenAt));
        }).map(c => {
            const seekerPart = c.participants.find(p => p.user && p.user.permissions.length === 0) ?? c.participants[0];
            const seeker = seekerPart?.user;
            return {
                id: c.id,
                guestName: seeker?.name || seeker?.username || c.guestName || 'Visitor',
                avatarUrl: seeker?.avatarUrl || null,
                userId: seeker?.id ?? null,
                status: c.status,
                lastMessage: c.messages[0]?.body ?? null,
                lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
            };
        });

        return NextResponse.json({ conversations });
    } catch (error) {
        console.error('[GET /api/admin/support]', error);
        return NextResponse.json({ error: 'Could not load support chats.' }, { status: 500 });
    }
}
