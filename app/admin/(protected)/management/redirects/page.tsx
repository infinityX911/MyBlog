'use client';

/**
 * app/admin/(protected)/management/redirects/page.tsx
 * Management → Redirects. View / add / delete 301-308 redirects.
 * Slug changes auto-add rows here; this is the manual manager.
 */

import React, { useEffect, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

interface Redirect {
    id: number;
    fromPath: string;
    toPath: string;
    statusCode: number;
    hits: number;
    createdAt: string;
}

export default function RedirectsPage() {
    const [rows, setRows] = useState<Redirect[]>([]);
    const [loading, setLoading] = useState(true);
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [code, setCode] = useState(308);
    const [msg, setMsg] = useState('');

    const load = () => {
        fetch('/api/redirects')
            .then(r => r.json())
            .then(d => setRows(d.redirects ?? []))
            .catch(() => setMsg('Could not load redirects.'))
            .finally(() => setLoading(false));
    };
    useEffect(load, []);

    async function add() {
        setMsg('');
        const res = await fetch('/api/redirects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromPath: from, toPath: to, statusCode: code }),
        });
        const data = await res.json();
        if (!res.ok) { setMsg(data.error ?? 'Failed.'); return; }
        setFrom(''); setTo('');
        load();
    }

    async function remove(id: number) {
        if (!confirm('Delete this redirect?')) return;
        const res = await fetch(`/api/redirects?id=${id}`, { method: 'DELETE' });
        if (res.ok) setRows(prev => prev.filter(r => r.id !== id));
    }

    const inputStyle: React.CSSProperties = {
        border: '1.5px solid #e2e5ef', borderRadius: 8, padding: '10px 12px', fontSize: 14, width: '100%',
    };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Redirects"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Management', path: '/admin/management/users' },
                    { label: 'Redirects', path: '/admin/management/redirects' },
                ]}
            />

            <Row>
                <Col xs={12}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <h3 className="hd" style={{ marginBottom: 6 }}>301 / 308 Redirects</h3>
                        <p className="para" style={{ opacity: 0.7, marginBottom: 18 }}>
                            When a post&apos;s slug changes, a redirect is added here automatically so old links don&apos;t 404. You can also add or remove them manually.
                        </p>

                        {/* Add form */}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
                            <input style={{ ...inputStyle, flex: 2, minWidth: 200 }} placeholder="/posts/old-slug"
                                value={from} onChange={e => setFrom(e.target.value)} />
                            <span style={{ opacity: 0.5 }}>→</span>
                            <input style={{ ...inputStyle, flex: 2, minWidth: 200 }} placeholder="/posts/new-slug"
                                value={to} onChange={e => setTo(e.target.value)} />
                            <select style={{ ...inputStyle, flex: '0 0 120px' }} value={code} onChange={e => setCode(Number(e.target.value))}>
                                <option value={308}>308 (perm)</option>
                                <option value={301}>301 (perm)</option>
                                <option value={302}>302 (temp)</option>
                                <option value={307}>307 (temp)</option>
                            </select>
                            <button className="btn btn-primary" onClick={add} disabled={!from || !to}>Add</button>
                        </div>
                        {msg && <p className="para" style={{ color: '#dc2626' }}>{msg}</p>}

                        {/* List */}
                        {loading ? (
                            <p className="para" style={{ color: '#888' }}>Loading…</p>
                        ) : rows.length === 0 ? (
                            <p className="para" style={{ color: '#888' }}>No redirects yet.</p>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>From</th><th>To</th><th>Code</th><th>Hits</th><th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map(r => (
                                            <tr key={r.id}>
                                                <td><code>{r.fromPath}</code></td>
                                                <td><code>{r.toPath}</code></td>
                                                <td>{r.statusCode}</td>
                                                <td>{r.hits}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(r.id)}>Delete</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </Col>
            </Row>
        </Container>
    );
}
