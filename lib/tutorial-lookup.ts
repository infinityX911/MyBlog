// lib/tutorial-lookup.ts
// Server-only: given a lesson href (e.g. "/posts/react-intro" or "/some-page"),
// find the published tutorial page whose sidebar lists it as a lesson, and
// return that tutorial's navigation context (sections + prev/next lesson).
// This lets a post/page that is *reached from a tutorial* render WITH the
// tutorial's left sidebar — no matter how the user arrives at the URL — while
// pages that belong to no tutorial render normally.
import { prisma } from '@/lib/prisma';
import { parseSidebar, type SidebarSection } from '@/lib/page-sidebar';

export interface TutorialLink { label: string; href: string }

// ── Legacy /posts/<slug> → canonical /<category>/<slug> rewrite ──────────────
// Tutorial sidebars saved before the category-siloing migration store lesson
// links as "/posts/<slug>". Those still work (308 redirect), but hovering shows
// the old URL and the active-lesson highlight can miss. We rewrite them to the
// canonical URL at render time — no data migration needed.
const POSTS_RE = /^\/posts\/([^/?#]+)$/;

async function postCanonicalMap(slugs: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!slugs.length) return map;
    try {
        const posts = await prisma.post.findMany({
            where: { slug: { in: slugs } },
            select: {
                slug: true,
                primaryCategory: { select: { slug: true } },
                categories: { select: { category: { select: { slug: true } } } },
            },
        });
        for (const p of posts as any[]) {
            const cat = p.primaryCategory?.slug || p.categories?.[0]?.category?.slug || 'uncategorized';
            map.set(p.slug, `/${cat}/${p.slug}`);
        }
    } catch { /* keep legacy hrefs on error */ }
    return map;
}

function rewriteHref(href: string, map: Map<string, string>): string {
    const m = POSTS_RE.exec(href || '');
    return m && map.has(m[1]) ? map.get(m[1])! : href;
}

/** Rewrite any legacy /posts/<slug> lesson links in a sidebar to canonical URLs. */
export async function canonicalizeSidebar(sections: SidebarSection[]): Promise<SidebarSection[]> {
    const slugs = new Set<string>();
    for (const sec of sections) for (const it of sec.items) {
        const m = POSTS_RE.exec(it.href || ''); if (m) slugs.add(m[1]);
    }
    if (!slugs.size) return sections;
    const map = await postCanonicalMap([...slugs]);
    return sections.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, href: rewriteHref(it.href, map) })) }));
}

export interface TutorialContext {
    title: string;
    href: string;              // the tutorial's own landing page (/slug)
    sections: SidebarSection[];
    prev: TutorialLink | null;
    next: TutorialLink | null;
    parentLabel: string | null; // navbar parent (e.g. "Tutorials") for breadcrumb
    parentHref: string | null;
}

/**
 * Breadcrumb root from the navbar: if `href` is a navbar item nested under a
 * dropdown (e.g. "Java Tutorial" under "Tutorials"), return that parent's
 * label + link. This mirrors CodeWithHarry's "Tutorials › Java Tutorial" crumb
 * automatically — no extra config. Returns null when the page isn't a navbar
 * sub-item.
 */
export async function getNavbarParent(href: string): Promise<{ label: string; href: string } | null> {
    if (!href) return null;
    try {
        const item = await prisma.navItem.findFirst({
            where: { siteKey: 'blog', url: href },
            select: { parentId: true },
        });
        if (!item?.parentId) return null;
        const parent = await prisma.navItem.findUnique({
            where: { id: item.parentId },
            select: { label: true, url: true },
        });
        if (!parent) return null;
        return { label: parent.label, href: parent.url && parent.url !== '#' ? parent.url : '' };
    } catch {
        return null;
    }
}

export async function getTutorialContext(href: string): Promise<TutorialContext | null> {
    if (!href) return null;

    // Exact-quoted match so "/posts/react" never matches "/posts/react-hooks".
    // sidebar JSON is produced by JSON.stringify → `"href":"/posts/react"`.
    let owner: { title: string; slug: string; sidebar: string | null } | null = null;
    try {
        owner = (await prisma.cmsPage.findFirst({
            where: {
                siteKey: 'blog',
                status: 'published',
                sidebar: { contains: `"href":"${href}"` },
            },
            select: { title: true, slug: true, sidebar: true },
        } as any)) as any;
    } catch {
        return null; // column missing / DB hiccup → behave like a normal page
    }
    if (!owner) return null;

    const rawSections = parseSidebar(owner.sidebar);
    if (!rawSections.length) return null;

    // Rewrite legacy /posts/<slug> lesson links to canonical URLs (also covers
    // the incoming href, so prev/next + active-lesson matching stay correct).
    const slugs = new Set<string>();
    for (const sec of rawSections) for (const it of sec.items) {
        const m = POSTS_RE.exec(it.href || ''); if (m) slugs.add(m[1]);
    }
    { const m = POSTS_RE.exec(href); if (m) slugs.add(m[1]); }
    const map = await postCanonicalMap([...slugs]);
    const sections = rawSections.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it, href: rewriteHref(it.href, map) })) }));
    const selfHref = rewriteHref(href, map);

    // Flatten to an ordered lesson list for prev/next navigation.
    const flat: TutorialLink[] = sections.flatMap((s) => s.items);
    const idx = flat.findIndex((it) => it.href === selfHref);
    const prev = idx > 0 ? flat[idx - 1] : null;
    const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

    const parent = await getNavbarParent(`/${owner.slug}`);

    return {
        title: owner.title,
        href: `/${owner.slug}`,
        sections, prev, next,
        parentLabel: parent?.label ?? null,
        parentHref: parent?.href ?? null,
    };
}

/**
 * All post/page SLUGS used as lessons inside any PUBLISHED tutorial's sidebar.
 * Used to hide tutorial lessons from the blog home/feed — they live INSIDE the
 * tutorial (like CodeWithHarry), not as standalone posts. Matched by slug (last
 * path segment) so it stays correct even if a post's category (URL) changes.
 */
export async function getTutorialLessonSlugs(): Promise<Set<string>> {
    const slugs = new Set<string>();
    try {
        const pages = (await prisma.cmsPage.findMany({
            where: { siteKey: 'blog', status: 'published' },
            select: { sidebar: true },
        } as any)) as any[];
        for (const p of pages) {
            for (const sec of parseSidebar(p.sidebar)) {
                for (const it of sec.items) {
                    const m = (it.href || '').match(/\/([^/?#]+)\/?$/);
                    if (m) slugs.add(m[1]);
                }
            }
        }
    } catch { /* no tutorials / DB hiccup → empty set → nothing hidden */ }
    return slugs;
}
