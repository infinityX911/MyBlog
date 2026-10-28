// lib/analytics/ga4.ts
// Server-only Google Analytics 4 (GA4) Data API helper. Returns REAL visitor
// data in the SAME shape the dashboard endpoints already use, so the existing
// "Visitors" chart + "Total Views" card need no frontend changes.
//
// Auth: a Google Cloud service account (see .env keys below). If those env vars
// aren't set, isGa4Configured() is false and callers fall back to DB analytics —
// so nothing breaks pre-launch (GA4 has no data until the site is live + tracked).
//
// Required .env:
//   GA4_PROPERTY_ID       e.g. 123456789   (GA4 Admin → Property Settings → Property ID)
//   GOOGLE_CLIENT_EMAIL   the service-account email (…@…iam.gserviceaccount.com)
//   GOOGLE_PRIVATE_KEY    the private key from the service-account JSON (keep the \n)
//
// Setup once (Google side): create GA4 property + add the tracking tag to the
// public site, enable the "Google Analytics Data API" in Google Cloud, create a
// service account + JSON key, then add that service-account email as a **Viewer**
// on the GA4 property.

import 'server-only';
import { getIntegrations } from '@/lib/integrations';

export interface SeriesPoint { name: string; value: number }
export interface VisitorsResult { total: number; series: SeriesPoint[] }
export type Range = 'day' | 'week' | 'month' | 'year';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');
/**
 * GA4's Data API rejects any startDate earlier than this, so it is the widest
 * window a report can legally ask for. Using anything earlier throws, which is
 * how the All Time views card ended up silently falling back to the DB.
 */
export const GA4_EARLIEST = '2015-08-14';

// Config now comes from the DB (Admin → Blog → Integrations), with an .env
// fallback baked into getIntegrations(). All three fields must be present.
export async function isGa4Configured(): Promise<boolean> {
    const a = (await getIntegrations()).analytics;
    return !!(a.ga4PropertyId && a.clientEmail && a.privateKey);
}

// Build a client from the resolved credentials (per-call; the config read is
// request-cached, and these endpoints are low-frequency).
async function getClient(clientEmail: string, privateKey: string) {
    const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
    return new BetaAnalyticsDataClient({
        credentials: {
            client_email: clientEmail,
            // Stored keys may escape newlines as literal "\n" — restore them.
            private_key: (privateKey || '').replace(/\\n/g, '\n'),
        },
    });
}

const property = (propertyId: string) => `properties/${propertyId}`;

/** Ordered buckets + the GA4 dimension + date range that match a chart range. */
function planGa4(range: Range): { dimension: string; startDate: string; endDate: string; buckets: { key: string; name: string }[] } {
    const now = new Date();
    if (range === 'day') {
        // last 24 hourly buckets (dateHour = "YYYYMMDDHH")
        const buckets: { key: string; name: string }[] = [];
        const start = new Date(now.getTime() - 23 * 3600 * 1000);
        start.setMinutes(0, 0, 0);
        for (let i = 0; i < 24; i++) {
            const d = new Date(start.getTime() + i * 3600 * 1000);
            buckets.push({
                key: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}`,
                name: `${((d.getHours() % 12) || 12)}${d.getHours() < 12 ? 'am' : 'pm'}`,
            });
        }
        return { dimension: 'dateHour', startDate: '1daysAgo', endDate: 'today', buckets };
    }
    if (range === 'week' || range === 'month') {
        const days = range === 'week' ? 7 : 30;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        const buckets: { key: string; name: string }[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
            buckets.push({ key: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`, name: `${MONTHS[d.getMonth()]} ${d.getDate()}` });
        }
        return { dimension: 'date', startDate: `${days - 1}daysAgo`, endDate: 'today', buckets };
    }
    // year → last 12 months (yearMonth = "YYYYMM")
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const buckets: { key: string; name: string }[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
        buckets.push({ key: `${d.getFullYear()}${pad(d.getMonth() + 1)}`, name: MONTHS[d.getMonth()] });
    }
    return { dimension: 'yearMonth', startDate: '365daysAgo', endDate: 'today', buckets };
}

