'use client';

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    ReactNode,
} from 'react';
import { signOut, useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
    id: number;
    text: string;
    time: string;
    sender: 'incoming' | 'outgoing';
}

interface Conversation {
    id: number;
    avatar: string;
    name: string;
    lastMessageTime: string;
    unreadCount: number;
    isOnline: boolean;
    isActive: boolean;
    messages: Message[];
}

export interface Notification {
    id: number;
    type: string;
    message: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
    actorName: string | null;
    actorAvatarUrl: string | null;
}

interface AdminContextType {
    isToggleSidebar: boolean;
    setIsToggleSidebar: (v: boolean) => void;
    themeMode: boolean;
    setThemeMode: (v: boolean) => void;
    messages: Conversation[];
    setMessages: React.Dispatch<React.SetStateAction<Conversation[]>>;
    handleSendMessage: (conversationId: number, text: string) => void;
    markConversationAsRead: (conversationId: number) => void;
    notifications: Notification[];
    markNotificationAsRead: (id: number) => Promise<void>;
    markAllNotificationsAsRead: () => Promise<void>;
    markAllNotificationsAsUnread: () => Promise<void>;
    deleteNotification: (id: number) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    reloadNotifications: () => Promise<void>;   // ← NEW: re-fetch from server
    totalUnreadMessages: number;
    totalUnreadNotifications: number;
    logout: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AdminContext = createContext<AdminContextType | null>(null);

export function useAdmin(): AdminContextType {
    const ctx = useContext(AdminContext);
    if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
    return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AdminProvider({ children }: { children: ReactNode }) {

    // ── Sidebar ───────────────────────────────────────────────────────────────
    const [isToggleSidebar, setIsToggleSidebar] = useState(false);

    // ── Theme ─────────────────────────────────────────────────────────────────
    const [themeMode, setThemeMode] = useState<boolean>(true);

    useEffect(() => {
        const saved = localStorage.getItem('themeMode');
        if (saved === 'dark') setThemeMode(false);
    }, []);

    useEffect(() => {
        if (themeMode) {
            document.body.classList.remove('dark');
            document.body.classList.add('light');
            localStorage.setItem('themeMode', 'light');
        } else {
            document.body.classList.remove('light');
            document.body.classList.add('dark');
            localStorage.setItem('themeMode', 'dark');
        }
        return () => {
            document.body.classList.remove('dark');
            document.body.classList.remove('light');
        };
    }, [themeMode]);

    // ── Messages ──────────────────────────────────────────────────────────────
    const [messages, setMessages] = useState<Conversation[]>([
        {
            id: 1,
            avatar: '/assets/profile1.webp',
            name: 'UMAIR ALI',
            lastMessageTime: 'Now',
            unreadCount: 5,
            isOnline: true,
            isActive: true,
            messages: [
                { id: 1, text: "What's your current career opportunity position?", time: 'Now', sender: 'incoming' },
                { id: 2, text: 'I have a new role you might be interested in.', time: '10:35 AM', sender: 'outgoing' },
            ],
        },
        {
            id: 2,
            avatar: '/assets/profile2.webp',
            name: 'Rose',
            lastMessageTime: '5 minutes ago',
            unreadCount: 2,
            isOnline: false,
            isActive: false,
            messages: [
                { id: 1, text: 'Do you have time for a quick call?', time: '5 minutes ago', sender: 'incoming' },
                { id: 2, text: "It's about a position I think you'd be great for.", time: '5 minutes ago', sender: 'outgoing' },
            ],
        },
    ]);

    const handleSendMessage = (conversationId: number, text: string) => {
        setMessages(prev =>
            prev.map(conv =>
                conv.id === conversationId
                    ? {
                        ...conv,
                        messages: [
                            ...conv.messages,
                            { id: conv.messages.length + 1, text, time: 'Just now', sender: 'outgoing' },
                        ],
                        lastMessageTime: 'Just now',
                    }
                    : conv
            )
        );
    };

    const markConversationAsRead = (conversationId: number) => {
        setMessages(prev =>
            prev.map(conv =>
                conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
            )
        );
    };

    // ── Notifications ─────────────────────────────────────────────────────────
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/notifications');
            if (!res.ok) return;
            const data = await res.json();
            const mapped: Notification[] = (data.notifications ?? []).map((n: any) => ({
                id: n.id,
                type: n.type,
                message: n.message,
                link: n.link,
                isRead: n.read,
                createdAt: n.createdAt,
                actorName: n.actor?.name ?? null,
                actorAvatarUrl: n.actor?.avatarUrl ?? null,
            }));
            setNotifications(mapped);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, []);

    // Current user id, kept in a ref so the socket handler (set up once) always
    // reads the latest value without re-subscribing.
    const { data: __session } = useSession();
    const meIdRef = useRef<number | null>(null);
    useEffect(() => {
        const raw = (__session?.user as any)?.id;
        meIdRef.current = raw != null ? Number(raw) : null;
    }, [__session]);

    useEffect(() => {
        loadNotifications();

        const socket: Socket = io({ path: '/api/socket' });

        socket.on('connect', () => {
            socket.emit('join-admin-room');
        });

        socket.on('new-notification', (n: any) => {
            // Skip live notifications about the current user's OWN action — the
            // REST fetch already hides these (visibilityWhere), so this keeps the
            // instant socket push consistent (no self-notifications).
            if (n?.actorUserId != null && meIdRef.current != null && Number(n.actorUserId) === meIdRef.current) return;
            setNotifications(prev =>
                [
                    {
                        id: n.id,
                        type: n.type,
                        message: n.message,
                        link: n.link,
                        isRead: false,
                        createdAt: n.createdAt,
                        actorName: n.actorName ?? null,
                        actorAvatarUrl: n.actorAvatarUrl ?? null,
                    },
                    ...prev,
                ].slice(0, 50)
            );
        });

        return () => { socket.disconnect(); };
    }, [loadNotifications]);

    const markNotificationAsRead = async (id: number) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        try {
            await fetch('/api/admin/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: id }),
            });
        } catch (err) {
            console.error('markNotificationAsRead error:', err);
        }
    };

    const markAllNotificationsAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        try {
            await fetch('/api/admin/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });
        } catch (err) {
            console.error('markAllNotificationsAsRead error:', err);
        }
    };

    const markAllNotificationsAsUnread = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: false })));
        try {
            await fetch('/api/admin/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true, read: false }),
            });
        } catch (err) {
            console.error('markAllNotificationsAsUnread error:', err);
        }
    };

    const deleteAllNotifications = async () => {
        setNotifications([]);
        try {
            await fetch('/api/admin/notifications', { method: 'DELETE' });
        } catch (err) {
            console.error('deleteAllNotifications error:', err);
        }
    };

    // Optimistic delete from state + API call
    const deleteNotification = async (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        try {
            await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
        } catch (err) {
            console.error('deleteNotification error:', err);
        }
    };

    // Re-fetch from server — call this after any action that changes
    // notifications indirectly (e.g. comment delete from comments page)
    const reloadNotifications = useCallback(async () => {
        await loadNotifications();
    }, [loadNotifications]);

    // ── Logout ────────────────────────────────────────────────────────────────
    const logout = () => { signOut({ callbackUrl: '/admin/login' }); };

    // ── Derived ───────────────────────────────────────────────────────────────
    const totalUnreadMessages      = messages.reduce((s, c) => s + c.unreadCount, 0);
    const totalUnreadNotifications = notifications.filter(n => !n.isRead).length;

    return (
        <AdminContext.Provider value={{
            isToggleSidebar, setIsToggleSidebar,
            themeMode, setThemeMode,
            messages, setMessages,
            handleSendMessage, markConversationAsRead,
            notifications,
            markNotificationAsRead,
            markAllNotificationsAsRead,
            markAllNotificationsAsUnread,
            deleteNotification,
            deleteAllNotifications,
            reloadNotifications,
            totalUnreadMessages,
            totalUnreadNotifications,
            logout,
        }}>
            {children}
        </AdminContext.Provider>
    );
}
