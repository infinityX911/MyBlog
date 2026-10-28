'use client';

/**
 * app/admin/(protected)/myprojects/blog/navbar/page.tsx
 * Manage the blog's front-end navbar — add/edit/delete links, nest them into
 * dropdowns (choose a parent), drag to reorder within a level, and show/hide.
 * The public Navbar reads these from /api/nav-items.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

type NavItem = {
    id: number; label: string; url: string; icon: string | null;
    parentId: number | null; sortOrder: number; visible: boolean;
    children?: NavItem[];
};

const SITE_KEY = 'blog';
const empty = { label: '', url: '', icon: '', parentId: '' as string | number, sortOrder: 0, visible: true };

function NavbarManager() {
    const [tree, setTree] = useState<NavItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ ...empty });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // drag-to-reorder state
    const dragItem = useRef<{ id: number; parentId: number | null } | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/nav-items?siteKey=${SITE_KEY}`);
            if (res.ok) setTree(await res.json());
        } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const flatTop = tree.map(t => ({ id: t.id, label: t.label })); // possible parents

    const reset = () => { setForm({ ...empty }); setEditingId(null); };

    async function submit() {
        if (!form.label.trim()) { alert('Label is required.'); return; }
        setSaving(true);
        try {
            const body = {
                siteKey: SITE_KEY,
                label: form.label, url: form.url || '#', icon: form.icon || null,
                parentId: form.parentId ? Number(form.parentId) : null,
                sortOrder: Number(form.sortOrder) || 0, visible: form.visible,
            };
            const res = await fetch(editingId ? `/api/nav-items/${editingId}` : '/api/nav-items', {
                method: editingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
            reset(); await load();
        } catch (e: any) { alert(`Failed: ${e.message}`); }
        finally { setSaving(false); }
    }

    function edit(it: NavItem) {
        setEditingId(it.id);
        setForm({ label: it.label, url: it.url, icon: it.icon ?? '', parentId: it.parentId ?? '', sortOrder: it.sortOrder, visible: it.visible });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    async function remove(id: number) {
        if (!window.confirm('Delete this item (and its dropdown children)?')) return;
        await fetch(`/api/nav-items/${id}`, { method: 'DELETE' });
        if (editingId === id) reset();
        await load();
    }

    // Persist a sibling list's new order (sortOrder = index)
    async function persistOrder(list: NavItem[]) {
        await Promise.all(list.map((it, idx) => fetch(`/api/nav-items/${it.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                siteKey: SITE_KEY, label: it.label, url: it.url, icon: it.icon,
                parentId: it.parentId, sortOrder: idx, visible: it.visible,
            }),
        })));
    }

    // Reorder within the same level (top-level or same parent's children)
    function handleDrop(targetId: number, parentId: number | null) {
        const src = dragItem.current;
        dragItem.current = null;
        setDragOverId(null);
        if (!src || src.parentId !== parentId || src.id === targetId) return;

        const next: NavItem[] = structuredClone(tree);
        const siblings = parentId == null ? next : (next.find(t => t.id === parentId)?.children ?? []);
        const from = siblings.findIndex(s => s.id === src.id);
        const to = siblings.findIndex(s => s.id === targetId);
        if (from === -1 || to === -1) return;
        const [moved] = siblings.splice(from, 1);
        siblings.splice(to, 0, moved);
        siblings.forEach((s, i) => { s.sortOrder = i; });
        setTree(next);
        persistOrder(siblings);
    }

    // ── styles ──
    const rowStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 12px', border: '1px solid #eef2f7', borderRadius: 10, marginBottom: 8,
        background: '#fff', transition: 'border-color .12s, background .12s',
    };
    const dragOverStyle: React.CSSProperties = { borderColor: '#4f46e5', background: '#eef2ff' };
    const editBtn: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 8,
        border: '1px solid #d4d9e6', background: '#fff', color: '#374151', fontWeight: 500, fontSize: 13, cursor: 'pointer',
    };
    const delBtn: React.CSSProperties = { ...editBtn, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626' };

    const rowNode = (it: NavItem, child?: boolean) => (
        <div
            key={it.id}
            draggable
            onDragStart={() => { dragItem.current = { id: it.id, parentId: it.parentId }; }}
            onDragOver={e => {
                e.preventDefault();
                const src = dragItem.current;
                if (src && src.parentId === it.parentId && src.id !== it.id) setDragOverId(it.id);
            }}
            onDragLeave={() => setDragOverId(prev => (prev === it.id ? null : prev))}
            onDragEnd={() => { dragItem.current = null; setDragOverId(null); }}
            onDrop={e => { e.preventDefault(); handleDrop(it.id, it.parentId); }}
            style={{ ...rowStyle, ...(dragOverId === it.id ? dragOverStyle : {}), marginLeft: child ? 28 : 0 }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ cursor: 'grab', color: '#94a3b8', fontSize: 16, userSelect: 'none' }} title="Drag to reorder">⠿</span>
                {child && <span style={{ color: '#cbd5e1' }}>↳</span>}
                <span style={{ fontWeight: 600 }}>{it.icon} {it.label}</span>
                <code style={{ fontSize: 12, color: '#64748b' }}>{it.url}</code>
                {!it.visible && <span style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', borderRadius: 999, padding: '2px 8px' }}>hidden</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button style={editBtn} onClick={() => edit(it)}>✎ Edit</button>
                <button style={delBtn} onClick={() => remove(it.id)}>🗑 Delete</button>
            </div>
        </div>
    );

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Blog Navbar"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Navbar', path: '/admin/myprojects/blog/navbar' },
                ]}
            />

            {/* Add / edit form */}
            <div className="card shadow border-0 p-3 mt-1">
                <h5 className="hd mb-3">{editingId ? 'Edit link' : 'Add link'}</h5>
                <div className="row g-2">
                    <div className="col-md-3">
                        <label className="form-label"><b>Label</b></label>
                        <input className="form-control" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Home" />
                    </div>
                    <div className="col-md-3">
                        <label className="form-label"><b>URL</b></label>
                        <input className="form-control" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="/ or /tag/tech" />
                        <small style={{ fontSize: 11, color: '#64748b' }}>
                            In a dropdown, a plain word like <code>lol</code> nests under the parent (parent <code>/tuto</code> → <code>/tuto/lol</code>). A leading slash <code>/lol</code> is used as-is.
                        </small>
                    </div>
                    <div className="col-md-1">
                        <label className="form-label"><b>Icon</b></label>
                        <input className="form-control" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="💻" />
                    </div>
                    <div className="col-md-2">
                        <label className="form-label"><b>Dropdown of</b></label>
                        <select className="form-control" value={String(form.parentId)} onChange={e => setForm({ ...form, parentId: e.target.value })}>
                            <option value="">— Top level —</option>
                            {flatTop.filter(p => p.id !== editingId).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                    </div>
                    <div className="col-md-1">
                        <label className="form-label"><b>Order</b></label>
                        <input type="number" className="form-control" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-2 d-flex align-items-end gap-2">
                        <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={form.visible} onChange={e => setForm({ ...form, visible: e.target.checked })} /> Visible
                        </label>
                    </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                    <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update link' : 'Add link'}</button>
                    {editingId && <button className="btn btn-secondary" onClick={reset}>Cancel</button>}
                </div>
            </div>

            {/* Current items */}
            <div className="card shadow border-0 p-3 mt-3">
                <div className="d-flex align-items-center justify-content-between mb-3">
                    <h5 className="hd mb-0">Current navbar</h5>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Drag ⠿ to reorder within a level</span>
                </div>
                {loading ? <p>Loading…</p> : tree.length === 0 ? (
                    <p className="text-muted mb-0">No links yet. Add your first one above, or run the seed to import the current navbar.</p>
                ) : (
                    <div>
                        {tree.map(t => (
                            <div key={t.id}>
                                {rowNode(t)}
                                {(t.children ?? []).map(c => rowNode(c, true))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Container>
    );
}

export default NavbarManager;
