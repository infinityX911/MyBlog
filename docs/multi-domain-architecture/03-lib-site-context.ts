/**
 * 03-lib-site-context.ts  →  deploy as  lib/site-context.ts
 *
 * THE single source of truth for "which site is this request for, and what is
 * its configuration". Everything downstream (generateMetadata, sitemap, robots,
 * CMS catch-all, tracking scripts) calls these two functions and nothing else.
 *
 * Caching model — two layers, deliberately:
 *   • React cache()        → dedupes within ONE request render pass, so layout +
 *                            page + generateMetadata share a single DB hit.
 *   • unstable_cache(tags) → persists ACROSS requests (survives per-request
 *                            cache), invalidated the instant an admin saves
 *                            Settings via revalidateTag(`site:${siteKey}`).
 *                            No TTL guessing, no stale-settings window.
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { SiteSetting } from '@prisma/client';

const DEFAULT_SITE_KEY = 'blog';

// ─────────────────────────────────────────────────────────────────────────────
// Cross-request cached DB read, tagged per tenant.
// ─────────────────────────────────────────────────────────────────────────────
const loadSite = (siteKey: string) =>
    unstable_cache(
        () => prisma.siteSetting.findUnique({ where: { siteKey } }),
        [`site-setting-${siteKey}`],            // cache key parts
        { tags: [`site:${siteKey}`] },          // ← revalidateTag('site:yt') on save
    )();

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentSite() — resolve the ACTIVE tenant for this request.
//
// proxy.ts already resolved Host → siteKey and stamped `x-site-key` on the
// request headers, so resolution here is a header read, not duplicated
// hostname parsing. React cache() makes repeated calls within the same render
// free.
// ─────────────────────────────────────────────────────────────────────────────
export const getCurrentSite = cache(async (): Promise<SiteSetting> => {
    const hdrs = await headers(); // Next 15+/16: headers() is async
    const siteKey = hdrs.get('x-site-key') ?? DEFAULT_SITE_KEY;

    const site = await loadSite(siteKey);
    if (site) return site;

    // Misconfiguration guard: proxy mapped a host to a siteKey that has no
    // SiteSetting row yet (e.g. fresh deploy before seeding). Fall back to the
    // default site rather than 500-ing the whole domain; log loudly.
    console.error(`[site-context] no SiteSetting row for siteKey="${siteKey}" — falling back to "${DEFAULT_SITE_KEY}"`);
    const fallback = await loadSite(DEFAULT_SITE_KEY);
    if (!fallback) throw new Error('[site-context] default SiteSetting row is missing — run prisma db seed');
    return fallback;
});

/** Explicit-key variant for contexts that KNOW their tenant statically —
 *  e.g. app/(yt-downloader)/yt/sitemap.xml/route.ts always serves "yt".
 *  Prefer this in per-site trees: it works even if a request bypasses the
 *  proxy (direct internal fetch, ISR revalidation worker, etc.). */
export async function getSiteByKey(siteKey: string): Promise<SiteSetting | null> {
    return loadSite(siteKey);
}

// ─────────────────────────────────────────────────────────────────────────────
// URL helpers — every absolute URL in metadata/sitemaps flows through these so
// canonical/OG/sitemap URLs are ALWAYS on the correct tenant domain.
// ─────────────────────────────────────────────────────────────────────────────

/** Site's canonical origin: prefers admin-configured websiteUrl, then
 *  customDomain, then env — always scheme-prefixed, never trailing-slashed. */
export function siteOrigin(site: SiteSetting): string {
    const raw = site.websiteUrl?.trim()
        || (site.customDomain ? `https://${site.customDomain}` : '')
        || process.env.NEXT_PUBLIC_SITE_URL
        || 'http://localhost:3000';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

/** Absolute PUBLIC url for a path on this tenant. Note: takes the VISIBLE
 *  path ("/about"), never the internal rewritten one ("/yt/about") — the
 *  internal prefix is a serving detail that must never leak into SEO output. */
export function siteUrl(site: SiteSetting, path = '/'): string {
    return `${siteOrigin(site)}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin save hook — call after ANY SiteSetting/PageSeo write in your settings
// API route so every domain reflects changes on the very next request:
//
//   import { revalidateTag } from 'next/cache';
//   revalidateTag(`site:${siteKey}`);
// ─────────────────────────────────────────────────────────────────────────────
