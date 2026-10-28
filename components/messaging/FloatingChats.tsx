'use client';

/**
 * components/messaging/FloatingChats.tsx
 *
 * Renders the open chat windows as floating cards in the bottom-right corner
 * (Facebook-style). Driven entirely by MessagingContext, so any page that
 * calls openChatWith()/openConversation() makes a window appear here.
 *
 * Self-contained inline styles (no extra CSS file needed); works in both the
 * admin panel and the public blog as long as <MessagingProvider> wraps them.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useMessaging, type ChatMsg, type Peer } from '@/context/MessagingContext';

function avatarFor(peer: Peer | null): string {
    if (peer?.avatarUrl) return peer.avatarUrl;
    const name = peer?.name || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0858f7&color=fff`;
}

// Bot-fronted "Support" avatar (matches the visitor widget) — used for bot lines
// inside a support chat so they're visually distinct from the visitor's own.
const SUPPORT_BOT_AVATAR = 'https://ui-avatars.com/api/?name=Support&background=5b4fcf&color=fff&bold=true';

function ChatWindowCard({
    conversationId, peer, messages, minimized, loading, peerLastReadAt,
}: {
    conversationId: number;
    peer: Peer | null;
    messages: ChatMsg[];
    minimized: boolean;
    loading: boolean;
    peerLastReadAt: string | null;
}) {
    const { sendMessage, closeChat, toggleMinimize, conversations, onlineUsers } = useMessaging();
    const { data: session } = useSession();
    const [text, setText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [leaveChoice, setLeaveChoice] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);

    // Detect a support chat from the conversation metadata (robust): once the
    // window loads, the admin's peer becomes the real seeker, so peer.id is no
    // longer 0 — relying on that alone would break the admin's End/Leave actions.
    const convoMeta = conversations.find(c => c.id === conversationId);
    const isSupport = convoMeta?.isSupport ?? (peer?.id === 0 || peer?.name === 'Support');
    const unreadCount = convoMeta?.unreadCount ?? 0; // shown on the header when minimized
    const peerOnline = peer?.id ? onlineUsers.has(peer.id) : false;
    // Staff manage support (leave/transfer/end); visitors just end their chat.
    const perms: string[] = (session?.user as any)?.permissions ?? [];
    const isStaff = perms.includes('manage-support') || perms.includes('view-admin-notifications');

    // ── Admin support actions (only meaningful for a staff-viewed support chat) ──
    const postAdmin = async (payload: Record<string, unknown>) => {
        try {
            await fetch(`/api/admin/support/${conversationId}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
            });
        } catch { /* ignore */ }
    };
    const endAsAdmin = async () => { setShowMenu(false); await postAdmin({ end: true }); closeChat(conversationId); };
    const leaveKeepBot = async () => { setLeaveChoice(false); await postAdmin({ leave: true }); closeChat(conversationId); };
    const leaveTransfer = async () => { setLeaveChoice(false); await postAdmin({ leave: true, transfer: true }); closeChat(conversationId); };

    useEffect(() => {
        if (!minimized && bodyRef.current) {
            bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
        }
    }, [messages, minimized]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        sendMessage(conversationId, t);
        setText('');
    };

    const title = peer?.name || 'Conversation';
    // The user's profile is clickable (admin viewing a support seeker, or a peer
    // DM). The support BOT (id 0) is not a real user, so it's never linkable —
    // i.e. the visitor can't click the "admin/support" identity.
    const profileHref = peer && peer.id > 0 ? `/u/${peer.id}` : null;

    // FB-style "Seen": the id of the last message I sent that the peer has read
    // (their lastReadAt is at/after the message time). Shown once, under it.
    const lastSeenMineId = (() => {
        if (!peerLastReadAt) return null;
        const readTs = new Date(peerLastReadAt).getTime();
        let id: number | string | null = null;
        for (const m of messages) {
            if (m.mine && !m.pending && new Date(m.createdAt).getTime() <= readTs) id = m.id;
        }
        return id;
    })();

    return (
        <div style={{
            width: 300, background: '#fff', color: '#1a1a1a',
            borderRadius: '10px 10px 0 0', boxShadow: '0 6px 24px rgba(0,0,0,0.22)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            border: '1px solid #e3e3e3',
        }}>
            {/* Header */}
            <div
                onClick={() => toggleMinimize(conversationId)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: '#0858f7', color: '#fff', cursor: 'pointer',
                }}
            >
                {(() => {
                    const avatarNode = (
                        <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                            <img src={avatarFor(peer)} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                            <span title={peerOnline ? 'Online' : 'Offline'} style={{ position: 'absolute', right: -1, bottom: -1, width: 9, height: 9, borderRadius: '50%', background: peerOnline ? '#34d399' : '#9aa0a6', border: '2px solid #0858f7' }} />
                        </span>
                    );
                    return profileHref
                        ? <Link href={profileHref} onClick={(e) => e.stopPropagation()} title={`View ${title}'s profile`} style={{ display: 'inline-flex' }}>{avatarNode}</Link>
                        : avatarNode;
                })()}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {profileHref
                        ? <Link href={profileHref} onClick={(e) => e.stopPropagation()} title={`View ${title}'s profile`} style={{ color: 'inherit', textDecoration: 'none' }}>{title}</Link>
                        : title}
                    {peer?.role && (
                        <span style={{ background: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, letterSpacing: 0.3 }}>
                            {peer.role}
                        </span>
                    )}
                    {isSupport && (
                        <span style={{ background: 'rgba(255,255,255,0.22)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999, letterSpacing: 0.3 }}>
                            SUPPORT
                        </span>
                    )}
                    {minimized && unreadCount > 0 && (
                        <span style={{ marginLeft: 'auto', background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </span>

                {/* Settings gear */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(v => !v); }}
                        title="Settings"
                        style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
                    >⚙</button>
                    {showMenu && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ position: 'absolute', top: 24, right: 0, background: '#fff', color: '#1a1a1a', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', overflow: 'hidden', minWidth: 170, zIndex: 5 }}
                        >
                            <button
                                onClick={() => { setShowMenu(false); toggleMinimize(conversationId); }}
                                style={menuItem}
                            >{minimized ? 'Expand' : 'Minimize'}</button>

                            {isSupport && isStaff ? (
                                <>
                                    <button
                                        onClick={() => { setShowMenu(false); setLeaveChoice(true); }}
                                        style={menuItem}
                                    >Leave the chat…</button>
                                    <button
                                        onClick={endAsAdmin}
                                        style={{ ...menuItem, color: '#c0392b' }}
                                    >End chat</button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { setShowMenu(false); closeChat(conversationId); }}
                                    style={{ ...menuItem, color: '#c0392b' }}
                                >End chat</button>
                            )}
                        </div>
                    )}
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); toggleMinimize(conversationId); }}
                    title={minimized ? 'Expand' : 'Minimize'}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                >{minimized ? '▢' : '—'}</button>
                <button
                    onClick={(e) => { e.stopPropagation(); closeChat(conversationId); }}
                    title="Close"
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                >✕</button>
            </div>

            {!minimized && (
                <>
                    {/* Messages */}
                    <div ref={bodyRef} style={{ height: 280, overflowY: 'auto', padding: 10, background: '#f5f7fb', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {loading && <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>Loading…</div>}
                        {!loading && messages.length === 0 && (
                            <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginTop: 20 }}>
                                Say hello 👋
                            </div>
                        )}
                        {messages.map(m => {
                            if (/(joined|left) the chat/i.test(m.body)) {
                                return (
                                    <div key={m.id} style={{ alignSelf: 'center', fontSize: 11, color: '#9aa0a6', margin: '2px 0' }}>
                                        {m.body.replace(/^🤖\s*/, '')}
                                    </div>
                                );
                            }
                            const bubble = (
                                <div style={{
                                    background: m.mine ? '#0858f7' : (m.isBot ? '#eceaf9' : '#fff'),
                                    color: m.mine ? '#fff' : '#1a1a1a',
                                    border: m.mine ? 'none' : '1px solid #e3e3e3',
                                    padding: '6px 10px', borderRadius: 12, fontSize: 13,
                                    opacity: m.pending ? 0.6 : 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                                }}>
                                    {m.body}
                                </div>
                            );
                            if (m.mine) {
                                return (
                                    <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '78%' }}>
                                        {bubble}
                                        {m.id === lastSeenMineId && (
                                            <div style={{ fontSize: 10, color: '#8a8d91', textAlign: 'right', marginTop: 2 }}>Seen</div>
                                        )}
                                    </div>
                                );
                            }
                            // Incoming → show whose message it is: the bot avatar for
                            // bot lines, the visitor's/peer's real photo otherwise.
                            return (
                                <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                                    <img src={m.isBot ? SUPPORT_BOT_AVATAR : avatarFor(peer)} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                    {bubble}
                                </div>
                            );
                        })}
                    </div>

                    {/* Composer */}
                    <form onSubmit={submit} style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid #eee', background: '#fff' }}>
                        <input
                            value={text}
                            onChange={e => setText(e.target.value)}
                            placeholder="Type a message…"
                            style={{ flex: 1, border: '1px solid #dcdcdc', borderRadius: 16, padding: '6px 12px', fontSize: 13, outline: 'none', color: '#1a1a1a' }}
                        />
                        <button type="submit" style={{ background: '#0858f7', color: '#fff', border: 'none', borderRadius: 16, padding: '0 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            Send
                        </button>
                    </form>
                </>
            )}

            {/* Leave-the-chat choice (green-flash style), shown when an admin
                chooses to leave: hand back to the bot, or transfer to another
                team member. */}
            {leaveChoice && (
                <div style={{ position: 'fixed', right: 16, top: 72, zIndex: 3600, width: 320, background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.22)', borderLeft: '5px solid #1a7f37' }}>
                    <div style={{ background: 'linear-gradient(135deg,#22a45a,#1a7f37)', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>🚪 Leave this chat?</span>
                        <button onClick={() => setLeaveChoice(false)} aria-label="Cancel" style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 15, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                    </div>
                    <div style={{ padding: '12px', color: '#1a1a1a' }}>
                        <div style={{ fontSize: 13, color: '#444', marginBottom: 12 }}>
                            What should happen to the visitor after you leave?
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button onClick={leaveKeepBot} style={{ background: '#0858f7', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                Keep with the bot
                            </button>
                            <button onClick={leaveTransfer} style={{ background: '#fff', color: '#1a7f37', border: '1px solid #9dccb0', borderRadius: 8, padding: '9px 0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                                Transfer to another admin
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const menuItem: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
    border: 'none', background: 'transparent', fontSize: 13, cursor: 'pointer',
};

export default function FloatingChats() {
    const { windows } = useMessaging();
    if (windows.length === 0) return null;

    return (
        <div style={{
            // Pinned bottom-right. On the blog the support widget publishes its
            // footprint as --fc-right-offset so these DM windows sit to its LEFT
            // (side by side, spaced) instead of overlapping it. On the admin panel
            // there's no widget, so the var is 0 and this stays at right:16.
            position: 'fixed', right: 'calc(16px + var(--fc-right-offset, 0px))', bottom: 0, zIndex: 2000,
            display: 'flex', alignItems: 'flex-end', gap: 12,
        }}>
            {windows.map(w => (
                <ChatWindowCard key={w.conversationId} {...w} />
            ))}
        </div>
    );
}
