/**
 * app/api/support/route.ts
 *
 * POST /api/support  → start (or resume) a support chat.
 *   Body: { guestId: string }
 *   - The bot works for ANYONE (anonymous visitors included).
 *   - If the visitor is logged in, the conversation is linked to their user
 *     (added as a participant) so the admin sees who they are and the chat
 *     shows in the user's inbox. Login is only enforced later, when the
 *     visitor asks to talk to a human (handled in /api/support/[id]).
 *   Returns: { conversationId, status, messages }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { getSession } from '@/lib/permissions';
import { botGreeting, serializeMessages, SENDER_SELECT } from '@/lib/support';

export async function POST(req: NextRequest) {
    const rl = rateLimit(`support-start:${getClientIp(req.headers)}`, 20, 10 * 60 * 1000);
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

    // Optional auth — bot works anonymously; we link the user if logged in.
    const session = await getSession();
    const meId = session?.user ? Number((session.user as any).id) : null;
    const meName = (session?.user as any)?.name || null;

    try {
        const body = await req.json();
        const guestId = String(body.guestId || '').slice(0, 64);
        if (!guestId || guestId.length < 8) {
            return NextResponse.json({ error: 'A valid guestId is required.' }, { status: 422 });
        }
        // `fresh` is sent when the visitor clicks "Start a new chat" after the
        // thread was ended — it REOPENS the same persistent thread (history kept).
        const fresh = body.fresh === true;

        // ONE persistent support thread per user/guest. It is NEVER deleted on the
        // server, so the admin always keeps the full record (and which admins the
        // user spoke to). On reconnect we resume this same thread and continue.
        let convo = meId
            ? await prisma.conversation.findFirst({
                where: { isSupport: true, participants: { some: { userId: meId } } },
                orderBy: { createdAt: 'desc' },
            })
            : await prisma.conversation.findFirst({
                where: { isSupport: true, guestId },
                orderBy: { createdAt: 'desc' },
            });

        if (!convo) {
            // First time ever → create the thread with a greeting.
            convo = await prisma.conversation.create({
                data: {
                    isSupport: true,
                    guestId: guestId || null,
                    guestName: meName || 'Visitor',
                    status: 'open',
                    lastMessageAt: new Date(),
                    ...(meId ? { participants: { create: [{ userId: meId }] } } : {}),
                },
            });
            await prisma.message.create({
                data: { conversationId: convo.id, senderId: null, isBot: true, body: botGreeting() },
            });
        } else {
            if (meId) {
                // Keep the logged-in user linked + name current.
                await prisma.conversationParticipant.upsert({
                    where: { conversationId_userId: { conversationId: convo.id, userId: meId } },
                    update: {},
                    create: { conversationId: convo.id, userId: meId },
                });
                await prisma.conversation.update({ where: { id: convo.id }, data: { guestName: meName || convo.guestName, guestId: guestId || convo.guestId } });
            }
            // "Start a new chat" on an ended/ticket thread → reopen it (history
            // preserved) and re-greet, so the visitor continues the SAME chat.
            if (fresh && (convo.status === 'closed' || convo.status === 'busy')) {
                await prisma.conversation.update({ where: { id: convo.id }, data: { status: 'open', lastMessageAt: new Date() } });
                await prisma.message.create({
                    data: { conversationId: convo.id, senderId: null, isBot: true, body: botGreeting() },
                });
                convo = { ...convo, status: 'open' };
            }
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: convo.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true, body: true, senderId: true, isBot: true, createdAt: true, sender: { select: SENDER_SELECT } },
        });

        return NextResponse.json({
            conversationId: convo.id,
            status: convo.status,
            messages: serializeMessages(messages),
        });
    } catch (error) {
        console.error('[POST /api/support]', error);
        return NextResponse.json({ error: 'Could not start support chat.' }, { status: 500 });
    }
}
