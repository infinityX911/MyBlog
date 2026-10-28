/**
 * app/robots.txt/route.ts — robots.txt for the BLOG site (default site, root).
 *
 * Replaces app/robots.ts: the metadata convention has no request context and
 * can't vary per domain. As a route handler, each domain reaches its own copy
 * via the proxy rewrite:
 *   blogdomain.com/robots.txt → this file            (siteKey 'blog')
 *   ytdomain.com/robots.txt   → /yt/robots.txt       (siteKey 'yt' copy)
 *
 * Fully admin-controlled: Admin → Settings → (blog) → "Site is indexable"
 * toggles between a normal robots.txt and a full Disallow: /.
 */

import { NextResponse } from 'next/server';
import { getSiteByKey, siteOrigin } from '@/lib/site-context';

const SITE_KEY = 'blog';

// Paths hidden from crawlers even when the site IS indexable.
// '/yt' is the private YouTube downloader (lib/yt/access.ts). It answers 404 to
// anyone but the owner, and a crawled 404 would surface as an error in Search
// Console — so we stop the crawl before it happens.
//
// '/tut' is the tutorials site (lib/tut/access.ts). Same 404 today, but it is
// listed for a second reason that outlives the gate: /tut is an INTERNAL
// prefix. That site is meant to be served from its own domain, where its pages
// sit at the root. If it ever goes public while still reachable here, this
// stops Google indexing it under this domain and filing the two sites together
// — which is the whole thing the separate site exists to avoid.
const DISALLOW: string[] = [
    '/admin', '/api/', '/login', '/signup', '/account',
    '/verify-email', '/messages', '/notifications', '/yt', '/tut',
];

export const dynamic = 'force-dynamic';

export async function GET() {
    const site = await getSiteByKey(SITE_KEY);

    // No config row yet → be SAFE and block (the blog must not be crawled
    // until the admin explicitly enables indexing).
    const indexable = site ? site.defaultRobotsIndex : false;
    const origin = siteOrigin(site);

    const lines: string[] = ['User-agent: *'];
    if (!indexable) {
        lines.push('Disallow: /');
    } else {
        lines.push('Allow: /');
        for (const path of DISALLOW) lines.push(`Disallow: ${path}`);
    }

    if (indexable && site?.sitemapEnabled) lines.push('', `Sitemap: ${origin}/sitemap.xml`);

    return new NextResponse(lines.join('\n') + '\n', {
        headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600',
        },
    });
}
