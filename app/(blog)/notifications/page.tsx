'use client';

/**
 * app/(blog)/notifications/page.tsx
 *
 * Full-page notifications list for the public blog (used especially on mobile,
 * where the navbar dropdown doesn't fit). Mirrors the admin panel's listed
 * style: each row is tappable, with "Mark all read" and per-row dismiss.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { resolveVisual, timeAgo, type IconConfigMap } from '@/lib/notificationVisuals';

interface Notif { id: number; type: string; message: string; link: string | null; read: boolean; createdAt: string }

export default function NotificationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const perms = ((session?.user as any)?.permissions ?? []) as string[];
    const privileged = perms.includes('view-admin-notifications') || perms.includes('access-admin-panel');

    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [iconConfig, setIconConfig] = useState<IconConfigMap>({});

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (!res.ok) return;
            const data = await res.json();
            let list: Notif[] = data.notifications ?? [];
            if (!privileged) list = list.filter(n => n.type === 'comment' || n.type.startsWith('comment') || n.type === 'mention' || n.type === 'post.published');
            setNotifs(list);
        } catch { /* ignore */ }
    }, [privileged]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        load();
        (async () => {
            try {
                const res = await fetch('/api/notification-icons');
                const data = await res.json();
                const map: IconConfigMap = {};
                (data.items ?? []).forEach((it: any) => { map[it.typeKey] = { icon: it.icon, color: it.color }; });
                setIconConfig(map);
            } catch { /* defaults */ }
        })();
    }, [status, load]);

    if (status === 'loading') return null;
    if (status !== 'authenticated') {
        return <div style={{ maxWidth: 680, margin: '40px auto', padding: 20 }}>Please <Link href="/login">log in</Link> to see your notifications.</div>;
    }

    const unread = notifs.filter(n => !n.read).length;

    async function open(n: Notif) {
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
        try {
            await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId: n.id }) });
        } catch { /* optimistic */ }
        if (n.link) router.push(n.link);
    }
    async function markAll() {
        setNotifs(prev => prev.map(x => ({ ...x, read: true })));
        try {
            await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) });
        } catch { /* optimistic */ }
    }
    async function deleteOne(id: number) {
        setNotifs(prev => prev.filter(x => x.id !== id));
        try { await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' }); } catch { /* optimistic */ }
    }
    async function clearAll() {
        if (!confirm('Delete all notifications?')) return;
        setNotifs([]);
        try { await fetch('/api/notifications', { method: 'DELETE' }); } catch { /* optimistic */ }
    }

    return (
        <div className="front-notif" style={{ maxWidth: 680, margin: '24px auto', padding: '0 14px 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button onClick={() => router.back()} aria-label="Back" className="front-notif-back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a2e', display: 'inline-flex', padding: 4 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <h1 className="front-notif-title" style={{ fontSize: 22, fontWeight: 800, margin: 0, flex: 1 }}>
                    Notifications {unread > 0 && <span style={{ color: '#0858f7' }}>({unread})</span>}
                </h1>
                {notifs.length > 0 && (
                    <>
                        <button onClick={markAll} title="Mark all read" style={{ background: 'none', border: 'none', color: '#0858f7', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>Mark all read</button>
                        <button onClick={clearAll} title="Delete all" aria-label="Delete all" style={{ background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', display: 'inline-flex', padding: 4 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </>
                )}
            </div>

            <div className="front-notif-card" style={{ background: '#fff', borderRadius: 14, border: '1px solid #eceef3', overflow: 'hidden' }}>
                {notifs.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9aa0b3' }}>No notifications yet.</div>
                ) : notifs.map(n => {
                    const v = resolveVisual(n.type, iconConfig);
                    return (
                        <div key={n.id} className="front-notif-item" style={{
                            display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f2f6',
                            background: n.read ? 'transparent' : 'rgba(8,88,247,0.08)',
                        }}>
                            <button onClick={() => open(n)} style={{
                                display: 'flex', gap: 12, flex: 1, minWidth: 0, textAlign: 'left', padding: '13px 14px',
                                border: 'none', background: 'transparent', cursor: 'pointer', alignItems: 'flex-start',
                            }}>
                                <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: '50%', background: v.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v.icon}</span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="front-notif-msg" style={{ display: 'block', fontSize: 14, color: '#2c3146', lineHeight: 1.4 }}>{n.message}</span>
                                    <span style={{ display: 'block', fontSize: 12, color: '#0858f7', marginTop: 3 }}>{timeAgo(n.createdAt)}</span>
                                </span>
                            </button>
                            <button onClick={() => deleteOne(n.id)} aria-label="Delete notification" title="Delete" style={{ background: 'none', border: 'none', color: '#9aa0b3', cursor: 'pointer', padding: '0 12px', display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
