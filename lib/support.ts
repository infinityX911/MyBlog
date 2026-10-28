/**
 * lib/support.ts
 *
 * Helpers for the visitor support chat (Conversation.isSupport = true).
 *
 * Flow / status:
 *   open    → bot is handling; visitor can ask to "connect" to a human
 *   waiting → connect requested, admins notified, nobody has accepted yet
 *   live    → an admin accepted and is chatting with the visitor
 *   closed  → ended
 *
 * Guests are NOT User rows. A guest is identified by a random `guestId`
 * stored in their browser (localStorage) and saved on the conversation; we
 * verify it on every guest request. Guest/bot messages have senderId = null
 * (bot is distinguished by isBot = true).
 */

import { prisma } from '@/lib/prisma';

/**
 * Single source of truth for the support BOT identity. The visitor/user always
 * sees this — never the admin's real name or photo — so admin details stay
 * private even after a human joins behind the scenes.
 */
export const SUPPORT_BOT_NAME = 'Support Bot';
export const SUPPORT_BOT_AVATAR =
    'https://ui-avatars.com/api/?name=Support&background=5b4fcf&color=fff&bold=true';

/**
 * Permission slugs that mark a user as support STAFF. Used to tell the seeker
 * (the visitor) apart from the agent(s) in a support conversation by ROLE rather
 * than join-order — so every surface (inbox list, chat window, navbar) resolves
 * the same real visitor identity, regardless of who was added first.
 */
// Staff = people who actually HANDLE support. Intentionally does NOT include
// 'access-admin-panel' — that grant only opens the admin panel; it does not make
// someone a support agent. Including it made every admin-panel user get treated
// as an agent, which (a) skipped visitor-side dedup so they saw multiple support
// threads, and (b) exposed the visitor's own identity instead of the "Support"
// bot identity. Genuine support handlers hold 'manage-support' (admins have it).
export const SUPPORT_STAFF_SLUGS = ['manage-support', 'view-admin-notifications'];

export const CONNECT_RE = /\b(connect|human|staff|agent|representative|person|talk to (someone|a human))\b/i;

export function botGreeting(): string {
    return "Hi! 👋 How can I help you? Ask your question here — or type \"connect\" any time to talk to a human.";
}

export function botReply(_userText: string): string {
    return "Thanks for your message! A team member will see this. Type \"connect\" if you'd like to talk to a human now.";
}

/** Number of admins currently connected to the realtime 'admins' room. */
export function onlineAdminCount(): number {
    try {
        const io = (globalThis as any).__io;
        const room = io?.sockets?.adapter?.rooms?.get('admins');
        return room ? room.size : 0;
    } catch {
        return 0;
    }
}

export function emitToConversation(conversationId: number, event: string, payload: unknown) {
    try {
        (globalThis as any).__io?.to(`conversation:${conversationId}`).emit(event, payload);
    } catch { /* socket optional */ }
}

export function emitToAdmins(event: string, payload: unknown) {
    try {
        (globalThis as any).__io?.to('admins').emit(event, payload);
    } catch { /* socket optional */ }
}

export interface SupportMsg {
    id: number;
    body: string;
    fromGuest: boolean;
    isBot: boolean;
    senderId: number | null;
    senderName: string | null;   // the admin/agent's name (so the visitor sees who replied)
    senderAvatar: string | null; // the admin/agent's profile photo (shown once a human joins)
    senderRole: string | null;   // their role name from the roles table, e.g. "Administrator"
    createdAt: string;
}

/**
 * Prisma `select` for a message sender — name, avatar and primary role name
 * (from the roles table). Reuse everywhere support messages are serialized so
 * once a human joins, the visitor sees the real agent's photo + "Name · Role".
 */
export const SENDER_SELECT = {
    name: true,
    avatarUrl: true,
    roles: { select: { role: { select: { name: true } } }, take: 1 },
} as const;

type SenderShape = { name: string; avatarUrl?: string | null; roles?: { role: { name: string } }[] } | null | undefined;

export function serializeMessages(
    rows: { id: number; body: string; senderId: number | null; isBot: boolean; createdAt: Date; sender?: SenderShape }[],
): SupportMsg[] {
    return rows.map(m => ({
        id: m.id,
        body: m.body,
        fromGuest: m.senderId === null && !m.isBot,
        isBot: m.isBot,
        senderId: m.senderId,
        senderName: m.sender?.name ?? null,
        senderAvatar: m.sender?.avatarUrl ?? null,
        senderRole: m.sender?.roles?.[0]?.role?.name ?? null,
        createdAt: m.createdAt.toISOString(),
    }));
}

/** Insert a bot message and return it. */
export async function addBotMessage(conversationId: number, body: string) {
    const m = await prisma.message.create({
        data: { conversationId, senderId: null, isBot: true, body },
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: m.createdAt } });
    return m;
}
