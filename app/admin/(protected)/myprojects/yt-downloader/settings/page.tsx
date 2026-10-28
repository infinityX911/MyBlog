'use client';

/**
 * Downloader settings — currently one thing: the YouTube cookies that unlock
 * the HD formats.
 *
 * WHY THIS PAGE EXISTS: YouTube serves anything above ~360p only to a signed-in
 * session. yt-dlp can present one with a cookies.txt, but a Docker container has
 * no browser to read cookies from and no durable place to keep a file across
 * redeploys. So the file is pasted here, stored in the database, and written to
 * a temp file for the lifetime of each download.
 *
 * The textarea is WRITE-ONLY: the saved value is never sent back to the browser,
 * because it contains live Google session tokens. The page only reports whether
 * something is stored, how many cookie lines it had, and when it was saved.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';

interface Status {
    configured: boolean;
    lines: number;
    updatedAt: string | null;
}

function DownloaderSettings() {
    const [status, setStatus] = useState<Status | null>(null);
    const [text, setText] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const load = useCallback(async () => {
        try {
            const r = await fetch('/api/yt/cookies', { cache: 'no-store' });
            if (r.ok) setStatus(await r.json());
        } catch { /* status is cosmetic — a failure here shouldn't block saving */ }
    }, []);

    useEffect(() => { load(); }, [load]);

    async function save() {
        setBusy(true); setMsg(''); setErr('');
        try {
            const r = await fetch('/api/yt/cookies', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cookies: text }),
            });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || `Save failed (HTTP ${r.status}).`);
            setMsg(`Saved — ${d.lines} cookies stored. HD formats should be available now.`);
            setText('');          // don't leave the secret sitting in the DOM
            await load();
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    }

    async function clear() {
        if (!confirm('Remove the saved cookies? Downloads will fall back to anonymous access, which usually caps quality at 360p.')) return;
        setBusy(true); setMsg(''); setErr('');
        try {
            const r = await fetch('/api/yt/cookies', { method: 'DELETE' });
            if (!r.ok) throw new Error(`Could not clear (HTTP ${r.status}).`);
            setMsg('Cookies removed.');
            await load();
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <Container fluid>
            <HeaderPanel
                title="Downloader Settings"
                breadcrumbs={[
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'YouTube Downloader', path: '/admin/myprojects/yt-downloader/analytics' },
                    { label: 'Settings', path: '/admin/myprojects/yt-downloader/settings' },
                ]}
            />

            <Row className="mt-3">
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3">
                        <h5 className="hd mb-1">YouTube session cookies</h5>
                        <p className="text-muted" style={{ fontSize: 13 }}>
                            YouTube only offers 1080p and above to a signed-in session. Without a cookies
                            file the downloader still works, but the quality picker quietly falls back to
                            whatever is available anonymously — usually 360p.
                        </p>

                        <div className={`alert ${status?.configured ? 'alert-success' : 'alert-warning'} py-2`} style={{ fontSize: 13 }}>
                            {status?.configured ? (
                                <>
                                    <b>Cookies are saved</b> — {status.lines} entries
                                    {status.updatedAt && <> · updated {new Date(status.updatedAt).toLocaleString()}</>}.
                                </>
                            ) : (
                                <><b>No cookies saved.</b> Downloads will be limited to anonymous quality.</>
                            )}
                        </div>

                        <label className="form-label"><b>Paste cookies.txt</b></label>
                        <textarea
                            className="form-control"
                            rows={10}
                            spellCheck={false}
                            style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }}
                            placeholder={'# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1799999999\tSID\t...'}
                            value={text}
                            onChange={e => setText(e.target.value)}
                            disabled={busy}
                        />

                        {msg && <div className="alert alert-success py-2 mt-3 mb-0" style={{ fontSize: 13 }}>{msg}</div>}
                        {err && <div className="alert alert-danger py-2 mt-3 mb-0" style={{ fontSize: 13 }}>{err}</div>}

                        <div className="d-flex gap-2 mt-3">
                            <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !text.trim()}>
                                {busy ? 'Saving…' : 'Save cookies'}
                            </button>
                            {status?.configured && (
                                <button className="btn btn-outline-danger btn-sm" onClick={clear} disabled={busy}>
                                    Remove saved cookies
                                </button>
                            )}
                        </div>
                    </div>
                </Col>

                <Col xs={12} lg={4}>
                    <div className="card shadow border-0 p-3">
                        <h6 className="hd mb-2">How to get the file</h6>
                        <ol className="text-muted mb-3" style={{ fontSize: 13, paddingLeft: 18 }}>
                            <li className="mb-2">
                                Sign in to YouTube in your browser with a <b>throwaway Google account</b> —
                                not your main one. YouTube flags accounts used for bulk downloading.
                            </li>
                            <li className="mb-2">
                                Install a &ldquo;Get cookies.txt&rdquo; extension (they exist for Chrome, Edge and Firefox).
                            </li>
                            <li className="mb-2">
                                Open <code>youtube.com</code>, click the extension, and export for the current site.
                            </li>
                            <li className="mb-2">
                                Open the downloaded file in Notepad, select all, and paste it into the box.
                            </li>
                        </ol>

                        <h6 className="hd mb-2">Worth knowing</h6>
                        <ul className="text-muted mb-0" style={{ fontSize: 13, paddingLeft: 18 }}>
                            <li className="mb-2">
                                Both formats are accepted: a Netscape <code>cookies.txt</code>, or the JSON that
                                Cookie-Editor exports. Copying values out of DevTools by hand will <b>not</b> work.
                            </li>
                            <li className="mb-2">
                                YouTube rotates the session on almost every use. The saved cookies are updated
                                automatically after each download, so they keep working — you should not need to
                                paste again for a long time.
                            </li>
                            <li className="mb-2">
                                Export from a <b>private / InPrivate window</b> and close it without signing out.
                                If you keep browsing YouTube in that same window, the browser rotates the session
                                too and the copy saved here gets left behind.
                            </li>
                            <li className="mb-2">
                                Signing out of that Google account in your browser invalidates the session here too.
                            </li>
                            <li>
                                Saved cookies are never shown again — paste a new file to replace them.
                            </li>
                        </ul>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default DownloaderSettings;
