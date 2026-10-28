/**
 * app/api/admin/support/[id]/route.ts
 *
 * GET  /api/admin/support/[id]            → full thread for the support inbox.
 * POST /api/admin/support/[id]            → accept and/or reply.
 *     Body: { accept?: boolean, body?: string }
 *     - accept: become a participant + set status 'live' (handoff from bot).
 *     - body  : send an agent reply (delivered to the visitor live).
 *
 * Requires 'manage-support'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyPermission, userId } from '@/lib/rbac';
import { isSameOrigin } from '@/lib/csrf';
import { cleanMessageBody, emitToUser } from '@/lib/messaging';
import { serializeMessages, addBotMessage, emitToConversation, emitToAdmins, SENDER_SELECT, SUPPORT_STAFF_SLUGS } from '@/lib/support';

const SUPPORT_PERMS = ['manage-support', 'view-admin-notifications'];
type Params = { params: Promise<{ id: string }> };

async function loadSupport(id: number) {
    if (!id || Number.isNaN(id)) return null;
    const c = await prisma.conversation.findUnique({ where: { id } });
    return c && c.isSupport ? c : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requireAnyPermission(SUPPORT_PERMS);
    if (auth.error) return auth.error;

    const id = Number((await params).id);
    const convo = await loadSupport(id);
    if (!convo) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const [messages, parts] = await Promise.all([
        prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
        }),
        // All participants + a staff-probe, so the seeker = the NON-staff one
        // (matched by permission, not join-order) — keeps this in sync with the
        // inbox list and the floating chat window.
        prisma.conversationParticipant.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: {
                id: true, name: true, username: true, avatarUrl: true,
                roles: { select: { role: { select: { name: true } } }, take: 1 },
                permissions: { where: { permission: { slug: { in: SUPPORT_STAFF_SLUGS } } }, select: { permissionId: true }, take: 1 },
            } } },
        }),
    ]);
    const seekerPart = parts.find(p => p.user && p.user.permissions.length === 0) ?? parts[0];
    const seeker = seekerPart?.user;
    return NextResponse.json({
        id,
        guestName: seeker?.name || seeker?.username || convo.guestName || 'Visitor',
        avatarUrl: seeker?.avatarUrl || null,
        userId: seeker?.id ?? null,
        role: seeker?.roles?.[0]?.role?.name ?? null,
        status: convo.status,
        messages: serializeMessages(messages),
    });
}

export async function POST(req: NextRequest, { params }: Params) {
    if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });

    const auth = await requireAnyPermission(SUPPORT_PERMS);
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const meName = (auth.session.user as any)?.name || 'Support';
    const id = Number((await params).id);
    const convo = await loadSupport(id);
    if (!convo) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    try {
        const body = await req.json();

        // Accept / take over the chat (bot → human handoff).
        if (body.accept === true) {
            await prisma.conversationParticipant.upsert({
                where: { conversationId_userId: { conversationId: id, userId: me } },
                update: {},
                create: { conversationId: id, userId: me },
            });
            if (convo.status !== 'live') {
                await prisma.conversation.update({ where: { id }, data: { status: 'live' } });
                // Visitor sees who joined (name + "Support" tag is fine).
                await addBotMessage(id, `${meName} (Support) has joined the chat. 👋`);
            }
            emitToConversation(id, 'support-message', { conversationId: id });
        }

        // Decline / "team is busy" → ask the visitor to leave an email + message.
        if (body.decline === true) {
            // Add me as a participant so the conversation still shows up in my
            // message list (navbar + Messages page) and stays deletable.
            await prisma.conversationParticipant.upsert({
                where: { conversationId_userId: { conversationId: id, userId: me } },
                update: {},
                create: { conversationId: id, userId: me },
            });
            await prisma.conversation.update({ where: { id }, data: { status: 'busy' } });
            await addBotMessage(id, "Sorry, our team is busy right now. Please leave your email and a short message below and we'll get back to you as soon as possible.");
            emitToConversation(id, 'support-message', { conversationId: id });
        }

        // Leave the chat. The admin chooses what happens next:
        //   transfer === true → hand the visitor to ANOTHER admin (re-queue +
        //                        notify the admins room).
        //   otherwise         → hand back to the BOT, which offers more help.
        if (body.leave === true) {
            await addBotMessage(id, `${meName} (Support) has left the chat.`);
            await prisma.conversationParticipant.deleteMany({ where: { conversationId: id, userId: me } });

            if (body.transfer === true) {
                await prisma.conversation.update({ where: { id }, data: { status: 'waiting' } });
                await addBotMessage(id, 'Connecting you to another team member — please hold on a moment… 🙌');
                emitToConversation(id, 'support-message', { conversationId: id });
                // Re-notify so other online admins get a fresh request flash.
                emitToAdmins('support-request', { conversationId: id });
            } else {
                await prisma.conversation.update({ where: { id }, data: { status: 'open' } });
                await addBotMessage(id, 'Is there anything else I can help you with? 🙂');
                emitToConversation(id, 'support-message', { conversationId: id });
                emitToAdmins('support-activity', { conversationId: id });
            }
        }

        // End the chat entirely → close it (composer disabled on both sides).
        if (body.end === true) {
            await addBotMessage(id, 'This chat has been closed by support. Thanks for reaching out! 🙏');
            await prisma.conversation.update({ where: { id }, data: { status: 'closed' } });
            emitToConversation(id, 'support-message', { conversationId: id });
            emitToAdmins('support-activity', { conversationId: id });
        }

        // Agent reply.
        const text = cleanMessageBody(body.body);
        if (text) {
            const m = await prisma.message.create({
                data: { conversationId: id, senderId: me, isBot: false, body: text },
            });
            await prisma.conversation.update({ where: { id }, data: { lastMessageAt: m.createdAt } });
            emitToConversation(id, 'support-message', { conversationId: id });
            // Ping the admins room too so every admin surface (inbox centre panel +
            // navbar dropdown) reloads with this outgoing reply.
            emitToAdmins('support-activity', { conversationId: id });
            // Also push to participants' personal rooms so the floating chatbox
            // (MessagingContext) stays in sync with the full Messages page.
            const parts = await prisma.conversationParticipant.findMany({ where: { conversationId: id }, select: { userId: true } });
            for (const p of parts) {
                emitToUser(p.userId, 'new-message', {
                    conversationId: id,
                    message: { id: m.id, body: m.body, senderId: me, createdAt: m.createdAt },
                });
            }
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
        });
        const fresh = await prisma.conversation.findUnique({ where: { id }, select: { status: true } });
        return NextResponse.json({ status: fresh?.status, messages: serializeMessages(messages) });
    } catch (error) {
        console.error('[POST /api/admin/support/:id]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
