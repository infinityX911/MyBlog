/**
 * components/blocks/BlockRenderer.tsx — server component that renders a CMS
 * page's blocks. Text blocks render sanitized HTML; posts/downloads blocks
 * fetch live data and render card grids; hero/newsletter render styled banners;
 * contact/social/faq render the same cards used on the Contact page's sidebar.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import SafeHtml from '@/components/SafeHtml';
import PostCard from '@/components/PostCard';
import DownloadCard from '@/components/DownloadCard';
import { getPosts, getCategories, getTrendingPosts, postHref } from '@/lib/blog';
import { getDisplayFlags } from '@/lib/display-flags';
import CategorySidebar from '@/components/CategorySidebar';
import AuthorCard from '@/components/AuthorCard';
import AdUnit from '@/components/ads/AdUnit';
import { getDownloads, getFeaturedDownload, getDownloadBySlug } from '@/lib/downloads';
import { getYoutubeChannels } from '@/lib/youtube';
import SubscribeButton from '@/components/SubscribeButton';
import CardsPager from '@/components/blocks/CardsPager';
import type { Block } from '@/lib/page-blocks';
import postStyles from '@/components/PostDetail.module.css';
import dstyles from '../../app/(blog)/downloads/Downloads.module.css';
import cstyles from '../../app/(blog)/contact/Contact.module.css';

const GRAD: Record<string, string> = {
    gradientPurple: 'linear-gradient(135deg, #1a0533 0%, #0d2b6b 55%, #0a4d68 100%)',
    gradientGreen: 'linear-gradient(135deg, #064e3b 0%, #065f46 55%, #047857 100%)',
    gradientBlue: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 55%, #0284c7 100%)',
    gradientOrange: 'linear-gradient(135deg, #431407 0%, #9a3412 55%, #c2410c 100%)',
    gradientPink: 'linear-gradient(135deg, #4a044e 0%, #86198f 55%, #a21caf 100%)',
    gradientIndigo: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #3730a3 100%)',
    gradientTeal: 'linear-gradient(135deg, #042f2e 0%, #0f766e 55%, #0d9488 100%)',
    gradientRose: 'linear-gradient(135deg, #4c0519 0%, #9f1239 55%, #be123c 100%)',
};
const DEF = GRAD.gradientPurple;

const METHOD_COLOR: Record<string, string> = {
    purple: cstyles.methodIconPurple,
    green: cstyles.methodIconGreen,
    blue: cstyles.methodIconBlue,
    orange: cstyles.methodIconOrange,
};

/** Icon glyphs a contact method can pick in the page editor (see the Icon
 *  select in PageBlocksEditor) — the same line-art set the old hardcoded
 *  Contact page shipped with. */
const METHOD_ICON: Record<string, ReactNode> = {
    email: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    location: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></>,
    tag: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
    chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
};

function Heading({ text }: { text?: string }) {
    if (!text) return null;
    return <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '8px 0 18px' }}>{text}</h2>;
}

