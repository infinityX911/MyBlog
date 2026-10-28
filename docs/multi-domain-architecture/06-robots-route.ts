/**
 * 06-robots-route.ts — per-domain robots.txt
 *
 * WHY route handlers instead of your current app/robots.ts:
 * the `robots.ts` / `sitemap.ts` metadata conventions have NO request context —
 * they can't see the Host header, so one build-time file can't vary per domain
 * (your current one hardcodes getSiteUrl('blog')). Route handlers named as
 * literal files DO get the request, and the proxy's host rewrite routes each
 * domain to its own handler automatically:
 *
 *   blogdomain.com/robots.txt   → app/robots.txt/route.ts            (this file, siteKey 'blog')
 *   ytdownloader.com/robots.txt → /yt/robots.txt (rewritten)
 *                               → app/(yt-downloader)/yt/robots.txt/route.ts
 *                                 (this same file with SITE_KEY = 'yt' and its
 *                                  own DISALLOW list — copy + adjust 2 constants)
 *
 * DELETE app/robots.ts when deploying this (they'd conflict on the same path).
 */

import { NextResponse } from 'next/server';
import { getSiteByKey, siteOrigin } from '@/lib/site-context';

// Per-tree constant: 'blog' in app/robots.txt/route.ts,
//                    'yt'   in app/(yt-downloader)/yt/robots.txt/route.ts
const SITE_KEY = 'blog';

// Paths hidden from crawlers for THIS site. The blog hides its member surfaces;
// the downloader copy typically only needs ['/admin', '/api/'].
const DISALLOW: string[] = [
    '/admin', '/api/', '/login', '/signup', '/account', '/verify-email',
];

// ISR for route handlers: cache the response, refresh at most hourly, and the
// admin save hook's revalidateTag also applies via the cached site lookup.
export const revalidate = 3600;

export async function GET() {
    const site = await getSiteByKey(SITE_KEY);

    // No config row → serve a safe, crawlable default rather than 500.
    if (!site) {
        return new NextResponse('User-agent: *\nAllow: /\n', {
            headers: { 'Content-Type': 'text/plain' },
        });
    }

    const origin = siteOrigin(site);
    const lines: string[] = ['User-agent: *'];

    if (!site.defaultRobotsIndex) {
        // Admin flipped the global "Index" switch off → block the whole site.
        lines.push('Disallow: /');
    } else {
        lines.push('Allow: /');
        for (const path of DISALLOW) lines.push(`Disallow: ${path}`);
    }

    // Only advertise the sitemap if the admin's "Sitemap" toggle is on.
    if (site.sitemapEnabled) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
    lines.push('', `Host: ${origin}`);

    return new NextResponse(lines.join('\n') + '\n', {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
        },
    });
}
