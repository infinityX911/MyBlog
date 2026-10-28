'use client';

/**
 * app/(blog)/messages/page.tsx
 *
 * Full-page inbox for the public blog (used especially on mobile, where the
 * navbar dropdown doesn't fit). Lists the user's conversations; tapping one
 * opens it — support chats in the Support widget, normal DMs in a floating
 * chat window.
 */

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMessaging } from '@/context/MessagingContext';

export default function MessagesPage() {
    const { status } = useSession();
    const router = useRouter();
    const { conversations, reloadConversations, openConversation, deleteConversation, onlineUsers } = useMessaging();

    useEffect(() => { if (status === 'authenticated') reloadConversations(); }, [status, reloadConversations]);

    if (status === 'loading') return null;
    if (status !== 'authenticated') {
        return <div style={{ maxWidth: 680, margin: '40px auto', padding: 20 }}>Please <Link href="/login">log in</Link> to see your messages.</div>;
    }

    const openChat = (c: any) => {
        if (c.isSupport) window.dispatchEvent(new Event('open-support-chat'));
        else openConversation(c.id, c.peer);
    };
    const removeChat = (id: number) => {
        if (!confirm('Delete this conversation?')) return;
        deleteConversation(id);
    };

    return (
        <div className="front-msgs" style={{ maxWidth: 680, margin: '24px auto', padding: '0 14px 60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <button onClick={() => router.back()} aria-label="Back" className="front-msgs-back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a2e', display: 'inline-flex', padding: 4 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Messages</h1>
            </div>

            <div className="front-msgs-card" style={{ background: '#fff', borderRadius: 14, border: '1px solid #eceef3', overflow: 'hidden' }}>
                {conversations.length === 0 ? (
                    <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9aa0b3' }}>No messages yet.</div>
                ) : conversations.map(c => {
                    const online = c.peer?.id ? onlineUsers.has(c.peer.id) : false;
                    return (
                        <div key={c.id} className="front-msgs-item" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f2f6', background: '#fff' }}>
                            <button onClick={() => openChat(c)} style={{
                                display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textAlign: 'left',
                                padding: '13px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
                            }}>
                                <span style={{ position: 'relative', flexShrink: 0 }}>
                                    <img
                                        src={c.peer?.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.peer?.name || 'Support')}&background=5b4fcf&color=fff`}
                                        alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
                                    {!c.isSupport && (
                                        <span style={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: '50%', background: online ? '#34d399' : '#9aa0a6', border: '2px solid #fff' }} />
                                    )}
                                </span>
                                <span style={{ flex: 1, minWidth: 0 }}>
                                    <span className="front-msgs-name" style={{ display: 'block', fontWeight: 600, fontSize: 15, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.peer?.name || 'Support'}
                                    </span>
                                    <span style={{ display: 'block', fontSize: 13, color: '#9aa0b3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {c.lastMessage || ''}
                                    </span>
                                </span>
                                {c.unreadCount > 0 && (
                                    <span style={{ background: '#0858f7', color: '#fff', borderRadius: 10, fontSize: 11, padding: '1px 8px', lineHeight: '18px', flexShrink: 0 }}>{c.unreadCount}</span>
                                )}
                            </button>
                            <button onClick={() => removeChat(c.id)} aria-label="Delete conversation" title="Delete" style={{ background: 'none', border: 'none', color: '#9aa0b3', cursor: 'pointer', padding: '0 12px', display: 'inline-flex', flexShrink: 0 }}>
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
