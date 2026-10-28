/**
 * app/sitemap.xml/route.ts — sitemap for the BLOG site (default site, root).
 * Replaces app/sitemap.ts (metadata convention can't vary per domain).
 *
 * Emits nothing while the blog is non-indexable or its sitemap toggle is off
 * (Admin → Settings), so Google gets a consistent story with robots.txt.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSiteByKey, siteOrigin } from '@/lib/site-context';

const SITE_KEY = 'blog';

export const dynamic = 'force-dynamic';

interface Entry {
    loc: string;
    lastmod?: Date;
    changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    priority?: number;
}

const xml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * The hand-built pages. This list — NOT the pageSeo table — decides which
 * static URLs exist. A pageSeo row is just SEO settings attached to a path; a
 * stale row for a route that was never built (there was one for "/posts", which
 * only exists as /posts/[slug]) used to be emitted as a real sitemap URL, so
 * Google was handed a 404. A path can only appear here if the route exists.
 *
 * /members is deliberately absent — a thin member directory isn't worth
 * indexing (see app/(blog)/members/layout.tsx).
 *
 * `requires` names a SiteSetting feature flag the route depends on. Turning a
 * feature off in Admin → Settings used to gate only its data API: the page kept
 * returning 200 with "Announcements aren't available right now", kept saying
 * index,follow, and kept being submitted here — so the site was actively asking
 * Google to index an empty page. A disabled feature now drops out of the
 * sitemap with it.
 */
const STATIC_ROUTES: {
    path: string;
    changefreq: Entry['changefreq'];
    priority: number;
    requires?: 'announcementsEnabled';
}[] = [
    { path: '/', changefreq: 'daily', priority: 1.0 },
    { path: '/downloads', changefreq: 'weekly', priority: 0.7 },
    { path: '/announcements', changefreq: 'weekly', priority: 0.5, requires: 'announcementsEnabled' },
    { path: '/contact', changefreq: 'yearly', priority: 0.4 },
];

const EMPTY =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>';

