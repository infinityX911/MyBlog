'use client';
/**
 * Admin → Blog → Integrations. Configure Google Analytics / Search Console and
 * image uploads (local vs Cloudinary) from the dashboard instead of .env.
 * Saves to /api/blog/integrations. Secrets are write-only: they show as "set"
 * and are only changed when you type a new value.
 */
import { useEffect, useState } from 'react';
import { Container } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

export default function IntegrationsEditor() {
    // Analytics
    const [measurementId, setMeasurementId] = useState('');
    const [ga4PropertyId, setGa4PropertyId] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [gscVerification, setGscVerification] = useState('');
    const [privateKey, setPrivateKey] = useState('');
    const [hasPrivateKey, setHasPrivateKey] = useState(false);
    // Upload
    const [provider, setProvider] = useState<'local' | 'cloudinary'>('local');
    const [cloudName, setCloudName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [hasApiSecret, setHasApiSecret] = useState(false);
    // Email (SMTP)
    const [smtpHost, setSmtpHost] = useState('');
    const [smtpPort, setSmtpPort] = useState('');
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpFrom, setSmtpFrom] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [hasSmtpPass, setHasSmtpPass] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        fetch('/api/blog/integrations')
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(d => {
                const a = d.analytics ?? {}, u = d.upload ?? {}, e = d.email ?? {};
                setMeasurementId(a.measurementId ?? ''); setGa4PropertyId(a.ga4PropertyId ?? '');
                setClientEmail(a.clientEmail ?? ''); setGscVerification(a.gscVerification ?? '');
                setHasPrivateKey(!!a.hasPrivateKey);
                setProvider(u.provider === 'cloudinary' ? 'cloudinary' : 'local');
                setCloudName(u.cloudName ?? ''); setApiKey(u.apiKey ?? '');
                setHasApiSecret(!!u.hasApiSecret);
                setSmtpHost(e.host ?? ''); setSmtpPort(e.port ?? ''); setSmtpUser(e.user ?? '');
                setSmtpFrom(e.from ?? ''); setHasSmtpPass(!!e.hasPass);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    async function save() {
        setSaving(true); setMsg('');
        try {
            const res = await fetch('/api/blog/integrations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analytics: { measurementId, ga4PropertyId, clientEmail, gscVerification, privateKey },
                    upload: { provider, cloudName, apiKey, apiSecret },
                    email: { host: smtpHost, port: smtpPort, user: smtpUser, from: smtpFrom, pass: smtpPass },
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setMsg('Saved ✓');
            if (privateKey.trim()) { setHasPrivateKey(true); setPrivateKey(''); }
            if (apiSecret.trim()) { setHasApiSecret(true); setApiSecret(''); }
            if (smtpPass.trim()) { setHasSmtpPass(true); setSmtpPass(''); }
        } catch (e: any) { setMsg(`Failed: ${e.message}`); }
        finally { setSaving(false); setTimeout(() => setMsg(''), 3500); }
    }

    if (loading) return <Container fluid className="right-content"><p className="p-4">Loading…</p></Container>;

    const secretPlaceholder = (has: boolean) => has ? '•••••••• (saved — leave blank to keep)' : 'Not set';

    return (
        <Container fluid className="right-content ads-settings">
            <HeaderPanel
                title="Integrations"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                    { label: 'Integrations', path: '/admin/myprojects/blog/integrations' },
                ]}
            />

            {/* ── Google Analytics + Search Console ─────────────────────────── */}
            <div className="card shadow border-0 p-3 mt-2">
                <h6 className="mb-1">Google Analytics &amp; Search Console</h6>
                <p className="text-muted" style={{ fontSize: 13 }}>
                    Set these here instead of <code>.env</code>. The <b>Measurement ID</b> turns on the
                    tracking tag so the public site sends data to GA (no rebuild needed). The
                    <b> Data API</b> fields let this dashboard read real GA numbers — leave them empty
                    to keep using the built-in view counts.
                </p>

                <div className="form-group mb-3">
                    <label><b>Measurement ID</b> <small style={{ fontWeight: 400 }}>(GA4 → Data Streams — looks like <code>G-XXXXXXXXXX</code>)</small></label>
                    <input className="form-control" value={measurementId} onChange={e => setMeasurementId(e.target.value)} placeholder="G-XXXXXXXXXX" style={{ maxWidth: 320 }} />
                </div>

                <div className="row">
                    <div className="form-group mb-3 col-md-6">
                        <label><b>GA4 Property ID</b> <small style={{ fontWeight: 400 }}>(numeric — Data API)</small></label>
                        <input className="form-control" value={ga4PropertyId} onChange={e => setGa4PropertyId(e.target.value)} placeholder="123456789" />
                    </div>
                    <div className="form-group mb-3 col-md-6">
                        <label><b>Service-account email</b> <small style={{ fontWeight: 400 }}>(…@…iam.gserviceaccount.com)</small></label>
                        <input className="form-control" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="reader@project.iam.gserviceaccount.com" />
                    </div>
                </div>

                <div className="form-group mb-3">
                    <label><b>Service-account private key</b> <small style={{ fontWeight: 400 }}>(from the JSON key — keep the <code>-----BEGIN…</code> lines)</small></label>
                    <textarea className="form-control" rows={3} style={{ fontFamily: 'monospace', fontSize: 12 }}
                        value={privateKey} onChange={e => setPrivateKey(e.target.value)} placeholder={secretPlaceholder(hasPrivateKey)} />
                    {hasPrivateKey
                        ? <small style={{ color: '#16a34a', fontWeight: 600 }}>✓ A private key is saved (hidden for security). Leave blank to keep it, or paste a new one to replace.</small>
                        : <small style={{ color: '#dc2626', fontWeight: 600 }}>⚠ No private key saved yet — GA Data API won't work until you paste it.</small>}
                </div>

                <div className="form-group mb-1">
                    <label><b>Search Console verification token</b> <small style={{ fontWeight: 400 }}>(GSC → HTML tag — the <code>content</code> value only)</small></label>
                    <input className="form-control" value={gscVerification} onChange={e => setGscVerification(e.target.value)} placeholder="abcd1234…" style={{ maxWidth: 480 }} />
                </div>
            </div>

            {/* ── Image uploads ──────────────────────────────────────────────── */}
            <div className="card shadow border-0 p-3 mt-3">
                <h6 className="mb-1">Image uploads</h6>
                <p className="text-muted" style={{ fontSize: 13 }}>
                    Where the editor stores uploaded images. <b>Local</b> saves to the server disk
                    (simple, free). <b>Cloudinary</b> offloads to a CDN — paste your Cloudinary
                    credentials below and pick it as the provider.
                </p>

                <div className="form-group mb-3">
                    <label><b>Storage provider</b></label>
                    <select className="form-control" value={provider} onChange={e => setProvider(e.target.value as any)} style={{ maxWidth: 240 }}>
                        <option value="local">Local (server disk)</option>
                        <option value="cloudinary">Cloudinary (CDN)</option>
                    </select>
                </div>

                <div className="row">
                    <div className="form-group mb-3 col-md-4">
                        <label><b>Cloud name</b></label>
                        <input className="form-control" value={cloudName} onChange={e => setCloudName(e.target.value)} placeholder="your_cloud_name" />
                    </div>
                    <div className="form-group mb-3 col-md-4">
                        <label><b>API key</b></label>
                        <input className="form-control" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="123456789012345" />
                    </div>
                    <div className="form-group mb-3 col-md-4">
                        <label><b>API secret</b></label>
                        <input className="form-control" type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder={secretPlaceholder(hasApiSecret)} />
                    </div>
                </div>
                {provider === 'cloudinary' && !cloudName && (
                    <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 0 }}>⚠ Cloudinary is selected but not configured — uploads will fail until you fill the fields above.</p>
                )}
            </div>

            {/* Email (SMTP) */}
            <div className="card shadow border-0 p-3 mt-3">
                <h6 className="mb-1">Email (SMTP)</h6>
                <p className="text-muted" style={{ fontSize: 13 }}>
                    Powers signup verification, password-reset and contact emails. Set it here instead
                    of the server <code>.env</code>. For Gmail: enable 2-Step Verification, create an
                    <b> App Password</b>, and use that below.
                </p>
                <div className="row">
                    <div className="form-group mb-3 col-md-6">
                        <label><b>SMTP host</b></label>
                        <input className="form-control" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                    </div>
                    <div className="form-group mb-3 col-md-6">
                        <label><b>Port</b> <small style={{ fontWeight: 400 }}>(465 = SSL, 587 = TLS)</small></label>
                        <input className="form-control" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="465" style={{ maxWidth: 160 }} />
                    </div>
                </div>
                <div className="row">
                    <div className="form-group mb-3 col-md-6">
                        <label><b>Username</b></label>
                        <input className="form-control" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="you@gmail.com" />
                    </div>
                    <div className="form-group mb-3 col-md-6">
                        <label><b>App password</b></label>
                        <input className="form-control" type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} placeholder={secretPlaceholder(hasSmtpPass)} autoComplete="new-password" />
                    </div>
                </div>
                <div className="form-group mb-1">
                    <label><b>From</b> <small style={{ fontWeight: 400 }}>(defaults to the username)</small></label>
                    <input className="form-control" value={smtpFrom} onChange={e => setSmtpFrom(e.target.value)} placeholder="Your Name <you@gmail.com>" style={{ maxWidth: 480 }} />
                </div>
            </div>

            <div className="d-flex align-items-center gap-3 mt-3">
                <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save integrations'}</button>
                {msg && <span style={{ fontSize: 14, color: msg.startsWith('Failed') ? '#dc2626' : '#16a34a' }}>{msg}</span>}
            </div>
        </Container>
    );
}
