/**
 * app/api/messages/[id]/route.ts
 *
 * GET  /api/messages/[id]   → messages in a conversation (oldest→newest) +
 *                             the peer's info; marks the conversation read.
 * POST /api/messages/[id]   → send a message. Body: { body: string }
 *
 * Only a participant of the conversation may read or post. Gated by the
 * 'use-messages' permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission, userId, userPermissions } from '@/lib/rbac';
import { isSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rateLimit';
import { isParticipant, cleanMessageBody, emitToUser } from '@/lib/messaging';
import { emitToConversation, emitToAdmins, SUPPORT_BOT_NAME, SUPPORT_BOT_AVATAR, SUPPORT_STAFF_SLUGS } from '@/lib/support';

const PERMISSION = 'use-messages';
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const conversationId = Number((await params).id);
    if (!conversationId || Number.isNaN(conversationId)) {
        return NextResponse.json({ error: 'Invalid conversation id.' }, { status: 400 });
    }

    if (!(await isParticipant(conversationId, me))) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    try {
        const [messages, participants] = await Promise.all([
            prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'asc' },
                take: 500,
                select: { id: true, body: true, senderId: true, isBot: true, createdAt: true },
            }),
            prisma.conversationParticipant.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true, roles: { select: { role: { select: { name: true } } }, take: 1 }, permissions: { where: { permission: { slug: { in: SUPPORT_STAFF_SLUGS } } }, select: { permissionId: true }, take: 1 } } } },
            }),
        ]);

        // Mark everything read for me, and un-hide if I had soft-deleted it.
        const readAt = new Date();
        await prisma.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: me } },
            data: { lastReadAt: readAt, hiddenAt: null },
        });

        const convoMeta = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { isSupport: true, guestName: true } });

        // ── Read receipts (normal DMs only) ──────────────────────────────────
        // Report the peer's own lastReadAt so I can render "Seen" on MY messages
        // right away, AND tell the other participant(s) I just read up to now so
        // their open window flips to "Seen" live (Facebook-style).
        const others = participants.filter(p => p.userId !== me);
        let peerLastReadAt: Date | null = null;
        if (!convoMeta?.isSupport) {
            peerLastReadAt = others[0]?.lastReadAt ?? null;
            for (const o of others) {
                emitToUser(o.userId, 'messages-read', { conversationId, readerId: me, at: readAt.toISOString() });
            }
        }

        // Peer identity:
        //   - Normal DM  → the other participant.
        //   - Support    → ASYMMETRIC. The seeker (earliest participant) always
        //     sees the bot-fronted "Support" identity; the admin's name/photo is
        //     never exposed. An admin viewing it sees the seeker's real profile.
        const roleOf = (u: { roles?: { role: { name: string } }[] } | null | undefined) => u?.roles?.[0]?.role?.name ?? null;
        let peer: { id: number; name: string; username: string | null; avatarUrl: string | null; role: string | null } | null;
        if (convoMeta?.isSupport) {
            // Who am I in THIS support chat? Decide by PERMISSION, not participant
            // order — otherwise an admin who is also the seeker (self-test) or an
            // anonymous seeker wrongly resolves to the "Support Bot" peer.
            const myPerms = userPermissions(auth.session);
            const iAmStaff = myPerms.includes('manage-support') || myPerms.includes('view-admin-notifications');
            if (iAmStaff) {
                // Admin view → the VISITOR = the NON-staff participant (matched by
                // permission, never myself), else a Visitor placeholder for an
                // anonymous guest. Clickable to their profile.
                const visitor = participants.find(p => p.user && p.user.permissions.length === 0 && p.userId !== me)?.user
                    ?? participants.find(p => p.userId !== me)?.user ?? null;
                peer = visitor
                    ? { id: visitor.id, name: visitor.name || visitor.username || 'User', username: visitor.username, avatarUrl: visitor.avatarUrl, role: roleOf(visitor) }
                    : { id: 0, name: convoMeta.guestName || 'Visitor', username: null, avatarUrl: 'https://ui-avatars.com/api/?name=Visitor&background=9aa0a6&color=fff', role: 'Visitor' };
            } else {
                // The visitor (non-staff) view → the connected human agent if one
                // has joined (real name/photo, but NOT clickable → id 0), else bot.
                const agent = participants.find(p => p.userId !== me && p.user)?.user ?? null;
                peer = agent
                    ? { id: 0, name: agent.name, username: null, avatarUrl: agent.avatarUrl, role: roleOf(agent) }
                    : { id: 0, name: SUPPORT_BOT_NAME, username: null, avatarUrl: SUPPORT_BOT_AVATAR, role: null };
            }
        } else {
            const u = participants.find(p => p.userId !== me)?.user ?? null;
            peer = u ? { id: u.id, name: u.name, username: u.username, avatarUrl: u.avatarUrl, role: roleOf(u) } : null;
        }

        return NextResponse.json({
            conversationId,
            peer,
            peerLastReadAt,
            messages: messages.map(m => ({
                id: m.id,
                body: m.body,
                senderId: m.senderId,
                isBot: m.isBot,
                mine: m.senderId === me,
                createdAt: m.createdAt,
            })),
        });
    } catch (error) {
        console.error('[GET /api/messages/:id]', error);
        return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    if (!isSameOrigin(req)) {
        return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
    }

    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const conversationId = Number((await params).id);
    if (!conversationId || Number.isNaN(conversationId)) {
        return NextResponse.json({ error: 'Invalid conversation id.' }, { status: 400 });
    }

    if (!(await isParticipant(conversationId, me))) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }

    // Anti-spam: cap messages per user.
    const rl = rateLimit(`msg-send:${me}:${getClientIp(req.headers)}`, 60, 60 * 1000);
    if (!rl.ok) {
        return NextResponse.json(
            { error: `Slow down. Try again in ${rl.retryAfter}s.` },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
        );
    }

    try {
        const body = await req.json();
        const text = cleanMessageBody(body.body);
        if (!text) {
            return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 422 });
        }

        const msg = await prisma.message.create({
            data: { conversationId, senderId: me, body: text },
            select: { id: true, body: true, senderId: true, createdAt: true },
        });
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { lastMessageAt: msg.createdAt },
        });

        // Live-deliver to the other participant(s).
        const others = await prisma.conversationParticipant.findMany({
            where: { conversationId, userId: { not: me } },
            select: { userId: true },
        });
        for (const o of others) {
            emitToUser(o.userId, 'new-message', {
                conversationId,
                message: { id: msg.id, body: msg.body, senderId: me, createdAt: msg.createdAt },
            });
        }

        // For a support conversation the visitor is an anonymous guest (not a
        // user), so also push to the conversation room so their widget updates
        // live when an admin replies from the normal message chatbox.
        const convoMeta = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { isSupport: true } });
        if (convoMeta?.isSupport) {
            emitToConversation(conversationId, 'support-message', { conversationId });
            // Also ping the admins room so EVERY admin surface (support inbox
            // centre panel + navbar dropdown) reloads and shows this OUTGOING
            // reply — the messages page isn't in the per-conversation room.
            emitToAdmins('support-activity', { conversationId });
        }

        return NextResponse.json({
            message: { id: msg.id, body: msg.body, senderId: me, mine: true, createdAt: msg.createdAt },
        }, { status: 201 });
    } catch (error) {
        console.error('[POST /api/messages/:id]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}

// ── PATCH — mark the conversation UNREAD for the caller ─────────────────────
export async function PATCH(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;
    const me = userId(auth.session);
    const conversationId = Number((await params).id);
    if (!conversationId || Number.isNaN(conversationId)) {
        return NextResponse.json({ error: 'Invalid conversation id.' }, { status: 400 });
    }
    if (!(await isParticipant(conversationId, me))) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    try {
        // Reset read marker to the epoch so unreadCount counts everything again.
        await prisma.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: me } },
            data: { lastReadAt: new Date(0) },
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[PATCH /api/messages/:id]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}

// ── DELETE — remove a whole conversation the caller is part of ──────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
    const auth = await requirePermission(PERMISSION);
    if (auth.error) return auth.error;

    const me = userId(auth.session);
    const conversationId = Number((await params).id);
    if (!conversationId || Number.isNaN(conversationId)) {
        return NextResponse.json({ error: 'Invalid conversation id.' }, { status: 400 });
    }
    if (!(await isParticipant(conversationId, me))) {
        return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    try {
        // SOFT delete — only for THIS user. The conversation + history stay so
        // the other participant (and the admin's support record) are unaffected.
        // It re-appears for this user automatically if a newer message arrives.
        await prisma.conversationParticipant.update({
            where: { conversationId_userId: { conversationId, userId: me } },
            data: { hiddenAt: new Date() },
        });

        // Clear it from this user's own open tabs/windows only.
        emitToUser(me, 'conversation-removed', { conversationId });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[DELETE /api/messages/:id]', error);
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
    }
}
