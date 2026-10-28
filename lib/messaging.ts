/**
 * lib/messaging.ts
 *
 * Shared helpers for the direct-messaging feature so the API routes stay thin
 * and the serialization shape is identical everywhere (list, send, socket push).
 *
 * Conversation model recap (see schema.prisma):
 *   - Peer DM     : isSupport=false, exactly two ConversationParticipant rows.
 *   - Support chat: isSupport=true (handled in a later phase).
 */

import { prisma } from '@/lib/prisma';
import { SUPPORT_BOT_AVATAR, SUPPORT_BOT_NAME, SUPPORT_STAFF_SLUGS } from '@/lib/support';

/** Strip control characters (keep tab/newline) + trim; cap length. Plain text only. */
export function cleanMessageBody(raw: unknown): string {
    if (typeof raw !== 'string') return '';
    // eslint-disable-next-line no-control-regex
    return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, 4000);
}

/**
 * Find the existing 1:1 conversation between two users, or create it.
 * Returns the conversation id. Order of the two ids does not matter.
 */
export async function getOrCreateDirectConversation(meId: number, otherId: number): Promise<number> {
    // A direct conversation is a non-support conversation that has BOTH users
    // as participants. Find ones that contain me, then check the other is in it.
    const mine = await prisma.conversation.findMany({
        where: {
            isSupport: false,
            participants: { some: { userId: meId } },
        },
        select: { id: true, participants: { select: { userId: true } } },
    });

    const existing = mine.find(c =>
        c.participants.length === 2 &&
        c.participants.some(p => p.userId === otherId)
    );
    if (existing) return existing.id;

    const created = await prisma.conversation.create({
        data: {
            isSupport: false,
            participants: {
                create: [{ userId: meId }, { userId: otherId }],
            },
        },
        select: { id: true },
    });
    return created.id;
}

export interface ConversationSummary {
    id: number;
    isSupport: boolean;
    status: string;
    lastMessageAt: string | null;
    lastMessage: string | null;
    unreadCount: number;
    // The "other" participant (for a 1:1 peer chat) — who you're talking to.
    peer: { id: number; name: string; username: string | null; avatarUrl: string | null } | null;
}

/**
 * Build the conversation list for a user: each conversation with its peer,
 * last message preview, and how many messages are unread for this user.
 */
export async function listConversationsForUser(meId: number): Promise<ConversationSummary[]> {
    const rows = await prisma.conversation.findMany({
        where: { participants: { some: { userId: meId } } },
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        include: {
            participants: {
                orderBy: { createdAt: 'asc' },
                include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
            },
            messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        take: 100,
    });

    // Does the viewer handle support? Staff see the visitor's real identity;
    // the visitor sees the bot-fronted "Support". One lightweight lookup, reused
    // for every support row below (keeps the list in sync with the chat window).
    const viewer = await prisma.user.findUnique({
        where: { id: meId },
        select: { permissions: { select: { permission: { select: { slug: true } } } } },
    });
    // Single source of truth (lib/support.ts). Does NOT include access-admin-panel
    // on purpose — see the note there.
    const iAmStaff = (viewer?.permissions ?? []).some(p => SUPPORT_STAFF_SLUGS.includes(p.permission.slug));

    const summaries: ConversationSummary[] = [];
    for (const c of rows) {
        const myPart = c.participants.find(p => p.userId === meId);

        // Soft-deleted by this user → hide it, UNLESS a newer message arrived
        // since (then it re-appears, like most chat apps).
        if (myPart?.hiddenAt && (!c.lastMessageAt || c.lastMessageAt <= myPart.hiddenAt)) {
            continue;
        }

        const lastReadAt = myPart?.lastReadAt ?? new Date(0);

        const unreadCount = await prisma.message.count({
            where: {
                conversationId: c.id,
                senderId: { not: meId },
                createdAt: { gt: lastReadAt },
            },
        });

        let peer: ConversationSummary['peer'];
        if (c.isSupport) {
            // SUPPORT chat identity is asymmetric on purpose, decided by ROLE (not
            // participant order) so it stays correct even in self-tests:
            //   - Staff handling the chat see the visitor's REAL profile.
            //   - The visitor sees a single bot-fronted "Support" identity; the
            //     admin behind it is never disclosed.
            if (iAmStaff) {
                const visitor = c.participants.find(p => p.userId !== meId)?.user ?? null;
                peer = visitor
                    ? { id: visitor.id, name: visitor.name || visitor.username || 'User', username: visitor.username, avatarUrl: visitor.avatarUrl }
                    : { id: 0, name: c.guestName || 'Visitor', username: null, avatarUrl: SUPPORT_BOT_AVATAR };
            } else {
                // Visitor's own view → mirror the support WIDGET: show the connected
                // human agent (name + photo, not clickable) once one has joined,
                // otherwise the bot-fronted "Support" identity. Keeps the message
                // dropdown in sync with the floating support widget.
                const agent = c.participants.find(p => p.userId !== meId)?.user ?? null;
                peer = agent
                    ? { id: 0, name: agent.name || agent.username || 'Support', username: null, avatarUrl: agent.avatarUrl }
                    : { id: 0, name: SUPPORT_BOT_NAME, username: null, avatarUrl: SUPPORT_BOT_AVATAR };
            }
        } else {
            const otherPart = c.participants.find(p => p.userId !== meId);
            peer = otherPart?.user
                ? {
                    id: otherPart.user.id,
                    name: otherPart.user.name,
                    username: otherPart.user.username,
                    avatarUrl: otherPart.user.avatarUrl,
                }
                : null;
        }

        summaries.push({
            id: c.id,
            isSupport: c.isSupport,
            status: c.status,
            lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
            lastMessage: c.messages[0]?.body ?? null,
            unreadCount,
            peer,
        });
    }

    // A visitor only ever has ONE ongoing support thread, but older duplicates
    // can pile up across anonymous→login sessions. For a non-staff viewer, keep
    // just the most recent support conversation (summaries are already newest
    // first) so the message dropdown shows a single "Support" entry. Staff keep
    // every support chat — those are different visitors they're handling.
    if (!iAmStaff) {
        let keptSupport = false;
        return summaries.filter(s => {
            if (!s.isSupport) return true;
            if (keptSupport) return false;
            keptSupport = true;
            return true;
        });
    }
    return summaries;
}

/** Is this user a participant of this conversation? (authorization guard) */
export async function isParticipant(conversationId: number, userId: number): Promise<boolean> {
    const p = await prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
        select: { id: true },
    });
    return !!p;
}

/** Emit a socket event to a specific user's room (no-op if io not ready). */
export function emitToUser(userId: number, event: string, payload: unknown) {
    try {
        (globalThis as any).__io?.to(`user:${userId}`).emit(event, payload);
    } catch {
        /* socket optional — REST is the source of truth */
    }
}
