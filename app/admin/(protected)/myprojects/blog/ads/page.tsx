'use client';
/**
 * Admin → Blog → Ads. Configure Google AdSense: enable/disable, publisher id,
 * and paste ad-unit code for each on-site position. Saves to /api/blog/ads.
 */
import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

type Slots = { afterHero: string; midArticle: string; inline: string; sidebar: string; footer: string; betweenPosts: string };
const EMPTY: Slots = { afterHero: '', midArticle: '', inline: '', sidebar: '', footer: '', betweenPosts: '' };

const POSITIONS: { key: keyof Slots; label: string; help: string }[] = [
    { key: 'afterHero',    label: 'After hero',        help: 'Top of the article, right under the post banner.' },
    { key: 'midArticle',   label: 'Mid-article (auto)', help: 'Auto-inserted at the middle of the post body — only when the post has no manual 💰 Ad markers.' },
    { key: 'inline',       label: 'Inline (💰 Ad button)', help: 'Shown wherever you place a 💰 Ad marker inside the post editor.' },
    { key: 'sidebar',      label: 'Sidebar',           help: 'In the right sidebar, below the author card.' },
    { key: 'footer',       label: 'Footer',            help: 'At the bottom of the post, above the site footer.' },
    { key: 'betweenPosts', label: 'Homepage',          help: 'On the homepage, between the filter bar and the post sections.' },
];

export default function AdsEditor() {
    const [enabled, setEnabled] = useState(false);
    const [clientId, setClientId] = useState('');
    const [slots, setSlots] = useState<Slots>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [detected, setDetected] = useState(false);

    useEffect(() => {
        fetch('/api/blog/ads')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(d => {
                setEnabled(!!d.enabled); setClientId(d.clientId ?? '');
                const s = { ...EMPTY, ...(d.slots ?? {}) };
                setSlots(s);
                // Auto-reveal the slots if any are already configured.
                if (Object.values(s).some(v => (v as string).trim())) setDetected(true);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        setSaving(true); setMsg('');
        try {
            const res = await fetch('/api/blog/ads', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled, clientId, slots }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setMsg('Saved ✓');
        } catch (e: any) { setMsg(`Failed: ${e.message}`); }
        finally { setSaving(false); setTimeout(() => setMsg(''), 3000); }
    }

    if (loading) return <Container fluid className="right-content"><p className="p-4">Loading…</p></Container>;

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Ads (AdSense)"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Ads', path: '/admin/myprojects/blog/ads' },
                ]}
            />

            <div className="card shadow border-0 p-3 mt-2 ads-settings">
                <label className="d-flex align-items-center gap-2 mb-3" style={{ cursor: 'pointer', fontWeight: 600 }}>
                    <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                    Enable ads site-wide
                </label>

                <div className="form-group mb-3">
                    <label><b>AdSense publisher ID</b> <small style={{ fontWeight: 400 }}>(from AdSense — looks like <code>ca-pub-1234567890123456</code>)</small></label>
                    <input className="form-control" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="ca-pub-XXXXXXXXXXXXXXXX" style={{ maxWidth: 420 }} />
                    <small className="text-muted">Only needed for <b>AdSense</b> (loads its script once, site-wide, and powers Auto ads). Other networks load via their own ad-unit code, so leave this empty for them. The <b>Enable ads</b> toggle above turns all built-in slots on/off.</small>
                </div>

                <hr />
                <h6 className="mb-1">Ad placements</h6>
                <p className="text-muted" style={{ fontSize: 13 }}>These are the <b>built-in</b> ad spots (fixed positions wired into the layout). Show them, then paste an ad-unit code into each spot you want — <b>AdSense</b> (the <code>&lt;ins class=&quot;adsbygoogle&quot;…&gt;</code> snippet) <b>or any other network</b> (Media.net, Ezoic, a raw <code>&lt;script&gt;</code> unit, etc. — their scripts run automatically). Empty = no ad there. For an ad <i>anywhere</i> inside a page, use the <b>💰 Ad block</b> in the page editor. For fully automatic AdSense placement, turn on <b>Auto ads</b> in your AdSense account (the site-wide script above is all it needs).</p>

                {!detected && (
                    <button
                        type="button"
                        className="mc-softblue-btn"
                        onClick={() => setDetected(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', fontWeight: 600, fontSize: 13, cursor: 'pointer', marginBottom: 24 }}
                    >
                        👁️ Show ad spots ({POSITIONS.length} built-in placements)
                    </button>
                )}

                {detected && POSITIONS.map(p => (
                    <div className="form-group mb-3" key={p.key}>
                        <label><b>{p.label}</b> <small style={{ fontWeight: 400 }}>— {p.help}</small></label>
                        <textarea
                            className="form-control"
                            rows={3}
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                            value={slots[p.key]}
                            onChange={e => setSlots(s => ({ ...s, [p.key]: e.target.value }))}
                            placeholder={`<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-…" data-ad-slot="…" data-ad-format="auto"></ins>`}
                        />
                    </div>
                ))}

                <div className="d-flex align-items-center gap-3">
                    <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save ads settings'}</button>
                    {msg && <span style={{ fontSize: 14, color: msg.startsWith('Failed') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
                </div>
            </div>
        </Container>
    );
}
