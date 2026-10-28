'use client';

/** Edit a Blog CMS page. Loads existing data (blocks + SEO), PUTs updates. */

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Col, Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import SeoPanel, { emptySeo, SeoData } from '@/components/admin/blog/SeoPanel';
import { normalizeSeo } from '@/lib/seo/scoring';
import PageBlocksEditor from '@/components/admin/PageBlocksEditor';
import PublishSchedule, { isoToLocalInput, localInputToIso, type PublishStatus } from '@/components/admin/PublishSchedule';
import TutorialSidebarEditor from '@/components/admin/TutorialSidebarEditor';
import { blocksToSeoText, parseBlocks, type Block } from '@/lib/page-blocks';
import { parseSidebar, serializeSidebar, type SidebarSection } from '@/lib/page-sidebar';

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
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [sidebar, setSidebar] = useState<SidebarSection[]>([]);
    const [heroGradient, setHeroGradient] = useState('gradientPurple');
    const [heroImage, setHeroImage] = useState('');
    const [tags, setTags] = useState('');
    const [layout, setLayout] = useState<'wide' | 'boxed'>('wide');
    const [status, setStatus] = useState<PublishStatus>('draft');
    // "YYYY-MM-DDTHH:mm" local string for the picker; converted to ISO on save.
    const [scheduledLocal, setScheduledLocal] = useState('');
    const [seo, setSeo] = useState<SeoData>(emptySeo());
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    // Site settings from DB — SeoPanel needs these for the Google preview URL and
    // the schema publisher name. Without them the preview falls back to the
    // placeholder "https://yoursite.com", which looks broken to the author.
    const [siteName, setSiteName] = useState('');
    const [siteUrl, setSiteUrl] = useState('');

    // Runs in parallel with the page fetch — never blocks the editor.
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
            .catch(() => { /* optional — SeoPanel degrades gracefully */ });
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/blog/cms-pages/${id}`);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setLoadError(err.error ?? `Failed to load page (HTTP ${res.status}).`);
                    return;
                }
                const p = await res.json();
                setTitle(p.title ?? '');
                setSlug(p.slug ?? '');
                setBlocks(parseBlocks(p.blocks).length ? parseBlocks(p.blocks) : (p.content ? [{ id: 'legacy', type: 'text', html: p.content }] : []));
                setStatus(['draft', 'scheduled', 'published'].includes(p.status) ? p.status : 'draft');
                setScheduledLocal(isoToLocalInput(p.scheduledAt));
                setSidebar(parseSidebar(p.sidebar));
                const hb: string = p.heroBg ?? '';
                if (/^https?:\/\//.test(hb) || hb.startsWith('/')) setHeroImage(hb);
                else if (hb) setHeroGradient(hb);
                setTags(p.tags ?? '');
                setLayout(p.layout === 'boxed' ? 'boxed' : 'wide');
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
            const res = await fetch(`/api/blog/cms-pages/${id}`, {
                method: 'PUT',
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

    // Save changes, then preview the page in admin-only ?preview=1 mode (works
    // even while the page is a draft) in a new tab.
    async function handlePreview() {
        if (!title.trim()) { alert('Please enter a title first.'); return; }
        if (!slug.trim()) { alert('Please set a page slug first.'); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/blog/cms-pages/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, slug, content: blocksToSeoText(blocks), blocks: JSON.stringify(blocks), sidebar: serializeSidebar(sidebar), heroBg: heroImage.trim() || heroGradient, tags, layout, status, scheduledAt: localInputToIso(scheduledLocal), seo }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }
            window.open(`/${slug}?preview=1`, '_blank', 'noopener');
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
                <p className="mb-3" style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    If this mentions an unknown column like <code>blocks</code>, run the pending DB migration
                    (<code>npx prisma migrate dev</code> + <code>npx prisma generate</code>) and restart the dev server.
                </p>
                <button className="btn btn-outline-secondary" style={{ width: 'fit-content' }}
                    onClick={() => router.push('/admin/myprojects/blog/pages')}>← Back to Pages</button>
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
                    { label: 'Blog Pages', path: '/admin/myprojects/blog/pages' },
                    { label: 'Edit Page', path: `/admin/myprojects/blog/pages/${id}/edit` },
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
                            {saving ? 'Saving...' : 'Update Page'}
                        </button>
                        <button type="button" className="btn btn-outline-secondary w-100 mt-2" onClick={handlePreview} disabled={saving}
                            title="Save changes and preview — without publishing">
                            👁 Preview
                        </button>
                    </div>
                </Col>
            </Row>
        </Container>
    );
}

export default EditCmsPage;
