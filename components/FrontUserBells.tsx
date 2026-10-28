'use client';

/**
 * FrontUserBells.tsx
 *
 * Notification (+ a placeholder message) dropdown for the PUBLIC blog navbar.
 *
 * Visibility uses the same RBAC the admin panel does:
 *   - /api/notifications already scopes results: privileged users (those with
 *     'view-admin-notifications') get the full admin feed; everyone else gets
 *     only their OWN notifications.
 *   - On top of that, for NON-privileged (normal) users we show ONLY
 *     comment-related notifications here (replies/reactions to their comments),
 *     and nothing else — per requirement.
 *   - Admins see everything, exactly like the admin panel.
 *
 * Messages dropdown is a non-functional placeholder for now.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { resolveVisual, timeAgo, type IconConfigMap } from '@/lib/notificationVisuals';
import { useMessaging } from '@/context/MessagingContext';

interface Notif {
    id: number;
    type: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: string;
}

export default function FrontUserBells({ mobile = false }: { mobile?: boolean }) {
    const { data: session, status } = useSession();
    const router = useRouter();

    const perms = ((session?.user as any)?.permissions ?? []) as string[];
    const privileged = perms.includes('view-admin-notifications') || perms.includes('access-admin-panel');

    const { conversations, totalUnread: totalUnreadDms, openConversation, onlineUsers, reloadConversations } = useMessaging();

    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [iconConfig, setIconConfig] = useState<IconConfigMap>({});
    const [openNotif, setOpenNotif] = useState(false);
    const [openMsg, setOpenMsg] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (!res.ok) return;
            const data = await res.json();
            let list: Notif[] = data.notifications ?? [];
            // Normal users: comment notifications + @mentions + new-post announcements.
            if (!privileged) list = list.filter(n => n.type === 'comment' || n.type.startsWith('comment') || n.type === 'mention' || n.type === 'post.published');
            setNotifs(list);
        } catch { /* non-critical */ }
    }, [privileged]);

    const loadIcons = useCallback(async () => {
        try {
            const res = await fetch('/api/notification-icons');
            const data = await res.json();
            const map: IconConfigMap = {};
            (data.items ?? []).forEach((it: any) => { map[it.typeKey] = { icon: it.icon, color: it.color }; });
            setIconConfig(map);
        } catch { /* fall back to defaults */ }
    }, []);

    useEffect(() => {
        if (status === 'authenticated') { load(); loadIcons(); }
    }, [status, load, loadIcons]);

    // Live refresh when a notification arrives (e.g. a new post is published).
    useEffect(() => {
        const onNew = () => load();
        window.addEventListener('app-new-notification', onNew);
        return () => window.removeEventListener('app-new-notification', onNew);
    }, [load]);

    // Close on outside click
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpenNotif(false); setOpenMsg(false);
            }
        }
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    if (status !== 'authenticated') return null;

    const unread = notifs.filter(n => !n.read).length;

    async function markRead(n: Notif) {
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId: n.id }),
            });
        } catch { /* optimistic */ }
        if (n.link) router.push(n.link.split('?')[0]);
        setOpenNotif(false);
    }

    async function markAll() {
        setNotifs(prev => prev.map(x => ({ ...x, read: true })));
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });
        } catch { /* optimistic */ }
    }

    return (
        <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>

            {/* ── Messages (placeholder) ── */}
            <button
                className="cwh-icon-btn"
                aria-label="Messages"
                style={{ position: 'relative' }}
                onClick={() => { if (mobile) { router.push('/messages'); return; } setOpenMsg(o => !o); setOpenNotif(false); }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16v12H5.17L4 17.17V4z" />
                </svg>
                {totalUnreadDms > 0 && (
                    <span style={badge}>{totalUnreadDms > 9 ? '9+' : totalUnreadDms}</span>
                )}
            </button>

            {/* ── Notifications ── */}
            <button
                className="cwh-icon-btn"
                aria-label="Notifications"
                style={{ position: 'relative' }}
                onClick={() => { if (mobile) { router.push('/notifications'); return; } setOpenNotif(o => { const n = !o; if (n) { load(); loadIcons(); } return n; }); setOpenMsg(false); }}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unread > 0 && (
                    <span style={badge}>{unread > 9 ? '9+' : unread}</span>
                )}
            </button>

            {openMsg && (
                <div style={panel}>
                    <div style={panelHead}>
                        <span>Messages</span>
                        <button onClick={() => { setOpenMsg(false); router.push('/messages'); }} title="All messages" aria-label="All messages" style={{ background: 'none', border: 'none', color: '#0858f7', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
                            View all
                        </button>
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {conversations.length === 0 ? (
                            <div style={{ padding: '26px 16px', textAlign: 'center', color: '#9aa0b3', fontSize: 14 }}>
                                No messages yet.
                            </div>
                        ) : conversations.map(c => (
                            <button
                                key={c.id}
                                onClick={() => {
                                    setOpenMsg(false);
                                    // Support chats live in the dedicated Support widget (single UI);
                                    // normal DMs open as a floating chat window. Prevents two
                                    // chatboxes opening for the same support conversation.
                                    if (c.isSupport) {
                                        window.dispatchEvent(new Event('open-support-chat'));
                                        // Opening the widget alone doesn't touch the DM read marker,
                                        // so the dropdown kept showing this thread as unread. Mark it
                                        // read (GET sets lastReadAt) then refresh the list/badge.
                                        fetch(`/api/messages/${c.id}`).then(() => reloadConversations()).catch(() => {});
                                    } else openConversation(c.id, c.peer);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'transparent', padding: '10px 14px', cursor: 'pointer', textAlign: 'left' }}
                            >
                                <span style={{ position: 'relative', flexShrink: 0 }}>
                                    <img
                                        src={c.peer?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.peer?.name || 'Support')}&background=5b4fcf&color=fff`}
                                        alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                                    {!c.isSupport && (
                                        <span style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', background: (c.peer?.id && onlineUsers.has(c.peer.id)) ? '#34d399' : '#9aa0a6', border: '2px solid #fff' }} />
                                    )}
                                </span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13.5, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.peer?.name || 'Support'}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#9aa0b3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.lastMessage || ''}
                                    </div>
                                </div>
                                {c.unreadCount > 0 && (
                                    <span style={{ background: '#0858f7', color: '#fff', borderRadius: 10, fontSize: 11, padding: '0 7px', lineHeight: '18px' }}>{c.unreadCount}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {openNotif && (
                <div style={panel}>
                    <div style={panelHead}>
                        <span>Notifications {unread > 0 && <span style={{ color: '#0858f7' }}>({unread})</span>}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {notifs.length > 0 && (
                                <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#0858f7', fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}>
                                    Mark all read
                                </button>
                            )}
                            {/* Settings → full notifications page (manage everything at once) */}
                            <button onClick={() => { setOpenNotif(false); router.push('/notifications'); }} title="All notifications" aria-label="All notifications" style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'inline-flex' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            </button>
                        </span>
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                        {notifs.length === 0 ? (
                            <div style={{ padding: '26px 16px', textAlign: 'center', color: '#9aa0b3', fontSize: 14 }}>
                                No notifications yet.
                            </div>
                        ) : notifs.map(n => {
                            const v = resolveVisual(n.type, iconConfig);
                            return (
                                <button key={n.id} onClick={() => markRead(n)} style={{
                                    display: 'flex', gap: 12, width: '100%', textAlign: 'left',
                                    padding: '11px 14px', border: 'none', cursor: 'pointer',
                                    background: n.read ? 'transparent' : 'rgba(8,88,247,0.06)',
                                    borderBottom: '1px solid #f1f2f6', alignItems: 'flex-start',
                                }}>
                                    <span style={{
                                        flexShrink: 0, width: 34, height: 34, borderRadius: '50%',
                                        background: v.background, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>{v.icon}</span>
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: 'block', fontSize: 13.5, color: '#2c3146', lineHeight: 1.4 }}>{n.message}</span>
                                        <span style={{ display: 'block', fontSize: 12, color: '#0858f7', marginTop: 3 }}>{timeAgo(n.createdAt)}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

const badge: React.CSSProperties = {
    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
    borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const panel: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 340, maxWidth: '90vw',
    background: '#fff', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
    border: '1px solid #eceef3', zIndex: 1000, overflow: 'hidden',
};
const panelHead: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '13px 16px', borderBottom: '1px solid #f1f2f6', fontWeight: 700, fontSize: 15, color: '#1f2440',
};
