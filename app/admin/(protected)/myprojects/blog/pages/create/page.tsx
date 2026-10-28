'use client';

/**
 * Add a YouTube-downloader CMS page (About / Privacy / Contact / …).
 * Reuses SeoPanel + emptySeo exactly like the Blog & Downloads editors, so the
 * live SEO health score works with zero new UI.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import PageBlocksEditor from '@/components/admin/PageBlocksEditor';
import PublishSchedule, { localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';
import TutorialSidebarEditor from '@/components/admin/TutorialSidebarEditor';
import { blocksToSeoText, parseBlocks, type Block } from '@/lib/page-blocks';
import { serializeSidebar, type SidebarSection } from '@/lib/page-sidebar';

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
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [sidebar, setSidebar] = useState<SidebarSection[]>([]);
    const [heroGradient, setHeroGradient] = useState('gradientPurple');
    const [heroImage, setHeroImage] = useState('');
    const [tags, setTags] = useState('');
    const [layout, setLayout] = useState<'wide' | 'boxed'>('wide');
    const [status, setStatus] = useState<PublishStatus>('draft');
    const [scheduledLocal, setScheduledLocal] = useState('');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);
    // Real site name + URL for the SeoPanel preview (otherwise it shows the
    // "https://yoursite.com" placeholder).
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
            const res = await fetch('/api/blog/cms-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, slug, content: blocksToSeoText(blocks), blocks: JSON.stringify(blocks), sidebar: serializeSidebar(sidebar), heroBg: heroImage.trim() || heroGradient, tags, layout, status, scheduledAt: localInputToIso(scheduledLocal), seo }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            router.push('/admin/myprojects/blog/pages');
        } catch (e: any) {
            alert(`Failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    }

    // Save as draft, preview the page in admin-only ?preview=1 mode, then switch
    // to its edit page so re-previewing updates the same draft (no duplicates).
    async function handlePreview() {
        if (!title.trim()) { alert('Please enter a title first.'); return; }
        if (!slug.trim()) { alert('Please set a page slug first.'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/blog/cms-pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, slug, content: blocksToSeoText(blocks), blocks: JSON.stringify(blocks), sidebar: serializeSidebar(sidebar), heroBg: heroImage.trim() || heroGradient, tags, layout, status: 'draft', seo }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json().catch(() => ({}));
            window.open(`/${slug}?preview=1`, '_blank', 'noopener');
            if (data?.id) router.push(`/admin/myprojects/blog/pages/${data.id}/edit`);
            else router.push('/admin/myprojects/blog/pages');
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
                    { label: 'Blog Pages', path: '/admin/myprojects/blog/pages' },
                    { label: 'Add Page', path: '/admin/myprojects/blog/pages/create' },
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
                            <label><b>Content blocks</b> <small style={{ fontWeight: 400 }}>(write text, or add posts / downloads / hero / newsletter blocks)</small></label>
                            <PageBlocksEditor value={blocks} onChange={setBlocks} focusKeyword={seo.focusKeyword} />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Tutorial sidebar</b> <small style={{ fontWeight: 400 }}>(optional — add sections to render this page with a left navigation like a tutorial)</small></label>
                            <TutorialSidebarEditor value={sidebar} onChange={setSidebar} />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Tutorial hero</b> <small style={{ fontWeight: 400 }}>(banner background — pick a gradient or paste an image URL; image wins)</small></label>
                            <div className="d-flex" style={{ gap: 8 }}>
                                <select className="form-control" value={heroGradient} onChange={e => setHeroGradient(e.target.value)} style={{ maxWidth: 220 }}>
                                    <option value="gradientPurple">Purple</option>
                                    <option value="gradientGreen">Green</option>
                                    <option value="gradientBlue">Blue</option>
                                    <option value="gradientOrange">Orange</option>
                                    <option value="gradientPink">Pink</option>
                                    <option value="gradientIndigo">Indigo</option>
                                    <option value="gradientTeal">Teal</option>
                                    <option value="gradientRose">Rose</option>
                                </select>
                                <input type="text" className="form-control" value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="or image URL (https://... or /uploads/...)" />
                            </div>
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Tags</b> <small style={{ fontWeight: 400 }}>(comma-separated, shown at the bottom with the share button)</small></label>
                            <input type="text" className="form-control" value={tags} onChange={e => setTags(e.target.value)} placeholder="react, hooks, tutorial" />
                        </div>
                        <div className="form-group para mb-3">
                            <label><b>Page layout</b> <small style={{ fontWeight: 400 }}>(for non-tutorial pages — Wide fills the screen; Boxed looks like a blog post)</small></label>
                            <select className="form-control" value={layout} onChange={e => setLayout(e.target.value as 'wide' | 'boxed')} style={{ maxWidth: 260 }}>
                                <option value="wide">Wide (full-width)</option>
                                <option value="boxed">Boxed (post style)</option>
                            </select>
                        </div>
                        <SeoPanel
                            seo={seo}
                            onChange={setSeo}
                            postTitle={title}
                            postContent={blocksToSeoText(blocks)}
                            postSlug={slug}
                            siteName={siteName}
                            siteUrl={siteUrl}
                            urlBasePath=""
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
                        <button className="btn btn-primary w-100" onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Saving...' : status === 'published' ? 'Publish Page' : status === 'scheduled' ? 'Schedule Page' : 'Save Draft'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary w-100 mt-2" onClick={handlePreview} disabled={saving}
                            title="Save as draft and preview — without publishing">
                            👁 Preview
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default AddCmsPage;
