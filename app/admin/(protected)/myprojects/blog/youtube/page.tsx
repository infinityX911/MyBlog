'use client';

/**
 * app/admin/(protected)/myprojects/blog/youtube/page.tsx
 * Manage the YouTube channels shown in the "Our Channels" sidebar block.
 * Add a channel ID (UC…) or handle (@name); the site fetches its name, avatar
 * and subscriber count live from the YouTube Data API.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

type Channel = { id: number; channelRef: string; label: string | null; sortOrder: number };

function YoutubeManager() {
    const [rows, setRows] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [ref, setRef] = useState('');
    const [label, setLabel] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/youtube-channels');
            if (res.ok) setRows(await res.json());
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function add() {
        const channelRef = ref.trim();
        if (!channelRef) { alert('Enter a channel ID (UC…) or handle (@name).'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/youtube-channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelRef, label }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
            setRef(''); setLabel(''); await load();
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setSaving(false); }
    }

    async function remove(id: number) {
        if (!window.confirm('Remove this channel?')) return;
        await fetch(`/api/youtube-channels/${id}`, { method: 'DELETE' });
        await load();
    }

    const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontWeight: 500, fontSize: 13, cursor: 'pointer' };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="YouTube Channels"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'YouTube Channels', path: '/admin/myprojects/blog/youtube' },
                ]}
            />

            <div className="card shadow border-0 p-3 mt-1">
                <h5 className="hd mb-2">Add a channel</h5>
                <p className="text-muted" style={{ fontSize: 13 }}>
                    Paste a channel ID (starts with <code>UC…</code>) or a handle (<code>@mychannel</code>). Name, avatar &amp;
                    subscriber count are fetched live from YouTube. Optionally set a custom display name.
                </p>
                <div className="row g-2">
                    <div className="col-md-5">
                        <label className="form-label"><b>Channel ID or @handle</b></label>
                        <input className="form-control" value={ref} onChange={e => setRef(e.target.value)} placeholder="@mrbeast or UCX6OQ3DkcsbYNE6H8uQQuVA" />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label"><b>Display name (optional)</b></label>
                        <input className="form-control" value={label} onChange={e => setLabel(e.target.value)} placeholder="Leave blank to use the real name" />
                    </div>
                    <div className="col-md-3 d-flex align-items-end">
                        <button className="btn btn-primary" onClick={add} disabled={saving}>{saving ? 'Adding…' : '+ Add channel'}</button>
                    </div>
                </div>
            </div>

            <div className="card shadow border-0 p-3 mt-3">
                <h5 className="hd mb-3">Channels</h5>
                {loading ? <p>Loading…</p> : rows.length === 0 ? (
                    <p className="text-muted mb-0">No channels yet. Add one above, then add a “Our YouTube channels” block to a page.</p>
                ) : (
                    <div>
                        {rows.map((c) => (
                            <div key={c.id} className="d-flex align-items-center justify-content-between" style={{ padding: '10px 4px', borderBottom: '1px solid #eef2f7' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    <b>{c.label || c.channelRef}</b>
                                    <code style={{ fontSize: 12, color: '#64748b' }}>{c.channelRef}</code>
                                </div>
                                <button style={btn} onClick={() => remove(c.id)}>🗑 Remove</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Container>
    );
}

export default YoutubeManager;
