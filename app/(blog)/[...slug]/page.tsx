// app/(blog)/[...slug]/page.tsx
// Root catch-all for blog CMS / block pages (landing pages, About, etc. created
// in Admin → Blog → Pages). Static routes (/posts, /tag, /downloads…) win over
// this. Block pages render FULL-WIDTH (like a landing page) with comments below.
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SafeHtml from '@/components/SafeHtml';
import CommentSection from '@/components/CommentSection';
import BlockRenderer, { InlineBlocks, SidebarBlocks, FullWidthBlocks, SIDEBAR_TYPES } from '@/components/blocks/BlockRenderer';
import TutorialShell from '@/components/TutorialShell';
import PostInteractions from '@/components/PostInteractions';
import CodeCopyButtons from '@/components/CodeCopyButtons';
import ImageLightbox from '@/components/ImageLightbox';
import CategorySidebar from '@/components/CategorySidebar';
import ReadingProgressBar from '@/components/ReadingProgressBar';
import TutorialPager from '@/components/TutorialPager';
import { getTutorialContext, getNavbarParent, canonicalizeSidebar } from '@/lib/tutorial-lookup';
import { getCategories, getPosts, getPostBySlug, buildPostMetadata } from '@/lib/blog';
import PostView from '@/components/PostView';
import { parseBlocks } from '@/lib/page-blocks';
import { parseSidebar } from '@/lib/page-sidebar';
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings';
import { cleanTitle } from '@/lib/seo/title';
import { robotsMeta } from '@/lib/seo/robots';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import DraftPreviewBanner from '@/components/DraftPreviewBanner';
import styles from '@/components/PostDetail.module.css';
import shell from '@/components/TutorialLayout.module.css';

const DEFAULT_HERO = 'linear-gradient(135deg, #1a0533 0%, #0d2b6b 55%, #0a4d68 100%)';

// Same gradient keys the post editor offers (FeaturedVisual) so tutorial pages
// can pick from the same palette.
const HERO_GRADIENTS: Record<string, string> = {
    gradientPurple: 'linear-gradient(135deg,#1a0533,#0d2b6b)',
    gradientGreen:  'linear-gradient(135deg,#064e3b,#065f46)',
    gradientBlue:   'linear-gradient(135deg,#0c4a6e,#0369a1)',
    gradientOrange: 'linear-gradient(135deg,#431407,#9a3412)',
    gradientPink:   'linear-gradient(135deg,#4a044e,#86198f)',
    gradientIndigo: 'linear-gradient(135deg,#1e1b4b,#312e81)',
    gradientTeal:   'linear-gradient(135deg,#042f2e,#0f766e)',
    gradientRose:   'linear-gradient(135deg,#4c0519,#9f1239)',
};

/** heroBg = image URL → cover image (darkened); gradient key → gradient; else default. */
function resolveHeroBg(heroBg: string | null | undefined): string {
    if (!heroBg) return DEFAULT_HERO;
    if (/^https?:\/\//.test(heroBg) || heroBg.startsWith('/')) {
        return `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)), url('${heroBg}') center / cover no-repeat`;
    }
    return HERO_GRADIENTS[heroBg] ?? DEFAULT_HERO;
}

export const revalidate = 300;
const SITE_KEY = 'blog';

/** Absolute URL for a stored href that may already be absolute. */
function abs(base: string, href: string): string {
    return /^https?:\/\//i.test(href) ? href : `${base}${href.startsWith('/') ? '' : '/'}${href}`;
}

/**
 * Structured data for a CMS page. Blog POSTS emit BlogPosting + BreadcrumbList
 * (see PostView), but custom pages / tutorial hubs emitted NOTHING — so Google
 * saw /phptutorials as an untyped page with no breadcrumb trail and no signal
 * that it's a lesson index. This adds:
 *   • WebPage (or the SEO panel's schemaType) with the page's own image/dates,
 *   • BreadcrumbList — Home › <navbar parent, if any> › this page,
 *   • ItemList of the tutorial's lessons, when the page has a sidebar.
 * A custom JSON blob saved in the SEO panel still merges in last and wins.
 */
