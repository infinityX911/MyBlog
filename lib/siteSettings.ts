/**
 * lib/siteSettings.ts
 *
 * Server-side helper to read a site's settings (the row managed from
 * Admin → Settings). Used by the blog layout's generateMetadata, the
 * sitemap and robots so that SEO is driven by the database instead of
 * hardcoded values — i.e. fully admin-controlled / automated.
 *
 * Cached per request via React.cache so multiple callers (layout +
 * sitemap, etc.) don't hit the DB repeatedly.
 */

import { cache } from 'react';
import { prisma } from './prisma';

export type SiteSettingRow = {
    siteName: string;
    emailAddress: string | null;
    tagline: string | null;
    description: string | null;
    websiteUrl: string | null;
    defaultMetaTitle: string | null;
    defaultMetaDescription: string | null;
    titleSeparator: string | null;
    defaultRobotsIndex: boolean;
    defaultRobotsFollow: boolean;
    ogImage: string | null;
    siteIcon: string | null;
    themeColor: string | null;
    metaKeywords: string | null;
    twitterHandle: string | null;
    sitemapEnabled: boolean;
    authorEnabled: boolean;
    authorName: string | null;
    authorImage: string | null;
    authorBio: string | null;
    authorLink: string | null;
    aboutStats: string | null;
    // Feature switches. NOT decoration — the navbar filter, the sitemap, the
    // robots meta on /announcements and /members all read them through here.
    //
    // This object is hand-picked rather than the raw row, which makes a missing
    // field genuinely dangerous: it reads as `undefined` at every call site,
    // which looks exactly like "switched off" and fails silently in the safe
    // direction, so nobody notices the switch no longer turns anything back ON.
    // Add new flags here at the same time as the schema.
    registrationEnabled: boolean;
    announcementsEnabled: boolean;
    membersEnabled: boolean;
    announcementsRemoved: boolean;
    membersRemoved: boolean;
} | null;

export const getSiteSetting = cache(async (siteKey: string): Promise<SiteSettingRow> => {
    try {
        const s = await prisma.siteSetting.findUnique({ where: { siteKey } });
        if (!s) return null;
        return {
            siteName: s.siteName,
            emailAddress: s.emailAddress,
            tagline: s.tagline,
            description: s.description,
            websiteUrl: s.websiteUrl,
            defaultMetaTitle: s.defaultMetaTitle,
            defaultMetaDescription: s.defaultMetaDescription,
            titleSeparator: s.titleSeparator,
            defaultRobotsIndex: s.defaultRobotsIndex,
            defaultRobotsFollow: s.defaultRobotsFollow,
            ogImage: s.ogImage,
            siteIcon: s.siteIcon,
            themeColor: s.themeColor,
            metaKeywords: s.metaKeywords,
            twitterHandle: s.twitterHandle,
            sitemapEnabled: s.sitemapEnabled,
            authorEnabled: s.authorEnabled,
            authorName: s.authorName,
            authorImage: s.authorImage,
            authorBio: s.authorBio,
            authorLink: s.authorLink,
            aboutStats: s.aboutStats,
            registrationEnabled: s.registrationEnabled,
            announcementsEnabled: s.announcementsEnabled,
            membersEnabled: s.membersEnabled,
            announcementsRemoved: s.announcementsRemoved,
            membersRemoved: s.membersRemoved,
        };
    } catch (err) {
        console.error('[getSiteSetting]', err);
        return null;
    }
});

/** Ensure a URL has a scheme and no trailing slash (so new URL() never throws). */
export function normalizeUrl(raw: string | null | undefined, fallback = 'https://inkdrop.blog'): string {
    const value = (raw || '').trim() || fallback;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return withScheme.replace(/\/$/, '');
}

/** Resolve the public site base URL (settings → env → fallback). */
export async function getSiteUrl(siteKey = 'blog'): Promise<string> {
    const s = await getSiteSetting(siteKey);
    return normalizeUrl(s?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL);
}

export type PageSeoRow = {
    metaTitle: string | null;
    metaDescription: string | null;
    canonicalUrl: string | null;
    robotsIndex: boolean;
    robotsFollow: boolean;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
};

/**
 * Per-page SEO overrides configured in Admin → Settings → Per-Page SEO.
 * Keyed by the site + the page path ('/', '/about', '/posts', …). Returns null
 * when no row exists, so callers fall back to their global/default metadata.
 */
export const getPageSeo = cache(async (siteKey: string, pageSlug: string): Promise<PageSeoRow | null> => {
    try {
        const s = await prisma.siteSetting.findUnique({ where: { siteKey }, select: { id: true } });
        if (!s) return null;
        return await prisma.pageSeo.findUnique({
            where: { siteSettingId_pageSlug: { siteSettingId: s.id, pageSlug } },
            select: {
                metaTitle: true, metaDescription: true, canonicalUrl: true,
                robotsIndex: true, robotsFollow: true, ogTitle: true, ogDescription: true, ogImage: true,
            },
        });
    } catch {
        return null;
    }
});
