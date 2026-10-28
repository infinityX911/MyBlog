'use client';

/**
 * components/admin/PageBlocksEditor.tsx
 * Lightweight block builder for CMS pages. A page is an ordered list of blocks;
 * each block is rich text (PostEditor) or a dynamic block (posts, downloads,
 * hero, newsletter, filter, featured, sidebar, contact, social, faq).
 * Controlled via value/onChange.
 */

import React, { useRef, useState } from 'react';
import PostEditor from '@/components/admin/PostEditor';
import FeaturedVisual from '@/components/admin/FeaturedVisual';
import type { Block } from '@/lib/page-blocks';
import { BLOCK_LABELS, blocksToSeoText } from '@/lib/page-blocks';

interface Props {
    value: Block[];
    onChange: (blocks: Block[]) => void;
    focusKeyword?: string;
}

const uid = () => Math.random().toString(36).slice(2, 9);

function newBlock(type: Block['type']): Block {
    switch (type) {
        case 'text': return { id: uid(), type: 'text', html: '' };
        case 'posts': return { id: uid(), type: 'posts', heading: 'Latest Posts', count: 6 };
        case 'downloads': return { id: uid(), type: 'downloads', heading: 'Downloads', count: 6, featuredOnly: false };
        case 'hero': return { id: uid(), type: 'hero', heading: 'Your headline', badge: '', subtext: '', gradient: 'gradientPurple', image: '', showStats: false, statArticles: true, statCategories: true, statViews: true };
        case 'newsletter': return { id: uid(), type: 'newsletter', heading: 'Subscribe', subtext: 'Get new content in your inbox.', buttonLabel: 'Subscribe', buttonUrl: '/#about' };
        case 'filter': return { id: uid(), type: 'filter' };
        case 'featured': return { id: uid(), type: 'featured', downloadSlug: '' };
        case 'sidebar': return { id: uid(), type: 'sidebar' };
        case 'contact': return {
            id: uid(), type: 'contact', heading: 'Contact Information', methods: [
                { color: 'purple', icon: 'email', label: 'Email', value: 'hello@example.com', href: 'mailto:hello@example.com', note: 'Reply within 24 hours' },
                { color: 'green', icon: 'clock', label: 'Response Time', value: 'Within 24 hours', note: 'Mon–Fri, 9am–6pm' },
                { color: 'blue', icon: 'location', label: 'Based In', value: 'Pakistan', note: 'Available worldwide' },
                { color: 'orange', icon: 'tag', label: 'For Collaboration', value: 'collab@example.com', href: 'mailto:collab@example.com', note: 'Partnerships & write-for-us' },
            ],
        };
        case 'social': return {
            id: uid(), type: 'social', heading: 'Follow us', subtext: 'Stay updated with our latest posts and resources.', links: [
                { icon: '𝕏', label: 'Twitter (X)', url: 'https://twitter.com' },
                { icon: '🐙', label: 'GitHub', url: 'https://github.com' },
                { icon: '▶️', label: 'YouTube', url: 'https://youtube.com' },
            ],
        };
        case 'faq': return {
            id: uid(), type: 'faq', heading: 'Quick Answers', items: [
                { q: 'Can I write for you?', a: 'Yes! Email us with your topic idea and a writing sample.' },
                { q: 'Are all downloads free?', a: '100%. No email required, no paywall.' },
            ],
        };
        case 'youtube': return { id: uid(), type: 'youtube', heading: 'Our YouTube Channels' };
        case 'cards': return { id: uid(), type: 'cards', heading: 'Tutorials', perPage: 0, items: [{ image: '', gradient: 'thumb-tech', title: '', description: '', href: '', badge: '', cta: '' }] };
        case 'author': return { id: uid(), type: 'author' };
        case 'categories': return { id: uid(), type: 'categories', heading: 'Categories' };
        case 'trending': return { id: uid(), type: 'trending', heading: 'Trending', count: 4 };
        case 'tags': return { id: uid(), type: 'tags', heading: 'Tags' };
        case 'related': return { id: uid(), type: 'related', heading: 'Related Posts', count: 4 };
        case 'ad': return { id: uid(), type: 'ad', code: '' };
    }
}

