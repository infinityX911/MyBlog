'use client';

/**
 * Add a YouTube-downloader CMS page (About / Privacy / Contact / …).
 * yt-downloader is a separate, simple site — so these pages use just the rich
 * editor (no blocks / sidebar). Reuses SeoPanel for the live SEO score.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import PostEditor from '@/components/admin/PostEditor';

const toSlug = (v: string) =>
    v.trim().toLowerCase()
        .replace(/[^\w\s/-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

function AddCmsPage() {
    const router = useRouter();
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

    const onTitle = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        setSlug(toSlug(e.target.value));
    };
    const onTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!seo.metaTitle && e.target.value.trim())
            setSeo(prev => ({ ...prev, metaTitle: e.target.value.trim() }));
    };

    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a title.'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/yt/cms-pages', {
                method: 'POST',
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

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Page"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'YT Pages', path: '/admin/myprojects/yt-downloader/pages' },
                    { label: 'Add Page', path: '/admin/myprojects/yt-downloader/pages/create' },
                ]}
            />
            <Row>
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="form-group para mb-3">
                            <label><b>Title</b></label>
                            <input type="text" className="form-control" value={title}
                                onChange={onTitle} onBlur={onTitleBlur}
                                placeholder="About Us"
                                style={{ fontSize: '18px', fontWeight: 500 }} />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Slug</b> <small style={{ fontWeight: 400 }}>(URL after the domain, e.g. "about")</small></label>
                            <input type="text" className="form-control" value={slug}
                                onChange={e => setSlug(e.target.value)} placeholder="about" />
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
                            {saving ? 'Saving...' : status === 'published' ? 'Publish Page' : 'Save Draft'}
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default AddCmsPage;
