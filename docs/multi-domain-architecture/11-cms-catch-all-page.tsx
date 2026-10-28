/**
 * 11-cms-catch-all-page.tsx  →  deploy as  app/(yt-downloader)/yt/[...slug]/page.tsx
 * (an identical copy — minus the group — serves blog-tenant CMS pages as
 *  app/(blog)/[...slug]/page.tsx if/when you want CMS pages on the blog too)
 *
 * THE renderer for every CMS-created page on the downloader site:
 *   ytdownloader.com/about       → proxy rewrites → /yt/about       → here
 *   ytdownloader.com/legal/dmca  → proxy rewrites → /yt/legal/dmca  → here
 *
 * Conflict story (recap):
 *   • Static siblings (app/.../yt/page.tsx, future /yt/tool/…) ALWAYS win over
 *     this [...slug] — Next's router prefers static segments. System screens
 *     are untouchable by CMS data.
 *   • Slugs that would shadow infrastructure never reach the DB — rejected at
 *     write time by validateCmsSlug (files 04 + 09).
 *   • Unknown slugs fall through to notFound() → the site's 404.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { getSiteByKey, siteUrl } from '@/lib/site-context';
import SafeHtml from '@/components/SafeHtml';

// This file lives INSIDE the yt tree, so its tenant is static — use
// getSiteByKey('yt'), NOT getCurrentSite(): the header-based resolver calls
// headers(), a dynamic API that would force every CMS page to render
// per-request. With a static key the route stays ISR-cacheable: pages are
// cached and refreshed by revalidatePath() fired on save (file 09, step 7),
// with the hourly revalidate below as a safety net.
export const revalidate = 3600;

const SITE_KEY = 'yt';

interface Props {
    params: Promise<{ slug: string[] }>; // Next 16: params is a Promise
}

/** Single tenant-scoped fetch shared by page + metadata (deduped by React). */
async function getPage(slugSegments: string[]) {
    const site = await getSiteByKey(SITE_KEY);
    if (!site) notFound(); // tenant row not seeded yet
    const page = await prisma.cmsPage.findUnique({
        where: {
            // Compound unique key ⇒ impossible to accidentally serve another
            // tenant's /about — the tenant id is part of the lookup itself.
            siteSettingId_slug: {
                siteSettingId: site.id,
                slug: slugSegments.join('/'),
            },
        },
        include: { seo: true },
    });
    return { site, page };
}

// ─── Metadata: Tier-3 cascade (see file 05 for the full commentary) ──────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const { site, page } = await getPage(slug);
    if (!page || page.status !== 'published') return {};

    const path = `/${page.slug}`; // VISIBLE path — the /yt prefix never leaks
    const seo = page.seo;
    return {
        title: seo?.metaTitle || page.title, // layout template appends " | SiteName"
        description: seo?.metaDescription || undefined,
        robots: { index: seo?.robotsIndex ?? true, follow: seo?.robotsFollow ?? true },
        alternates: { canonical: seo?.canonicalUrl || siteUrl(site, path) },
        openGraph: {
            title: seo?.ogTitle || seo?.metaTitle || page.title,
            description: seo?.ogDescription || seo?.metaDescription || undefined,
            url: siteUrl(site, path),
            type: 'article',
            ...(seo?.ogImage || site.ogImage
                ? { images: [{ url: (seo?.ogImage || site.ogImage)! }] }
                : {}),
        },
    };
}

// ─── The page ─────────────────────────────────────────────────────────────────
export default async function CmsPage({ params }: Props) {
    const { slug } = await params;
    const { page } = await getPage(slug);

    // Drafts are invisible to the public — same 404 as a missing page so the
    // existence of unpublished content can't be probed.
    if (!page || page.status !== 'published') notFound();

    return (
        // Tailwind v4 prefixed utilities (tw:*) — downloader styling only ever
        // comes from this route group's own CSS entry, never the blog's.
        <main className="tw:mx-auto tw:max-w-3xl tw:px-4 tw:py-12">
            <h1 className="tw:text-3xl tw:font-bold tw:mb-6">{page.title}</h1>
            {/* THE sanctioned sink for user-generated markup — see file 10. */}
            <SafeHtml html={page.content} className="tw:prose tw:max-w-none" />
        </main>
    );
}
