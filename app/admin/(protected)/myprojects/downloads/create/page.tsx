'use client';

/**
 * app/admin/(protected)/myprojects/downloads/create/page.tsx
 * Add new download — reuses SeoPanel exactly like blog posts
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import FeaturedVisual from '@/components/admin/FeaturedVisual';
import PostEditor from '@/components/admin/PostEditor';
import PublishSchedule, { localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';

const toSlug = (value: string) =>
    value.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/-$/, '');

const GRADIENTS = [
    'gradientPurple', 'gradientGreen', 'gradientBlue', 'gradientOrange',
    'gradientPink', 'gradientIndigo', 'gradientTeal', 'gradientRose',
];

const CATEGORIES = ['Tech', 'Life', 'Travel', 'Science', 'Opinion'];

function AddDownload() {
    const router = useRouter();

    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [fileUrl, setFileUrl] = useState('');
    const [fileType, setFileType] = useState('PDF');
    const [fileSize, setFileSize] = useState('');
    const [icon, setIcon] = useState('📄');
    const [gradient, setGradient] = useState('gradientPurple');
    const [image, setImage] = useState('');
    const [category, setCategory] = useState('Tech');
    const [tags, setTags] = useState('');
    const [content, setContent] = useState('');
    const [featured, setFeatured] = useState(false);
    const [free, setFree] = useState(true);
    const [status, setStatus] = useState<PublishStatus>('draft');
    const [scheduledLocal, setScheduledLocal] = useState('');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);
    // Real site name + URL for the SeoPanel preview (else "https://yoursite.com").
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    useEffect(() => {
        fetch('/api/settings')
            .then(r => (r.ok ? r.json() : []))
            .then((all: any[]) => {
                const blog = all.find((s: any) => s.siteKey === 'blog');
                if (blog) {
                    setSiteName(blog.siteName ?? '');
                    setSiteUrl(blog.websiteUrl ?? '');
                }
            })
            .catch(() => { /* optional */ });
    }, []);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        setSlug(toSlug(newTitle));
    };

    const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (!seo.metaTitle && e.target.value.trim()) {
            setSeo(prev => ({ ...prev, metaTitle: e.target.value.trim() }));
        }
    };

    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a title.'); return; }
        if (!fileUrl.trim()) { alert('Please enter a file URL.'); return; }
        setSaving(true);
        try {
            const result = await fetch('/api/downloads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title, slug, excerpt, fileUrl, fileType, fileSize,
                    icon, gradient, image, category,
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                    content,
                    featured, free, status, scheduledAt: localInputToIso(scheduledLocal), seo,
                }),
            });
            if (!result.ok) {
                const err = await result.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${result.status}`);
            }
            router.push('/admin/myprojects/downloads');
        } catch (error: any) {
            alert(`Failed: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Add Download"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Downloads', path: '/admin/myprojects/downloads' },
                    { label: 'Add Download', path: '/admin/myprojects/downloads/create' },
                ]}
            />

            <Row>
                {/* Main column */}
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="form-group para mb-3">
                            <label><b>Title</b></label>
                            <input
                                type="text"
                                className="form-control"
                                value={title}
                                onChange={handleTitleChange}
                                onBlur={handleTitleBlur}
                                placeholder="Complete React 2026 Cheat Sheet"
                                style={{ fontSize: '18px', fontWeight: 500 }}
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Slug</b></label>
                            <input
                                type="text"
                                className="form-control"
                                value={slug}
                                onChange={e => setSlug(e.target.value)}
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Excerpt</b> <small style={{ fontWeight: 400 }}>(shown on cards)</small></label>
                            <textarea
                                className="form-control"
                                rows={3}
                                value={excerpt}
                                onChange={e => setExcerpt(e.target.value)}
                                placeholder="Brief description of this resource..."
                            />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>File URL</b> <small style={{ fontWeight: 400 }}>(actual downloadable file)</small></label>
                            <input
                                type="text"
                                className="form-control"
                                value={fileUrl}
                                onChange={e => setFileUrl(e.target.value)}
                                placeholder="https://yoursite.com/files/cheat-sheet.pdf"
                            />
                        </div>

                        <Row>
                            <Col xs={4}>
                                <div className="form-group para mb-3">
                                    <label><b>File Type</b></label>
                                    <select className="form-control" value={fileType} onChange={e => setFileType(e.target.value)}>
                                        <option value="PDF">PDF</option>
                                        <option value="ZIP">ZIP</option>
                                        <option value="Template">Template</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </Col>
                            <Col xs={4}>
                                <div className="form-group para mb-3">
                                    <label><b>File Size</b></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={fileSize}
                                        onChange={e => setFileSize(e.target.value)}
                                        placeholder="2.4 MB"
                                    />
                                </div>
                            </Col>
                            <Col xs={4}>
                                <div className="form-group para mb-3">
                                    <label><b>Icon (emoji)</b></label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={icon}
                                        onChange={e => setIcon(e.target.value)}
                                        placeholder="⚛️"
                                    />
                                </div>
                            </Col>
                        </Row>

                        <div className="form-group para mb-3">
                            <label><b>Tags</b> <small style={{ fontWeight: 400 }}>(comma separated)</small></label>
                            <input
                                type="text"
                                className="form-control"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                                placeholder="React, JavaScript"
                            />
                        </div>

                        {/* Full content — same rich editor as blog posts (for a
                            proper detail page + stronger SEO) */}
                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Content</label>
                            <PostEditor value={content} onChange={setContent} focusKeyword={seo.focusKeyword} placeholder="Write the full description / details for this download..." />
                        </div>

                        {/* SEO Panel — reused exactly (now scored against the full content) */}
                        <SeoPanel
                            seo={seo}
                            onChange={setSeo}
                            postTitle={title}
                            postContent={content || excerpt}
                            postSlug={slug}
                            siteName={siteName}
                            siteUrl={siteUrl}
                            urlBasePath="downloads"
                        />
                    </div>
                </Col>

                {/* Sidebar */}
                <Col xs={12} lg={4}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <h5 className="hd mb-3">Publish</h5>

                        <PublishSchedule
                            status={status}
                            onStatusChange={setStatus}
                            scheduledLocal={scheduledLocal}
                            onScheduledChange={setScheduledLocal}
                        />

                        <div className="form-group para mb-3">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)} />
                                <b>Featured</b>
                            </label>
                        </div>

                        <div className="form-group para mb-3">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={free} onChange={e => setFree(e.target.checked)} />
                                <b>Free</b>
                            </label>
                        </div>

                        <button className="btn btn-primary w-100" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Saving...' : status === 'published' ? 'Publish Download' : 'Save Draft'}
                        </button>
                    </div>

                    <div className="card shadow border-0 p-3 mt-2">
                        <h5 className="hd mb-3">Category</h5>
                        <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="card shadow border-0 p-3 mt-2">
                        <h5 className="hd mb-3">Card Visual</h5>
                        <FeaturedVisual
                            image={image}
                            gradient={gradient}
                            onChange={({ image, gradient }) => { setImage(image); setGradient(gradient); }}
                        />
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default AddDownload;