function buildCmsPageJsonLd(opts: {
    base: string;
    url: string;
    siteName: string;
    title: string;
    description?: string;
    image?: string;
    datePublished?: string;
    dateModified?: string;
    schemaType?: string | null;
    authorName?: string;
    logo?: string;
    extra?: Record<string, unknown>;
    parent?: { label?: string | null; href?: string | null } | null;
    lessons?: { label: string; href: string }[];
}) {
    const { base, url, siteName, title, parent } = opts;
    const crumbs: Record<string, unknown>[] = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: base },
    ];
    if (parent?.label && parent?.href) {
        crumbs.push({ '@type': 'ListItem', position: 2, name: parent.label, item: abs(base, parent.href) });
    }
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: title, item: url });

    const graph: Record<string, unknown>[] = [
        {
            '@type': opts.schemaType || 'WebPage',
            '@id': `${url}#page`,
            name: title,
            headline: title,
            url,
            ...(opts.description ? { description: opts.description } : {}),
            ...(opts.image ? { image: [opts.image] } : {}),
            ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
            ...(opts.dateModified ? { dateModified: opts.dateModified } : {}),
            mainEntityOfPage: { '@type': 'WebPage', '@id': url },
            isPartOf: { '@type': 'WebSite', '@id': `${base}/#website`, name: siteName, url: base },
            // `author` is REQUIRED by Google whenever the admin picks an
            // Article/BlogPosting schemaType (the SEO panel allows it) — without
            // it the Rich Results test flags the page. Harmless on a WebPage.
            author: { '@type': 'Person', name: opts.authorName || siteName, url: `${base}/#about` },
            publisher: {
                '@type': 'Organization',
                name: siteName,
                url: base,
                ...(opts.logo ? { logo: { '@type': 'ImageObject', url: opts.logo } } : {}),
            },
            ...(opts.extra ?? {}),
        },
        { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs },
    ];

    const lessons = opts.lessons ?? [];
    if (lessons.length > 0) {
        graph.push({
            '@type': 'ItemList',
            '@id': `${url}#lessons`,
            name: `${title} — lessons`,
            numberOfItems: lessons.length,
            itemListOrder: 'https://schema.org/ItemListOrderAscending',
            itemListElement: lessons.map((l, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: l.label,
                url: abs(base, l.href),
            })),
        });
    }

    return { '@context': 'https://schema.org', '@graph': graph };
}

/** The parts of the JSON-LD input that come straight off the page row + its
 *  SEO panel — shared by both layouts so the two call sites can't drift. */
async function pageSchemaInput(page: { slug: string; title: string; publishedAt: Date | null; updatedAt: Date | null; seo: { metaDescription: string | null; ogImage: string | null; schemaType: string | null; schemaJson: string | null } | null }) {
    const settings = await getSiteSetting(SITE_KEY);
    const base = await siteBaseUrl();
    const seo = page.seo;
    const heroBg = ((page as any).heroBg as string | null | undefined) ?? '';
    let extra: Record<string, unknown> = {};
    try { if (seo?.schemaJson) extra = JSON.parse(seo.schemaJson); } catch { extra = {}; }
    return {
        base,
        url: `${base}/${page.slug}`,
        siteName: settings?.siteName || 'Flow’s Blog',
        title: page.title,
        description: seo?.metaDescription || undefined,
        image: seo?.ogImage || (/^(https?:\/\/|\/)/.test(heroBg) ? abs(base, heroBg) : undefined),
        datePublished: page.publishedAt?.toISOString(),
        dateModified: (page.updatedAt ?? page.publishedAt)?.toISOString(),
        schemaType: seo?.schemaType,
        authorName: settings?.authorName || undefined,
        logo: settings?.ogImage || `${base}/og-image.png`,
        extra,
    };
}

/** Public base URL: Admin → Settings website URL → env → safe fallback. */
async function siteBaseUrl(): Promise<string> {
    const s = await getSiteSetting(SITE_KEY);
    return normalizeUrl(s?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL);
}

interface Props {
    params: Promise<{ slug: string[] }>;
    searchParams?: Promise<{ preview?: string }>;
}

/** True when the request is ?preview=1 AND made by an admin (can access panel).
 *  Lets drafts render for content editors without exposing them to the public. */
async function canPreviewDrafts(searchParams?: Props['searchParams']): Promise<boolean> {
    const sp = searchParams ? await searchParams : undefined;
    if (sp?.preview !== '1') return false;
    const session = await getServerSession(authOptions);
    const perms = ((session?.user as any)?.permissions ?? []) as string[];
    return perms.includes('access-admin-panel');
}

/**
 * Follows an admin-managed redirect for `path`, if one exists.
 *
 * Returns normally when there is no match, so the caller can carry on to
 * notFound(). When there IS a match it never returns — permanentRedirect throws
 * a navigation signal — which is why it must not be called inside a try/catch.
 */
