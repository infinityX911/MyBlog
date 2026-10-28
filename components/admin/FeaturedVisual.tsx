'use client';

/**
 * components/admin/FeaturedVisual.tsx
 *
 * A "Featured Visual" picker with a toggle between an IMAGE (URL or upload,
 * with preview — same backend as the post editor's image insert) and a CARD
 * GRADIENT (swatches). Used by both Blog posts and Downloads so the two share
 * one consistent control.
 *
 * Controlled: parent holds `image` + `gradient` strings. Switching mode clears
 * the other value so exactly one visual is active at a time.
 */

import React, { useEffect, useRef, useState } from 'react';
import ImageCropper from '@/components/admin/ImageCropper';

export const GRADIENTS = [
    'gradientPurple', 'gradientGreen', 'gradientBlue', 'gradientOrange',
    'gradientPink', 'gradientIndigo', 'gradientTeal', 'gradientRose',
];

export const gradientCss = (g: string): string => (
    g === 'gradientPurple' ? 'linear-gradient(135deg,#1a0533,#0d2b6b)' :
    g === 'gradientGreen'  ? 'linear-gradient(135deg,#064e3b,#065f46)' :
    g === 'gradientBlue'   ? 'linear-gradient(135deg,#0c4a6e,#0369a1)' :
    g === 'gradientOrange' ? 'linear-gradient(135deg,#431407,#9a3412)' :
    g === 'gradientPink'   ? 'linear-gradient(135deg,#4a044e,#86198f)' :
    g === 'gradientIndigo' ? 'linear-gradient(135deg,#1e1b4b,#312e81)' :
    g === 'gradientTeal'   ? 'linear-gradient(135deg,#042f2e,#0f766e)' :
                             'linear-gradient(135deg,#4c0519,#9f1239)'
);

interface Props {
    image: string;
    gradient: string;
    onChange: (v: { image: string; gradient: string }) => void;
}

export default function FeaturedVisual({ image, gradient, onChange }: Props) {
    const [mode, setMode] = useState<'image' | 'gradient'>(image ? 'image' : 'gradient');

    // On edit pages the image URL arrives AFTER mount (async load) — reflect it
    // by switching to Image mode when an image becomes present.
    useEffect(() => { if (image) setMode('image'); }, [image]);
    const [tab, setTab] = useState<'url' | 'local' | 'cloud'>('url');
    const [urlInput, setUrlInput] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    // Non-null while the crop modal is open for a freshly picked file.
    const [cropFile, setCropFile] = useState<File | null>(null);
    // Opt-in, same as the post editor.
    const [cropEnabled, setCropEnabled] = useState(false);

    const pickMode = (m: 'image' | 'gradient') => {
        setMode(m);
        if (m === 'image') onChange({ image, gradient: '' });
        else onChange({ image: '', gradient: gradient || GRADIENTS[0] });
    };

    const setImage = (url: string) => onChange({ image: url, gradient: '' });

    const upload = async (file: File, m: 'local' | 'cloud') => {
        setUploading(true); setError('');
        try {
            const fd = new FormData(); fd.append('file', file); fd.append('mode', m);
            const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
            let data: any = null;
            try { data = await res.json(); } catch { throw new Error(`Non-JSON response (HTTP ${res.status}).`); }
            if (!res.ok) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
            if (!data?.url) throw new Error('Upload succeeded but no URL returned.');
            setImage(data.url);
        } catch (e: any) { setError(e.message ?? 'Upload failed.'); } finally { setUploading(false); }
    };
    // When cropping is on it opens at 1.91:1 — the ratio Open Graph, Twitter
    // cards and the site's own post cards all crop to — so the author sees what
    // Google and social previews will actually show, instead of finding out
    // later that the heading got cut off.
    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        e.target.value = '';
        if (cropEnabled) setCropFile(f);
        else upload(f, tab === 'cloud' ? 'cloud' : 'local');
    };

    return (
        <div>
            {/* Mode toggle */}
            <div className="blog-image-tabs" style={{ marginBottom: 10 }}>
                <button type="button" className={`blog-image-tab ${mode === 'image' ? 'active' : ''}`} onClick={() => pickMode('image')}>🖼️ Image</button>
                <button type="button" className={`blog-image-tab ${mode === 'gradient' ? 'active' : ''}`} onClick={() => pickMode('gradient')}>🎨 Card Gradient</button>
            </div>

            {mode === 'image' ? (
                <>
                    {image && (
                        <div style={{ marginBottom: 8, position: 'relative' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 160, objectFit: 'cover' }} />
                            <button type="button" onClick={() => setImage('')}
                                className="btn btn-sm btn-light" style={{ position: 'absolute', top: 6, right: 6 }}>✕</button>
                        </div>
                    )}
                    <div className="blog-image-tabs" style={{ marginBottom: 8 }}>
                        {(['url', 'local', 'cloud'] as const).map(t => (
                            <button key={t} type="button" className={`blog-image-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                                {t === 'url' ? '🔗 URL' : t === 'local' ? '💻 Local' : '☁️ Cloud'}
                            </button>
                        ))}
                    </div>
                    {tab === 'url' ? (
                        <div className="blog-image-tab-body">
                            <input type="url" className="form-control form-control-sm" placeholder="https://example.com/image.jpg"
                                value={urlInput} onChange={e => setUrlInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && urlInput.trim()) { setImage(urlInput.trim()); setUrlInput(''); } }} />
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => { if (urlInput.trim()) { setImage(urlInput.trim()); setUrlInput(''); } }}>Set</button>
                        </div>
                    ) : (
                        <div className="blog-image-tab-body" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <div className="d-flex align-items-center gap-2">
                                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="form-control form-control-sm" disabled={uploading} onChange={onFile} />
                                {uploading && <span className="blog-image-uploading">Uploading…</span>}
                            </div>
                            <label className="blog-crop-toggle">
                                <input
                                    type="checkbox"
                                    checked={cropEnabled}
                                    disabled={uploading}
                                    onChange={e => setCropEnabled(e.target.checked)}
                                />
                                <span>Crop before uploading</span>
                                <small>Opens at 1.91:1 — the shape Google and social previews use.</small>
                            </label>
                        </div>
                    )}
                    {error && <p className="blog-image-error">{error}</p>}
                </>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {GRADIENTS.map(g => (
                        <button key={g} type="button" title={g} onClick={() => onChange({ image: '', gradient: g })}
                            style={{ height: 40, borderRadius: 6, cursor: 'pointer', background: gradientCss(g),
                                border: gradient === g ? '3px solid #0858f7' : '1px solid #dee2e6' }} />
                    ))}
                </div>
            )}

            {cropFile && (
                <ImageCropper
                    files={[cropFile]}
                    aspect={1.91}
                    onDone={(files) => {
                        setCropFile(null);
                        if (files[0]) upload(files[0], tab === 'cloud' ? 'cloud' : 'local');
                    }}
                    onCancel={() => setCropFile(null)}
                />
            )}
        </div>
    );
}
