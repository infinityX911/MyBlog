/**
 * GET /api/members   [view-members, + Members page must be enabled]
 *
 * Public members directory data — basic profile info for the /members grid.
 * Gated by the 'view-members' permission (remove it from a role/user to block
 * them) and the admin "Members page" feature toggle.
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';

export async function GET() {
    // Feature toggle — if the admin hasn't enabled the Members page, 404 it.
    const setting = await prisma.siteSetting.findUnique({
        where: { siteKey: 'blog' }, select: { membersEnabled: true },
    });
    if (!setting?.membersEnabled) {
        return NextResponse.json({ error: 'Members page is disabled.' }, { status: 404 });
    }

    const auth = await requirePermission('view-members');
    if (auth.error) return auth.error;

    const users = await prisma.user.findMany({
        where: { status: 'approved' },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true, name: true, username: true, avatarUrl: true, bio: true, createdAt: true,
            roles: { select: { role: { select: { name: true } } } },
        },
    });

    const members = users.map(u => ({
        id: u.id,
        name: u.name,
        username: u.username,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        role: u.roles[0]?.role?.name ?? 'Member',
    }));

    return NextResponse.json({ total: members.length, members });
}
