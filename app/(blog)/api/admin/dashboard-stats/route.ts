/**
 * app/api/admin/dashboard-stats/route.ts
 *
 * GET /api/admin/dashboard-stats
 *   → the four headline counters for the admin dashboard cards:
 *       { posts, users, views, roles }
 *
 * Requires the 'view-dashboard' permission (same gate as the analytics graph).
 * proxy.ts does NOT cover /api/admin/*, so this in-handler check is the gate —
 * a user without view-dashboard gets 403 and the cards render as 0/hidden.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { isGa4Configured, ga4TotalPageviews } from '@/lib/analytics/ga4';

/** Start date for a range, or null for "all time". */
function sinceFor(range: string): Date | null {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    switch (range) {
        case 'day': return new Date(now - DAY);
        case 'week': return new Date(now - 7 * DAY);
        case 'month': return new Date(now - 30 * DAY);
        case 'year': return new Date(now - 365 * DAY);
        default: return null; // all
    }
}

export async function GET(req: NextRequest) {
    const auth = await requirePermission('view-dashboard');
    if (auth.error) return auth.error;

    // ── Single-metric mode (used by each card, with a range) ─────────────────
    const metric = req.nextUrl.searchParams.get('metric');
    const range = req.nextUrl.searchParams.get('range') || 'all';
    if (metric) {
        try {
            const since = sinceFor(range);
            const dateFilter = since ? { createdAt: { gte: since } } : {};
            let value = 0;
            // "Total Posts" counts what a reader can actually reach. Drafts and
            // scheduled posts are not live, so they must not inflate the card.
            if (metric === 'posts') value = await prisma.post.count({ where: { ...dateFilter, status: 'published' } });
            else if (metric === 'users') value = await prisma.user.count({ where: dateFilter });
            else if (metric === 'roles') value = await prisma.role.count({ where: dateFilter });
            else if (metric === 'views') {
                // Prefer REAL Google Analytics pageviews when configured; fall back
                // to the DB view log/counter on any error (or if GA4 isn't set up).
                let done = false;
                if (await isGa4Configured()) {
                    try {
                        // GA4's Data API rejects any startDate before 2015-08-14. The old
                        // '2015-01-01' therefore threw on the All Time range only, silently
                        // fell through to the DB counter, and made All Time (242) read
                        // SMALLER than Last Month (1,195). Every range now uses GA4.
                        const startDate = since ? since.toISOString().slice(0, 10) : '2015-08-14';
                        value = await ga4TotalPageviews(startDate);
                        done = true;
                    } catch (e) { console.warn('[views] GA4 unavailable, DB fallback:', (e as any)?.message || e); }
                }
                if (!done) {
                    if (since) {
                        try { value = await prisma.postView.count({ where: { createdAt: { gte: since } } }); }
                        catch { value = 0; }
                    } else {
                        const agg = await prisma.post.aggregate({ _sum: { viewCount: true } });
                        value = agg._sum.viewCount ?? 0;
                    }
                }
            }
            return NextResponse.json({ metric, range, value });
        } catch (error) {
            console.error('[GET /api/admin/dashboard-stats metric]', error);
            return NextResponse.json({ error: 'Could not load stat.' }, { status: 500 });
        }
    }

    try {
        const [posts, users, roles, viewAgg] = await Promise.all([
            prisma.post.count({ where: { status: 'published' } }),  // published only — matches the card above
            prisma.user.count(),
            prisma.role.count(),
            prisma.post.aggregate({ _sum: { viewCount: true } }),
        ]);

        // ── Visitors (real, from the post_views event log) ───────────────────
        // Total visits all-time, visits in the last 30 days, and a 12-month
        // series to draw the trend chart. Wrapped defensively: if post_views
        // isn't migrated yet we still return the counters with an empty trend.
        const MONTHS = 12;
        const now = new Date();
        const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
        const seriesStart = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);
        const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let visitors = 0;
        let visitorsLastMonth = 0;
        let visitorSeries: { name: string; value: number }[] = [];
        try {
            const [total, lastMonth, monthly] = await Promise.all([
                prisma.postView.count(),
                prisma.postView.count({ where: { createdAt: { gte: last30 } } }),
                prisma.$queryRaw<{ ym: string; c: bigint }[]>`
                    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS c
                    FROM post_views
                    WHERE created_at >= ${seriesStart}
                    GROUP BY ym
                    ORDER BY ym ASC
                `,
            ]);
            visitors = total;
            visitorsLastMonth = lastMonth;

            const byMonth = new Map<string, number>();
            for (const r of monthly) byMonth.set(r.ym, Number(r.c));
            visitorSeries = Array.from({ length: MONTHS }, (_, i) => {
                const d = new Date(seriesStart.getFullYear(), seriesStart.getMonth() + i, 1);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return { name: MONTH_LABELS[d.getMonth()], value: byMonth.get(key) ?? 0 };
            });
            void monthStart; // (kept for clarity of intent)
        } catch (e) {
            console.warn('[dashboard-stats] post_views unavailable:', e);
            visitorSeries = MONTH_LABELS.slice(0, MONTHS).map((name) => ({ name, value: 0 }));
        }

        return NextResponse.json({
            posts,
            users,
            roles,
            views: viewAgg._sum.viewCount ?? 0,
            visitors,
            visitorsLastMonth,
            visitorSeries,
        });
    } catch (error) {
        console.error('[GET /api/admin/dashboard-stats]', error);
        return NextResponse.json({ error: 'Could not load dashboard stats.' }, { status: 500 });
    }
}
