/**
 * 07-sitemap-route.ts — per-domain, context-aware sitemap.xml
 *
 * Same placement pattern as file 06:
 *   app/sitemap.xml/route.ts                          → SITE_KEY 'blog'
 *   app/(yt-downloader)/yt/sitemap.xml/route.ts       → SITE_KEY 'yt'
 * DELETE the old app/sitemap.ts (path conflict).
 *
 * Structural blueprint:
 *   entries(site) is assembled from PLUGGABLE per-siteType sources — the blog
 *   contributes posts + categories, every site contributes its published
 *   CmsPages and its PageSeo-listed static views (respecting each row's
 *   robotsIndex flag, so "noindex" pages are consistently absent here AND in
 *   the meta robots tag — one source of truth: the DB row).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSiteByKey, siteOrigin } from '@/lib/site-context';

const SITE_KEY = 'blog'; // ← 'yt' in the downloader tree's copy

export const revalidate = 3600; // ISR: new content appears without a rebuild

interface Entry {
    loc: string;
    lastmod?: Date;
    changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    priority?: number;
}

// ─── Escape XML entities: URLs may contain & (query strings) ─────────────────
const xml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// ─── Source 1: static system views, driven by the admin's Per-Page SEO tab ───
async function pageSeoEntries(siteId: number, origin: string): Promise<Entry[]> {
    const pages = await prisma.pageSeo.findMany({
        where: { siteSettingId: siteId, robotsIndex: true }, // noindex ⇒ omit
        select: { pageSlug: true, updatedAt: true },
    });
    return pages.map((p) => ({
        loc: `${origin}${p.pageSlug === '/' ? '/' : p.pageSlug}`,
        lastmod: p.updatedAt ?? undefined,
        changefreq: p.pageSlug === '/' ? 'daily' : 'monthly',
        priority: p.pageSlug === '/' ? 1.0 : 0.6,
    }));
}

// ─── Source 2: CMS pages (any site type) ─────────────────────────────────────
async function cmsEntries(siteId: number, origin: string): Promise<Entry[]> {
    const pages = await prisma.cmsPage.findMany({
        where: {
            siteSettingId: siteId,          // tenant isolation at the query level
            status: 'published',
            OR: [{ seo: null }, { seo: { robotsIndex: true } }],
        },
        select: { slug: true, updatedAt: true, publishedAt: true },
    });
    return pages.map((p) => ({
        loc: `${origin}/${p.slug}`,          // VISIBLE url — never the /yt prefix
        lastmod: p.updatedAt ?? p.publishedAt ?? undefined,
        changefreq: 'monthly',
        priority: 0.5,
    }));
}

// ─── Source 3: blog-only content (posts + tags) ──────────────────────────────
async function blogEntries(origin: string): Promise<Entry[]> {
    const [posts, categories] = await Promise.all([
        prisma.post.findMany({
            where: { status: 'published' },
            select: { slug: true, updatedAt: true, publishedAt: true, createdAt: true },
        }),
        prisma.category.findMany({ select: { slug: true, updatedAt: true } }),
    ]);
    return [
        ...posts.map((p): Entry => ({
            loc: `${origin}/posts/${p.slug}`,
            lastmod: p.updatedAt ?? p.publishedAt ?? p.createdAt ?? undefined,
            changefreq: 'weekly',
            priority: 0.8,
        })),
        ...categories.map((c): Entry => ({
            loc: `${origin}/tag/${c.slug}`,
            lastmod: c.updatedAt ?? undefined,
            changefreq: 'weekly',
            priority: 0.6,
        })),
    ];
}

export async function GET() {
    const site = await getSiteByKey(SITE_KEY);

    // Admin toggled the sitemap off, or site unseeded → valid empty document.
    if (!site || !site.sitemapEnabled) {
        return new NextResponse(
            '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>',
            { status: site ? 200 : 404, headers: { 'Content-Type': 'application/xml' } },
        );
    }

    const origin = siteOrigin(site);
    let entries: Entry[] = [];
    try {
        // siteType decides which sources contribute — extend with one case per
        // future SiteType (PORTFOLIO → projects, etc.).
        const sources: Promise<Entry[]>[] = [
            pageSeoEntries(site.id, origin),
            cmsEntries(site.id, origin),
        ];
        if (site.siteType === 'BLOG') sources.push(blogEntries(origin));
        entries = (await Promise.all(sources)).flat();
    } catch (err) {
        // DB hiccup → degrade to the homepage rather than failing the crawl.
        console.error(`[sitemap:${SITE_KEY}] dynamic sources failed:`, err);
        entries = [{ loc: `${origin}/`, priority: 1.0 }];
    }

    // De-dupe (a PageSeo row and a CmsPage could describe the same path).
    const seen = new Set<string>();
    const body = entries
        .filter((e) => !seen.has(e.loc) && seen.add(e.loc))
        .map((e) => [
            '  <url>',
            `    <loc>${xml(e.loc)}</loc>`,
            e.lastmod    ? `    <lastmod>${e.lastmod.toISOString()}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>`      : null,
            e.priority !== undefined ? `    <priority>${e.priority.toFixed(1)}</priority>` : null,
            '  </url>',
        ].filter(Boolean).join('\n'))
        .join('\n');

    return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`,
        {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
            },
        },
    );
}
