'use client';

/**
 * app/admin/(protected)/conversations/page.tsx
 *
 * Message oversight for admins: list every conversation (peer DMs + support),
 * filter by type, open a thread read-only, and moderate (Clear messages /
 * Delete conversation, plus bulk-delete via checkboxes). Gated by the
 * 'oversee-messages' permission.
 */
import { Col, Container, Row } from 'react-bootstrap';
import React, { useCallback, useEffect, useState } from 'react';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import { timeAgo } from '@/lib/notificationVisuals';

interface Participant { id: number; name: string; username: string | null; avatarUrl: string | null }
interface ConvoRow {
    id: number; isSupport: boolean; status: string; guestName: string | null;
    lastMessageAt: string | null; messageCount: number;
    lastMessage: { body: string; isBot: boolean; createdAt: string | null } | null;
    participants: Participant[];
}
interface ThreadMsg { id: number; body: string; isBot: boolean; createdAt: string | null; sender: Participant | null }
interface Thread { id: number; isSupport: boolean; status: string; guestName: string | null; participants: Participant[]; messages: ThreadMsg[] }

function avatarFor(name: string, url?: string | null) {
    return url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=0858f7&color=fff`;
}
function convoTitle(c: ConvoRow) {
    const names = c.participants.map((p) => p.name);
    if (c.isSupport) return `${c.guestName || names[0] || 'Visitor'} (support)`;
    return names.length ? names.join(' ↔ ') : 'Conversation';
}

export default function ConversationOversightPage() {
    const [items, setItems] = useState<ConvoRow[]>([]);
    const [search, setSearch] = useState('');
    const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
    const [selected, setSelected] = useState<number | null>(null);
    const [thread, setThread] = useState<Thread | null>(null);
    const [threadLoading, setThreadLoading] = useState(false);
    const [typeFilter, setTypeFilter] = useState<'all' | 'dm' | 'support'>('all');
    const [checked, setChecked] = useState<Set<number>>(new Set());

    const load = useCallback(async () => {
        const res = await fetch('/api/admin/conversations').catch(() => null);
        if (!res) return setState('error');
        if (res.status === 403) return setState('forbidden');
        if (!res.ok) return setState('error');
        const d = await res.json();
        setItems(d.items ?? []);
        setState('ok');
    }, []);
    useEffect(() => { load(); }, [load]);

    const openThread = async (id: number) => {
        setSelected(id); setThread(null); setThreadLoading(true);
        const res = await fetch(`/api/admin/conversations/${id}`).catch(() => null);
        if (res && res.ok) setThread(await res.json());
        setThreadLoading(false);
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            setTimeout(() => document.querySelector('.convo-thread-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
        }
    };

    const removeConvo = async (id: number, clear: boolean) => {
        const label = clear ? 'Clear all messages in this conversation?' : 'Delete this whole conversation permanently? This cannot be undone.';
        if (!confirm(label)) return;
        const res = await fetch(`/api/admin/conversations/${id}${clear ? '?clear=1' : ''}`, { method: 'DELETE' }).catch(() => null);
        if (!res || !res.ok) { alert('Could not complete that action.'); return; }
        if (clear) {
            setThread((t) => (t && t.id === id ? { ...t, messages: [] } : t));
            setItems((list) => list.map((c) => c.id === id ? { ...c, messageCount: 0, lastMessage: null } : c));
        } else {
            setItems((list) => list.filter((c) => c.id !== id));
            if (selected === id) { setSelected(null); setThread(null); }
        }
    };

    const filtered = items.filter((c) => {
        if (typeFilter === 'dm' && c.isSupport) return false;
        if (typeFilter === 'support' && !c.isSupport) return false;
        if (search.trim() && !convoTitle(c).toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
    });

    const toggleCheck = (id: number) => setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allVisibleChecked = filtered.length > 0 && filtered.every((c) => checked.has(c.id));
    const toggleAll = () => setChecked((prev) => {
        if (allVisibleChecked) { const n = new Set(prev); filtered.forEach((c) => n.delete(c.id)); return n; }
        const n = new Set(prev); filtered.forEach((c) => n.add(c.id)); return n;
    });
    const deleteSelected = async () => {
        const ids = [...checked];
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} selected conversation(s) permanently? This cannot be undone.`)) return;
        const res = await fetch('/api/admin/conversations', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
        }).catch(() => null);
        if (!res || !res.ok) { alert('Could not delete the selected conversations.'); return; }
        setItems((list) => list.filter((c) => !checked.has(c.id)));
        if (selected !== null && checked.has(selected)) { setSelected(null); setThread(null); }
        setChecked(new Set());
    };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Message Oversight"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Conversations', path: '/admin/conversations' },
                ]}
            />

            {state === 'forbidden' && <div className="card p-4"><p className="para" style={{ margin: 0 }}>You do not have permission to view message oversight.</p></div>}
            {state === 'error' && <div className="card p-4"><p className="para" style={{ margin: 0 }}>Could not load conversations.</p></div>}

            {state === 'ok' && (
                <Row>
                    <Col xs={12} md={5} lg={4} className="mb-3">
                        <input className="form-control mb-2" placeholder="Search by participant..."
                            value={search} onChange={(e) => setSearch(e.target.value)} />

                        <div className="convo-filterbar">
                            {(['all', 'dm', 'support'] as const).map((f) => (
                                <button key={f} className={`convo-filter-btn ${typeFilter === f ? 'active' : ''}`} onClick={() => setTypeFilter(f)}>
                                    {f === 'all' ? 'All' : f === 'dm' ? 'Direct' : 'Support'}
                                </button>
                            ))}
                        </div>

                        <div className="convo-bulkbar">
                            <label className="convo-selectall">
                                <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
                                <span>Select all{checked.size > 0 ? ` (${checked.size})` : ''}</span>
                            </label>
                            {checked.size > 0 && (
                                <button className="convo-action-btn convo-action-danger" onClick={deleteSelected}>
                                    Delete selected ({checked.size})
                                </button>
                            )}
                        </div>

                        <div className="convo-list">
                            {filtered.length === 0 && <p className="para">No conversations.</p>}
                            {filtered.map((c) => (
                                <div key={c.id} className={`convo-item-row ${selected === c.id ? 'active' : ''}`}>
                                    <input type="checkbox" className="convo-check" checked={checked.has(c.id)} onChange={() => toggleCheck(c.id)} onClick={(e) => e.stopPropagation()} />
                                    <button className="convo-item" onClick={() => openThread(c.id)}>
                                        <div className="convo-item-head">
                                            <span className="convo-item-title">{convoTitle(c)}</span>
                                            {c.isSupport && <span className="convo-badge">support · {c.status}</span>}
                                        </div>
                                        <div className="convo-item-preview">
                                            {c.lastMessage ? `${c.lastMessage.isBot ? '[bot] ' : ''}${c.lastMessage.body}` : 'No messages'}
                                        </div>
                                        <div className="convo-item-meta">
                                            {c.messageCount} messages{c.lastMessageAt ? ` · ${timeAgo(c.lastMessageAt)}` : ''}
                                        </div>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </Col>

                    <Col xs={12} md={7} lg={8} className="convo-thread-col">
                        {!selected && <div className="card p-4"><p className="para" style={{ margin: 0 }}>Select a conversation to view the full transcript.</p></div>}
                        {selected && threadLoading && <div className="card p-4"><p className="para" style={{ margin: 0 }}>Loading...</p></div>}
                        {selected && thread && (
                            <div className="card p-3 convo-thread">
                                <div className="convo-thread-header" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <strong style={{ flex: 1, minWidth: 0 }}>{thread.participants.map((p) => p.name).join('  <-->  ') || thread.guestName || 'Conversation'}</strong>
                                    {thread.isSupport && <span className="convo-badge">support · {thread.status}</span>}
                                    <button className="convo-action-btn" onClick={() => removeConvo(thread.id, true)} title="Delete all messages, keep the conversation">Clear</button>
                                    <button className="convo-action-btn convo-action-danger" onClick={() => removeConvo(thread.id, false)} title="Delete the whole conversation">Delete</button>
                                </div>
                                <div className="convo-thread-body">
                                    {thread.messages.length === 0 && <p className="para">No messages in this conversation.</p>}
                                    {thread.messages.map((m) => (
                                        <div key={m.id} className="convo-msg">
                                            <img className="convo-msg-avatar" src={avatarFor(m.sender?.name || (m.isBot ? 'Bot' : 'System'), m.sender?.avatarUrl)} alt="" />
                                            <div className="convo-msg-bubble">
                                                <div className="convo-msg-sender">
                                                    {m.isBot ? 'Support Bot' : (m.sender?.name || 'System')}
                                                    <span className="convo-msg-time">{m.createdAt ? timeAgo(m.createdAt) : ''}</span>
                                                </div>
                                                <div className="convo-msg-text">{m.body}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Col>
                </Row>
            )}
        </Container>
    );
}