export default function PageBlocksEditor({ value, onChange, focusKeyword = '' }: Props) {
    const blocks = value ?? [];
    const dragFrom = useRef<number | null>(null);
    const [dragOver, setDragOver] = useState<number | null>(null);
    const reorder = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
        const next = [...blocks];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onChange(next);
    };
    const update = (id: string, patch: Partial<Block>) =>
        onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as Block) : b));
    const remove = (id: string) => onChange(blocks.filter(b => b.id !== id));
    const add = (type: Block['type']) => onChange([...blocks, newBlock(type)]);

    // Word count for the WHOLE page — the same text the SEO panel scores
    // (blocksToSeoText is what the editor saves as `content`). Each text block's
    // stats panel gets this so its "aim for 300+" hint matches the SEO score
    // instead of judging one block in isolation.
    const pageWords = React.useMemo(() => {
        const text = blocksToSeoText(blocks).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return text ? text.split(/\s+/).filter(Boolean).length : 0;
    }, [blocks]);

    // Helpers for blocks that hold an array of items (contact methods, social links, faq)
    const setItem = (b: any, key: string, i: number, patch: any) => {
        const arr = [...(b[key] ?? [])]; arr[i] = { ...arr[i], ...patch }; update(b.id, { [key]: arr } as any);
    };
    const addItem = (b: any, key: string, blank: any) =>
        update(b.id, { [key]: [...(b[key] ?? []), blank] } as any);
    const delItem = (b: any, key: string, i: number) =>
        update(b.id, { [key]: (b[key] ?? []).filter((_: any, x: number) => x !== i) } as any);
    const moveItem = (b: any, key: string, i: number, dir: -1 | 1) => {
        const arr = [...(b[key] ?? [])]; const j = i + dir; if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]]; update(b.id, { [key]: arr } as any);
    };

    const field = (label: string, el: React.ReactNode) => (
        <div className="mb-2">
            <label className="form-label" style={{ fontSize: 13, fontWeight: 600 }}>{label}</label>
            {el}
        </div>
    );

    return (
        <div>
            {blocks.map((b, idx) => (
                <div key={b.id} className="card border-0 shadow-sm mb-3"
                    style={{ borderLeft: '4px solid #5b4fcf', outline: dragOver === idx ? '2px dashed #5b4fcf' : 'none' }}
                    onDragOver={(e) => { e.preventDefault(); if (dragOver !== idx) setDragOver(idx); }}
                    onDrop={() => { const from = dragFrom.current; if (from !== null) reorder(from, idx); dragFrom.current = null; setDragOver(null); }}
                >
                    <div className="d-flex align-items-center justify-content-between px-3 py-2"
                        style={{ background: '#f6f6fb', borderBottom: '1px solid #e9edf5', cursor: 'grab' }}
                        draggable
                        onDragStart={() => { dragFrom.current = idx; }}
                        onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
                        title="Drag to reorder">
                        <b style={{ fontSize: 14 }}><span style={{ color: '#94a3b8', marginRight: 8, cursor: 'grab' }}>⠿</span>{BLOCK_LABELS[b.type]}</b>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(b.id)} title="Remove block">✕</button>
                    </div>
                    <div className="p-3">
                        {b.type === 'text' && (
                            <PostEditor value={b.html} onChange={(html) => update(b.id, { html })} focusKeyword={focusKeyword} placeholder="Write content for this block…" pageWords={pageWords} />
                        )}
                        {b.type === 'posts' && (
                            <div className="row g-2">
                                <div className="col-md-6">{field('Heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} />)}</div>
                                <div className="col-md-3">{field('Category / tag (optional)', <input className="form-control" value={b.category ?? ''} onChange={e => update(b.id, { category: e.target.value })} placeholder="tech" />)}</div>
                                <div className="col-md-3">{field('How many', <input type="number" className="form-control" value={b.count ?? 6} onChange={e => update(b.id, { count: Number(e.target.value) })} />)}</div>
                            </div>
                        )}
                        {b.type === 'downloads' && (
                            <div className="row g-2">
                                <div className="col-md-5">{field('Heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} />)}</div>
                                <div className="col-md-3">{field('Category (optional)', <input className="form-control" value={b.category ?? ''} onChange={e => update(b.id, { category: e.target.value })} placeholder="Tech" />)}</div>
                                <div className="col-md-2">{field('How many', <input type="number" className="form-control" value={b.count ?? 6} onChange={e => update(b.id, { count: Number(e.target.value) })} />)}</div>
                                <div className="col-md-2 d-flex align-items-end">
                                    <label className="d-flex align-items-center gap-1 mb-2" style={{ cursor: 'pointer', fontSize: 13 }}>
                                        <input type="checkbox" checked={!!b.featuredOnly} onChange={e => update(b.id, { featuredOnly: e.target.checked })} /> Featured only
                                    </label>
                                </div>
                            </div>
                        )}
                        {b.type === 'hero' && (
                            <div className="row g-2">
                                <div className="col-md-4">{field('Badge / eyebrow (optional)', <input className="form-control" value={b.badge ?? ''} onChange={e => update(b.id, { badge: e.target.value })} placeholder="Tutorial" />)}</div>
                                <div className="col-md-8">{field('Heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} />)}</div>
                                <div className="col-12">{field('Subtext (optional)', <input className="form-control" value={b.subtext ?? ''} onChange={e => update(b.id, { subtext: e.target.value })} />)}</div>
                                <div className="col-12">{field('Background - image or gradient (same as post hero)',
                                    <FeaturedVisual image={b.image ?? ''} gradient={b.gradient ?? ''} onChange={({ image, gradient }) => update(b.id, { image, gradient })} />
                                )}</div>
                                <div className="col-12">
                                    <label className="d-flex align-items-center gap-1 mb-1" style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                                        <input type="checkbox" checked={!!b.showStats} onChange={e => update(b.id, { showStats: e.target.checked })} /> Show stats bar (like the home hero)
                                    </label>
                                    {b.showStats && (
                                        <div className="d-flex align-items-center gap-3 flex-wrap ms-3" style={{ fontSize: 13 }}>
                                            <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                                                <input type="checkbox" checked={b.statArticles !== false} onChange={e => update(b.id, { statArticles: e.target.checked })} /> Articles
                                            </label>
                                            <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                                                <input type="checkbox" checked={b.statCategories !== false} onChange={e => update(b.id, { statCategories: e.target.checked })} /> Categories
                                            </label>
                                            <label className="d-flex align-items-center gap-1" style={{ cursor: 'pointer' }}>
                                                <input type="checkbox" checked={b.statViews !== false} onChange={e => update(b.id, { statViews: e.target.checked })} /> Total Views
                                            </label>
                                        </div>
                                    )}
                                </div>
                                <div className="col-12">
                                    <label className="d-flex align-items-center gap-1 mb-0" style={{ cursor: 'pointer', fontSize: 13 }}>
                                        <input type="checkbox" checked={!!b.fullWidth} onChange={e => update(b.id, { fullWidth: e.target.checked })} /> Full width (render edge-to-edge below the content / comments)
                                    </label>
                                </div>
                            </div>
                        )}
                        {b.type === 'featured' && (
                            <div className="row g-2">
                                <div className="col-md-6">{field('Download slug (blank = featured download)', <input className="form-control" value={b.downloadSlug ?? ''} onChange={e => update(b.id, { downloadSlug: e.target.value })} placeholder="sql-backup-master-2026" />)}</div>
                            </div>
                        )}
                        {b.type === 'filter' && <p className="text-muted mb-0" style={{ fontSize: 13 }}>Renders the category filter pills (auto from your categories).</p>}
                        {b.type === 'ad' && (
                            <>
                                {field('Ad code', <textarea className="form-control" rows={4} style={{ fontFamily: 'monospace', fontSize: 12 }} value={(b as any).code ?? ''} onChange={e => update(b.id, { code: e.target.value } as any)} placeholder='Paste any ad-unit code — AdSense (<ins class="adsbygoogle" …></ins>) or another network (Media.net, Ezoic, a raw <script> unit — its scripts run automatically).' />)}
                                <p className="text-muted mb-0" style={{ fontSize: 12 }}>For <b>AdSense</b>, set your publisher ID under <b>Blog → Ads</b> first. Other networks work from the pasted code alone.</p>
                            </>
                        )}
                        {b.type === 'sidebar' && <p className="text-muted mb-0" style={{ fontSize: 13 }}>Renders the Author + Categories + Trending sidebar cards (all in one). Prefer the separate Author / Categories / Trending / Tags blocks for independent placement.</p>}
                        {b.type === 'author' && <p className="text-muted mb-0" style={{ fontSize: 13 }}>Author card — edit name / photo / bio under <b>Settings → Sitemap &amp; OG</b>. Renders in the sidebar.</p>}
                        {b.type === 'categories' && field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Categories" />)}
                        {b.type === 'trending' && (
                            <div className="row g-2">
                                <div className="col-md-8">{field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Trending" />)}</div>
                                <div className="col-md-4">{field('How many', <input type="number" className="form-control" value={b.count ?? 4} onChange={e => update(b.id, { count: Number(e.target.value) })} />)}</div>
                            </div>
                        )}
                        {b.type === 'related' && (
                            <div className="row g-2">
                                <div className="col-md-5">{field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Related Posts" />)}</div>
                                <div className="col-md-4">{field('Category / tag (optional)', <input className="form-control" value={b.category ?? ''} onChange={e => update(b.id, { category: e.target.value })} placeholder="tech" />)}</div>
                                <div className="col-md-3">{field('How many', <input type="number" className="form-control" value={b.count ?? 4} onChange={e => update(b.id, { count: Number(e.target.value) })} />)}</div>
                            </div>
                        )}
                        {b.type === 'tags' && (
                            <>
                                {field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Tags" />)}
                                <p className="text-muted mb-0" style={{ fontSize: 13 }}>Shows this page&apos;s own Tags (set the <b>Tags</b> field below). Hidden if the page has no tags.</p>
                            </>
                        )}
                        {b.type === 'newsletter' && (
                            <div className="row g-2">
                                <div className="col-md-6">{field('Heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} />)}</div>
                                <div className="col-md-6">{field('Subtext', <input className="form-control" value={b.subtext ?? ''} onChange={e => update(b.id, { subtext: e.target.value })} />)}</div>
                                <div className="col-md-6">{field('Button label', <input className="form-control" value={b.buttonLabel ?? ''} onChange={e => update(b.id, { buttonLabel: e.target.value })} />)}</div>
                                <div className="col-md-6">{field('Button URL', <input className="form-control" value={b.buttonUrl ?? ''} onChange={e => update(b.id, { buttonUrl: e.target.value })} />)}</div>
                                <div className="col-12">
                                    <label className="d-flex align-items-center gap-1 mb-0" style={{ cursor: 'pointer', fontSize: 13 }}>
                                        <input type="checkbox" checked={!!(b as any).fullWidth} onChange={e => update(b.id, { fullWidth: e.target.checked } as any)} /> Full width (render edge-to-edge below the content / comments)
                                    </label>
                                </div>
                            </div>
                        )}
                        {b.type === 'contact' && (
                            <div>
                                {field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} />)}
                                <div className="text-muted mb-2" style={{ fontSize: 12 }}>Rows shown in the card (renders on the page sidebar).</div>
                                {(b.methods ?? []).map((m, i) => (
                                    <div key={i} className="row g-2 align-items-end mb-2 p-2" style={{ background: '#f8fafc', borderRadius: 8 }}>
                                        <div className="col-md-2">{field('Colour', <select className="form-control" value={m.color ?? 'purple'} onChange={e => setItem(b, 'methods', i, { color: e.target.value })}>
                                            <option value="purple">Purple</option><option value="green">Green</option><option value="blue">Blue</option><option value="orange">Orange</option>
                                        </select>)}</div>
                                        <div className="col-md-2">{field('Icon', <select className="form-control" value={m.icon ?? 'email'} onChange={e => setItem(b, 'methods', i, { icon: e.target.value })}>
                                            <option value="email">✉️ Email</option><option value="clock">🕒 Clock</option><option value="location">📍 Location</option>
                                            <option value="tag">🏷️ Tag</option><option value="phone">📞 Phone</option><option value="chat">💬 Chat</option><option value="link">🔗 Link</option>
                                        </select>)}</div>
                                        <div className="col-md-2">{field('Label', <input className="form-control" value={m.label} onChange={e => setItem(b, 'methods', i, { label: e.target.value })} placeholder="Email" />)}</div>
                                        <div className="col-md-3">{field('Value', <input className="form-control" value={m.value} onChange={e => setItem(b, 'methods', i, { value: e.target.value })} placeholder="hello@site.com" />)}</div>
                                        <div className="col-md-3">{field('Link (optional)', <input className="form-control" value={m.href ?? ''} onChange={e => setItem(b, 'methods', i, { href: e.target.value })} placeholder="mailto:…" />)}</div>
                                        <div className="col-md-5">{field('Note', <input className="form-control" value={m.note ?? ''} onChange={e => setItem(b, 'methods', i, { note: e.target.value })} placeholder="Reply within 24h" />)}</div>
                                        <div className="col-md-1"><button type="button" className="btn btn-sm btn-outline-danger mb-2" onClick={() => delItem(b, 'methods', i)}>✕</button></div>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem(b, 'methods', { color: 'purple', icon: 'email', label: '', value: '', href: '', note: '' })}>+ Add row</button>
                            </div>
                        )}
                        {b.type === 'social' && (
                            <div>
                                <div className="row g-2">
                                    <div className="col-md-6">{field('Heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Follow us" />)}</div>
                                    <div className="col-md-6">{field('Subtext', <input className="form-control" value={b.subtext ?? ''} onChange={e => update(b.id, { subtext: e.target.value })} />)}</div>
                                </div>
                                {(b.links ?? []).map((l, i) => (
                                    <div key={i} className="row g-2 align-items-end mb-2 p-2" style={{ background: '#f8fafc', borderRadius: 8 }}>
                                        <div className="col-md-2">{field('Icon / emoji', <input className="form-control" value={l.icon ?? ''} onChange={e => setItem(b, 'links', i, { icon: e.target.value })} placeholder="🐙" />)}</div>
                                        <div className="col-md-4">{field('Label', <input className="form-control" value={l.label} onChange={e => setItem(b, 'links', i, { label: e.target.value })} placeholder="GitHub" />)}</div>
                                        <div className="col-md-5">{field('URL', <input className="form-control" value={l.url} onChange={e => setItem(b, 'links', i, { url: e.target.value })} placeholder="https://…" />)}</div>
                                        <div className="col-md-1"><button type="button" className="btn btn-sm btn-outline-danger mb-2" onClick={() => delItem(b, 'links', i)}>✕</button></div>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem(b, 'links', { icon: '🔗', label: '', url: '' })}>+ Add link</button>
                            </div>
                        )}
                        {b.type === 'youtube' && (
                            <div>
                                {field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Our YouTube Channels" />)}
                                <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                                    Shows the channels you add under <b>Blog → YouTube Channels</b> (name, avatar, subscriber count &amp; a Subscribe button). Renders in the page sidebar.
                                </p>
                            </div>
                        )}
                        {b.type === 'faq' && (
                            <div>
                                {field('Card heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Quick Answers" />)}
                                {(b.items ?? []).map((it, i) => (
                                    <div key={i} className="row g-2 align-items-end mb-2 p-2" style={{ background: '#f8fafc', borderRadius: 8 }}>
                                        <div className="col-md-5">{field('Question', <input className="form-control" value={it.q} onChange={e => setItem(b, 'items', i, { q: e.target.value })} placeholder="Question?" />)}</div>
                                        <div className="col-md-6">{field('Answer', <input className="form-control" value={it.a} onChange={e => setItem(b, 'items', i, { a: e.target.value })} placeholder="Answer." />)}</div>
                                        <div className="col-md-1"><button type="button" className="btn btn-sm btn-outline-danger mb-2" onClick={() => delItem(b, 'items', i)}>✕</button></div>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem(b, 'items', { q: '', a: '' })}>+ Add Q&amp;A</button>
                            </div>
                        )}
                        {b.type === 'cards' && (
                            <div>
                                <div className="row g-2">
                                    <div className="col-md-8">{field('Section heading', <input className="form-control" value={b.heading ?? ''} onChange={e => update(b.id, { heading: e.target.value })} placeholder="Tutorials" />)}</div>
                                    <div className="col-md-4">{field('Cards per page (0 = show all)', <input type="number" min={0} className="form-control" value={b.perPage ?? 0} onChange={e => update(b.id, { perPage: Math.max(0, Number(e.target.value) || 0) })} placeholder="6" />)}</div>
                                </div>
                                <p className="text-muted" style={{ fontSize: 12 }}>Each card looks like a blog post card. Add an <b>Image URL</b> (or pick a <b>Gradient</b> if no image). Use ▲ ▼ to reorder. Set <b>Cards per page</b> once the grid gets long — every card still ships in the HTML for search engines, the extra pages are just hidden until clicked.</p>
                                {(b.items ?? []).map((c, i) => (
                                    <div key={i} className="row g-2 align-items-end mb-3 p-2" style={{ background: '#f8fafc', borderRadius: 8 }}>
                                        <div className="col-md-3">{field('Image URL (optional)', <input className="form-control" value={c.image ?? ''} onChange={e => setItem(b, 'items', i, { image: e.target.value })} placeholder="/uploads/php.png" />)}</div>
                                        <div className="col-md-2">{field('Gradient (if no image)', <select className="form-control" value={c.gradient ?? 'thumb-tech'} onChange={e => setItem(b, 'items', i, { gradient: e.target.value })}>
                                            <option value="thumb-tech">Purple</option>
                                            <option value="thumb-life">Green</option>
                                            <option value="thumb-travel">Teal</option>
                                            <option value="thumb-opinion">Pink</option>
                                            <option value="thumb-science">Indigo</option>
                                            <option value="thumb-new">Violet</option>
                                        </select>)}</div>
                                        <div className="col-md-2">{field('Badge (optional)', <input className="form-control" value={c.badge ?? ''} onChange={e => setItem(b, 'items', i, { badge: e.target.value })} placeholder="Web Development" />)}</div>
                                        <div className="col-md-2">{field('Title', <input className="form-control" value={c.title} onChange={e => setItem(b, 'items', i, { title: e.target.value })} placeholder="PHP Tutorial" />)}</div>
                                        <div className="col-md-3">{field('Link', <input className="form-control" value={c.href} onChange={e => setItem(b, 'items', i, { href: e.target.value })} placeholder="/phptutorials" />)}</div>
                                        <div className="col-md-6">{field('Description', <input className="form-control" value={c.description ?? ''} onChange={e => setItem(b, 'items', i, { description: e.target.value })} placeholder="Learn PHP from scratch — free, step by step." />)}</div>
                                        <div className="col-md-3">{field('Button text (optional)', <input className="form-control" value={c.cta ?? ''} onChange={e => setItem(b, 'items', i, { cta: e.target.value })} placeholder="Start Learning →" />)}</div>
                                        <div className="col-md-3 d-flex gap-1 align-items-end">
                                            <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={() => moveItem(b, 'items', i, -1)} title="Move up">▲</button>
                                            <button type="button" className="btn btn-sm btn-outline-secondary mb-2" onClick={() => moveItem(b, 'items', i, 1)} title="Move down">▼</button>
                                            <button type="button" className="btn btn-sm btn-outline-danger mb-2" onClick={() => delItem(b, 'items', i)}>✕ Remove</button>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => addItem(b, 'items', { image: '', gradient: 'thumb-tech', title: '', description: '', href: '', badge: '', cta: '' })}>+ Add card</button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add block */}
            <div className="d-flex align-items-center gap-2 flex-wrap p-3 rounded" style={{ background: '#f6f6fb', border: '1px dashed #cbd5e1' }}>
                <b style={{ fontSize: 13, marginRight: 4 }}>+ Add block:</b>
                {(Object.keys(BLOCK_LABELS) as Block['type'][]).map(t => (
                    <button key={t} type="button" className="btn btn-sm btn-outline-primary" onClick={() => add(t)}>{BLOCK_LABELS[t]}</button>
                ))}
            </div>
        </div>
    );
}
