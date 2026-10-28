'use client';

/**
 * context/MessagingContext.tsx
 *
 * Client-side state for the direct-messaging feature:
 *   - the conversation list + total unread badge
 *   - the set of OPEN floating chat windows (bottom-right)
 *   - live updates over Socket.io (joins the per-user room `user:<id>`)
 *
 * UI components call openChatWith(userId) / openConversation(id) to pop a chat
 * window, and sendMessage() to post. The REST API (/api/messages*) is the
 * source of truth; sockets only push new messages for instant delivery.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { playPing } from '@/lib/notifySound';

export interface Peer {
    id: number;
    name: string;
    username: string | null;
    avatarUrl: string | null;
    role?: string | null;
}

export interface ChatMsg {
    id: number | string;
    body: string;
    mine: boolean;
    createdAt: string;
    pending?: boolean;
    /** Support bot message (vs a real person) — lets the chat window show the
     *  bot avatar for bot lines and the visitor's photo for the visitor's. */
    isBot?: boolean;
}

export interface ConversationSummary {
    id: number;
    isSupport: boolean;
    status: string;
    lastMessageAt: string | null;
    lastMessage: string | null;
    unreadCount: number;
    peer: Peer | null;
}

interface ChatWindow {
    conversationId: number;
    peer: Peer | null;
    messages: ChatMsg[];
    minimized: boolean;
    loading: boolean;
    /** ISO time the peer last read this conversation — used to show "Seen"
     *  under my most recent message they've read (null = not read yet). */
    peerLastReadAt: string | null;
}

interface MessagingContextType {
    conversations: ConversationSummary[];
    totalUnread: number;
    windows: ChatWindow[];
    onlineUsers: Set<number>;
    reloadConversations: () => Promise<void>;
    openChatWith: (userId: number, peerHint?: Peer) => Promise<void>;
    openConversation: (conversationId: number, peerHint?: Peer | null) => Promise<void>;
    closeChat: (conversationId: number) => void;
    toggleMinimize: (conversationId: number) => void;
    sendMessage: (conversationId: number, body: string) => Promise<void>;
    deleteConversation: (conversationId: number) => Promise<void>;
    markConversationUnread: (conversationId: number) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | null>(null);

export function useMessaging(): MessagingContextType {
    const ctx = useContext(MessagingContext);
    if (!ctx) throw new Error('useMessaging must be used inside <MessagingProvider>');
    return ctx;
}

export function MessagingProvider({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const myId = Number((session?.user as any)?.id) || 0;

    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
    const [windows, setWindows] = useState<ChatWindow[]>([]);
    const windowsRef = useRef<ChatWindow[]>([]);
    windowsRef.current = windows;

    const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

    const reloadConversations = useCallback(async () => {
        try {
            const res = await fetch('/api/messages');
            if (!res.ok) return;
            const data = await res.json();
            setConversations(data.conversations ?? []);
        } catch { /* ignore */ }
    }, []);

    // Initial load + socket — only when logged in.
    useEffect(() => {
        if (!myId) return;
        reloadConversations();

        const socket: Socket = io({ path: '/api/socket' });
        socket.on('connect', () => { socket.emit('join-user', myId); socket.emit('join-admin-room'); });

        // Keep the navbar message dropdown in sync with the support inbox — bot
        // lines, new connect requests and hand-offs don't always fire a
        // 'new-message', so reload the list on any support activity too. (Only
        // real admins are in the 'admins' room, so non-staff never receive these.)
        socket.on('support-activity', () => reloadConversations());
        socket.on('support-request', () => reloadConversations());

        socket.on('new-message', (payload: { conversationId: number; message: { id: number; body: string; senderId: number; createdAt: string } }) => {
            const { conversationId, message } = payload;
            const open = windowsRef.current.find(w => w.conversationId === conversationId);
            if (open && !open.minimized) {
                // Append live into the open window + keep its read state current.
                setWindows(prev => prev.map(w =>
                    w.conversationId === conversationId
                        ? { ...w, messages: [...w.messages, { id: message.id, body: message.body, mine: message.senderId === myId, createdAt: message.createdAt }] }
                        : w
                ));
                fetch(`/api/messages/${conversationId}`).catch(() => {}); // marks read
                reloadConversations();
            } else {
                // Message arrived for a minimized/closed window (or no window) —
                // ping + bump the unread badge so the admin/user notices it.
                if (message.senderId !== myId) playPing();
                reloadConversations();
            }
        });

        // Read receipt: the peer just read this conversation — flip my sent
        // messages up to `at` to "Seen" live (Facebook-style).
        socket.on('messages-read', (p: { conversationId: number; readerId: number; at: string }) => {
            if (p.readerId === myId) return; // ignore my own reads
            setWindows(prev => prev.map(w =>
                w.conversationId === p.conversationId ? { ...w, peerLastReadAt: p.at } : w
            ));
        });

        // Re-broadcast incoming notifications as a window event so the navbar
        // bell (FrontUserBells) can refresh live without opening its own socket.
        socket.on('new-notification', (p: unknown) => {
            try { window.dispatchEvent(new CustomEvent('app-new-notification', { detail: p })); } catch { /* ignore */ }
        });

        // Presence (online/offline) — server pushes the current list on join and
        // a single event whenever a user flips between online and offline.
        socket.on('presence-snapshot', (ids: number[]) => {
            setOnlineUsers(new Set((ids || []).map(Number)));
        });
        socket.on('presence-change', (p: { userId: number; online: boolean }) => {
            setOnlineUsers(prev => {
                const next = new Set(prev);
                if (p.online) next.add(Number(p.userId)); else next.delete(Number(p.userId));
                return next;
            });
        });

        // A conversation was deleted (e.g. the visitor ended their support chat)
        // — drop any open window for it and refresh the list/badges.
        socket.on('conversation-removed', (payload: { conversationId: number }) => {
            setWindows(prev => prev.filter(w => w.conversationId !== payload.conversationId));
            setConversations(prev => prev.filter(c => c.id !== payload.conversationId));
            reloadConversations();
        });

        return () => { socket.disconnect(); };
    }, [myId, reloadConversations]);

    const fetchInto = useCallback(async (conversationId: number) => {
        try {
            const res = await fetch(`/api/messages/${conversationId}`);
            if (!res.ok) return;
            const data = await res.json();
            setWindows(prev => prev.map(w =>
                w.conversationId === conversationId
                    ? { ...w, loading: false, peer: data.peer ?? w.peer, messages: data.messages ?? [], peerLastReadAt: data.peerLastReadAt ?? w.peerLastReadAt }
                    : w
            ));
            reloadConversations(); // unread cleared after read
        } catch { /* ignore */ }
    }, [reloadConversations]);

    const openConversation = useCallback(async (conversationId: number, peerHint?: Peer | null) => {
        const existing = windowsRef.current.find(w => w.conversationId === conversationId);
        if (existing) {
            setWindows(prev => prev.map(w => w.conversationId === conversationId ? { ...w, minimized: false } : w));
            return;
        }
        setWindows(prev => [
            ...prev.slice(-2), // keep at most 3 windows open
            { conversationId, peer: peerHint ?? null, messages: [], minimized: false, loading: true, peerLastReadAt: null },
        ]);
        await fetchInto(conversationId);
    }, [fetchInto]);

    const openChatWith = useCallback(async (userId: number, peerHint?: Peer) => {
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) return;
            const data = await res.json();
            if (data.conversationId) await openConversation(data.conversationId, peerHint ?? null);
        } catch { /* ignore */ }
    }, [openConversation]);

