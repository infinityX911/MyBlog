/**
 * GET /api/admin/conversations   [oversee-messages]
 *
 * Read-only oversight of ALL user conversations for admins. Lists every
 * conversation (peer DMs + support chats) with its participants, the last
 * message preview, and a message count. The full thread is fetched from
 * /api/admin/conversations/[id]. This endpoint never mutates anything.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

export async function GET() {
    const auth = await requirePermission('oversee-messages');
    if (auth.error) return auth.error;

    const rows = await prisma.conversation.findMany({
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        take: 200,
        include: {
            participants: {
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
            },
            _count: { select: { messages: true } },
            messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, isBot: true, createdAt: true } },
        },
    });

    const items = rows.map((c) => ({
        id: c.id,
        isSupport: c.isSupport,
        status: c.status,
        guestName: c.guestName,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
        messageCount: c._count.messages,
        lastMessage: c.messages[0]
            ? { body: c.messages[0].body.slice(0, 120), isBot: c.messages[0].isBot, createdAt: c.messages[0].createdAt }
            : null,
        participants: c.participants
            .filter((p) => p.user)
            .map((p) => ({ id: p.user!.id, name: p.user!.name, username: p.user!.username, avatarUrl: p.user!.avatarUrl })),
    }));

    return NextResponse.json({ items });
}

/**
 * DELETE /api/admin/conversations   [oversee-messages]
 * Bulk-delete conversations. Body: { ids: number[] }. Cascade removes their
 * messages + participants. Audited.
 */
export async function DELETE(req: NextRequest) {
    const auth = await requirePermission('oversee-messages');
    if (auth.error) return auth.error;
    const me = userId(auth.session);

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids)
        ? [...new Set(body.ids.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0))]
        : [];
    if (ids.length === 0) return NextResponse.json({ error: 'No conversations selected.' }, { status: 400 });

    const result = await prisma.conversation.deleteMany({ where: { id: { in: ids } } });

    await recordEvent({
        type: 'conversation.delete',
        action: `${(auth.session.user as any)?.name ?? 'Admin'} deleted ${result.count} conversation(s) (oversight)`,
        description: `Bulk-deleted conversations from Message Oversight: #${ids.join(', #')}.`,
        actorUserId: me,
    }).catch(() => {});

    return NextResponse.json({ ok: true, deleted: result.count });
}
