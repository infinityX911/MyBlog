/**
 * app/api/admin/analytics/visitors/route.ts
 *
 * GET /api/admin/analytics/visitors?range=day|week|month|year
 *   → visitor (post_views) trend for the dashboard "Visitors" card, at the
 *     granularity that matches the selected range:
 *       day   → last 24 hours, hourly
 *       week  → last 7 days,   daily
 *       month → last 30 days,  daily
 *       year  → last 12 months, monthly
 *   Returns: { range, total, series: [{ name, value }] }
 *
 * Requires 'view-dashboard'. If post_views isn't available, returns a
 * zero-filled series so the chart still renders.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { isGa4Configured, ga4VisitorsSeries } from '@/lib/analytics/ga4';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

type Range = 'day' | 'week' | 'month' | 'year';
interface Bucket { key: string; name: string }

/** Build the ordered, empty buckets + the SQL grouping format for a range. */
function plan(range: Range): { since: Date; fmt: string; buckets: Bucket[] } {
    const now = new Date();

    if (range === 'day') {
        const since = new Date(now.getTime() - 23 * 3600 * 1000);
        since.setMinutes(0, 0, 0);
        const buckets: Bucket[] = [];
        for (let i = 0; i < 24; i++) {
            const d = new Date(since.getTime() + i * 3600 * 1000);
            buckets.push({
                key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}`,
                name: `${((d.getHours() % 12) || 12)}${d.getHours() < 12 ? 'am' : 'pm'}`,
            });
        }
        return { since, fmt: '%Y-%m-%d %H', buckets };
    }

    if (range === 'week' || range === 'month') {
        const days = range === 'week' ? 7 : 30;
        const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
        const buckets: Bucket[] = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(since.getFullYear(), since.getMonth(), since.getDate() + i);
            buckets.push({
                key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                name: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
            });
        }
        return { since, fmt: '%Y-%m-%d', buckets };
    }

    // year → last 12 months, monthly
    const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const buckets: Bucket[] = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
        buckets.push({ key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, name: MONTHS[d.getMonth()] });
    }
    return { since, fmt: '%Y-%m', buckets };
}

export async function GET(req: NextRequest) {
    const auth = await requirePermission('view-dashboard');
    if (auth.error) return auth.error;

    const raw = (req.nextUrl.searchParams.get('range') || 'year').toLowerCase();
    const range: Range = (['day', 'week', 'month', 'year'] as const).includes(raw as Range) ? (raw as Range) : 'year';

    const { since, fmt, buckets } = plan(range);

    // Prefer REAL Google Analytics data when a service account is configured.
    // On any GA4 error (not set up yet, no data, quota) we silently fall back to
    // the DB series below — so the chart never breaks.
    if (await isGa4Configured()) {
        try {
            const { total, series } = await ga4VisitorsSeries(range);
            return NextResponse.json({ range, total, series, source: 'ga4' });
        } catch (e) {
            console.warn('[visitors] GA4 unavailable, using DB fallback:', (e as any)?.message || e);
        }
    }

    try {
        // Both fmt and since are bound parameters (no string concatenation).
        const rows = await prisma.$queryRaw<{ k: string; c: bigint }[]>`
            SELECT DATE_FORMAT(created_at, ${fmt}) AS k, COUNT(*) AS c
            FROM post_views
            WHERE created_at >= ${since}
            GROUP BY k
        `;

        const byKey = new Map<string, number>();
        for (const r of rows) byKey.set(r.k, Number(r.c));

        const series = buckets.map(b => ({ name: b.name, value: byKey.get(b.key) ?? 0 }));
        const total = series.reduce((a, b) => a + b.value, 0);

        return NextResponse.json({ range, total, series });
    } catch (e) {
        console.warn('[GET /api/admin/analytics/visitors] unavailable:', e);
        return NextResponse.json({ range, total: 0, series: buckets.map(b => ({ name: b.name, value: 0 })), unavailable: true });
    }
}
