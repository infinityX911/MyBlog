'use client';

/**
 * components/admin/SupportInbox.tsx
 *
 * Reusable visitor-support inbox (two-pane): live list of support chats +
 * thread with Accept / Decline (bot→human handoff) and reply. Used both as the
 * "Support" tab inside the Messages page and on the standalone /admin/support
 * route (deep-linked from the support notification with ?c=<id>).
 *
 * Backed by /api/admin/support* and live over Socket.io.
 */

import { Col, Row } from 'react-bootstrap';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { timeAgo } from '@/lib/notificationVisuals';
import { showToast } from '@/lib/toast';

interface ConvRow { id: number; guestName: string; status: string; lastMessage: string | null; lastMessageAt: string | null }
interface Msg { id: number; body: string; fromGuest: boolean; isBot: boolean; senderId: number | null; createdAt: string }

export default function SupportInbox() {
    const [list, setList] = useState<ConvRow[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [thread, setThread] = useState<Msg[]>([]);
    const [status, setStatus] = useState('open');
    const [guestName, setGuestName] = useState('Visitor');
    const [text, setText] = useState('');
    const bodyRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<number | null>(null);
    selectedRef.current = selectedId;
    const socketRef = useRef<Socket | null>(null);

    const scrollDown = () => requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; });

    const loadList = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/support');
            if (res.ok) { const d = await res.json(); setList(d.conversations ?? []); }
        } catch { /* ignore */ }
    }, []);

    const loadThread = useCallback(async (id: number) => {
        try {
            const res = await fetch(`/api/admin/support/${id}`);
            if (res.ok) {
                const d = await res.json();
                setThread(d.messages ?? []);
                setStatus(d.status);
                setGuestName(d.guestName || 'Visitor');
                scrollDown();
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { loadList(); }, [loadList]);

    // Deep link (?c=<id>) from the support notification opens that chat.
    useEffect(() => {
        const c = Number(new URLSearchParams(window.location.search).get('c'));
        if (c) {
            setSelectedId(c);
            selectedRef.current = c;
            loadThread(c);
            socketRef.current?.emit('join-conversation', c);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadThread]);

    useEffect(() => {
        const socket: Socket = io({ path: '/api/socket' });
        socketRef.current = socket;
        socket.on('connect', () => {
            socket.emit('join-admin-room');
            if (selectedRef.current) socket.emit('join-conversation', selectedRef.current);
        });
        const onActivity = (p: { conversationId: number }) => {
            loadList();
            if (p?.conversationId && p.conversationId === selectedRef.current) loadThread(p.conversationId);
        };
        socket.on('support-request', onActivity);
        socket.on('support-activity', onActivity);
        socket.on('support-message', onActivity);
        return () => { socket.disconnect(); socketRef.current = null; };
    }, [loadList, loadThread]);

    const select = (id: number) => {
        setSelectedId(id);
        socketRef.current?.emit('join-conversation', id);
        loadThread(id);
    };

    const accept = async () => {
        if (!selectedId) return;
        try {
            await fetch(`/api/admin/support/${selectedId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept: true }),
            });
            loadThread(selectedId); loadList();
            showToast(`Connected with ${guestName}. You can reply now.`, 'success');
        } catch { showToast('Could not accept the chat.', 'error'); }
    };

    const decline = async () => {
        if (!selectedId) return;
        try {
            await fetch(`/api/admin/support/${selectedId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decline: true }),
            });
            loadThread(selectedId); loadList();
            showToast(`Declined — ${guestName} was asked to leave their email.`, 'info');
        } catch { showToast('Could not decline the chat.', 'error'); }
    };

    const leave = async () => {
        if (!selectedId) return;
        try {
            await fetch(`/api/admin/support/${selectedId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leave: true }),
            });
            loadThread(selectedId); loadList();
            showToast('You left the chat — the bot will take over.', 'info');
        } catch { showToast('Could not leave the chat.', 'error'); }
    };

    const reply = async (e: React.FormEvent) => {
        e.preventDefault();
        const t = text.trim();
        if (!t || !selectedId) return;
        setText('');
        try {
            const res = await fetch(`/api/admin/support/${selectedId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: t }),
            });
            if (res.ok) { const d = await res.json(); setThread(d.messages ?? []); setStatus(d.status); scrollDown(); loadList(); }
        } catch { /* ignore */ }
    };

    const badgeColors = (s: string) =>
        s === 'waiting' ? { bg: '#fdecc8', fg: '#9a6700' }
        : s === 'busy' ? { bg: '#f8d7da', fg: '#842029' }
        : { bg: '#cdebd5', fg: '#1a7f37' };

    return (
        <Row>
            <Col xs={12} sm={5} md={4}>
                <div className="card shadow border-0 p-2 mt-1" style={{ minHeight: 480 }}>
                    <h3 className="hd px-2 pt-2">Active chats</h3>
                    {list.length === 0 && <p className="para px-2" style={{ color: '#888', fontSize: 13 }}>No active support chats.</p>}
                    {list.map(c => {
                        const bc = badgeColors(c.status);
                        return (
                            <button key={c.id} onClick={() => select(c.id)} style={{
                                display: 'block', textAlign: 'left', width: '100%', border: 'none', cursor: 'pointer',
                                background: selectedId === c.id ? 'rgba(8,88,247,0.08)' : 'transparent', borderRadius: 8, padding: '10px 8px', color: 'inherit',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                    <span style={{ fontWeight: 600 }}>{c.guestName}</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: bc.bg, color: bc.fg }}>
                                        {c.status.toUpperCase()}
                                    </span>
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.65, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.lastMessage || '—'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </Col>

            <Col xs={12} sm={7} md={8}>
                <div className="card shadow border-0 mt-1" style={{ minHeight: 480, display: 'flex', flexDirection: 'column' }}>
                    {!selectedId ? (
                        <div className="para" style={{ margin: 'auto', color: '#888', padding: 40 }}>Select a chat to view it.</div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bs-border-color,#e3e3e3)' }}>
                                <span style={{ fontWeight: 600 }}>{guestName} · <span style={{ opacity: 0.6, fontWeight: 400 }}>{status}</span></span>
                                {status === 'waiting' && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={accept} style={{ background: '#1a7f37', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                                        <button onClick={decline} style={{ background: '#fff', color: '#c0392b', border: '1px solid #e3b3ad', borderRadius: 8, padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}>Decline</button>
                                    </div>
                                )}
                            </div>

                            <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420 }}>
                                {thread.map(m => {
                                    const mine = m.senderId !== null;
                                    // Join/leave = subtle centered system notice, not a bubble.
                                    if (m.isBot && /(joined|left) the chat/i.test(m.body)) {
                                        return (
                                            <div key={m.id} style={{ alignSelf: 'center', fontSize: 11, color: '#9aa0a6', margin: '4px 0' }}>
                                                {m.body}
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
                                            <div style={{
                                                background: mine ? '#0858f7' : (m.isBot ? 'var(--seo-panel-header-bg,#eceaf9)' : 'var(--seo-panel-header-bg,#f1f3f7)'),
                                                color: mine ? '#fff' : 'inherit',
                                                padding: '8px 12px', borderRadius: 14, fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            }}>
                                                {!mine && <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, marginBottom: 2 }}>{m.isBot ? 'Support Bot' : 'VISITOR'}</div>}
                                                {m.body}
                                            </div>
                                            <div style={{ fontSize: 10, opacity: 0.5, textAlign: mine ? 'right' : 'left', marginTop: 2 }}>{timeAgo(m.createdAt)}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            <form onSubmit={reply} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--bs-border-color,#e3e3e3)' }}>
                                <input value={text} onChange={e => setText(e.target.value)} placeholder={status === 'live' ? 'Reply to visitor…' : 'Accept the chat to reply…'}
                                    disabled={status !== 'live'}
                                    style={{ flex: 1, border: '1px solid var(--bs-border-color,#dcdcdc)', borderRadius: 20, padding: '8px 14px', fontSize: 14, outline: 'none', background: 'var(--input-bg,transparent)', color: 'inherit' }} />
                                <button type="submit" disabled={status !== 'live'} style={{ background: '#0858f7', color: '#fff', border: 'none', borderRadius: 20, padding: '0 20px', fontWeight: 600, cursor: status === 'live' ? 'pointer' : 'default', opacity: status === 'live' ? 1 : 0.5 }}>Send</button>
                            </form>
                        </>
                    )}
                </div>
            </Col>
        </Row>
    );
}
