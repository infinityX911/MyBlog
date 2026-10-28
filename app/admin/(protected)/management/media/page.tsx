'use client';

/**
 * app/admin/(protected)/management/media/page.tsx
 * Management → Media Library.
 *
 * Every file under public/uploads, from every site, in one grid: search by
 * name, filter by folder, upload, copy the URL, and delete.
 *
 * The one rule the UI enforces on top of the API: nothing is deleted blindly.
 * Selecting files runs a usage check first, and anything still referenced by a
 * post, page, download or settings row is called out by name — deleting it is
 * still possible, but only after a second, explicit confirmation.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import ImageCropper from '@/components/admin/ImageCropper';

type MediaFile = {
    url: string; rel: string; name: string; folder: string;
    size: number; modified: string; ext: string;
};
type Usage = { where: string; label: string; id?: number };

const FOLDERS = ['blog', 'downloads', 'site', 'misc'];
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export default function MediaLibraryPage() {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [totalBytes, setTotalBytes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [msg, setMsg] = useState('');

    const [q, setQ] = useState('');
    const [folder, setFolder] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [uploadFolder, setUploadFolder] = useState('blog');
    const [busy, setBusy] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [progress, setProgress] = useState(0);      // 0–100 while uploading
    const [queue, setQueue] = useState<string[]>([]); // names being uploaded
    const fileInput = useRef<HTMLInputElement>(null);

    // Crop step. `cropQueue` non-null means the modal is up and holding the
    // files the user just picked / dropped / pasted.
    const [cropFirst, setCropFirst] = useState(true);
    const [cropQueue, setCropQueue] = useState<File[] | null>(null);

    const [usage, setUsage] = useState<Record<string, Usage[]>>({});
    const [confirming, setConfirming] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const r = await fetch('/api/admin/media', { cache: 'no-store' });
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
            const d = await r.json();
            setFiles(d.files ?? []);
            setFolders(d.folders ?? []);
            setTotalBytes(d.totalBytes ?? 0);
        } catch (e: any) {
            setErr(e.message || 'Could not load the media library.');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const shown = useMemo(() => {
        const needle = q.toLowerCase().trim();
        return files.filter(f =>
            (!folder || f.folder === folder) &&
            (!needle || f.name.toLowerCase().includes(needle) || f.folder.toLowerCase().includes(needle))
        );
    }, [files, q, folder]);

    const toggle = (rel: string) => {
        setConfirming(false);
        setSelected(prev => {
            const next = new Set(prev);
            next.has(rel) ? next.delete(rel) : next.add(rel);
            return next;
        });
    };

    /**
     * Upload via XHR rather than fetch — fetch gives no upload progress, and a
     * silent wait on a batch of screenshots feels broken.
     */
    const doUpload = useCallback((list: FileList | File[] | null) => {
        const picked = Array.from(list ?? []).filter(f => f.type.startsWith('image/')).slice(0, 20);
        if (!picked.length) return;

        setBusy(true); setMsg(''); setErr(''); setProgress(0);
        setQueue(picked.map(f => f.name));

        const fd = new FormData();
        fd.append('folder', uploadFolder);
        picked.forEach(f => fd.append('file', f));

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/admin/media');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = async () => {
            let d: any = {};
            try { d = JSON.parse(xhr.responseText); } catch { /* noop */ }
            if (xhr.status >= 400 && !d.saved?.length) {
                setErr(d.error || `Upload failed (HTTP ${xhr.status}).`);
            } else {
                const ok = d.saved?.length ?? 0;
                const bad = (d.failed ?? []) as { name: string; error: string }[];
                setMsg(`Uploaded ${ok} file${ok === 1 ? '' : 's'}.` +
                    (bad.length ? ` ${bad.length} rejected: ${bad.map(b => `${b.name} (${b.error})`).join('; ')}` : ''));
                await load();
            }
            setBusy(false); setProgress(0); setQueue([]);
            if (fileInput.current) fileInput.current.value = '';
        };
        xhr.onerror = () => {
            setErr('Upload failed — the connection dropped.');
            setBusy(false); setProgress(0); setQueue([]);
        };
        xhr.send(fd);
    }, [uploadFolder, load]);

    /**
     * Everything that can produce files — the picker, drag & drop, and paste —
     * routes through here. With "Crop first" on, the files go to the cropper
     * and only reach doUpload() once the user is happy; with it off, nothing
     * changes from before.
     */
    const upload = useCallback((list: FileList | File[] | null) => {
        const picked = Array.from(list ?? []).filter(f => f.type.startsWith('image/')).slice(0, 20);
        if (!picked.length) return;
        if (cropFirst) setCropQueue(picked);
        else doUpload(picked);
    }, [cropFirst, doUpload]);

    /** Let go of the queue and reset the file input, whichever way we exit. */
    const clearCropQueue = useCallback(() => {
        setCropQueue(null);
        if (fileInput.current) fileInput.current.value = '';
    }, []);

    // Paste a screenshot straight from the clipboard (Win+Shift+S → Ctrl+V).
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            // Don't hijack Ctrl+V while the crop modal owns the screen.
            if (cropQueue) return;
            const files = Array.from(e.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
            if (files.length) { e.preventDefault(); upload(files); }
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, [upload, cropQueue]);

    /** Step 1 of delete: ask the server where these files are used. */
    async function checkUsage() {
        if (!selected.size) return;
        setBusy(true); setErr(''); setMsg('');
        try {
            const paths = Array.from(selected);
            const r = await fetch('/api/admin/media/usage', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths }),
            });
            const d = await r.json();
            setUsage(d.usage ?? {});
            setConfirming(true);
        } catch {
            setErr('Could not check where these files are used.');
        } finally {
            setBusy(false);
        }
    }

    /** Step 2: actually delete. `force` only when something was in use. */
    async function doDelete(force: boolean) {
        setBusy(true); setErr(''); setMsg('');
        try {
            const paths = Array.from(selected);
            const r = await fetch('/api/admin/media', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paths, force }),
            });
            const d = await r.json();
            if (r.status === 409) { setUsage(d.usage ?? {}); setConfirming(true); setErr('Some files are still in use — confirm below to delete anyway.'); return; }
            if (!r.ok) throw new Error(d.error || `Delete failed (HTTP ${r.status}).`);
            setMsg(`Deleted ${d.deleted.length} file${d.deleted.length === 1 ? '' : 's'}.` +
                (d.errors?.length ? ` ${d.errors.length} failed.` : ''));
            setSelected(new Set()); setConfirming(false); setUsage({});
            await load();
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    }

    const selectedUsed = Array.from(selected).filter(rel => (usage[`/uploads/${rel}`] ?? []).length > 0);

    return (
        <>
            <Container fluid>
                <HeaderPanel
                    title="Media Library"
                    breadcrumbs={[
                        { label: 'Dashboard', path: '/admin/dashboard' },
                        { label: 'Media Library', path: '/admin/management/media' },
                    ]}
                />

                <Row className="mt-3">
                    <Col xs={12}>
                        <div className="card shadow border-0 p-3">
                            {/* dropzone */}
                            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                                multiple hidden onChange={e => upload(e.target.files)} />
                            <div
                                className={`media-dropzone${dragOver ? ' is-over' : ''}${busy ? ' is-busy' : ''}`}
                                onClick={() => !busy && fileInput.current?.click()}
                                onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(true); }}
                                onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
                                onDrop={e => { e.preventDefault(); setDragOver(false); if (!busy) upload(e.dataTransfer.files); }}
                                role="button" tabIndex={0}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.current?.click(); } }}
                            >
                                {busy ? (
                                    <>
                                        <div className="media-dz-icon">⏳</div>
                                        <div className="media-dz-title">Uploading {queue.length} file{queue.length === 1 ? '' : 's'}…</div>
                                        <div className="media-dz-bar"><span style={{ width: `${progress}%` }} /></div>
                                        <div className="media-dz-hint">{progress}%{queue.length ? ` · ${queue.slice(0, 3).join(', ')}${queue.length > 3 ? ` +${queue.length - 3}` : ''}` : ''}</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="media-dz-icon">{dragOver ? '📥' : '🖼️'}</div>
                                        <div className="media-dz-title">
                                            {dragOver ? 'Drop them here' : 'Drag images here, or click to browse'}
                                        </div>
                                        <div className="media-dz-hint">
                                            You can also paste a screenshot with <b>Ctrl&nbsp;+&nbsp;V</b> ·
                                            JPEG, PNG, WebP, AVIF · up to 8MB each · saved as WebP
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Crop toggle. Lives outside the dropzone so clicking it
                                doesn't also open the file picker. */}
                            <div className="d-flex align-items-center gap-2 mb-3 mt-2">
                                <div className="form-check form-switch m-0">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        role="switch"
                                        id="media-crop-first"
                                        checked={cropFirst}
                                        disabled={busy}
                                        onChange={e => setCropFirst(e.target.checked)}
                                    />
                                    <label className="form-check-label small" htmlFor="media-crop-first">
                                        Crop before uploading
                                    </label>
                                </div>
                                <span className="text-muted" style={{ fontSize: 12 }}>
                                    Trim screenshots down to just the part that matters — smaller files, and the
                                    detail stays readable on phones. You can skip it per image.
                                </span>
                            </div>

                            {/* toolbar */}
                            <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                                <div style={{ flex: '1 1 240px' }}>
                                    <label className="form-label mb-1"><b>Search</b></label>
                                    <input className="form-control" placeholder="File name or folder…" value={q} onChange={e => setQ(e.target.value)} />
                                </div>
                                <div style={{ width: 180 }}>
                                    <label className="form-label mb-1"><b>Show folder</b></label>
                                    <select className="form-control" value={folder} onChange={e => setFolder(e.target.value)}>
                                        <option value="">All folders</option>
                                        {folders.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div style={{ width: 150 }}>
                                    <label className="form-label mb-1"><b>Upload into</b></label>
                                    <select className="form-control" value={uploadFolder} onChange={e => setUploadFolder(e.target.value)}>
                                        {FOLDERS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div className="ms-auto text-muted" style={{ fontSize: 13 }}>
                                    {files.length} files · {kb(totalBytes)}
                                </div>
                            </div>

                            {err && <div className="alert alert-danger py-2">{err}</div>}
                            {msg && <div className="alert alert-success py-2">{msg}</div>}

                            {/* selection bar */}
                            {selected.size > 0 && (
                                <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 py-2">
                                    <b>{selected.size} selected</b>
                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => { setSelected(new Set()); setConfirming(false); }}>Clear</button>
                                    {!confirming
                                        ? <button className="btn btn-sm btn-danger ms-auto" disabled={busy} onClick={checkUsage}>🗑 Delete…</button>
                                        : (
                                            <div className="w-100 mt-2">
                                                {selectedUsed.length > 0 ? (
                                                    <>
                                                        <div className="mb-2">
                                                            <b>{selectedUsed.length} of these are still in use.</b> Deleting will leave a broken image:
                                                        </div>
                                                        <ul style={{ fontSize: 13, maxHeight: 160, overflow: 'auto' }}>
                                                            {selectedUsed.map(rel => (
                                                                <li key={rel}>
                                                                    <code>{rel}</code> — {(usage[`/uploads/${rel}`] || []).map(u => `${u.where}: ${u.label}`).join(', ')}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                ) : (
                                                    <div className="mb-2">None of these are referenced anywhere. Safe to delete.</div>
                                                )}
                                                <button className="btn btn-sm btn-danger" disabled={busy}
                                                    onClick={() => doDelete(selectedUsed.length > 0)}>
                                                    {selectedUsed.length > 0 ? 'Delete anyway' : 'Confirm delete'}
                                                </button>
                                                <button className="btn btn-sm btn-outline-secondary ms-2" onClick={() => setConfirming(false)}>Cancel</button>
                                            </div>
                                        )}
                                </div>
                            )}

                            {/* grid */}
                            {loading ? <p className="text-muted">Loading…</p>
                                : shown.length === 0 ? <p className="text-muted">No files match.</p>
                                    : (
                                        <div className="media-grid">
                                            {shown.map(f => {
                                                const on = selected.has(f.rel);
                                                return (
                                                    <div key={f.rel}
                                                        className={`media-card${on ? ' is-selected' : ''}`}
                                                        onClick={() => toggle(f.rel)}>
                                                        <div className="media-card-thumb">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={f.url} alt={f.name} loading="lazy" />
                                                        </div>
                                                        <div className="media-card-body">
                                                            <div className="media-card-name">{f.name}</div>
                                                            <div className="media-card-meta">
                                                                {f.folder || 'root'} · {kb(f.size)} · {new Date(f.modified).toLocaleDateString()}
                                                            </div>
                                                            <button className="btn btn-sm btn-outline-secondary mt-2 w-100"
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    navigator.clipboard?.writeText(f.url);
                                                                    setMsg(`Copied ${f.url}`);
                                                                }}>
                                                                Copy URL
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                            <p className="text-muted mt-3" style={{ fontSize: 12 }}>
                                Files stored on this server only. Anything uploaded while Cloudinary was the
                                active provider lives on Cloudinary and is managed there.
                            </p>
                        </div>
                    </Col>
                </Row>
            </Container>
            {cropQueue && (
                <ImageCropper
                    files={cropQueue}
                    onDone={(cropped) => { clearCropQueue(); doUpload(cropped); }}
                    onCancel={clearCropQueue}
                />
            )}
        </>
    );
}
