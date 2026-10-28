// lib/analytics/gsc.ts
// Server-only Google Search Console helper. Returns the site's top search
// queries (clicks / impressions / CTR / average position) for the dashboard.
//
// Auth reuses the SAME service account as GA4 (Admin → Integrations). The only
// extra setup on Google's side: add that service-account email as a user on the
// Search Console property, and the site must be verified in GSC.
import 'server-only';
import { getIntegrations } from '@/lib/integrations';
import { getSiteSetting, normalizeUrl } from '@/lib/siteSettings';

export interface GscQuery {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;       // percentage, e.g. 4.2
    position: number;  // average position, e.g. 12.3
}

/** GSC works with the same service-account creds as GA4. */
export async function isGscConfigured(): Promise<boolean> {
    const a = (await getIntegrations()).analytics;
    return !!(a.clientEmail && a.privateKey);
}

async function accessToken(): Promise<string> {
    const a = (await getIntegrations()).analytics;
    const { JWT } = await import('google-auth-library');
    const client = new JWT({
        email: a.clientEmail,
        key: (a.privateKey || '').replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('No GSC access token');
    return token;
}

/** Top search queries for the last `days` days (default 28). */
export async function gscQueries(days = 28): Promise<GscQuery[]> {
    const token = await accessToken();
    const base = normalizeUrl((await getSiteSetting('blog'))?.websiteUrl); // https://host
    const host = base.replace(/^https?:\/\//, '');

    const end = new Date();
    const start = new Date(Date.now() - days * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const body = JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: ['query'], rowLimit: 10 });

    // GSC properties come in two shapes — try the URL-prefix property first,
    // then the domain property. Whichever the account owns will answer.
    const properties = [`${base}/`, `sc-domain:${host}`];
    let rows: any[] | null = null;
    for (const property of properties) {
        const res = await fetch(
            `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body },
        );
        if (res.ok) { rows = (await res.json()).rows ?? []; break; }
    }
    if (rows == null) throw new Error('GSC: property not found / not authorised');

    return rows.map((r: any) => ({
        query: r.keys?.[0] ?? '',
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: Math.round((r.ctr ?? 0) * 1000) / 10,
        position: Math.round((r.position ?? 0) * 10) / 10,
    }));
}
