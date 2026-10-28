/**
 * app/api/messages/route.ts
 *
 * GET  /api/messages              → list my conversations (+ total unread)
 * POST /api/messages              → start (or reuse) a 1:1 conversation with a
 *                                    user, optionally sending the first message.
 *                                    Body: { userId: number, body?: string }
 *
 * Gated by the 'use-messages' permission (default on roles, revocable per-user
 * from the Users edit page — same model as create-comment / upload-avatar).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId } from '@/lib/rbac';
import { isSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import {
    listConversationsForUser,
    getOrCreateDirectConversation,
    cleanMessageBody,
    emitToUser,
} from '@/lib/messaging';

const PERMISSION = 'use-messages';

export async function GET() {
    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    try {
        const conversations = await listConversationsForUser(me);
        const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);
        return NextResponse.json({ conversations, totalUnread });
    } catch (error) {
        console.error('[GET /api/messages]', error);
        return NextResponse.json({ error: 'Could not load conversations.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;

    const me = userId(auth.session);

    // Light anti-spam: cap conversation starts per user.
    const rl = rateLimit(`msg-start:${me}:${getClientIp(req.headers)}`, 40, 5 * 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Too many requests. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    try {
        const body = await req.json();
        const otherId = Number(body.userId);
        if (!otherId || Number.isNaN(otherId)) {
            return NextResponse.json({ error: 'A valid userId is required.' }, { status: 422 });
        }
        if (otherId === me) {
            return NextResponse.json({ error: 'You cannot message yourself.' }, { status: 422 });
        }

        // Recipient must exist and not be blocked.
        const other = await prisma.user.findUnique({
            where: { id: otherId },
            select: { id: true, status: true, name: true },
        });
        if (!other) {
            return NextResponse.json({ error: 'That user does not exist.' }, { status: 404 });
        }
        if (other.status === 'blocked') {
            return NextResponse.json({ error: 'This user is not available.' }, { status: 403 });
        }

        const conversationId = await getOrCreateDirectConversation(me, otherId);

        // Optional first message in the same call.
        const text = cleanMessageBody(body.body);
        if (text) {
            const msg = await prisma.message.create({
                data: { conversationId, senderId: me, body: text },
            });
            await prisma.conversation.update({
                where: { id: conversationId },
                data: { lastMessageAt: msg.createdAt },
            });
            emitToUser(otherId, 'new-message', {
                conversationId,
                message: { id: msg.id, body: msg.body, senderId: me, createdAt: msg.createdAt },
            });
        }

        return NextResponse.json({ conversationId }, { status: 201 });
    } catch (error) {
        console.error('[POST /api/messages]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
