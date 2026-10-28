// app/(blog)/members/layout.tsx
//
// page.tsx here is a 'use client' component, so it can't export metadata
// itself — this segment layout is the standard way to attach it.
//
// Why it exists: /members had no metadata of its own, so it inherited the
// LAYOUT's defaults — the home page's exact <title> and description, and no
// canonical. That's a duplicate-content signal against the home page.
//
// Note on indexing: a member directory is a thin, largely user-generated
// listing with little search value, so this defaults to NOINDEX (follow stays
// on so profile links are still crawled). An admin can override it from
// Settings → Per-Page SEO for '/members' if they do want it indexed.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getSiteSetting, getPageSeo, normalizeUrl } from '@/lib/siteSettings';
import { cleanTitle } from '@/lib/seo/title';
import { robotsMeta } from '@/lib/seo/robots';

const PATH = '/members';

export async function generateMetadata(): Promise<Metadata> {
    const [s, seo] = await Promise.all([getSiteSetting('blog'), getPageSeo('blog', PATH)]);
    const siteName = s?.siteName;
    const base = normalizeUrl(s?.websiteUrl || process.env.NEXT_PUBLIC_SITE_URL);
    const title = cleanTitle(seo?.metaTitle || 'Members', siteName);
    const description = seo?.metaDescription
        || `The people writing and reading ${siteName || 'this blog'}.`;

    return {
        title,
        description,
        // Default false — only an explicit Per-Page SEO row can opt this in.
        robots: robotsMeta(seo?.robotsIndex ?? false, seo?.robotsFollow ?? true),
        alternates: { canonical: seo?.canonicalUrl || `${base}${PATH}` },
        openGraph: {
            type: 'website',
            url: `${base}${PATH}`,
            title: cleanTitle(seo?.ogTitle || title, siteName),
            description: seo?.ogDescription || description,
            ...(siteName ? { siteName } : {}),
        },
    };
}

export default async function MembersLayout({ children }: { children: React.ReactNode }) {
    // page.tsx is a client component and cannot 404 on its own, so the gate
    // lives here. "Removed" means gone for good — a real 404 is what drops the
    // URL from Google. Merely disabled leaves the page reachable and noindex.
    const s = await getSiteSetting('blog');
    if (s?.membersRemoved) notFound();
    return <>{children}</>;
}
