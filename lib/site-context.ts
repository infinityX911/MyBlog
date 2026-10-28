/**
 * lib/site-context.ts
 *
 * Single source of truth for "which site is this request for, and what is its
 * configuration". Used by robots.txt / sitemap.xml route handlers and by
 * generateMetadata so SEO output is driven by Admin → Settings, per site.
 *
 * Caching:
 *   • React cache()        → dedupes within one render pass.
 *   • unstable_cache(tags) → persists across requests; invalidated instantly
 *                            when the admin saves Settings (revalidateTag).
 */

import { cache } from 'react';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { SiteSetting } from '@prisma/client';

const DEFAULT_SITE_KEY = process.env.DEFAULT_SITE_KEY || 'blog';

// Cross-request cached DB read, tagged per tenant so the admin's "Save"
// (revalidateTag(`site:${siteKey}`)) refreshes every domain instantly.
const loadSite = (siteKey: string) =>
    unstable_cache(
        () => prisma.siteSetting.findUnique({ where: { siteKey } }),
        [`site-setting-${siteKey}`],
        { tags: [`site:${siteKey}`] },
    )();

/**
 * Resolve the ACTIVE tenant for this request. proxy.ts resolves Host → siteKey
 * and stamps `x-site-key`, so this is a header read — no hostname re-parsing.
 */
export const getCurrentSite = cache(async (): Promise<SiteSetting | null> => {
    const hdrs = await headers();
    const siteKey = hdrs.get('x-site-key') ?? DEFAULT_SITE_KEY;

    const site = await loadSite(siteKey);
    if (site) return site;

    console.error(`[site-context] no SiteSetting row for siteKey="${siteKey}" — falling back to "${DEFAULT_SITE_KEY}"`);
    return loadSite(DEFAULT_SITE_KEY);
});

/**
 * Explicit-key variant for contexts that KNOW their tenant statically —
 * e.g. app/(yt-downloader)/yt/sitemap.xml/route.ts always serves "yt".
 * Works even when a request bypasses the proxy (ISR revalidation, etc.).
 */
export async function getSiteByKey(siteKey: string): Promise<SiteSetting | null> {
    return loadSite(siteKey);
}

/**
 * Site's canonical origin: prefers admin-configured websiteUrl, then env —
 * always scheme-prefixed, never trailing-slashed.
 */
export function siteOrigin(site: SiteSetting | null): string {
    const raw =
        site?.websiteUrl?.trim() ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'http://localhost:3000';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, '');
}

/**
 * Absolute PUBLIC url for a path on this tenant. Takes the VISIBLE path
 * ("/about"), never the internal rewritten one ("/yt/about") — the internal
 * prefix is a serving detail that must never leak into SEO output.
 */
export function siteUrl(site: SiteSetting | null, path = '/'): string {
    return `${siteOrigin(site)}${path.startsWith('/') ? path : `/${path}`}`;
}
