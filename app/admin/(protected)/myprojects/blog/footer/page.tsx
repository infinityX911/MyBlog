'use client';

/**
 * app/admin/(protected)/myprojects/blog/footer/page.tsx
 * Fully dynamic footer editor: add/remove columns, links per column, social
 * links, and the bottom-bar text. Saves to /api/blog/footer.
 *
 * NOTE: types are declared locally (not imported from lib/footer) so the
 * server-only prisma import never leaks into this client bundle.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

type FooterLink = { label: string; url: string };
type FooterColumn = { heading: string; links: FooterLink[] };
type FooterSocial = { platform: string; url: string };

const PLATFORMS = ['github', 'twitter', 'youtube', 'facebook', 'instagram', 'linkedin', 'tiktok', 'website'];

function FooterEditor() {
    const [columns, setColumns] = useState<FooterColumn[]>([]);
    const [socials, setSocials] = useState<FooterSocial[]>([]);
    const [bottomText, setBottomText] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [overIndex, setOverIndex] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/blog/footer');
            if (res.ok) {
                const d = await res.json();
                setColumns(Array.isArray(d.columns) ? d.columns : []);
                setSocials(Array.isArray(d.socials) ? d.socials : []);
                setBottomText(d.bottomText ?? '');
            }
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    async function save() {
        setSaving(true); setSaved(false);
        try {
            const res = await fetch('/api/blog/footer', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ columns, socials, bottomText }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e: any) { alert(`Save failed: ${e.message}`); }
        finally { setSaving(false); }
    }

    // ── Column helpers ──────────────────────────────────────────────────────
    const addColumn = () => setColumns((c) => [...c, { heading: 'New Column', links: [] }]);
    const removeColumn = (i: number) => setColumns((c) => c.filter((_, idx) => idx !== i));
    const setHeading = (i: number, v: string) =>
        setColumns((c) => c.map((col, idx) => (idx === i ? { ...col, heading: v } : col)));
    const addLink = (i: number) =>
        setColumns((c) => c.map((col, idx) => (idx === i ? { ...col, links: [...col.links, { label: '', url: '' }] } : col)));
    const removeLink = (i: number, j: number) =>
        setColumns((c) => c.map((col, idx) => (idx === i ? { ...col, links: col.links.filter((_, k) => k !== j) } : col)));
    const setLink = (i: number, j: number, field: 'label' | 'url', v: string) =>
        setColumns((c) => c.map((col, idx) => idx === i
            ? { ...col, links: col.links.map((l, k) => (k === j ? { ...l, [field]: v } : l)) }
            : col));

    // Drag-to-reorder columns (decides their left-to-right order on the site).
    const dropColumn = (target: number) => {
        setOverIndex(null);
        if (dragIndex === null || dragIndex === target) { setDragIndex(null); return; }
        setColumns((cols) => {
            const arr = [...cols];
            const [moved] = arr.splice(dragIndex, 1);
            arr.splice(target, 0, moved);
            return arr;
        });
        setDragIndex(null);
    };

    // ── Social helpers ──────────────────────────────────────────────────────
    const addSocial = () => setSocials((s) => [...s, { platform: 'github', url: '' }]);
    const removeSocial = (i: number) => setSocials((s) => s.filter((_, idx) => idx !== i));
    const setSocial = (i: number, field: 'platform' | 'url', v: string) =>
        setSocials((s) => s.map((so, idx) => (idx === i ? { ...so, [field]: v } : so)));

    const delBtn: React.CSSProperties = { border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Footer"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Footer', path: '/admin/myprojects/blog/footer' },
                ]}
            />

            {loading ? (
                <div className="card shadow border-0 p-3 mt-1"><p className="mb-0">Loading…</p></div>
            ) : (
                <>
                    {/* ── Columns ── */}
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h5 className="hd mb-0">Footer Columns</h5>
                            <button className="btn btn-sm btn-primary" onClick={addColumn}>+ Add column</button>
                        </div>
                        <p className="text-muted" style={{ fontSize: 13 }}>Each column has a heading and a list of links (internal <code>/about</code> or full URLs). <b>Drag the <span style={{ fontSize: 15 }}>⠿</span> handle</b> to change a column's position in the footer.</p>

                        <div className="row g-3">
                            {columns.map((col, i) => (
                                <div className="col-md-6 col-lg-4" key={i}
                                    onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i); }}
                                    onDrop={() => dropColumn(i)}>
                                    <div style={{ border: overIndex === i && dragIndex !== null ? '2px dashed #5b4fcf' : '1px solid #e5e9f2', borderRadius: 12, padding: 14, height: '100%', opacity: dragIndex === i ? 0.5 : 1, transition: 'border-color .12s' }}>
                                        <div className="d-flex align-items-center gap-2 mb-2">
                                            <span
                                                draggable
                                                onDragStart={() => setDragIndex(i)}
                                                onDragEnd={() => { setDragIndex(null); setOverIndex(null); }}
                                                title="Drag to reorder this column"
                                                style={{ cursor: 'grab', fontSize: 18, color: '#94a3b8', userSelect: 'none', flexShrink: 0, lineHeight: 1 }}
                                            >⠿</span>
                                            <input className="form-control form-control-sm" style={{ fontWeight: 700 }} value={col.heading} onChange={(e) => setHeading(i, e.target.value)} placeholder="Column heading" />
                                            <button style={delBtn} onClick={() => removeColumn(i)} title="Remove column">✕</button>
                                        </div>
                                        {col.links.map((l, j) => (
                                            <div className="d-flex align-items-center gap-1 mb-1" key={j}>
                                                <input className="form-control form-control-sm" value={l.label} onChange={(e) => setLink(i, j, 'label', e.target.value)} placeholder="Label" />
                                                <input className="form-control form-control-sm" value={l.url} onChange={(e) => setLink(i, j, 'url', e.target.value)} placeholder="/url" />
                                                <button style={delBtn} onClick={() => removeLink(i, j)} title="Remove link">✕</button>
                                            </div>
                                        ))}
                                        <button className="btn btn-sm btn-outline-secondary mt-1" onClick={() => addLink(i)}>+ Add link</button>
                                    </div>
                                </div>
                            ))}
                            {columns.length === 0 && <p className="text-muted">No columns. Click “Add column”.</p>}
                        </div>
                    </div>

                    {/* ── Socials ── */}
                    <div className="card shadow border-0 p-3 mt-3">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <h5 className="hd mb-0">Social Links</h5>
                            <button className="btn btn-sm btn-primary" onClick={addSocial}>+ Add social</button>
                        </div>
                        {socials.map((s, i) => (
                            <div className="d-flex align-items-center gap-2 mb-2" key={i} style={{ maxWidth: 640 }}>
                                <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={s.platform} onChange={(e) => setSocial(i, 'platform', e.target.value)}>
                                    {PLATFORMS.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                                </select>
                                <input className="form-control form-control-sm" value={s.url} onChange={(e) => setSocial(i, 'url', e.target.value)} placeholder="https://…" />
                                <button style={delBtn} onClick={() => removeSocial(i)} title="Remove">✕</button>
                            </div>
                        ))}
                        {socials.length === 0 && <p className="text-muted mb-0">No social links.</p>}
                    </div>

                    {/* ── Bottom bar ── */}
                    <div className="card shadow border-0 p-3 mt-3">
                        <h5 className="hd mb-2">Bottom Bar Text</h5>
                        <input className="form-control" value={bottomText} onChange={(e) => setBottomText(e.target.value)} placeholder="Made with ❤️ …" />
                    </div>

                    {/* ── Save ── */}
                    <div className="d-flex align-items-center gap-3 mt-3 mb-4">
                        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Footer'}</button>
                        {saved && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
                    </div>
                </>
            )}
        </Container>
    );
}

export default FooterEditor;