async function PostsBlock({ b }: { b: Extract<Block, { type: 'posts' }> }) {
    let posts = await getPosts(b.category?.trim() || undefined);
    posts = posts.slice(0, b.count ?? 6);
    if (posts.length === 0) return null;
    return (
        <section style={{ margin: '28px 0' }}>
            <Heading text={b.heading} />
            <div className="row g-4">
                {posts.map((p) => (
                    <div key={p.slug} className="col-12 col-sm-6 col-xl-4"><PostCard post={p} /></div>
                ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 22 }}>
                <Link href={b.category?.trim() ? `/tag/${b.category.trim()}` : '/'} className="block-viewall">View all posts →</Link>
            </div>
        </section>
    );
}

async function DownloadsBlock({ b }: { b: Extract<Block, { type: 'downloads' }> }) {
    let dls = await getDownloads(b.category?.trim() || undefined);
    if (b.featuredOnly) dls = dls.filter(d => d.featured);
    dls = dls.slice(0, b.count ?? 6);
    if (dls.length === 0) return null;
    return (
        <section style={{ margin: '28px 0' }}>
            <Heading text={b.heading} />
            <div className="row g-4">
                {dls.map((d) => (
                    <div key={d.slug} className="col-12 col-sm-6 col-xl-4"><DownloadCard item={d} /></div>
                ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 22 }}>
                <Link href="/downloads" className="block-viewall">View all downloads →</Link>
            </div>
        </section>
    );
}

async function HeroBlock({ b }: { b: Extract<Block, { type: 'hero' }> }) {
    const bg = b.image
        ? `linear-gradient(rgba(10,5,25,0.55), rgba(10,5,25,0.6)), url('${b.image}') center / cover no-repeat`
        : (GRAD[b.gradient ?? ''] ?? DEF);

    // Each stat defaults ON unless explicitly turned off (undefined = show)
    const stats: { num: string; label: string }[] = [];
    if (b.showStats) {
        const [posts, cats] = await Promise.all([getPosts(), getCategories()]);
        const totalViews = posts.reduce((a, p) => a + (p.view_count || 0), 0);
        if (b.statArticles !== false) stats.push({ num: `${posts.length}+`, label: 'Articles' });
        if (b.statCategories !== false) stats.push({ num: `${cats.length}`, label: 'Categories' });
        // Respects the same toggle as the rest of the site, so a hero block
        // cannot put the figure back after Settings has hidden it.
        if (b.statViews !== false && (await getDisplayFlags()).showViews) stats.push({ num: totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}k` : `${totalViews}`, label: 'Total Views' });
    }

    return (
        <div className="blog-hero" style={{ background: bg }}>
            <div className="container-fluid">
                <div className="blog-hero-inner" data-hero-animate>
                    {b.badge && <div className="blog-hero-eyebrow">{b.badge}</div>}
                    {b.heading && <h1 className="blog-hero-title">{b.heading}</h1>}
                    {b.subtext && <p className="blog-hero-sub">{b.subtext}</p>}
                    {stats.length > 0 && (
                        <div className="blog-hero-stats">
                            {stats.map((s, i) => (
                                <div key={i} className="blog-hero-stat">
                                    <span className="blog-hero-stat-num">{s.num}</span>
                                    <span className="blog-hero-stat-label">{s.label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function NewsletterBlock({ b }: { b: Extract<Block, { type: 'newsletter' }> }) {
    return (
        <section style={{ margin: '28px 0' }}>
            <div style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #3730a3 100%)',
                borderRadius: 18, padding: '34px 30px', color: '#fff', textAlign: 'center',
            }}>
                {b.heading && <h3 style={{ fontWeight: 800, fontSize: '1.5rem', margin: '0 0 8px' }}>{b.heading}</h3>}
                {b.subtext && <p style={{ opacity: 0.85, margin: '0 0 18px', fontSize: '.98rem' }}>{b.subtext}</p>}
                {b.buttonLabel && (
                    <div style={{ display: 'inline-block' }}>
                        <SubscribeButton label={b.buttonLabel} style={{
                            display: 'inline-block', background: '#fff', color: '#312e81', fontWeight: 700,
                            padding: '11px 26px', borderRadius: 10, border: 'none', cursor: 'pointer',
                        }} />
                    </div>
                )}
            </div>
        </section>
    );
}

async function FilterBlock() {
    const cats = await getCategories();
    return (
        <div className="blog-filter-wrap">
            <div className="container-fluid">
                <div className="blog-filter-bar">
                    <Link href="/" className="blog-filter-pill active">✨ All</Link>
                    {cats.map(c => (
                        <Link key={c.id} href={`/tag/${c.slug}`} className="blog-filter-pill">
                            {c.emoji} {c.name}<span className="blog-filter-count">{c.post_count}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

async function FeaturedBlock({ b }: { b: Extract<Block, { type: 'featured' }> }) {
    const d = b.downloadSlug?.trim() ? await getDownloadBySlug(b.downloadSlug.trim()) : await getFeaturedDownload();
    if (!d) return null;
    return (
        <div className={dstyles.featuredCard} style={{ margin: '20px 0' }}>
            <div className={dstyles.featuredThumb} style={d.image ? { background: `url('${d.image}') center/cover` } : undefined}>
                {!d.image && <span className={dstyles.featuredThumbIcon}>{d.icon}</span>}
            </div>
            <div className={dstyles.featuredBody}>
                <div className={dstyles.featuredEyebrow}>⭐ Featured Resource</div>
                <h2 className={dstyles.featuredTitle}><Link href={`/downloads/${d.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{d.title}</Link></h2>
                <p className={dstyles.featuredExcerpt}>{d.excerpt}</p>
                <div className={dstyles.featuredFooter}>
                    <Link href={`/downloads/${d.slug}`} className={dstyles.downloadBtn}>Read More
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </Link>
                    <div className={dstyles.featuredMeta}><span>{d.fileType} · {d.fileSize}</span></div>
                </div>
            </div>
        </div>
    );
}

async function SidebarBlock() {
    const [cats, trending] = await Promise.all([getCategories(), getTrendingPosts(4)]);
    return (
        <div className="home-sidebar">
            <CategorySidebar categories={cats} trendingPosts={trending} showAuthor={true} />
        </div>
    );
}

function ContactBlock({ b }: { b: Extract<Block, { type: 'contact' }> }) {
    const methods = b.methods ?? [];
    return (
        <div className={cstyles.infoCard}>
            <h3 className={cstyles.infoCardTitle}>{b.heading || 'Contact Information'}</h3>
            {methods.map((m, i) => (
                <div key={i} className={cstyles.contactMethod}>
                    <div className={`${cstyles.methodIcon} ${METHOD_COLOR[m.color || 'purple'] ?? cstyles.methodIconPurple}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            {METHOD_ICON[m.icon || ''] ?? METHOD_ICON.email}
                        </svg>
                    </div>
                    <div className={cstyles.methodInfo}>
                        <div className={cstyles.methodLabel}>{m.label}</div>
                        {m.href
                            ? <a href={m.href} className={cstyles.methodValue}>{m.value}</a>
                            : <div className={cstyles.methodValue}>{m.value}</div>}
                        {m.note && <div className={cstyles.methodNote}>{m.note}</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

function SocialBlock({ b }: { b: Extract<Block, { type: 'social' }> }) {
    const links = b.links ?? [];
    return (
        <div className={cstyles.socialCard}>
            <div className={cstyles.socialTitle}>{b.heading || 'Follow us'}</div>
            {b.subtext && <p className={cstyles.socialSub}>{b.subtext}</p>}
            <div className={cstyles.socialLinks}>
                {links.map((l, i) => (
                    <a key={i} href={l.url || '#'} target="_blank" rel="noreferrer" className={cstyles.socialLink}>
                        <span style={{ fontSize: 18, width: 22, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>{l.icon || '🔗'}</span>
                        {l.label}
                    </a>
                ))}
            </div>
        </div>
    );
}

function FaqBlock({ b }: { b: Extract<Block, { type: 'faq' }> }) {
    const items = b.items ?? [];
    return (
        <div className={cstyles.faqCard}>
            <div className={cstyles.faqTitle}>{b.heading || 'Quick Answers'}</div>
            {items.map((it, i) => (
                <div key={i} className={cstyles.faqItem}>
                    <div className={cstyles.faqQ}>{it.q}</div>
                    <div className={cstyles.faqA}>{it.a}</div>
                </div>
            ))}
        </div>
    );
}

async function YoutubeBlock({ b }: { b: Extract<Block, { type: 'youtube' }> }) {
    const channels = await getYoutubeChannels();
    if (channels.length === 0) return null;
    return (
        <div className={cstyles.socialCard} style={{ marginBottom: 0 }}>
            <div className={cstyles.socialTitle}>{b.heading || 'Our YouTube Channels'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                {channels.map(ch => (
                    <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Avatar + name → clickable link to the channel (opens in a
                            new tab; right-click / middle-click work like any link). */}
                        <a
                            href={ch.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${ch.title} on YouTube`}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                        >
                            {ch.thumbnail ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                // referrerPolicy="no-referrer": Google's avatar CDN
                                // (yt3.ggpht.com / googleusercontent) returns a broken
                                // image when it sees a referrer from another site.
                                <img src={ch.thumbnail} alt={ch.title} width={44} height={44} referrerPolicy="no-referrer" loading="lazy" style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }} />
                            ) : (
                                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#ff0000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>▶</div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ch.title}</div>
                                {ch.subscribers && <div style={{ fontSize: 12, color: '#6b7280' }}>{ch.subscribers} subscribers</div>}
                            </div>
                        </a>
                        {/* Subscribe → opens YouTube's own subscribe-confirmation popup.
                            This is the ONLY sanctioned way to subscribe someone to a
                            channel; YouTube does not allow a site to subscribe a
                            visitor silently via API (see note to user). */}
                        <a href={ch.subscribeUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, background: '#ff0000', color: '#fff', fontWeight: 700, fontSize: 12, padding: '6px 13px', borderRadius: 999, textDecoration: 'none' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z"/></svg>
                            Subscribe
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Standalone sidebar widgets (each is its own block so the user can place
//    Author / Categories / Trending / Tags / Related independently) ───────────
const RELATED_GRAD = [GRAD.gradientPurple, GRAD.gradientBlue, GRAD.gradientTeal, GRAD.gradientOrange, GRAD.gradientPink, GRAD.gradientIndigo];

async function CategoriesBlock({ b }: { b: Extract<Block, { type: 'categories' }> }) {
    const cats = await getCategories();
    return (
        <div className="sidebar-box">
            <h3 className="sidebar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h7" /></svg>
                {b.heading || 'Categories'}
            </h3>
            <ul className="sidebar-cat-list">
                {cats.map((cat) => (
                    <li key={cat.id}>
                        <Link href={`/tag/${cat.slug}`} className="sidebar-cat-item">
                            <span className="sidebar-cat-left"><span className="sidebar-cat-emoji">{cat.emoji}</span><span className="sidebar-cat-name">{cat.name}</span></span>
                            <span className="sidebar-cat-count">{cat.post_count}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

async function TrendingBlock({ b }: { b: Extract<Block, { type: 'trending' }> }) {
    const posts = await getTrendingPosts(b.count ?? 4);
    if (!posts.length) return null;
    return (
        <div className="sidebar-box">
            <h3 className="sidebar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                {b.heading || 'Trending'}
            </h3>
            <ul className="sidebar-trending-list">
                {posts.map((post, i) => (
                    <li key={post.slug}>
                        <Link href={postHref(post)} className="sidebar-trending-item">
                            <span className="trending-num">{String(i + 1).padStart(2, '0')}</span>
                            <span className="trending-title">{post.title}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** "PHP Tutorial" → "php-tutorial", the format category slugs use. */
function slugifyTag(s: string): string {
    return s.trim().toLowerCase()
        .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

async function TagsBlock({ b, pageTags }: { b: Extract<Block, { type: 'tags' }>; pageTags?: string }) {
    const tags = (pageTags || '')
        .split(',').map((t) => t.trim()).filter(Boolean)
        .map((label) => ({ label, slug: slugifyTag(label) }))
        .filter((t) => t.slug);
    if (!tags.length) return null;
    // /tag/<slug> only serves CATEGORY slugs — anything else 404s. This used to
    // link every tag (URL-encoding the spaces, e.g. /tag/php%20tutorial), so a
    // page with tags shipped a row of dead links. Only real categories link now.
    const linkable = new Set((await getCategories()).map((c) => c.slug.toLowerCase()));
    return (
        <div className="sidebar-box">
            <h3 className="sidebar-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                {b.heading || 'Tags'}
            </h3>
            <div className="sidebar-tags">
                {tags.map((t, i) => (
                    linkable.has(t.slug)
                        ? <Link key={i} href={`/tag/${t.slug}`} className="sidebar-tag">{t.label}</Link>
                        : <span key={i} className="sidebar-tag">{t.label}</span>
                ))}
            </div>
        </div>
    );
}

async function RelatedBlock({ b }: { b: Extract<Block, { type: 'related' }> }) {
    let posts = await getPosts(b.category?.trim() || undefined);
    posts = posts.slice(0, b.count ?? 4);
    if (!posts.length) return null;
    return (
        <div className={postStyles.sideCard}>
            <div className={postStyles.sideTitle}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                {b.heading || 'Related Posts'}
            </div>
            {posts.map((p, i) => (
                <Link key={p.slug} href={postHref(p)} className={postStyles.relatedItem}>
                    <div className={postStyles.relatedThumb} style={{ background: p.thumbnail_url ? `url('${p.thumbnail_url}') center/cover` : RELATED_GRAD[i % RELATED_GRAD.length] }} aria-hidden="true" />
                    <div>
                        <p className={postStyles.relatedTitle}>{p.title}</p>
                        <span className={postStyles.relatedMeta}>
                            {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {' · '}{p.read_min} min read
                        </span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export const SIDEBAR_TYPES = ['sidebar', 'author', 'categories', 'trending', 'tags', 'related', 'contact', 'social', 'faq', 'youtube'];

/**
 * Renders a page's MAIN blocks INLINE, in order, with no home-page wrapper/grid
 * — used inside the tutorial content column so every main block a user adds
 * (text, posts, downloads, newsletter, featured, …) shows up, not just text.
 * Sidebar-type blocks are skipped here (they belong in the right aside — see
 * SidebarBlocks). `textClassName` aligns text blocks with the surrounding
 * typography (e.g. reset the article-body padding on tutorial pages).
 */
export async function InlineBlocks({ blocks, textClassName }: { blocks: Block[]; textClassName?: string }) {
    const render = (b: Block) => {
        switch (b.type) {
            case 'text': return <SafeHtml html={(b as any).html} className={textClassName || postStyles.articleBody} />;
            case 'posts': return <PostsBlock b={b as any} />;
            case 'downloads': return <DownloadsBlock b={b as any} />;
            case 'newsletter': return <NewsletterBlock b={b as any} />;
            case 'featured': return <FeaturedBlock b={b as any} />;
            case 'cards': return <CardsBlock b={b as any} />;
            case 'hero': return <HeroBlock b={b as any} />;
            case 'filter': return <FilterBlock />;
            case 'ad': return <AdUnit code={(b as any).code || ''} />;
            default: return null; // sidebar-type blocks render in the aside
        }
    };
    return <>{blocks.map((b) => <div key={b.id} style={{ marginBottom: 8 }}>{render(b)}</div>)}</>;
}

/** Renders the sidebar-type blocks — for the right aside of a tutorial/CMS
 *  page. Each widget (author, categories, trending, tags, contact, social,
 *  FAQ, YouTube) is independent so the user can order/position them freely.
 *  `pageTags` feeds the Tags widget the page's own tags.
 *  `className` overrides the default `.sidebar` wrapper (the Contact page
 *  passes its own module class so the column keeps its 16px gap/sticky). */
export async function SidebarBlocks({ blocks, pageTags, className }: { blocks: Block[]; pageTags?: string; className?: string }) {
    const render = (b: Block) => {
        switch (b.type) {
            case 'sidebar': return <SidebarBlock />;
            case 'author': return <AuthorCard />;
            case 'categories': return <CategoriesBlock b={b as any} />;
            case 'trending': return <TrendingBlock b={b as any} />;
            case 'tags': return <TagsBlock b={b as any} pageTags={pageTags} />;
            case 'related': return <RelatedBlock b={b as any} />;
            case 'contact': return <ContactBlock b={b as any} />;
            case 'social': return <SocialBlock b={b as any} />;
            case 'faq': return <FaqBlock b={b as any} />;
            case 'youtube': return <YoutubeBlock b={b as any} />;
            default: return null;
        }
    };
    // `.sidebar` (global) provides the 24px column gap + card styling context.
    return <div className={className || 'sidebar'}>{blocks.map((b) => <div key={b.id}>{render(b)}</div>)}</div>;
}

/** Full-width blocks (hero / newsletter flagged fullWidth) rendered edge-to-edge
 *  below the content — e.g. a Subscribe strip after the comments. */
export async function FullWidthBlocks({ blocks }: { blocks: Block[] }) {
    const render = (b: Block) => {
        switch (b.type) {
            case 'newsletter': return <NewsletterBlock b={b as any} />;
            case 'hero': return <HeroBlock b={b as any} />;
            default: return null;
        }
    };
    return <div className="container-fluid" style={{ padding: '0 22px 40px' }}>{blocks.map((b) => <div key={b.id}>{render(b)}</div>)}</div>;
}

function CardsBlock({ b }: { b: Extract<Block, { type: 'cards' }> }) {
    const items = (b.items ?? []).filter((c) => (c.title || '').trim());
    if (!items.length) return null;
    // "Cards per page" from the editor. 0 / unset = show them all (old behaviour).
    const perPage = Math.max(0, Math.floor(Number(b.perPage) || 0));
    const paginate = perPage > 0 && items.length > perPage;

    const cards = items.map((c, i) => (
        <article key={i} className="post-card">
                        <div className={`post-thumb ${c.image ? '' : (c.gradient || 'thumb-tech')}`}>
                            {c.image
                                /* eslint-disable-next-line @next/next/no-img-element */
                                ? <img src={c.image} alt={c.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                : null}
                            {(c.badge || '').trim() ? <span className="post-badge">{c.badge}</span> : null}
                        </div>
                        <div className="post-body">
                            <h2 className="post-title"><Link href={c.href || '#'} style={{ color: 'inherit', textDecoration: 'none' }}>{c.title}</Link></h2>
                            {c.description ? <p className="post-excerpt">{c.description}</p> : null}
                            <Link href={c.href || '#'} className="post-link">{(c.cta || '').trim() || 'Read More →'}</Link>
                        </div>
        </article>
    ));

    return (
        <section className="tut-cards-section">
            {b.heading ? <h2 className="tut-cards-heading">{b.heading}</h2> : null}
            {paginate
                ? <CardsPager perPage={perPage}>{cards}</CardsPager>
                : <div className="tut-cards">{cards}</div>}
        </section>
    );
}

export default async function BlockRenderer({ blocks }: { blocks: Block[] }) {
    const heroes = blocks.filter(b => b.type === 'hero');
    const filters = blocks.filter(b => b.type === 'filter');
    const sidebars = blocks.filter(b => SIDEBAR_TYPES.includes(b.type));
    const mains = blocks.filter(b => !['hero', 'filter', ...SIDEBAR_TYPES].includes(b.type));
    const hasSidebar = sidebars.length > 0;

    const renderInner = (b: Block) => {
        switch (b.type) {
            case 'text': return <SafeHtml html={(b as any).html} className={postStyles.articleBody} />;
            case 'posts': return <PostsBlock b={b as any} />;
            case 'downloads': return <DownloadsBlock b={b as any} />;
            case 'newsletter': return <NewsletterBlock b={b as any} />;
            case 'featured': return <FeaturedBlock b={b as any} />;
            case 'cards': return <CardsBlock b={b as any} />;
            default: return null;
        }
    };

    const renderSidebar = (b: Block) => {
        switch (b.type) {
            case 'sidebar': return <SidebarBlock />;
            case 'author': return <AuthorCard />;
            case 'categories': return <CategoriesBlock b={b as any} />;
            case 'trending': return <TrendingBlock b={b as any} />;
            case 'tags': return <TagsBlock b={b as any} />;
            case 'related': return <RelatedBlock b={b as any} />;
            case 'contact': return <ContactBlock b={b as any} />;
            case 'social': return <SocialBlock b={b as any} />;
            case 'faq': return <FaqBlock b={b as any} />;
            case 'youtube': return <YoutubeBlock b={b as any} />;
            default: return null;
        }
    };

    return (
        <div className="blog-home-page">
            {/* Hero(es) + filter bar(s) — full-width, above the content grid */}
            {heroes.map(b => <HeroBlock key={b.id} b={b as any} />)}
            {filters.map(b => <FilterBlock key={b.id} />)}

            <div className="posts-section" style={{ marginTop: 0 }}>
                <div className="container-fluid" style={{ paddingTop: 32, paddingBottom: 32 }}>
                    <div className="row g-4">
                        <div className={hasSidebar ? 'col-12 col-lg-9' : 'col-12'}>
                            {mains.map(b => <div key={b.id} style={{ marginBottom: 8 }}>{renderInner(b)}</div>)}
                        </div>
                        {hasSidebar && (
                            <div className="col-12 col-lg-3 mt-4 mt-lg-0">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {sidebars.map(b => <div key={b.id}>{renderSidebar(b)}</div>)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