    const closeChat = useCallback((conversationId: number) => {
        setWindows(prev => prev.filter(w => w.conversationId !== conversationId));
    }, []);

    const toggleMinimize = useCallback((conversationId: number) => {
        setWindows(prev => prev.map(w => w.conversationId === conversationId ? { ...w, minimized: !w.minimized } : w));
    }, []);

    const sendMessage = useCallback(async (conversationId: number, body: string) => {
        const text = body.trim();
        if (!text) return;
        const tempId = `tmp-${Date.now()}`;
        setWindows(prev => prev.map(w =>
            w.conversationId === conversationId
                ? { ...w, messages: [...w.messages, { id: tempId, body: text, mine: true, createdAt: new Date().toISOString(), pending: true }] }
                : w
        ));
        try {
            const res = await fetch(`/api/messages/${conversationId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body: text }),
            });
            if (res.ok) {
                const data = await res.json();
                setWindows(prev => prev.map(w =>
                    w.conversationId === conversationId
                        ? { ...w, messages: w.messages.map(m => m.id === tempId ? { ...data.message } : m) }
                        : w
                ));
                reloadConversations();
            } else {
                // mark the optimistic bubble as failed
                setWindows(prev => prev.map(w =>
                    w.conversationId === conversationId
                        ? { ...w, messages: w.messages.map(m => m.id === tempId ? { ...m, pending: false, body: m.body + '  (failed)' } : m) }
                        : w
                ));
            }
        } catch { /* ignore */ }
    }, [reloadConversations]);

    const deleteConversation = useCallback(async (conversationId: number) => {
        setWindows(prev => prev.filter(w => w.conversationId !== conversationId));
        setConversations(prev => prev.filter(c => c.id !== conversationId));
        try {
            await fetch(`/api/messages/${conversationId}`, { method: 'DELETE' });
        } catch { /* ignore */ }
        reloadConversations();
    }, [reloadConversations]);

    const markConversationUnread = useCallback(async (conversationId: number) => {
        try {
            await fetch(`/api/messages/${conversationId}`, { method: 'PATCH' });
        } catch { /* ignore */ }
        reloadConversations();
    }, [reloadConversations]);

    return (
        <MessagingContext.Provider value={{
            conversations, totalUnread, windows, onlineUsers,
            reloadConversations, openChatWith, openConversation,
            closeChat, toggleMinimize, sendMessage, deleteConversation,
            markConversationUnread,
        }}>
            {children}
        </MessagingContext.Provider>
    );
}