function render(entries: Entry[]) {
    const seen = new Set<string>();
    const body = entries
        .filter((e) => !seen.has(e.loc) && seen.add(e.loc))
        .map((e) => [
            '  <url>',
            `    <loc>${xml(e.loc)}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod.toISOString()}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : null,
            '  </url>',
        ].filter(Boolean).join('\n'))
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`;
}

export async function GET() {
    const site = await getSiteByKey(SITE_KEY);

    // Blog hidden (not indexable / sitemap off / unseeded) → valid empty doc.
    if (!site || !site.defaultRobotsIndex || !site.sitemapEnabled) {
        return new NextResponse(EMPTY, {
            headers: { 'Content-Type': 'application/xml' },
        });
    }

    const origin = siteOrigin(site);
    const now = new Date();
    // Seeded outside the try so a DB hiccup still yields a valid sitemap with
    // the hand-built pages instead of an empty one.
    let entries: Entry[] = STATIC_ROUTES
        .filter((r) => !r.requires || (site as any)[r.requires] === true)
        .map((r) => ({
            loc: `${origin}${r.path}`,
            lastmod: now,
            changefreq: r.changefreq,
            priority: r.priority,
        }));

    try {
        const [posts, pageSeo, cmsPages, categories] = await Promise.all([
            prisma.post.findMany({
                // Published AND not per-post noindex. Posts without a SEO row
                // default to indexable, so only exclude an explicit robotsIndex:false.
                where: { status: 'published', NOT: { seo: { robotsIndex: false } } },
                select: {
                    slug: true, updatedAt: true, publishedAt: true, createdAt: true,
                    primaryCategory: { select: { slug: true } },
                    categories: { take: 1, select: { category: { select: { slug: true } } } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            // ALL per-page SEO rows, not just the indexable ones — they're used
            // to filter/annotate STATIC_ROUTES below, never to create URLs.
            prisma.pageSeo.findMany({
                where: { siteSetting: { siteKey: SITE_KEY } },
                select: { pageSlug: true, updatedAt: true, robotsIndex: true },
            }),
            // Custom pages / tutorial hubs built in Admin → Blog → Pages
            // (/tutorials, /phptutorials, …). These were missing entirely, so a
            // published, indexable hub never reached Google. Same robots rule as
            // posts: no SEO row → indexable; only an explicit robotsIndex:false
            // opts out. (`OR` instead of `NOT` mirrors the /yt sitemap.)
            prisma.cmsPage.findMany({
                where: {
                    siteKey: SITE_KEY,
                    status: 'published',
                    OR: [{ seo: null }, { seo: { robotsIndex: true } }],
                },
                select: { slug: true, updatedAt: true, publishedAt: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
            }),
            // Category archives (/tag/<slug>). Page 1 is indexable again — see
            // app/(blog)/tag/[tag]/page.tsx — so it belongs in the sitemap.
            // Only categories with at least one PUBLISHED post: an empty archive
            // is a genuinely thin page and submitting it invites a soft-404.
            // Page 2+ is still noindex and is never listed here.
            prisma.category.findMany({
                where: { posts: { some: { post: { status: 'published' } } } },
                select: { slug: true, updatedAt: true },
                orderBy: { name: 'asc' },
            }),
        ]);

        // Apply the per-page SEO rows to the static entries: drop any the admin
        // marked noindex, and use the row's real updatedAt as lastmod.
        const seoByPath = new Map(pageSeo.map((p) => [p.pageSlug, p]));
        const pathOf = (loc: string) => loc.slice(origin.length) || '/';
        entries = entries
            .filter((e) => seoByPath.get(pathOf(e.loc))?.robotsIndex !== false)
            .map((e) => {
                const row = seoByPath.get(pathOf(e.loc));
                return row?.updatedAt ? { ...e, lastmod: row.updatedAt } : e;
            });

        // Newest post date per category slug, built from the posts already
        // fetched above — no extra query.
        //
        // `Category.updatedAt` only moves when the category ITSELF is edited
        // (name, slug, emoji). An archive that gained three posts today was
        // still advertising a lastmod from weeks earlier, and engines use
        // lastmod to decide what to re-crawl — so the archive looked stale at
        // exactly the moment it had most changed.
        const newestPostByCategory = new Map<string, Date>();
        for (const p of posts as any[]) {
            const date: Date | null = p.updatedAt ?? p.publishedAt ?? p.createdAt ?? null;
            if (!date) continue;
            const slugs = [
                p.primaryCategory?.slug,
                p.categories?.[0]?.category?.slug,
            ].filter(Boolean) as string[];
            for (const slug of slugs) {
                const seenDate = newestPostByCategory.get(slug);
                if (!seenDate || date > seenDate) newestPostByCategory.set(slug, date);
            }
        }

        entries = entries.concat(
            posts.map((p): Entry => {
                const cat = (p as any).primaryCategory?.slug || (p as any).categories?.[0]?.category?.slug || 'uncategorized';
                return {
                    loc: `${origin}/${cat}/${p.slug}`,
                    lastmod: p.updatedAt ?? p.publishedAt ?? p.createdAt ?? now,
                    changefreq: 'weekly',
                    priority: 0.8,
                };
            }),
            // Custom pages last: render() de-dupes by `loc`, so a CMS page that
            // shares a path with a static entry above (e.g. /contact) keeps the
            // static entry's changefreq/priority instead of being listed twice.
            cmsPages.map((p): Entry => ({
                loc: `${origin}/${p.slug}`,
                lastmod: p.updatedAt ?? p.publishedAt ?? p.createdAt ?? now,
                changefreq: 'monthly',
                priority: 0.7,
            })),
            // Lower priority than the hand-written hubs (0.7): if Google has to
            // pick one page for "web development tutorials", the prose hub is
            // the one worth having.
            categories.map((c): Entry => {
                const newestPost = newestPostByCategory.get(c.slug) ?? null;
                const candidates = [newestPost, c.updatedAt ?? null].filter(Boolean) as Date[];
                return {
                    loc: `${origin}/tag/${c.slug}`,
                    // Whichever moved last: the newest post on this archive, or
                    // the category record itself.
                    lastmod: candidates.length
                        ? new Date(Math.max(...candidates.map((d) => d.getTime())))
                        : now,
                    changefreq: 'weekly',
                    priority: 0.5,
                };
            }),
        );
    } catch (err) {
        console.error(`[sitemap:${SITE_KEY}] dynamic sources failed:`, err);
    }

    return new NextResponse(render(entries), {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
        },
    });
}