/** Real visitors (activeUsers) for a range, mapped onto the ordered buckets. */
export async function ga4VisitorsSeries(range: Range): Promise<VisitorsResult> {
    const { dimension, startDate, endDate, buckets } = planGa4(range);
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const [resp] = await client.runReport({
        property: property(a.ga4PropertyId),
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: dimension }],
        metrics: [{ name: 'activeUsers' }],
    });

    const byKey = new Map<string, number>();
    for (const row of resp.rows ?? []) {
        const key = row.dimensionValues?.[0]?.value ?? '';
        const val = Number(row.metricValues?.[0]?.value ?? 0);
        byKey.set(key, val);
    }
    const series = buckets.map((b) => ({ name: b.name, value: byKey.get(b.key) ?? 0 }));
    const total = series.reduce((a, p) => a + p.value, 0);
    return { total, series };
}

/** Total pageviews (screenPageViews) since the given start (default: all-time-ish). */
export async function ga4TotalPageviews(startDate = GA4_EARLIEST): Promise<number> {
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const [resp] = await client.runReport({
        property: property(a.ga4PropertyId),
        dateRanges: [{ startDate, endDate: 'today' }],
        metrics: [{ name: 'screenPageViews' }],
    });
    return Number(resp.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}


/** Daily screenPageViews for the last `days` days, keyed 'YYYY-MM-DD'. */
export async function ga4DailyViews(days: number): Promise<Map<string, number>> {
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const [resp] = await client.runReport({
        property: property(a.ga4PropertyId),
        dateRanges: [{ startDate: `${Math.max(1, days) - 1}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'date' }],   // GA4 returns this as 'YYYYMMDD'
        metrics: [{ name: 'screenPageViews' }],
    });
    const out = new Map<string, number>();
    for (const row of resp.rows ?? []) {
        const d = row.dimensionValues?.[0]?.value ?? '';
        if (d.length !== 8) continue;
        out.set(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, Number(row.metricValues?.[0]?.value ?? 0));
    }
    return out;
}

/**
 * screenPageViews split by country. `pagePaths` narrows the report to those
 * pages — that is what makes a PER-POST country breakdown possible, which was
 * the original reason this lived in the DB instead. Omit it for the whole site.
 * A country GA4 could not resolve comes back as null, not dropped.
 */
export async function ga4CountryViews(
    { days, pagePaths }: { days?: number; pagePaths?: string[] } = {},
): Promise<{ code: string | null; views: number }[]> {
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const [resp] = await client.runReport({
        property: property(a.ga4PropertyId),
        dateRanges: [{ startDate: days ? `${days}daysAgo` : GA4_EARLIEST, endDate: 'today' }],
        dimensions: [{ name: 'countryId' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 250,
        ...(pagePaths?.length
            ? { dimensionFilter: { filter: { fieldName: 'pagePath', inListFilter: { values: pagePaths } } } }
            : {}),
    } as any);
    return ((resp as any).rows ?? [])
        .map((r: any) => {
            const raw = r.dimensionValues?.[0]?.value ?? '';
            return {
                // GA4 uses '(not set)' for an unresolved country; normalise it to
                // null so it lands in the same Unknown bucket the DB path uses.
                code: /^[A-Z]{2}$/.test(raw) ? raw : null,
                views: Number(r.metricValues?.[0]?.value ?? 0),
            };
        })
        .filter((r: { views: number }) => r.views > 0);
}

/** Top country per page path — one report for a whole posts-list page. */
export async function ga4TopCountryByPath(
    pagePaths: string[],
    days?: number,
): Promise<Map<string, { code: string; views: number }>> {
    const out = new Map<string, { code: string; views: number }>();
    if (!pagePaths.length) return out;
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const [resp] = await client.runReport({
        property: property(a.ga4PropertyId),
        dateRanges: [{ startDate: days ? `${days}daysAgo` : GA4_EARLIEST, endDate: 'today' }],
        dimensions: [{ name: 'pagePath' }, { name: 'countryId' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: { filter: { fieldName: 'pagePath', inListFilter: { values: pagePaths } } },
        limit: 10000,
    } as any);
    for (const r of ((resp as any).rows ?? [])) {
        const path = r.dimensionValues?.[0]?.value ?? '';
        const code = r.dimensionValues?.[1]?.value ?? '';
        const views = Number(r.metricValues?.[0]?.value ?? 0);
        if (!path || !/^[A-Z]{2}$/.test(code) || views <= 0) continue;
        const cur = out.get(path);
        if (!cur || views > cur.views) out.set(path, { code, views });
    }
    return out;
}
// ── Dashboard "insights" widgets (device / country / pages / traffic sources) ─
const fmtDuration = (secs: number) => {
    const s = Math.max(0, Math.round(secs));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(sec)}`;
};

export interface Ga4Insights {
    device: { month: string; desktop: number; mobile: number }[];
    countries: { name: string; code: string; users: number; share: number }[];
    pages: { path: string; views: number; bounce: number }[];
    sources: { source: string; users: number; sessions: number; bounce: number; duration: string }[];
}

/** All four dashboard-insight datasets in one call, for a given calendar year. */
export async function ga4Insights(year: number): Promise<Ga4Insights> {
    const a = (await getIntegrations()).analytics;
    const client = await getClient(a.clientEmail, a.privateKey);
    const prop = property(a.ga4PropertyId);
    const startDate = `${year}-01-01`;
    const endDate = year >= new Date().getFullYear() ? 'today' : `${year}-12-31`;

    const [deviceR, countryR, pagesR, sourcesR] = await Promise.all([
        client.runReport({ property: prop, dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'yearMonth' }, { name: 'deviceCategory' }], metrics: [{ name: 'screenPageViews' }] }),
        client.runReport({ property: prop, dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'countryId' }, { name: 'country' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }], limit: 6 as any }),
        client.runReport({ property: prop, dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }, { name: 'bounceRate' }], orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 6 as any }),
        client.runReport({ property: prop, dateRanges: [{ startDate, endDate }], dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'bounceRate' }, { name: 'averageSessionDuration' }], orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 6 as any }),
    ]);

    // Device → 12 month buckets, desktop vs mobile (tablet folded into mobile).
    const device = MONTHS.map((name, i) => ({ month: name, desktop: 0, mobile: 0, key: `${year}${pad(i + 1)}` }));
    for (const row of (deviceR as any)[0].rows ?? []) {
        const ym = row.dimensionValues?.[0]?.value ?? '';
        const dev = (row.dimensionValues?.[1]?.value ?? '').toLowerCase();
        const val = Number(row.metricValues?.[0]?.value ?? 0);
        const b = device.find((d) => d.key === ym);
        if (!b) continue;
        if (dev === 'desktop') b.desktop += val; else b.mobile += val;
    }

    const cRows = (countryR as any)[0].rows ?? [];
    const cTotal = cRows.reduce((s: number, r: any) => s + Number(r.metricValues?.[0]?.value ?? 0), 0) || 1;
    const countries = cRows.map((r: any) => {
        const users = Number(r.metricValues?.[0]?.value ?? 0);
        return { code: r.dimensionValues?.[0]?.value ?? '', name: r.dimensionValues?.[1]?.value ?? '', users, share: Math.round((users / cTotal) * 100) };
    });

    const pages = ((pagesR as any)[0].rows ?? []).map((r: any) => ({
        path: r.dimensionValues?.[0]?.value ?? '/',
        views: Number(r.metricValues?.[0]?.value ?? 0),
        bounce: Math.round(Number(r.metricValues?.[1]?.value ?? 0) * 100),
    }));

    const sources = ((sourcesR as any)[0].rows ?? []).map((r: any) => ({
        source: r.dimensionValues?.[0]?.value ?? 'Other',
        users: Number(r.metricValues?.[0]?.value ?? 0),
        sessions: Number(r.metricValues?.[1]?.value ?? 0),
        bounce: Math.round(Number(r.metricValues?.[2]?.value ?? 0) * 100),
        duration: fmtDuration(Number(r.metricValues?.[3]?.value ?? 0)),
    }));

    return { device: device.map(({ key, ...d }) => d), countries, pages, sources };
}
