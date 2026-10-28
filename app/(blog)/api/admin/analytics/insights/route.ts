/**
 * GET /api/admin/analytics/insights?year=YYYY   [view-dashboard]
 *
 * Powers the dashboard's Visitors-Device chart, Country list, Page-Views table
 * and Traffic-Sources table. Returns REAL Google Analytics 4 data when the GA4
 * Data API is configured (Admin → Blog → Integrations), otherwise DUMMY data so
 * the widgets never look empty. The moment the admin adds the GA4 service-account
 * credentials, these widgets switch to live numbers — no code change.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { isGa4Configured, ga4Insights } from '@/lib/analytics/ga4';
import { isGscConfigured, gscQueries } from '@/lib/analytics/gsc';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Dummy fallback (shown until GA4 Data API is connected) ───────────────────
function dummy(year: number) {
    const seed = (i: number, a: number, b: number) => a + ((i * 9301 + 49297 + year) % (b - a));
    return {
        source: 'dummy' as const,
        year,
        device: MONTHS.map((m, i) => ({ month: m, desktop: seed(i, 1800, 6800), mobile: seed(i + 3, 1200, 5400) })),
        countries: [
            { name: 'Pakistan', code: 'PK', users: 5298, share: 32 },
            { name: 'India', code: 'IN', users: 4170, share: 25 },
            { name: 'United States', code: 'US', users: 2500, share: 15 },
            { name: 'United Kingdom', code: 'GB', users: 1400, share: 9 },
            { name: 'Germany', code: 'DE', users: 900, share: 6 },
        ],
        pages: [
            { path: '/', views: 6478, bounce: 15 },
            { path: '/tech/getting-started', views: 3589, bounce: 40 },
            { path: '/downloads', views: 2872, bounce: 55 },
            { path: '/contact', views: 1236, bounce: 63 },
            { path: '/tech/react-server-components', views: 908, bounce: 72 },
        ],
        sources: [
            { source: 'Direct', users: 872, sessions: 1077, bounce: 63, duration: '00:09:18' },
            { source: 'Organic Search', users: 1023, sessions: 1265, bounce: 29, duration: '00:06:25' },
            { source: 'Referral', users: 789, sessions: 390, bounce: 74, duration: '00:03:20' },
            { source: 'Social', users: 640, sessions: 812, bounce: 41, duration: '00:05:02' },
            { source: 'Campaign', users: 340, sessions: 512, bounce: 35, duration: '00:15:25' },
        ],
    };
}

// Search Console: top queries (dummy until GSC API is connected).
function dummyQueries() {
    return [
        { query: 'flow syntax blog', clicks: 128, impressions: 3400, ctr: 3.8, position: 4.2 },
        { query: 'youtube downloader free', clicks: 96, impressions: 5200, ctr: 1.8, position: 8.1 },
        { query: 'react server components guide', clicks: 74, impressions: 2100, ctr: 3.5, position: 6.7 },
        { query: 'next.js tutorial', clicks: 61, impressions: 4800, ctr: 1.3, position: 11.4 },
        { query: 'how to build a blog cms', clicks: 43, impressions: 1600, ctr: 2.7, position: 9.9 },
    ];
}

export async function GET(req: NextRequest) {
    const auth = await requirePermission('view-dashboard');
    if (auth.error) return auth.error;

    const now = new Date();
    const year = Math.min(now.getFullYear(), Math.max(2015, Number(new URL(req.url).searchParams.get('year')) || now.getFullYear()));

    // ── Search Console queries (independent of GA4) ──────────────────────────
    let queries = dummyQueries();
    let queriesSource: 'gsc' | 'dummy' = 'dummy';
    if (await isGscConfigured()) {
        try { queries = await gscQueries(); queriesSource = 'gsc'; }
        catch (e) { console.warn('[insights] GSC error, using dummy:', (e as any)?.message || e); }
    }

    // ── GA4 device/country/pages/sources; fall back to dummy on any error ────
    if (await isGa4Configured()) {
        try {
            const data = await ga4Insights(year);
            return NextResponse.json({ ...data, source: 'ga4', year, queries, queriesSource });
        } catch (e) {
            console.warn('[insights] GA4 error, using dummy:', (e as any)?.message || e);
        }
    }
    return NextResponse.json({ ...dummy(year), queries, queriesSource });
}
