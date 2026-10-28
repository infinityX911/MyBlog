'use client';

/**
 * app/admin/(protected)/messages/page.tsx
 *
 * ONE unified inbox (HOTASH design). Normal DMs and visitor support chats all
 * appear in the SAME list under the search box. The grid icon filters the list
 * (Active Users / All / Unread / Read / Support Chats). Selecting any chat —
 * normal or support — opens it in the same chat box on the right. For a waiting
 * support chat, Accept / Decline appears above the composer.
 */

import { Col, Container, Row } from 'react-bootstrap';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { io, Socket } from 'socket.io-client';
import { useMessaging, type Peer } from '@/context/MessagingContext';
import { timeAgo } from '@/lib/notificationVisuals';
import { showToast } from '@/lib/toast';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import MessageList, { type MsgFilter } from '@/components/admin/messages/MessageList';
import MessageChatBox from '@/components/admin/messages/MessageChatBox';

interface ThreadMsg { id: number | string; text: string; sender: string; time: string }
interface SupportRow { id: number; guestName: string; avatarUrl?: string | null; userId?: number | null; status: string; lastMessage: string | null; lastMessageAt: string | null }

function avatarFor(name: string, url?: string | null): string {
    if (url) return url;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0858f7&color=fff`;
}

export default function MessagesPage() {
    const router = useRouter();
    const { data: session } = useSession();
    const myId = Number((session?.user as any)?.id) || 0;

    const { conversations, reloadConversations, deleteConversation, markConversationUnread, onlineUsers } = useMessaging();
    const [supportList, setSupportList] = useState<SupportRow[]>([]);
    const [filter, setFilter] = useState<MsgFilter>('all');
    const [search, setSearch] = useState('');

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isSupportSel, setIsSupportSel] = useState(false);
    const [peerName, setPeerName] = useState('Conversation');
    const [peerAvatar, setPeerAvatar] = useState('');
    const [peerId, setPeerId] = useState<number | null>(null);   // for presence
    const [peerRole, setPeerRole] = useState<string | null>(null); // role badge (e.g. Viewer)
    const [status, setStatus] = useState('');           // support status when applicable
    const [messages, setMessages] = useState<ThreadMsg[]>([]);
    const selRef = useRef<{ id: number | null; support: boolean }>({ id: null, support: false });
    selRef.current = { id: selectedId, support: isSupportSel };

    // ── Loaders ────────────────────────────────────────────────────────────────
    const loadSupportList = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/support');
            if (res.ok) { const d = await res.json(); setSupportList(d.conversations ?? []); }
        } catch { /* ignore (e.g. no permission) */ }
    }, []);

    const loadNormalThread = useCallback(async (id: number, hintName: string, hintAvatar: string) => {
        setSelectedId(id); setIsSupportSel(false); setStatus(''); setPeerId(null); setPeerRole(null);
        setPeerName(hintName); setPeerAvatar(hintAvatar); setMessages([]);
        try {
            const res = await fetch(`/api/messages/${id}`);
            if (res.ok) {
                const d = await res.json();
                if (d.peer) { setPeerName(d.peer.name); setPeerAvatar(avatarFor(d.peer.name, d.peer.avatarUrl)); setPeerId(d.peer.id ?? null); setPeerRole(d.peer.role ?? null); }
                setMessages((d.messages ?? []).map((m: any) => ({ id: m.id, text: m.body, sender: m.mine ? 'outgoing' : 'incoming', time: timeAgo(m.createdAt) })));
                reloadConversations();
            }
        } catch { /* ignore */ }
    }, [reloadConversations]);

    const loadSupportThread = useCallback(async (id: number) => {
        setSelectedId(id); setIsSupportSel(true); setMessages([]);
        try {
            const res = await fetch(`/api/admin/support/${id}`);
            if (res.ok) {
                const d = await res.json();
                setStatus(d.status);
                setPeerName(d.guestName || 'Visitor');
                setPeerAvatar(avatarFor(d.guestName || 'Visitor', d.avatarUrl));
                setPeerId(d.userId ?? null);
                setPeerRole(d.role ?? null);
                setMessages((d.messages ?? []).map((m: any) => ({
                    id: m.id,
                    text: (m.isBot ? '🤖 ' : '') + m.body,
                    sender: m.senderId !== null ? 'outgoing' : 'incoming',
                    time: timeAgo(m.createdAt),
                })));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadSupportList(); }, [loadSupportList]);

    // Deep link from the support notification: /admin/messages?c=<id> opens that
    // visitor's support chat directly (and shows the Support filter).
    useEffect(() => {
        const c = Number(new URLSearchParams(window.location.search).get('c'));
        if (c) { setFilter('support'); loadSupportThread(c); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadSupportThread]);

    // ── Live updates ─────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!myId) return;
        const socket: Socket = io({ path: '/api/socket' });
        socket.on('connect', () => { socket.emit('join-user', myId); socket.emit('join-admin-room'); });
        socket.on('new-message', (p: { conversationId: number }) => {
            if (!selRef.current.support && p.conversationId === selRef.current.id) loadNormalThread(p.conversationId, peerName, peerAvatar);
        });
        const onSupport = (p: { conversationId: number }) => {
            loadSupportList();
            if (selRef.current.support && p?.conversationId === selRef.current.id) loadSupportThread(p.conversationId);
        };
        socket.on('support-request', onSupport);
        socket.on('support-activity', onSupport);
        socket.on('support-message', onSupport);
        return () => { socket.disconnect(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myId]);

    // ── Send / accept / decline ─────────────────────────────────────────────────
    const onSend = async (raw: string) => {
        const t = raw.trim();
        if (!t || !selectedId) return;
        if (isSupportSel) {
            if (status !== 'live') { showToast('Accept the chat first to reply.', 'info'); return; }
            try {
                const res = await fetch(`/api/admin/support/${selectedId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: t }) });
                if (res.ok) loadSupportThread(selectedId);
            } catch { /* ignore */ }
            return;
        }
        const tempId = `tmp-${Date.now()}`;
        setMessages(prev => [...prev, { id: tempId, text: t, sender: 'outgoing', time: 'now' }]);
        try {
            const res = await fetch(`/api/messages/${selectedId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: t }) });
            if (res.ok) reloadConversations();
        } catch { /* ignore */ }
    };

    // Accept / Decline / Leave are handled from the green-flash support alerts
    // (SupportAlerts) and the floating chat settings — not from this page.

    // ── Build the ONE unified list ──────────────────────────────────────────────
    const normalItems = conversations.filter(c => !c.isSupport).map(c => ({
        id: c.id, kind: 'normal' as const,
        avatar: avatarFor(c.peer?.name || 'User', c.peer?.avatarUrl),
        name: c.peer?.name || 'Conversation',
        isOnline: c.peer?.id ? onlineUsers.has(c.peer.id) : false, isActive: selectedId === c.id && !isSupportSel,
        unreadCount: c.unreadCount, messages: [], message: c.lastMessage || '',
        time: c.lastMessageAt ? timeAgo(c.lastMessageAt) : '', peerId: c.peer?.id,
    }));
    const supportItems = supportList.map(s => ({
        id: s.id, kind: 'support' as const,
        avatar: avatarFor(s.guestName, s.avatarUrl),
        name: `${s.guestName} (support)`,
        isOnline: s.userId ? onlineUsers.has(s.userId) : false, isActive: selectedId === s.id && isSupportSel,
        unreadCount: s.status === 'waiting' ? 1 : 0, messages: [], message: s.lastMessage || '',
        time: s.lastMessageAt ? timeAgo(s.lastMessageAt) : '', peerId: s.userId ?? undefined,
    }));

    let items = [...supportItems, ...normalItems];
    if (filter === 'support') items = supportItems;
    else if (filter === 'unread') items = items.filter(i => i.unreadCount > 0);
    else if (filter === 'read') items = items.filter(i => i.unreadCount === 0);
    if (search.trim()) items = items.filter(i => i.name.toLowerCase().includes(search.trim().toLowerCase()));

    const onSelect = (id: number) => {
        const item = [...supportItems, ...normalItems].find(i => i.id === id);
        if (!item) return;
        if (item.kind === 'support') loadSupportThread(id);
        else loadNormalThread(id, item.name, item.avatar);
        // On mobile the chat column stacks BELOW the conversation list, so a tap
        // renders it off-screen and feels like "nothing opened". Scroll it into
        // view so the conversation visibly opens.
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setTimeout(() => {
                document.querySelector('.SecondColMsg')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 120);
        }
    };

    return (
        <Container fluid className="right-content msg-shell">
            <HeaderPanel
                title="Messages"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Messages', path: '/admin/messages' },
                ]}
            />
            <Row className="h-100">
                <Col xs={12} sm={4} md={4} lg={4} xl={4} className="thatCol FirstColMsg">
                    <MessageList
                        messages={items}
                        onSelectConversation={onSelect}
                        filter={filter}
                        onFilterChange={setFilter}
                        search={search}
                        onSearchChange={setSearch}
                        onViewProfile={(conv: any) => { if (conv.peerId) router.push(`/u/${conv.peerId}`); else showToast('This is a guest visitor — no profile.', 'info'); }}
                        onMarkUnread={(id) => { markConversationUnread(id); showToast('Marked as unread.', 'info'); }}
                        onDelete={async (id) => { if (confirm('Delete this conversation from your view?')) { if (selectedId === id) setSelectedId(null); await deleteConversation(id); loadSupportList(); showToast('Conversation removed from your view.', 'success'); } }}
                        onBlock={() => showToast('Blocking isn’t available yet.', 'info')}
                    />
                </Col>

                <Col xs={12} sm={8} md={8} lg={8} xl={8} className="thatCol SecondColMsg">
                    {selectedId ? (
                        <MessageChatBox
                            senderInfo={{ avatar: peerAvatar, name: peerName, isOnline: peerId ? onlineUsers.has(peerId) : false, role: peerRole, isSupport: isSupportSel }}
                            messages={messages as any}
                            onSend={onSend}
                        />
                    ) : (
                        <div className="para" style={{ padding: '20px' }}>
                            Select a conversation to start chatting
                        </div>
                    )}
                </Col>
            </Row>
        </Container>
    );
}
