'use client';

/**
 * components/admin/SupportAlerts.tsx
 *
 * Green flash alerts (bottom-right) for incoming visitor support requests.
 * Each card has Accept / Decline and a dismiss (✕). Mounted globally in the
 * admin layout so an admin sees the request from any page.
 *
 *   Accept  → connect: opens a live chat (floating chatbox) with the visitor.
 *   Decline → tells the visitor the team is busy + asks for their email.
 *   ✕       → just hide the toast (request stays in the Support inbox).
 *
 * Lists are kept fresh by polling the admin support API on the 'support-request'
 * socket event (admins room).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMessaging } from '@/context/MessagingContext';
import { showToast } from '@/lib/toast';

interface Toast { id: number; guestName: string; lastMessage: string | null }

export default function SupportAlerts() {
    const { openConversation, reloadConversations } = useMessaging();
    const [toasts, setToasts] = useState<Toast[]>([]);
    const dismissedRef = useRef<Set<number>>(new Set());

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/support');
            if (!res.ok) return; // e.g. no manage-support permission
            const data = await res.json();
            const waiting: Toast[] = (data.conversations ?? [])
                .filter((c: any) => c.status === 'waiting' && !dismissedRef.current.has(c.id))
                .map((c: any) => ({ id: c.id, guestName: c.guestName, lastMessage: c.lastMessage }));
            setToasts(waiting);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        refresh();
        const socket: Socket = io({ path: '/api/socket' });
        socket.on('connect', () => socket.emit('join-admin-room'));
        // A fresh connect request → RE-ARM this conversation: clear it from the
        // dismissed set so its Accept/Decline toast pops again in real time, even
        // if the admin accepted/ended/dismissed it earlier (reconnect case).
        socket.on('support-request', (p: { conversationId?: number }) => {
            if (p?.conversationId) dismissedRef.current.delete(p.conversationId);
            refresh();
        });
        socket.on('support-activity', () => refresh());
        return () => { socket.disconnect(); };
    }, [refresh]);

    const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

    const accept = async (t: Toast) => {
        dismissedRef.current.add(t.id);
        remove(t.id);
        try {
            await fetch(`/api/admin/support/${t.id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept: true }),
            });
            await reloadConversations();
            // Open a live chat window with the visitor.
            openConversation(t.id, { id: 0, name: `${t.guestName} (support)`, username: null, avatarUrl: null });
            showToast(`Connected with ${t.guestName} — chat opened.`, 'success');
        } catch {
            showToast('Could not accept the chat. Try again.', 'error');
        }
    };

    const decline = async (t: Toast) => {
        dismissedRef.current.add(t.id);
        remove(t.id);
        try {
            await fetch(`/api/admin/support/${t.id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decline: true }),
            });
            await reloadConversations();
            showToast(`Declined — ${t.guestName} was asked to leave their email.`, 'info');
        } catch {
            showToast('Could not decline the chat. Try again.', 'error');
        }
    };

    const dismiss = (id: number) => { dismissedRef.current.add(id); remove(id); };

    if (toasts.length === 0) return null;

    return (
        <div style={{ position: 'fixed', right: 16, top: 72, zIndex: 3500, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    background: '#fff', borderRadius: 12, overflow: 'hidden',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.22)', borderLeft: '5px solid #1a7f37',
                    animation: 'none',
                }}>
                    <div style={{ background: 'linear-gradient(135deg,#22a45a,#1a7f37)', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>🟢 New support request</span>
                        <button onClick={() => dismiss(t.id)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                    <div style={{ padding: '10px 12px', color: '#1a1a1a' }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{t.guestName}</div>
                        {t.lastMessage && (
                            <div style={{ fontSize: 12.5, color: '#666', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.lastMessage}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button onClick={() => accept(t)} style={{ flex: 1, background: '#1a7f37', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Accept</button>
                            <button onClick={() => decline(t)} style={{ flex: 1, background: '#fff', color: '#c0392b', border: '1px solid #e3b3ad', borderRadius: 8, padding: '7px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Decline</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