async function followRedirect(path: string): Promise<void> {
    let to: string | null = null;
    let id: number | null = null;
    try {
        const row = await prisma.redirect.findUnique({ where: { fromPath: path } });
        if (row) { to = row.toPath; id = row.id; }
    } catch { /* table unavailable — fall through to the 404 */ }

    if (!to) return;
    // Fire-and-forget: a failed counter must never cost the visitor a redirect.
    if (id !== null) {
        prisma.redirect.update({ where: { id }, data: { hits: { increment: 1 } } }).catch(() => {});
    }
    permanentRedirect(to);
}

async function getPage(slug: string[]) {
    return prisma.cmsPage.findUnique({
        where: { siteKey_slug: { siteKey: SITE_KEY, slug: slug.join('/') } },
        include: { seo: true },
    });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const page = await getPage(slug);
    // Not a CMS page → a category-siloed post lives at /<category>/<slug>.
    if (!page || page.status !== 'published') {
        if (slug.length === 2) {
            const post = await getPostBySlug(slug[1]);
            if (post) return buildPostMetadata(slug[1]);
        }
        return {};
    }
    const seo = page.seo;
    const path = `/${page.slug}`;
    const settings = await getSiteSetting(SITE_KEY);
    const base = await siteBaseUrl();
    const siteName = settings?.siteName;

    // The layout already appends "%s | <siteName>". Editors often type the brand
    // into the SEO panel too, which produced "… | Flow's Blog | Flow's Blog" on
    // every hub page — cleanTitle() removes the editor's copy so exactly one
    // suffix survives. Titles without a suffix are returned unchanged.
    const title = cleanTitle(seo?.metaTitle || page.title, siteName);
    const description = seo?.metaDescription || undefined;
    // Social image: the SEO panel's OG image wins, else the page's own hero
    // cover (heroBg holds either an image URL or a gradient KEY — only a URL is
    // usable as an image), else nothing, so the layout's site-wide OG image is
    // the last resort rather than the first.
    // (`as any` for the same reason as `sidebar`/`tags` below — the generated
    // Prisma client types can lag behind the schema until `prisma generate`.)
    const heroBg = ((page as any).heroBg as string | null | undefined) ?? '';
    const heroImage = /^(https?:\/\/|\/)/.test(heroBg) ? heroBg : undefined;
    const ogImage = seo?.ogImage || heroImage;

    return {
        title,
        description,
        robots: robotsMeta(seo?.robotsIndex ?? true, seo?.robotsFollow ?? true),
        alternates: { canonical: seo?.canonicalUrl || `${base}${path}` },
        openGraph: {
            title: cleanTitle(seo?.ogTitle || seo?.metaTitle || page.title, siteName),
            description: seo?.ogDescription || description,
            // A hub or landing page is not an article. Facebook and LinkedIn use
            // og:type to decide whether to show a byline and publish date; on a
            // contents page there is neither, so 'website' is the honest value.
            url: `${base}${path}`, type: 'website',
            ...(siteName ? { siteName } : {}),
            ...(ogImage ? { images: [{ url: ogImage }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: cleanTitle(seo?.twitterTitle || seo?.ogTitle || seo?.metaTitle || page.title, siteName),
            description: seo?.twitterDescription || seo?.ogDescription || description,
            ...(ogImage ? { images: [ogImage] } : {}),
        },
    };
}

export default async function BlogCmsPage({ params, searchParams }: Props) {
    const { slug } = await params;
    const preview = await canPreviewDrafts(searchParams);
    const page = await getPage(slug);
    // Dispatch: a published CMS page at this exact path wins. Otherwise, a
    // two-segment path may be a category-siloed blog post: /<category>/<slug>.
    // (CMS pages are checked first so nested pages like /tuto/lesson keep working
    // even if a post happens to share the last segment.)
    // In preview mode (admin + ?preview=1) draft pages/posts render too.
    if (!page || (page.status !== 'published' && !preview)) {
        if (slug.length === 2) {
            const post = await getPostBySlug(slug[1], { includeUnpublished: preview });
            if (post) return (
                <>
                    {preview && <DraftPreviewBanner status="draft" />}
                    <PostView post={post} urlCategory={slug[0]} />
                </>
            );
        }
        // Last chance before a 404: an admin-managed redirect. The `redirects`
        // table already existed but only /posts/<slug> ever consulted it, so a
        // row for any other path silently did nothing. /tutorials was a live
        // example — it still receives real visitors and returned a 404.
        // Reading it here means one row now fixes ANY renamed or removed path.
        //
        // The lookup only runs on a request that was already going to 404, so
        // it costs nothing on normal traffic.
        await followRedirect(`/${slug.join('/')}`);
        notFound();
    }
    const showPageDraftBanner = preview && page.status !== 'published';

    const blocks = parseBlocks(page.blocks);
    // `as any` bridges the gap until `prisma generate` adds the sidebar column
    // to the client types (harmless at runtime; parseSidebar handles undefined).
    const ownSidebar = await canonicalizeSidebar(parseSidebar((page as any).sidebar));

    // Two ways a page renders inside the tutorial layout:
    //   1. It IS a tutorial (has its own sidebar sections)          → landing.
    //   2. It's a LESSON listed in some published tutorial's sidebar → nested.
    // (1) wins; only look up (2) when the page has no sidebar of its own.
    const tut = ownSidebar.length > 0 ? null : await getTutorialContext(`/${page.slug}`);

    // ── Tutorial layout (landing OR nested lesson) ───────────────────────────
    if (ownSidebar.length > 0 || tut) {
        const isLanding  = ownSidebar.length > 0;
        const sections   = isLanding ? ownSidebar : tut!.sections;
        const shellTitle = isLanding ? page.title : tut!.title;   // left sidebar heading
        const homeHref   = isLanding ? undefined  : tut!.href;    // lesson links back to tutorial
        const parent     = isLanding
            ? await getNavbarParent(`/${page.slug}`)
            : { label: tut!.parentLabel, href: tut!.parentHref };
        const prev = tut?.prev ?? null;
        const next = tut?.next ?? null;

        // Split blocks: main blocks fill the content column; sidebar-type blocks
        // (author/categories/trending, contact, social, FAQ, YouTube) fill the
        // right aside — so the sidebar is DYNAMIC (built from the blocks the user
        // adds), not hardcoded. No sidebar blocks → sensible default.
        const sideBlocks = blocks.filter((b) => SIDEBAR_TYPES.includes(b.type));
        const fullBlocks = blocks.filter((b) => !SIDEBAR_TYPES.includes(b.type) && (b as any).fullWidth);
        const mainBlocks = blocks.filter((b) => !SIDEBAR_TYPES.includes(b.type) && !(b as any).fullWidth);
        const bodyClass = `${styles.articleBody} ${shell.bodyReset}`;
        const hasContent = mainBlocks.length > 0 || !!(page.content || '').trim();
        const tags = ((page as any).tags as string | null) ?? '';
        // This shell renders no hero card, so nothing outside the body supplies
        // an H1. Lesson pages usually open with one of their own; hub pages start
        // with a paragraph, so /phptutorials was shipping a page with ZERO h1
        // elements — bad for screen readers and for search. Only add ours when
        // the body doesn't already bring one, so pages never end up with two.
        const bodyHasH1 = /<h1[\s>]/i.test(page.content || '');

        // Right sidebar (same author + categories + trending as blog posts).
        const [categories, allPosts] = await Promise.all([getCategories(), getPosts()]);
        const trendingPosts = allPosts.slice(0, 4);

        const jsonLd = buildCmsPageJsonLd({
            ...(await pageSchemaInput(page)),
            parent,
            // Only the hub itself lists the lessons; a nested lesson page doesn't.
            lessons: isLanding ? sections.flatMap((s) => s.items ?? []) : [],
        });

        return (
            <>
                {showPageDraftBanner && <DraftPreviewBanner status={page.status} />}
                <Navbar />
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <CodeCopyButtons />
                <ImageLightbox />
                <PostInteractions tags={tags} title={page.title} slug={page.slug} renderOnly="progressBar" />

                <TutorialShell
                    title={shellTitle}
                    sections={sections}
                    homeHref={homeHref}
                    parentLabel={parent?.label ?? undefined}
                    parentHref={parent?.href ?? undefined}
                >
                    {/* No banner, no floating card — CodeWithHarry-style: content is
                        flush-left after the sidebar, wide, with the lesson title as
                        the H1. Layout/width live in TutorialLayout.module.css. */}
                    <div className={shell.content}>
                        <div className={`${styles.grid} ${shell.tgrid}`}>
                            <main>
                                {!bodyHasH1 && <h1 className={shell.lessonTitle}>{page.title}</h1>}
                                {mainBlocks.length > 0 ? (
                                    <InlineBlocks blocks={mainBlocks} textClassName={bodyClass} />
                                ) : (page.content ? (
                                    <SafeHtml html={page.content} className={bodyClass} />
                                ) : null)}
                                {/* Lesson navigation goes straight under the lesson
                                    text and ABOVE the tags/share row — a reader who
                                    just finished the lesson looks here next. The hub
                                    page itself is a contents list, so it gets none. */}
                                {!isLanding && <TutorialPager prev={prev} next={next} />}
                                {hasContent && (
                                    <div className={styles.articleFooter}>
                                        <hr className={styles.footerDivider} />
                                        <PostInteractions tags={tags} title={page.title} slug={page.slug} renderOnly="footer" linkableTags={categories.map(c => c.slug)} />
                                    </div>
                                )}
                                <CommentSection cmsPageId={page.id} />
                            </main>

                            <aside className={styles.sidebar}>
                                {sideBlocks.length > 0
                                    ? <SidebarBlocks blocks={sideBlocks} pageTags={tags} />
                                    : <CategorySidebar categories={categories} trendingPosts={trendingPosts} showAuthor />}
                            </aside>
                        </div>

                        {/* Full-width blocks (e.g. a Subscribe strip) — edge-to-edge,
                            below the grid + comments, with a little breathing room. */}
                        {fullBlocks.length > 0 && (
                            <div style={{ marginTop: 32 }}>
                                <FullWidthBlocks blocks={fullBlocks} />
                            </div>
                        )}
                    </div>
                </TutorialShell>

                <Footer />
                <PostInteractions tags={tags} title={page.title} slug={page.slug} renderOnly="backToTop" />
            </>
        );
    }

    // Per-page layout choice (non-tutorial pages): "boxed" = blog-post look;
    // "wide" (default) = full-width blocks / readable column.
    const pageLayout = (page as any).layout === 'boxed' ? 'boxed' : 'wide';
    const hasAnything = blocks.length > 0 || !!(page.content || '').trim();

    const jsonLd = buildCmsPageJsonLd({
        ...(await pageSchemaInput(page)),
        parent: await getNavbarParent(`/${page.slug}`),
    });

    return (
        <>
            {showPageDraftBanner && <DraftPreviewBanner status={page.status} />}
            <Navbar />
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            {/* Non-tutorial CMS pages can hold code blocks too — this branch was
                missing the copy buttons that the tutorial layout already had. */}
            <CodeCopyButtons />
            <ImageLightbox />
            <ReadingProgressBar />

            {/* The navbar is `position: fixed`, so it occupies no space and every
                layout below has to leave room for it — `calc(var(--nav-h) + …)`.
                Without that the page starts at y=0 and its first lines render
                BEHIND the bar. /privacy-policy had exactly this: 28px of padding
                against a 58px bar, so the opening paragraph was half-hidden, and
                worse on a phone where 30px costs more lines.
                The block layout is exempt: its first block is a hero that brings
                its own top margin. */}
            {!hasAnything ? (
                // Nothing added yet — don't render an empty titled card.
                <main style={{ minHeight: 40 }} />
            ) : pageLayout === 'boxed' ? (
                // Boxed: blog-post style — centered white article card.
                <main style={{ maxWidth: 860, margin: '0 auto', padding: 'calc(var(--nav-h) + 28px) 20px 40px' }}>
                    <article className={styles.article}>
                        {blocks.length > 0 ? (
                            <InlineBlocks blocks={blocks.filter((b) => !SIDEBAR_TYPES.includes(b.type))} textClassName={styles.articleBody} />
                        ) : (
                            <SafeHtml html={page.content} className={styles.articleBody} />
                        )}
                    </article>
                </main>
            ) : blocks.length > 0 ? (
                // Wide + blocks: full-width landing layout (hero, grids, sidebar…).
                <main style={{ paddingBottom: 40 }}>
                    <BlockRenderer blocks={blocks} />
                </main>
            ) : (
                // Wide + only text: a comfortable readable column (no card).
                <main style={{ maxWidth: 900, margin: '0 auto', padding: 'calc(var(--nav-h) + 28px) 20px 40px' }}>
                    <SafeHtml html={page.content} className={styles.articleBody} />
                </main>
            )}

            {/* Tags + Share. The tutorial layout has had this footer all along,
                but non-tutorial CMS pages (/web-development-tutorials and any
                other "wide" page) had no way to share the page and never showed
                their tags. Same component, same markup, so it looks identical. */}
            {hasAnything && (
                <div className="container-fluid" style={{ paddingTop: 8 }}>
                    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                        <div className={styles.articleFooter}>
                            <hr className={styles.footerDivider} />
                            <PostInteractions
                                tags={((page as any).tags as string | null) ?? ''}
                                title={page.title}
                                slug={page.slug}
                                renderOnly="footer"
                                linkableTags={(await getCategories()).map((c) => c.slug)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Comments — comfortable centered width (not edge-to-edge) */}
            <div className="container-fluid" style={{ paddingBottom: 56 }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                    <CommentSection cmsPageId={page.id} />
                </div>
            </div>

            <Footer />
        </>
    );
}
