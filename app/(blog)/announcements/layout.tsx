// app/(blog)/announcements/layout.tsx
//
// page.tsx here is a 'use client' component, so it can't export metadata
// itself — this segment layout is the standard way to attach it.
//
// Why it exists: without any metadata of its own, /announcements inherited the
// LAYOUT's defaults, so it shipped the home page's exact <title> and
// description and had NO canonical. Three URLs sharing one title/description
// is a duplicate-content signal, and a missing canonical leaves Google to pick
// its own. Everything below is still admin-controlled through
// Settings → Per-Page SEO for the path '/announcements'.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteSetting, getPageSeo, normalizeUrl } from '@/lib/siteSettings';
import { cleanTitle } from '@/lib/seo/title';
import { robotsMeta } from '@/lib/seo/robots';

const PATH = '/announcements';

export async function generateMetadata(): Promise<Metadata> {
    const [s, seo] = await Promise.all([getSiteSetting('blog'), getPageSeo('blog', PATH)]);
    const siteName = s?.siteName;
    const base = normalizeUrl(s?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL);
    const title = cleanTitle(seo?.metaTitle || 'Announcements', siteName);
    const description = seo?.metaDescription
        || `News, updates and short notes from ${siteName || 'the team'}.`;
    const image = seo?.ogImage || s?.ogImage || undefined;

    // With the feature switched off in Admin → Settings this page still renders,
    // but all it says is "Announcements aren't available right now". Letting that
    // stay index,follow means asking Google to index an empty page, which is a
    // thin-content signal a small site can't afford. Follow stays on so the nav
    // links out of it are still crawled.
    const featureOn = s?.announcementsEnabled === true;

    return {
        title,
        description,
        robots: featureOn
            ? robotsMeta(seo?.robotsIndex ?? true, seo?.robotsFollow ?? true)
            : robotsMeta(false, true),
        alternates: { canonical: seo?.canonicalUrl || `${base}${PATH}` },
        openGraph: {
            type: 'website',
            url: `${base}${PATH}`,
            title: cleanTitle(seo?.ogTitle || title, siteName),
            description: seo?.ogDescription || description,
            ...(siteName ? { siteName } : {}),
            ...(image ? { images: [{ url: image }] } : {}),
        },
        twitter: {
            card: 'summary_large_image',
            title: cleanTitle(seo?.ogTitle || title, siteName),
            description: seo?.ogDescription || description,
            ...(image ? { images: [image] } : {}),
        },
    };
}

export default async function AnnouncementsLayout({ children }: { children: React.ReactNode }) {
    // page.tsx is a client component and cannot 404 on its own, so the gate
    // lives here. "Removed" means the section is gone for good: a real 404 is
    // the honest answer, and it is what gets the URL dropped from the index.
    // Merely disabled is handled in generateMetadata above — the page still
    // renders its notice, just noindex.
    const s = await getSiteSetting('blog');
    if (s?.announcementsRemoved) notFound();
    return <>{children}</>;
}
