'use client';

/**
 * app/admin/(protected)/myprojects/downloads/[id]/edit/page.tsx
 * Edit existing download — reuses SeoPanel exactly like blog posts
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import FeaturedVisual from '@/components/admin/FeaturedVisual';
import PostEditor from '@/components/admin/PostEditor';
import PublishSchedule, { isoToLocalInput, localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';

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

function EditDownload() {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;

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
    const [loaded, setLoaded] = useState(false);
    // Real site name + URL so the SeoPanel preview shows the live domain instead
    // of the "https://yoursite.com" placeholder.
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

    useEffect(() => {
        if (!id) return;
        fetch(`/api/downloads/${id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                setTitle(data.title ?? '');
                setSlug(data.slug ?? '');
                setExcerpt(data.excerpt ?? '');
                setFileUrl(data.fileUrl ?? '');
                setFileType(data.fileType ?? 'PDF');
                setFileSize(data.fileSize ?? '');
                setIcon(data.icon ?? '📄');
                setGradient(data.gradient ?? 'gradientPurple');
                setImage(data.image ?? '');
                setCategory(data.category ?? 'Tech');
                setTags(data.tags ?? '');
                setContent(data.content ?? '');
                setFeatured(data.featured ?? false);
                setFree(data.free ?? true);
                setStatus(['draft', 'scheduled', 'published'].includes(data.status) ? data.status : 'draft');
                setScheduledLocal(isoToLocalInput(data.scheduledAt));
                if (data.seo) {
                    setSeo({
                        focusKeyword:       data.seo.focusKeyword       ?? '',
                        metaTitle:          data.seo.metaTitle          ?? '',
                        metaDescription:    data.seo.metaDescription    ?? '',
                        robotsIndex:        data.seo.robotsIndex        ?? true,
                        robotsFollow:       data.seo.robotsFollow       ?? true,
                        canonicalUrl:       data.seo.canonicalUrl       ?? '',
                        ogTitle:            data.seo.ogTitle            ?? '',
                        ogDescription:      data.seo.ogDescription      ?? '',
                        ogImage:            data.seo.ogImage            ?? '',
                        twitterTitle:       data.seo.twitterTitle       ?? '',
                        twitterDescription: data.seo.twitterDescription ?? '',
                        schemaType:         data.seo.schemaType         ?? 'WebPage',
                        schemaJson:         data.seo.schemaJson         ?? '',
                    });
                }
                setLoaded(true);
            })
            .catch(err => console.error('Error fetching download:', err));
    }, [id]);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        setSlug(toSlug(e.target.value));
    };

    async function handleSubmit() {
        if (!title.trim()) { alert('Please enter a title.'); return; }
        if (!fileUrl.trim()) { alert('Please enter a file URL.'); return; }
        setSaving(true);
        try {
            const result = await fetch(`/api/downloads/${id}`, {
                method: 'PATCH',
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

    if (!loaded) {
        return (
            <Container fluid className="right-content">
                <HeaderPanel title="Edit Download" breadcrumbs={[{ label: 'Downloads', path: '/admin/myprojects/downloads' }, { label: 'Edit', path: '#' }]} />
                <div className="para mt-4" style={{ textAlign: 'center', opacity: 0.5 }}>Loading download...</div>
            </Container>
        );
    }

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Edit Download"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Downloads', path: '/admin/myprojects/downloads' },
                    { label: 'Edit', path: `/admin/myprojects/downloads/${id}/edit` },
                ]}
            />

            <Row>
                <Col xs={12} lg={8}>
                    <div className="card shadow border-0 p-3 mt-1">
                        <div className="form-group para mb-3">
                            <label><b>Title</b></label>
                            <input type="text" className="form-control" value={title}
                                onChange={handleTitleChange}
                                style={{ fontSize: '18px', fontWeight: 500 }} />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Slug</b></label>
                            <input type="text" className="form-control" value={slug}
                                onChange={e => setSlug(e.target.value)} />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>Excerpt</b></label>
                            <textarea className="form-control" rows={3} value={excerpt}
                                onChange={e => setExcerpt(e.target.value)} />
                        </div>

                        <div className="form-group para mb-3">
                            <label><b>File URL</b></label>
                            <input type="text" className="form-control" value={fileUrl}
                                onChange={e => setFileUrl(e.target.value)}
                                placeholder="https://yoursite.com/files/cheat-sheet.pdf" />
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
                                    <input type="text" className="form-control" value={fileSize}
                                        onChange={e => setFileSize(e.target.value)} placeholder="2.4 MB" />
                                </div>
                            </Col>
                            <Col xs={4}>
                                <div className="form-group para mb-3">
                                    <label><b>Icon (emoji)</b></label>
                                    <input type="text" className="form-control" value={icon}
                                        onChange={e => setIcon(e.target.value)} placeholder="⚛️" />
                                </div>
                            </Col>
                        </Row>

                        <div className="form-group para mb-3">
                            <label><b>Tags</b> <small style={{ fontWeight: 400 }}>(comma separated)</small></label>
                            <input type="text" className="form-control" value={tags}
                                onChange={e => setTags(e.target.value)} placeholder="React, JavaScript" />
                        </div>

                        {/* SEO Panel — unchanged, reused */}
                        <div className="form-group para mb-3">
                            <label className="blog-field-label">Content</label>
                            <PostEditor value={content} onChange={setContent} focusKeyword={seo.focusKeyword} placeholder="Write the full description / details for this download..." />
                        </div>

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
                            {saving ? 'Saving...' : status === 'published' ? 'Update & Publish' : 'Save Draft'}
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

export default EditDownload;
