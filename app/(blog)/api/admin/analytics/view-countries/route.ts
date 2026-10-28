// app/(blog)/api/admin/analytics/view-countries/route.ts
//
// Country breakdown of views, from Google Analytics 4.
//
// This used to read the site's own post_views table. That table only records
// POST pages and only carries a country for rows written after the column was
// added, so nearly two thirds of it reported as "Unknown". GA4 knows the
// country for essentially every hit, so it is the source now and post_views is
// only the fallback for when GA4 is unconfigured, erroring or over quota.
//
// The per-post slice — the one thing the DB could do and the site-wide GA4
// dashboard card could not — still works: GA4 is asked for the post's own
// pagePath, so "which countries read THIS post" is still answerable.
//
//   GET ?postId=58          -> countries for that post
//   GET                     -> countries across the whole site
//   GET ?ids=58,59,60       -> top country per post, for list columns
//
// Optional: &days=30 to window the result, &limit=6 to cap the rows.
// Every response carries `source` ('ga4' | 'db') so a caller knows which it got.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/rbac';
import { isGa4Configured, ga4CountryViews, ga4TopCountryByPath } from '@/lib/analytics/ga4';
import {
    getPostCountries,
    getSiteCountries,
    getTopCountryByPost,
    shapeCountryCounts,
} from '@/lib/analytics/viewCountries';

export const dynamic = 'force-dynamic';

const intOr = (raw: string | null, fallback?: number) => {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/**
 * A post's public path, '/<primary-category>/<slug>' — the exact shape GA4
 * records as pagePath. A post with no primary category has no canonical path,
 * so it is left out and that row falls through to the DB answer.
 */
async function pathsFor(ids: number[]): Promise<Map<number, string>> {
    const out = new Map<number, string>();
    if (!ids.length) return out;
    const rows = await prisma.post.findMany({
        where: { id: { in: ids } },
        select: { id: true, slug: true, primaryCategory: { select: { slug: true } } },
    });
    for (const r of rows) {
        if (r.slug && r.primaryCategory?.slug) out.set(r.id, `/${r.primaryCategory.slug}/${r.slug}`);
    }
    return out;
}

export async function GET(req: NextRequest) {
    const auth = await requirePermission('access-admin-panel');
    if (auth.error) return auth.error;

    const sp = req.nextUrl.searchParams;
    const days = intOr(sp.get('days'));
    const limit = intOr(sp.get('limit'));
    const ga4 = await isGa4Configured();

    // Batch mode: one query for a whole list page instead of one per row.
    const idsRaw = sp.get('ids');
    if (idsRaw) {
        const ids = idsRaw
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isInteger(n) && n > 0)
            .slice(0, 100); // a list page never shows more than this

        if (ga4) {
            try {
                const paths = await pathsFor(ids);
                const byPath = await ga4TopCountryByPath([...paths.values()], days);
                const top: Record<number, unknown> = {};
                for (const id of ids) {
                    const path = paths.get(id);
                    const hit = path ? byPath.get(path) : undefined;
                    // share is 0 by convention here: a single top entry has no
                    // meaningful share of a set it is the only member of.
                    top[id] = hit
                        ? { ...shapeCountryCounts([{ code: hit.code, views: hit.views }])[0], share: 0 }
                        : null;
                }
                return NextResponse.json({ top, source: 'ga4' });
            } catch (e) {
                console.warn('[view-countries] GA4 unavailable, DB fallback:', (e as any)?.message || e);
            }
        }

        const map = await getTopCountryByPost(ids);
        return NextResponse.json({
            top: Object.fromEntries([...map].map(([id, c]) => [id, c])),
            source: 'db',
        });
    }

    const postId = intOr(sp.get('postId'));

    if (ga4) {
        try {
            let pagePaths: string[] | undefined;
            if (postId) {
                const path = (await pathsFor([postId])).get(postId);
                // No canonical path means GA4 cannot be asked about this post at
                // all; throwing hands it to the DB answer below rather than
                // silently reporting the whole site's countries as the post's.
                if (!path) throw new Error(`post ${postId} has no public path`);
                pagePaths = [path];
            }
            const countries = shapeCountryCounts(await ga4CountryViews({ days, pagePaths }), limit);
            return NextResponse.json({
                scope: postId ? 'post' : 'site',
                postId: postId ?? null,
                days: days ?? null,
                total: countries.reduce((sum, c) => sum + c.views, 0),
                countries,
                source: 'ga4',
            });
        } catch (e) {
            console.warn('[view-countries] GA4 unavailable, DB fallback:', (e as any)?.message || e);
        }
    }

    const countries = postId
        ? await getPostCountries(postId, { limit, sinceDays: days })
        : await getSiteCountries({ limit, sinceDays: days });

    return NextResponse.json({
        scope: postId ? 'post' : 'site',
        postId: postId ?? null,
        days: days ?? null,
        total: countries.reduce((sum, c) => sum + c.views, 0),
        countries,
        source: 'db',
    });
}
