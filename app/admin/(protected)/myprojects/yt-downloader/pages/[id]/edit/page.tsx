'use client';

/** Edit a YT-downloader CMS page — plain rich editor (no blocks). */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import { normalizeSeo } from '@/lib/seo/scoring';
import PostEditor from '@/components/admin/PostEditor';

const toSlug = (v: string) =>
    v.trim().toLowerCase()
        .replace(/[^\w\s/-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

function EditCmsPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [content, setContent] = useState('');
    const [status, setStatus] = useState<'draft' | 'published'>('draft');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);
    // Settings for the 'yt' site — SeoPanel's Google preview and schema use these
    // instead of the "https://yoursite.com" placeholder.
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        fetch('/api/settings')
            .then(r => (r.ok ? r.json() : []))
            .then((all: any[]) => {
                const yt = all.find((s: any) => s.siteKey === 'yt');
                if (yt) {
                    setSiteName(yt.siteName ?? '');
                    setSiteUrl(yt.websiteUrl ?? '');
                }
            })
            .catch(() => { /* optional */ });
    }, []);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/yt/cms-pages/${id}`);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setLoadError(err.error ?? `Failed to load page (HTTP ${res.status}).`);
                    return;
                }
                const p = await res.json();
                setTitle(p.title ?? '');
                setSlug(p.slug ?? '');
                setContent(p.content ?? '');
                setStatus(p.status === 'published' ? 'published' : 'draft');
                if (p.seo) setSeo(normalizeSeo(p.seo));
            } catch (e: any) {
                setLoadError(e?.message ?? 'Network error while loading page.');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, router]);

    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a title.'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/yt/cms-pages/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, slug, content, blocks: null, status, seo }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            router.push('/admin/myprojects/yt-downloader/pages');
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <Container fluid className="right-content"><p className="p-4">Loading…</p></Container>;

    if (loadError) return (
        <Container fluid className="right-content">
            <div className="card shadow border-0 p-4 mt-3">
                <h5 className="mb-2" style={{ color: '#dc2626' }}>Couldn&apos;t load this page</h5>
                <p className="mb-3" style={{ color: '#6b7280' }}>{loadError}</p>
                <button className="btn btn-outline-secondary" style={{ width: 'fit-content' }}
                    onClick={() => router.push('/admin/myprojects/yt-downloader/pages')}>← Back to Pages</button>
            </div>
        </Container>
    );

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Page"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'YT Pages', path: '/admin/myprojects/yt-downloader/pages' },
                    { label: 'Edit Page', path: `/admin/myprojects/yt-downloader/pages/${id}/edit` },
                ]}
            />
            <Row>
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="form-group para mb-3">
                            <label><b>Title</b></label>
                            <input type="text" className="form-control" value={title}
                                onChange={e => setTitle(e.target.value)}
                                style={{ fontSize: '18px', fontWeight: 500 }} />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Slug</b></label>
                            <input type="text" className="form-control" value={slug}
                                onChange={e => setSlug(toSlug(e.target.value))} />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Content</b></label>
                            <PostEditor value={content} onChange={setContent} focusKeyword={seo.focusKeyword} placeholder="Write this page's content…" />
                        </div>
                        <SeoPanel
                            seo={seo}
                            onChange={setSeo}
                            postTitle={title}
                            postContent={content}
                            postSlug={slug}
                            siteName={siteName}
                            siteUrl={siteUrl}
                            urlBasePath="yt"
                        />
                    </div>
                </Col>
                <Col xs={12} lg={4}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <h5 className="hd mb-3">Publish</h5>
                        <div className="form-group para mb-3">
                            <label><b>Status</b></label>
                            <select className="form-control" value={status}
                                onChange={e => setStatus(e.target.value as 'draft' | 'published')}>
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                            </select>
                        </div>
                        <button className="btn btn-primary w-100" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Saving...' : 'Update Page'}
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default EditCmsPage;
