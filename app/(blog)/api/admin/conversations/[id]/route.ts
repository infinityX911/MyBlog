/**
 * GET /api/admin/conversations/[id]   [oversee-messages]
 *
 * Read-only full transcript of one conversation for admin oversight. Returns
 * every message with the sender's name/avatar so an admin can see exactly who
 * said what to whom. No write operations are exposed here.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { recordEvent } from '@/lib/activity';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('oversee-messages');
    if (auth.error) return auth.error;

    const id = Number((await params).id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

    const convo = await prisma.conversation.findUnique({
        where: { id },
        include: {
            participants: { include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } } },
        },
    });
    if (!convo) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

    const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
        take: 1000,
        include: { sender: { select: { id: true, name: true, username: true, avatarUrl: true } } },
    });

    return NextResponse.json({
        id: convo.id,
        isSupport: convo.isSupport,
        status: convo.status,
        guestName: convo.guestName,
        participants: convo.participants
            .filter((p) => p.user)
            .map((p) => ({ id: p.user!.id, name: p.user!.name, username: p.user!.username, avatarUrl: p.user!.avatarUrl })),
        messages: messages.map((m) => ({
            id: m.id,
            body: m.body,
            isBot: m.isBot,
            createdAt: m.createdAt,
            sender: m.sender
                ? { id: m.sender.id, name: m.sender.name, username: m.sender.username, avatarUrl: m.sender.avatarUrl }
                : null,
        })),
    });
}

/**
 * DELETE /api/admin/conversations/[id]           -> delete the whole conversation
 * DELETE /api/admin/conversations/[id]?clear=1   -> clear messages, keep the shell
 * Admin moderation; gated by 'oversee-messages'; every deletion is audited.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requirePermission('oversee-messages');
    if (auth.error) return auth.error;
    const me = userId(auth.session);

    const id = Number((await params).id);
    if (!id || Number.isNaN(id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });

    const clear = new URL(req.url).searchParams.get('clear') === '1';
    try {
        if (clear) {
            await prisma.message.deleteMany({ where: { conversationId: id } });
            await prisma.conversation.update({ where: { id }, data: { lastMessageAt: null } }).catch(() => {});
        } else {
            await prisma.conversation.delete({ where: { id } });
        }
    } catch {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    await recordEvent({
        type: clear ? 'conversation.clear' : 'conversation.delete',
        action: `${(auth.session.user as any)?.name ?? 'Admin'} ${clear ? 'cleared' : 'deleted'} a conversation (oversight)`,
        description: `Conversation #${id} was ${clear ? 'cleared of all messages' : 'permanently deleted'} from Message Oversight.`,
        actorUserId: me,
    }).catch(() => {});

    return NextResponse.json({ ok: true, cleared: clear });
}
