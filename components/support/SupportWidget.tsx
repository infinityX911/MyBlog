'use client';

/**
 * components/support/SupportWidget.tsx
 *
 * Floating "Support" chat bubble shown on every blog page (works for
 * anonymous visitors). Talks to /api/support*:
 *   - generates/keeps a guestId in localStorage
 *   - starts the chat (bot greeting), sends messages, can request a human
 *   - live updates via Socket.io (joins `conversation:<id>`)
 *
 * Bottom-LEFT so it doesn't collide with the peer-DM FloatingChats (bottom-right).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { playPing } from '@/lib/notifySound';

interface Msg { id: number; body: string; fromGuest: boolean; isBot: boolean; senderId: number | null; senderName?: string | null; senderAvatar?: string | null; senderRole?: string | null; createdAt: string }

const SUPPORT_BOT_AVATAR = 'https://ui-avatars.com/api/?name=Support&background=5b4fcf&color=fff&bold=true';
const avatarFallback = (name?: string | null) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Agent')}&background=6d5cf0&color=fff`;

const CLOSED_KEY = 'support_closed';
const GUEST_KEY = 'support_guest_id';
const CONVO_KEY = 'support_convo_id';      // remembers an active conversation across reloads
const SEEN_KEY  = 'support_last_seen_at';  // epoch ms the visitor last had the chat open

function getGuestId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
        id = (crypto?.randomUUID?.() || `g-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(GUEST_KEY, id);
    }
    return id;
}

export default function SupportWidget() {
    const { data: session } = useSession();
    // Staff (anyone who can handle support) shouldn't see the visitor widget on
    // the public site — they manage support from the admin panel instead.
    const perms: string[] = (session?.user as any)?.permissions ?? [];
    const isStaff = perms.includes('manage-support') || perms.includes('view-admin-notifications');

    const [open, setOpen] = useState(false);
    const [started, setStarted] = useState(false);
    const [closed, setClosed] = useState(true);     // hidden until we decide to show
    const [showMenu, setShowMenu] = useState(false); // header gear menu
    const [needsAuth, setNeedsAuth] = useState(false); // guest tried to reach a human while logged out
    const [convoId, setConvoId] = useState<number | null>(null);
    const [unread, setUnread] = useState(0); // unseen admin/bot messages while minimized
    const [status, setStatus] = useState<string>('open');
    const [messages, setMessages] = useState<Msg[]>([]);
    const [text, setText] = useState('');
    const [email, setEmail] = useState('');

    // On first visit: show the bubble and auto-open once. If the visitor has
    // previously closed it, stay hidden until they reopen from the navbar.
    useEffect(() => {
        if (isStaff) return;
        // Show only the minimized "Chat with us" bubble by default — do NOT
        // auto-expand the panel (that was the "chat open by default" behaviour).
        setClosed(localStorage.getItem(CLOSED_KEY) === '1');
        lastSeenRef.current = Number(localStorage.getItem(SEEN_KEY)) || 0;
    }, [isStaff]);

    // Reopen from anywhere (e.g. a navbar "Support" button) via a window event.
    useEffect(() => {
        const onOpen = () => {
            localStorage.removeItem(CLOSED_KEY);
            setClosed(false);
            setOpen(true);
        };
        window.addEventListener('open-support-chat', onOpen);
        return () => window.removeEventListener('open-support-chat', onOpen);
    }, []);

    const endChat = async () => {
        if (!confirm('End this support chat? It will be closed (you can start a new one any time).')) return;
        setShowMenu(false);
        const id = convoIdRef.current;
        if (id) {
            // Close (disable) the conversation — it is NOT deleted; history stays
            // and the composer becomes disabled on both sides.
            try {
                const res = await fetch(`/api/support/${id}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestId: guestIdRef.current, end: true }),
                });
                if (res.ok) { const d = await res.json(); setStatus(d.status); setMessages(d.messages ?? []); scrollDown(); }
            } catch { /* ignore */ }
        } else {
            setStatus('closed');
        }
    };

    // ✕ → hide the widget completely (no "Chat with us" bubble). Reopenable from
    // the navbar Support/Messages entry points (which fire 'open-support-chat').
    const hideWidget = () => {
        localStorage.setItem(CLOSED_KEY, '1');
        setClosed(true);
        setOpen(false);
        setShowMenu(false);
    };
    const guestIdRef = useRef('');
    const convoIdRef = useRef<number | null>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const lastSeenRef = useRef<number>(0);
    const prevUnreadRef = useRef<number>(0);

    convoIdRef.current = convoId;

    // Publish this widget's footprint (width + gap) as a CSS var so the DM
    // FloatingChats windows sit to its LEFT (side by side) rather than overlapping
    // it on the blog. Staff don't see the widget, so the offset is 0 there.
    useEffect(() => {
        const el = document.documentElement;
        const w = isStaff ? 0 : (rootRef.current?.offsetWidth || 0);
        el.style.setProperty('--fc-right-offset', w ? `${w + 16}px` : '0px');
    }, [isStaff, open, closed, started, unread, needsAuth, status, messages.length]);
    useEffect(() => () => { document.documentElement.style.removeProperty('--fc-right-offset'); }, []);

    const scrollDown = () => requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });

    const refresh = useCallback(async () => {
        const id = convoIdRef.current;
        if (!id) return;
        try {
            const res = await fetch(`/api/support/${id}?guestId=${encodeURIComponent(guestIdRef.current)}`);
            if (res.ok) {
                const data = await res.json();
                setStatus(data.status);
                setMessages(data.messages ?? []);
                scrollDown();
            }
        } catch { /* ignore */ }
    }, []);

    const start = useCallback(async (fresh = false) => {
        guestIdRef.current = getGuestId();
        try {
            const res = await fetch('/api/support', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId: guestIdRef.current, ...(fresh ? { fresh: true } : {}) }),
            });
            if (res.ok) {
                const data = await res.json();
                setConvoId(data.conversationId);
                convoIdRef.current = data.conversationId;
                try { localStorage.setItem(CONVO_KEY, String(data.conversationId)); } catch { /* ignore */ }
                setStatus(data.status);
                setMessages(data.messages ?? []);
                setStarted(true);
                scrollDown();
            }
        } catch { /* ignore */ }
    }, []);

    // Start once when first opened. The bot greets EVERYONE (anonymous visitors
    // included); login is only required later, when they ask for a human.
    useEffect(() => {
        if (open && !started) start();
    }, [open, started, start]);

    // Live updates — connect the realtime socket ONLY while the panel is open.
    // Anonymous visitors still get a background conversation + bot greeting on
    // load (via start()), but WITHOUT opening a Socket.io connection, so the
    // public page's initial load stays free of socket traffic and any failed-WS
    // console noise (cleaner Best-Practices score). Live updates resume the
    // instant the visitor opens the chat.
    useEffect(() => {
        if (!convoId || !open) return;
        const socket: Socket = io({ path: '/api/socket', reconnectionAttempts: 5 });
        socket.on('connect', () => socket.emit('join-conversation', { conversationId: convoId, guestId: guestIdRef.current }));
        socket.on('support-message', (p: { conversationId: number }) => {
            if (p.conversationId === convoIdRef.current) refresh();
        });
        return () => { socket.disconnect(); };
    }, [convoId, open, refresh]);

    // Resume an existing conversation on load (only if the visitor chatted
    // before — we never create one here), so the chat + unread badge survive a
    // page reload without auto-opening the panel.
    useEffect(() => {
        if (isStaff || started || convoIdRef.current) return;
        if (localStorage.getItem(CLOSED_KEY) === '1') return; // visitor hid the widget
        // Start the conversation in the BACKGROUND (stays minimized) so the bot
        // greets and the bubble can show an unread badge + ping before the
        // visitor ever opens the panel.
        start();
    }, [isStaff, started, start]);

    // Unread tracking: count admin/bot messages newer than the last time the
    // visitor had the chat open. Opening clears it (and records "seen now") so
    // the red badge behaves like Facebook's unread count.
    useEffect(() => {
        if (open) {
            const now = Date.now();
            lastSeenRef.current = now;
            try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ }
            setUnread(0);
            prevUnreadRef.current = 0;
        } else {
            const seen = lastSeenRef.current;
            const u = messages.filter(m => !m.fromGuest && new Date(m.createdAt).getTime() > seen).length;
            if (u > prevUnreadRef.current) playPing(); // ping when a NEW message arrives while minimized
            prevUnreadRef.current = u;
            setUnread(u);
        }
    }, [messages, open]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || !convoId) return;
        setText('');
        setMessages(prev => [...prev, { id: Date.now(), body: t, fromGuest: true, isBot: false, senderId: null, createdAt: new Date().toISOString() }]);
        scrollDown();
        try {
            const res = await fetch(`/api/support/${convoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId: guestIdRef.current, body: t }),
            });
            if (res.ok) { const d = await res.json(); setStatus(d.status); setMessages(d.messages ?? []); scrollDown(); }
        } catch { /* ignore */ }
    };

    const requestHuman = async () => {
        if (!convoId) return;
        // Must be signed in to talk to a human.
        if (!session?.user) {
            setNeedsAuth(true);
            setMessages(prev => [...prev, {
                id: Date.now(), body: 'To talk to a human, please sign up or log in first. 🙂',
                fromGuest: false, isBot: true, senderId: null, senderName: 'Support Bot', createdAt: new Date().toISOString(),
            }]);
            scrollDown();
            return;
        }
        try {
            const res = await fetch(`/api/support/${convoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId: guestIdRef.current, connect: true }),
            });
            if (res.ok) { const d = await res.json(); setStatus(d.status); setMessages(d.messages ?? []); scrollDown(); }
        } catch { /* ignore */ }
    };

    const sendWithEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const t = text.trim();
        const em = email.trim();
        if (!em || !convoId) return;
        setText('');
        if (t) setMessages(prev => [...prev, { id: Date.now(), body: t, fromGuest: true, isBot: false, senderId: null, createdAt: new Date().toISOString() }]);
        scrollDown();
        try {
            const res = await fetch(`/api/support/${convoId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId: guestIdRef.current, body: t, email: em }),
            });
            if (res.ok) { const d = await res.json(); setStatus(d.status); setMessages(d.messages ?? []); setEmail(''); scrollDown(); }
        } catch { /* ignore */ }
    };

    // Privacy: the visitor never sees which admin is behind the chat — only the
    // bot-fronted "Support" identity. So no agent name is surfaced anywhere.
    const statusLabel = status === 'live' ? 'Connected — chatting with our team'
        : status === 'waiting' ? 'Connecting you to an agent…'
        : "We typically reply in a few minutes";
    const dotColor = status === 'live' ? '#34d399' : status === 'waiting' ? '#fbbf24' : 'rgba(255,255,255,0.7)';

    // After the visitor leaves their email (status stays 'busy' as a ticket),
    // show the ended state. Once the thread is reopened (status 'open') we ignore
    // the old "saved your email" note in history so the composer comes back.
    const emailCaptured = messages.some(m => m.isBot && /saved your email/i.test(m.body));
    const ended = status === 'closed' || (status === 'busy' && emailCaptured);

    // Once a human has joined, surface the REAL agent (avatar + name + role) in
    // the header — taken from the most recent human (non-bot) agent message.
    const agent = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (!m.fromGuest && !m.isBot && m.senderName) {
                return { name: m.senderName, avatar: m.senderAvatar || null, role: m.senderRole || null };
            }
        }
        return null;
    })();
    const showAgent = status === 'live' && !!agent;

    if (isStaff) return null;

    return (
        <div ref={rootRef} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1900 }}>
            <style>{`@keyframes sw-blink{0%,80%,100%{opacity:.2}40%{opacity:1}}`}</style>
            {!open && !closed && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button
                        onClick={() => setOpen(true)}
                        aria-label="Open support chat"
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'linear-gradient(135deg,#6d5cf0,#5b4fcf)', color: '#fff', border: 'none', borderRadius: 999,
                            padding: '13px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(91,79,207,0.45)',
                        }}
                    >💬 Chat with us</button>
                    {unread > 0 && (
                        <span
                            aria-label={`${unread} unread message${unread !== 1 ? 's' : ''}`}
                            style={{
                                position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, padding: '0 5px',
                                borderRadius: 999, background: '#e74c3c', color: '#fff', fontSize: 11, fontWeight: 800,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)', border: '2px solid #fff',
                            }}
                        >{unread > 9 ? '9+' : unread}</span>
                    )}
                </div>
            )}

            {open && (
                <div style={{
                    width: 340, height: 480, background: '#fff', color: '#1a1a1a',
                    borderRadius: 16, boxShadow: '0 16px 50px rgba(0,0,0,0.28)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid #e7e7ef',
                }}>
                    {/* Header */}
                    <div style={{ background: 'linear-gradient(135deg,#6d5cf0,#5b4fcf)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {showAgent ? (
                                <img src={agent!.avatar || avatarFallback(agent!.name)} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.5)' }} />
                            ) : (
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
                            )}
                            <div>
                                <div style={{ fontWeight: 700, fontSize: showAgent ? 15 : 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {showAgent ? agent!.name : 'Support'}
                                    {showAgent && agent!.role && (
                                        <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(255,255,255,0.25)', padding: '1px 7px', borderRadius: 999, letterSpacing: 0.3 }}>{agent!.role}</span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11.5, opacity: 0.9, display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
                                    {statusLabel}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, position: 'relative' }}>
                            {/* Settings gear */}
                            <button onClick={() => setShowMenu(v => !v)} aria-label="Chat settings" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>⚙️</button>
                            {/* Minimize (keeps it reopenable from the bubble) */}
                            <button onClick={() => setOpen(false)} aria-label="Minimize" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>–</button>
                            {/* ✕ → hide completely (no bubble). Does NOT end the chat. */}
                            <button onClick={hideWidget} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>

                            {showMenu && (
                                <div style={{ position: 'absolute', top: 30, right: 0, background: '#fff', color: '#1a1a1a', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', minWidth: 150, zIndex: 5 }}>
                                    <button onClick={() => { setOpen(false); setShowMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer' }}>Minimize</button>
                                    <button onClick={endChat} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer', color: '#c0392b' }}>End chat</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Messages */}
                    <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 12, background: '#f5f7fb', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {messages.map(m => (
                            (m.isBot && /(joined|left) the chat/i.test(m.body)) ? (
                                <div key={m.id} style={{ alignSelf: 'center', fontSize: 11, color: '#9aa0a6', margin: '2px 0' }}>
                                    {m.body}
                                </div>
                            ) : (
                            <div key={m.id} style={{ alignSelf: m.fromGuest ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                                <div style={{
                                    background: m.fromGuest ? '#5b4fcf' : (m.isBot ? '#eceaf9' : '#fff'),
                                    color: m.fromGuest ? '#fff' : '#1a1a1a',
                                    border: m.fromGuest ? 'none' : '1px solid #e3e3e3',
                                    padding: '7px 11px', borderRadius: 12, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                }}>
                                    {!m.fromGuest && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                            {/* Bot → "Support Bot"; a human agent → real photo +
                                                name + role badge (e.g. Umair · Administrator). */}
                                            <img
                                                src={m.isBot ? SUPPORT_BOT_AVATAR : (m.senderAvatar || avatarFallback(m.senderName))}
                                                alt=""
                                                style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#5b4fcf' }}>
                                                {m.isBot ? 'Support Bot' : (m.senderName || 'Support')}
                                            </span>
                                            {!m.isBot && m.senderRole && (
                                                <span style={{ fontSize: 8.5, fontWeight: 800, background: '#5b4fcf', color: '#fff', padding: '0 5px', borderRadius: 999, lineHeight: '14px' }}>
                                                    {m.senderRole}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {m.body}
                                </div>
                            </div>
                            )
                        ))}

                        {/* Connecting indicator while waiting for an agent. */}
                        {status === 'waiting' && (
                            <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                                <div style={{ background: '#eceaf9', border: '1px solid #e3e3e3', padding: '9px 13px', borderRadius: 12, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                                    {[0, 1, 2].map(i => (
                                        <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#5b4fcf', display: 'inline-block', animation: `sw-blink 1.4s infinite ${i * 0.2}s` }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Connect-to-human (only in bot mode) */}
                    {status === 'open' && !needsAuth && (
                        <button onClick={requestHuman} style={{ border: 'none', borderTop: '1px solid #eee', background: '#fafafe', color: '#5b4fcf', padding: '8px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            🙋 Connect me to a human
                        </button>
                    )}

                    {/* Logged-out guest tried to reach a human → ask them to authenticate. */}
                    {status === 'open' && needsAuth && !session?.user && (
                        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #eee', background: '#fafafe', padding: 8 }}>
                            <button onClick={() => { window.location.href = '/signup'; }} style={{ flex: 1, background: '#5b4fcf', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Sign up</button>
                            <button onClick={() => { window.location.href = '/login'; }} style={{ flex: 1, background: '#fff', color: '#5b4fcf', border: '1px solid #5b4fcf', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Log in</button>
                        </div>
                    )}

                    {ended ? (
                        /* Chat ended (closed by support, or email left after busy) →
                           composer disabled; offer a fresh start. */
                        <div style={{ padding: 12, borderTop: '1px solid #eee', textAlign: 'center' }}>
                            <div style={{ fontSize: 12.5, color: '#888', marginBottom: 8 }}>This chat has ended.</div>
                            <button
                                onClick={() => { setMessages([]); start(true); }}
                                style={{ background: '#5b4fcf', color: '#fff', border: 'none', borderRadius: 16, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                            >Start a new chat</button>
                        </div>
                    ) : status === 'busy' ? (
                        /* Team busy → capture email + message and forward to the team. */
                        <form onSubmit={sendWithEmail} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderTop: '1px solid #eee' }}>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="Your email"
                                style={{ border: '1px solid #dcdcdc', borderRadius: 10, padding: '7px 12px', fontSize: 13, outline: 'none', color: '#1a1a1a' }}
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                                <input
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    placeholder="Your message…"
                                    style={{ flex: 1, border: '1px solid #dcdcdc', borderRadius: 16, padding: '7px 12px', fontSize: 13, outline: 'none', color: '#1a1a1a' }}
                                />
                                <button type="submit" style={{ background: '#5b4fcf', color: '#fff', border: 'none', borderRadius: 16, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Send</button>
                            </div>
                        </form>
                    ) : (
                        /* Normal composer */
                        <form onSubmit={send} style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #eee' }}>
                            <input
                                value={text}
                                onChange={e => setText(e.target.value)}
                                placeholder="Type a message…"
                                style={{ flex: 1, border: '1px solid #dcdcdc', borderRadius: 16, padding: '7px 12px', fontSize: 13, outline: 'none', color: '#1a1a1a' }}
                            />
                            <button type="submit" style={{ background: '#5b4fcf', color: '#fff', border: 'none', borderRadius: 16, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Send</button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}
