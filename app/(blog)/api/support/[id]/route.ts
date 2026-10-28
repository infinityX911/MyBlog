/**
 * app/api/support/[id]/route.ts
 *
 * GET  /api/support/[id]?guestId=&after=  → poll messages + current status.
 * POST /api/support/[id]                  → visitor sends a message.
 *     Body: { guestId, body?, connect?: boolean }
 *
 * Public, but every request must carry the matching guestId for this
 * conversation (verified) — so one visitor can't read another's chat.
 *
 * Bot behaviour (only while status = 'open'):
 *   - "connect"/human keywords OR connect:true → request a human:
 *       online admins → status 'waiting', notify admins, bot acknowledges.
 *       no admins online → bot says nobody is available right now.
 *   - any other message → a canned bot reply.
 * Once an admin accepts (status 'live') the bot stays silent.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { getSession } from '@/lib/permissions';
import { cleanMessageBody, emitToUser } from '@/lib/messaging';
import {
    CONNECT_RE, botReply, onlineAdminCount,
    addBotMessage, serializeMessages, emitToConversation, emitToAdmins, SENDER_SELECT,
} from '@/lib/support';
import { recordEvent } from '@/lib/activity';
import { deliverEmail } from '@/lib/delivery';

type Params = { params: Promise<{ id: string }> };

async function loadConvo(id: number, guestId: string) {
    if (!id || Number.isNaN(id)) return null;
    const convo = await prisma.conversation.findUnique({ where: { id } });
    if (!convo || !convo.isSupport || convo.guestId !== guestId) return null;
    return convo;
}

export async function GET(req: NextRequest, { params }: Params) {
    const id = Number((await params).id);
    const guestId = String(req.nextUrl.searchParams.get('guestId') || '');
    const after = Number(req.nextUrl.searchParams.get('after') || 0);

    const convo = await loadConvo(id, guestId);
    if (!convo) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const messages = await prisma.message.findMany({
        where: { conversationId: id, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
    });
    return NextResponse.json({ status: convo.status, messages: serializeMessages(messages) });
}

export async function POST(req: NextRequest, { params }: Params) {
    const id = Number((await params).id);

    const rl = rateLimit(`support-send:${getClientIp(req.headers)}`, 40, 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: 'Slow down.' }, { status: 429 });

    try {
        const body = await req.json();
        const guestId = String(body.guestId || '');
        const convo = await loadConvo(id, guestId);
        if (!convo) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

        // If the visitor is logged in, link them to THIS conversation as the
        // seeker participant and keep their REAL name on the thread. This is what
        // lets the admin/inbox see WHO is chatting (name, avatar, profile, role
        // badge) instead of an anonymous "Visitor" — the chat may have started
        // anonymously (bot greeting in the background) before they signed in.
        const session = await getSession();
        const meId = session?.user ? Number((session.user as any).id) : null;
        const meName = (session?.user as any)?.name || (session?.user as any)?.username || null;
        if (meId) {
            await prisma.conversationParticipant.upsert({
                where: { conversationId_userId: { conversationId: id, userId: meId } },
                update: {},
                create: { conversationId: id, userId: meId },
            });
            if (meName && convo.guestName !== meName) {
                await prisma.conversation.update({ where: { id }, data: { guestName: meName } });
                convo.guestName = meName; // keep in-memory copy current for the notifications below
            }
        }

        // Visitor ends their own chat → DISABLE it (status closed). The
        // conversation + history stay; the composer is disabled on both sides.
        if (body.end === true) {
            await addBotMessage(id, 'You ended the chat. 👋');
            await prisma.conversation.update({ where: { id }, data: { status: 'closed' } });
            emitToConversation(id, 'support-message', { conversationId: id });
            emitToAdmins('support-activity', { conversationId: id });
            const closedMsgs = await prisma.message.findMany({
                where: { conversationId: id },
                orderBy: { createdAt: 'asc' },
                select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
            });
            return NextResponse.json({ status: 'closed', messages: serializeMessages(closedMsgs) });
        }

        const text = cleanMessageBody(body.body);
        const wantsConnect = body.connect === true || (text && CONNECT_RE.test(text));

        // Store the visitor's message (if any).
        if (text) {
            const m = await prisma.message.create({
                data: { conversationId: id, senderId: null, isBot: false, body: text },
            });
            await prisma.conversation.update({ where: { id }, data: { lastMessageAt: m.createdAt } });
            emitToConversation(id, 'support-message', { conversationId: id });
            // Also push to any admin participants' personal rooms so their
            // navbar/Messages floating chat updates live (not just the inbox).
            const parts = await prisma.conversationParticipant.findMany({ where: { conversationId: id }, select: { userId: true } });
            for (const p of parts) {
                emitToUser(p.userId, 'new-message', {
                    conversationId: id,
                    message: { id: m.id, body: m.body, senderId: null, createdAt: m.createdAt },
                });
            }
            // If a human is already handling it, ping admins about the new line.
            if (convo.status === 'live' || convo.status === 'waiting') {
                emitToAdmins('support-activity', { conversationId: id });
            }
        }

        // Visitor left contact details (after a "busy" decline).
        const email = typeof body.email === 'string' ? body.email.trim().slice(0, 160) : '';
        if (email && /\S+@\S+\.\S+/.test(email)) {
            // Best-effort email to the team inbox (if SMTP is configured).
            const inbox = process.env.SUPPORT_INBOX || process.env.SMTP_USER;
            if (inbox) {
                deliverEmail(
                    inbox,
                    `New support message from ${convo.guestName || 'a visitor'}`,
                    `Email: ${email}\nConversation: #${id}\n\nMessage:\n${text || '(no message)'}`,
                ).catch(() => {});
            }
            // Surface the contact INSIDE the conversation so the admin always sees
            // it (even without email/SMTP), and raise a bell notification.
            await addBotMessage(id, `📧 Visitor left contact details — Email: ${email}${text ? `\nMessage: ${text}` : ''}`);
            await recordEvent({
                type: 'support.request',
                action: `Support contact from ${convo.guestName || 'a visitor'}`,
                description: `Email: ${email}${text ? ` — ${text}` : ''}`,
                link: `/admin/messages?c=${id}`,
                notify: 'admins',
            });
            await addBotMessage(id, "Thanks! We've saved your email and message — our team will get back to you soon. 🙏");
            // Keep status 'busy' (NOT closed) so the ticket stays visible in the
            // admin's support inbox for follow-up. The visitor's widget shows an
            // ended state because the "saved your email" note is present.
            emitToConversation(id, 'support-message', { conversationId: id });
            emitToAdmins('support-activity', { conversationId: id });

            const ticketMsgs = await prisma.message.findMany({
                where: { conversationId: id },
                orderBy: { createdAt: 'asc' },
                select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
            });
            return NextResponse.json({ status: convo.status, messages: serializeMessages(ticketMsgs) });
        }

        // Bot logic only while still in bot mode.
        if (convo.status === 'open') {
            if (wantsConnect && !meId) {
                // Reaching a human requires an account, so the agent always knows
                // who they're talking to (no anonymous "Visitor" hand-offs).
                await addBotMessage(id, 'To talk to a human, please sign up or log in first. 🙂');
            } else if (wantsConnect) {
                const online = onlineAdminCount();
                if (online > 0) {
                    await prisma.conversation.update({ where: { id }, data: { status: 'waiting' } });
                    await addBotMessage(id, "Connecting you to our team — please hold on a moment… 🙌");
                    // Notify admins (bell notification + live inbox ping).
                    await recordEvent({
                        type: 'support.request',
                        action: `New support chat from ${convo.guestName || 'a visitor'}`,
                        description: text || 'Visitor requested to connect.',
                        link: `/admin/messages?c=${id}`,
                        notify: 'admins',
                    });
                    emitToAdmins('support-request', { conversationId: id });
                } else {
                    await addBotMessage(id, "Sorry, no one is available right now. Please leave your message and we'll get back to you as soon as we can.");
                }
            } else if (text) {
                await addBotMessage(id, botReply(text));
            }
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
        });
        const fresh = await prisma.conversation.findUnique({ where: { id }, select: { status: true } });
        emitToConversation(id, 'support-message', { conversationId: id });

        return NextResponse.json({ status: fresh?.status ?? convo.status, messages: serializeMessages(messages) });
    } catch (error) {
        console.error('[POST /api/support/:id]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
