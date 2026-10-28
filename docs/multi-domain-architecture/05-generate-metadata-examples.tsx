/**
 * 05-generate-metadata-examples.tsx  —  three real generateMetadata tiers.
 *
 * The cascade, lowest priority first (each tier only overrides what it sets):
 *
 *   TIER 1  Site layout        → SiteSetting globals (title template, favicon,
 *                                theme color, global OG image, twitter handle,
 *                                index/follow defaults, tracking scripts)
 *   TIER 2  Static system view → PageSeo row for that slug ("/", "/posts"…)
 *   TIER 3  Dynamic content    → PostSeo / DownloadSeo / CmsPageSeo satellite
 *
 * All tiers read config through lib/site-context.ts — one cached DB hit per
 * request, correct tenant guaranteed by the proxy's x-site-key header.
 */

import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentSite, siteOrigin, siteUrl } from '@/lib/site-context';

// ═════════════════════════════════════════════════════════════════════════════
// TIER 1 — SITE LAYOUT
// deploy pattern into: app/(blog)/layout.tsx  AND  app/(yt-downloader)/yt/layout.tsx
// (identical code — the tenant difference comes entirely from the data)
// ═════════════════════════════════════════════════════════════════════════════

export async function generateMetadata(): Promise<Metadata> {
    const site = await getCurrentSite();
    const origin = siteOrigin(site);
    const sep = site.titleSeparator ?? '|';

    return {
        // metadataBase makes every relative OG/canonical URL resolve on the
        // CORRECT tenant domain — the linchpin of multi-domain metadata.
        metadataBase: new URL(origin),
        title: {
            default: site.defaultMetaTitle || site.siteName,
            // Child pages render as e.g. "About | YT Downloader"
            template: `%s ${sep} ${site.siteName}`,
        },
        description: site.defaultMetaDescription || site.description || undefined,
        keywords: site.metaKeywords?.split(',').map((k) => k.trim()).filter(Boolean),
        // Admin "Index / Follow" master switches (Global SEO tab)
        robots: {
            index: site.defaultRobotsIndex,
            follow: site.defaultRobotsFollow,
        },
        icons: site.siteIcon ? { icon: site.siteIcon } : undefined,
        openGraph: {
            siteName: site.siteName,
            type: 'website',
            url: origin,
            ...(site.ogImage ? { images: [{ url: site.ogImage }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            ...(site.twitterHandle ? { site: site.twitterHandle } : {}),
        },
        other: site.themeColor ? { 'theme-color': site.themeColor } : undefined,
    };
}

// The same layout also injects per-tenant tracking — dynamically, from the DB,
// so switching a GA property is an admin-panel edit, not a deploy. IDs are
// rendered through typed, escaped attributes (XSS-safe by construction).
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
    const site = await getCurrentSite();
    return (
        <html lang="en">
            <body>
                {children}
                {site.gaMeasurementId && (
                    <>
                        <Script
                            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(site.gaMeasurementId)}`}
                            strategy="afterInteractive"
                        />
                        <Script id={`ga-${site.siteKey}`} strategy="afterInteractive">
                            {`window.dataLayer = window.dataLayer || [];
                              function gtag(){dataLayer.push(arguments);}
                              gtag('js', new Date());
                              gtag('config', ${JSON.stringify(site.gaMeasurementId)});`}
                        </Script>
                    </>
                )}
            </body>
        </html>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
// TIER 2 — STATIC SYSTEM VIEW (the admin panel's "Per-Page SEO" tab)
// deploy pattern into: app/(blog)/page.tsx, app/(blog)/posts/page.tsx,
// app/(yt-downloader)/yt/page.tsx, … each passing its own pageSlug.
// ═════════════════════════════════════════════════════════════════════════════

/** Shared helper — put in lib/seo/page-metadata.ts and import everywhere. */
export async function staticPageMetadata(pageSlug: string): Promise<Metadata> {
    const site = await getCurrentSite();
    const seo = await prisma.pageSeo.findUnique({
        // Compound unique ⇒ tenant id is REQUIRED by the type system.
        // blogdomain.com "/" and ytdownloader.com "/" can never cross-read.
        where: { siteSettingId_pageSlug: { siteSettingId: site.id, pageSlug } },
    });
    if (!seo) return {}; // fall through to Tier 1 layout defaults

    return {
        ...(seo.metaTitle ? { title: seo.metaTitle } : {}),
        ...(seo.metaDescription ? { description: seo.metaDescription } : {}),
        robots: { index: seo.robotsIndex, follow: seo.robotsFollow },
        alternates: { canonical: seo.canonicalUrl || siteUrl(site, pageSlug) },
        openGraph: {
            title: seo.ogTitle || seo.metaTitle || undefined,
            description: seo.ogDescription || seo.metaDescription || undefined,
            url: siteUrl(site, pageSlug),
            ...(seo.ogImage || site.ogImage
                ? { images: [{ url: (seo.ogImage || site.ogImage)! }] }
                : {}),
        },
    };
}

// Usage in app/(yt-downloader)/yt/page.tsx — note: the VISIBLE slug "/", not "/yt":
// export const generateMetadata = () => staticPageMetadata('/');

// ═════════════════════════════════════════════════════════════════════════════
// TIER 3 — DYNAMIC CONTENT (CMS page; Post/Download follow the same shape)
// deploy into: app/(yt-downloader)/yt/[...slug]/page.tsx  (full page: file 11)
// ═════════════════════════════════════════════════════════════════════════════

export async function cmsPageMetadata(
    props: { params: Promise<{ slug: string[] }> }, // Next 16: params is a Promise
): Promise<Metadata> {
    const { slug } = await props.params;
    const site = await getCurrentSite();
    const path = `/${slug.join('/')}`;

    const page = await prisma.cmsPage.findUnique({
        where: {
            siteSettingId_slug: { siteSettingId: site.id, slug: slug.join('/') },
        },
        include: { seo: true },
    });
    if (!page || page.status !== 'published') notFound();

    const seo = page.seo;
    return {
        title: seo?.metaTitle || page.title,          // layout template appends site name
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
        twitter: {
            card: 'summary_large_image',
            title: seo?.twitterTitle || seo?.ogTitle || page.title,
            description: seo?.twitterDescription || seo?.ogDescription || undefined,
        },
    };
}
