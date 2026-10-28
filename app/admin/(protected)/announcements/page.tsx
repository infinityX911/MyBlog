'use client';

/**
 * app/admin/(protected)/announcements/page.tsx
 *
 * Admin composer for the public Announcements feed. Post a "status" (optional
 * title + body + image + pin), see the list of what's live, and delete any
 * entry. Members like + comment on these from /announcements. Gated behind the
 * 'manage-announcements' permission (route access map + API both enforce it).
 */
import { Col, Container, Row } from 'react-bootstrap';
import React, { useCallback, useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import { showToast } from '@/lib/toast';
import { timeAgo } from '@/lib/notificationVisuals';

interface Ann {
    id: number;
    title: string | null;
    body: string;
    image: string | null;
    pinned: boolean;
    createdAt: string | null;
    author: { id: number; name: string; avatarUrl: string | null };
    likeCount: number;
    commentCount: number;
}

export default function AdminAnnouncementsPage() {
    const [items, setItems] = useState<Ann[]>([]);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [image, setImage] = useState('');
    const [pinned, setPinned] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [disabled, setDisabled] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch('/api/announcements').catch(() => null);
        if (!res) return;
        if (res.status === 404) { setDisabled(true); return; }
        if (res.ok) { const d = await res.json(); setItems(d.items ?? []); setDisabled(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const upload = async (file: File) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            const d = await res.json();
            if (res.ok && d.url) { setImage(d.url); showToast('Image uploaded.', 'success'); }
            else showToast(d.error || 'Upload failed.', 'error');
        } catch { showToast('Upload failed.', 'error'); }
        finally { setUploading(false); }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) { showToast('Write something to announce.', 'info'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/announcements', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), body: body.trim(), image: image.trim(), pinned }),
            });
            if (res.ok) {
                showToast('Announcement posted.', 'success');
                setTitle(''); setBody(''); setImage(''); setPinned(false);
                load();
            } else {
                const d = await res.json().catch(() => ({}));
                showToast(d.error || 'Could not post.', 'error');
            }
        } finally { setSaving(false); }
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this announcement? Its likes and comments are removed too.')) return;
        const res = await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
        if (res.ok) { showToast('Deleted.', 'success'); setItems((p) => p.filter((x) => x.id !== id)); }
        else showToast('Could not delete.', 'error');
    };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Announcements"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Announcements', path: '/admin/announcements' },
                ]}
            />

            {disabled && (
                <div className="card p-4 mb-4" style={{ borderRadius: 12 }}>
                    <p style={{ margin: 0 }}>
                        The Announcements feature is currently <strong>off</strong>. Turn it on in{' '}
                        <a href="/admin/settings">Settings → Informations</a> to publish to the public feed.
                    </p>
                </div>
            )}

            <Row>
                <Col xs={12} lg={5}>
                    <form onSubmit={submit} className="card p-4 mb-4 ann-composer" style={{ borderRadius: 12 }}>
                        <h5 style={{ fontWeight: 700, marginBottom: 16 }}>New announcement</h5>

                        <label className="form-label">Title (optional)</label>
                        <input className="form-control mb-3" value={title} maxLength={160}
                            onChange={(e) => setTitle(e.target.value)} placeholder="Short headline" />

                        <label className="form-label">Message</label>
                        <textarea className="form-control mb-3" value={body} rows={5} maxLength={5000}
                            onChange={(e) => setBody(e.target.value)} placeholder="What do you want to announce?" required />

                        <label className="form-label">Image (optional)</label>
                        <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
                            <input className="form-control" value={image} onChange={(e) => setImage(e.target.value)}
                                placeholder="Image URL or upload" style={{ flex: 1, minWidth: 160 }} />
                            <label className="btn btn-outline-secondary mb-0" style={{ whiteSpace: 'nowrap' }}>
                                {uploading ? 'Uploading...' : 'Upload'}
                                <input type="file" accept="image/*" hidden
                                    onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
                            </label>
                        </div>
                        {image && <img src={image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />}

                        <label className="d-flex align-items-center gap-2 mb-3" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
                            <span>Pin to top</span>
                        </label>

                        <Button type="submit" variant="contained" disabled={saving}>
                            {saving ? 'Posting...' : 'Post announcement'}
                        </Button>
                    </form>
                </Col>

                <Col xs={12} lg={7}>
                    <h5 style={{ fontWeight: 700, marginBottom: 16 }}>Live announcements ({items.length})</h5>
                    {items.length === 0 && <p className="para">No announcements yet.</p>}
                    {items.map((a) => (
                        <div key={a.id} className="card p-3 mb-3 ann-admin-row" style={{ borderRadius: 12 }}>
                            <div className="d-flex justify-content-between align-items-start gap-2">
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700 }}>
                                        {a.pinned && <span style={{ color: '#5b4fcf', marginRight: 4 }}>[pinned]</span>}
                                        {a.title || <span style={{ opacity: 0.7 }}>Untitled</span>}
                                    </div>
                                    <div className="para" style={{ whiteSpace: 'pre-wrap', margin: '6px 0' }}>{a.body}</div>
                                    {a.image && <img src={a.image} alt="" style={{ maxWidth: 220, borderRadius: 8 }} />}
                                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
                                        {a.likeCount} likes &middot; {a.commentCount} comments &middot; {a.author?.name} &middot; {a.createdAt ? timeAgo(a.createdAt) : ''}
                                    </div>
                                </div>
                                <Button size="small" color="error" onClick={() => remove(a.id)} title="Delete">
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </Col>
            </Row>
        </Container>
    );
}
