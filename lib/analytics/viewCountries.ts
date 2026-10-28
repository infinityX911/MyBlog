// lib/analytics/viewCountries.ts
//
// Country breakdowns built from the site's OWN post_views rows — not GA4.
//
// Why this exists: the admin dashboard already shows a country split, but it
// comes from GA4, it is site-wide, and it cannot be broken down per post. This
// module answers "which countries read THIS post", which nothing could before.
//
// The only location data involved is PostView.country, a 2-letter ISO code set
// from the CDN edge header. The raw IP is hashed for de-duplication at write
// time and never stored, so nothing here can identify a reader.
//
// Rows written before the column existed have country = null. They are reported
// as an explicit "Unknown" bucket rather than dropped: hiding them would make
// the percentages lie about how much is actually known.

import 'server-only'
import { prisma } from '@/lib/prisma'

export interface CountryCount {
    /** ISO 3166-1 alpha-2, or null for views recorded without a country. */
    code: string | null
    /** Display name, or "Unknown" when code is null. */
    name: string
    /**
     * flagcdn.com image URL, or null for the unknown bucket. Deliberately NOT
     * a regional-indicator emoji: those render as bare letters on Windows,
     * which is why DashboardInsights already uses flagcdn images. Consumers
     * should hide the <img> on error rather than show a broken icon.
     */
    flagUrl: string | null
    views: number
    /** Share of the total in this result set, 0–100, one decimal. */
    share: number
}

const REGION_NAMES =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : null

/** "PK" → flagcdn image URL. Same source the GA4 country card already uses. */
function flagOf(code: string): string | null {
    if (!/^[A-Z]{2}$/.test(code)) return null
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}

function nameOf(code: string): string {
    try {
        return REGION_NAMES?.of(code) || code
    } catch {
        return code
    }
}

function shape(rows: { country: string | null; count: number }[], limit?: number): CountryCount[] {
    const total = rows.reduce((sum, r) => sum + r.count, 0)
    const mapped = rows
        .map(
            (r): CountryCount => ({
                code: r.country,
                name: r.country ? nameOf(r.country) : 'Unknown',
                flagUrl: r.country ? flagOf(r.country) : null,
                views: r.count,
                // Guard the divide: an empty result set must not produce NaN.
                share: total ? Math.round((r.count / total) * 1000) / 10 : 0,
            }),
        )
        // Highest first; the unknown bucket sorts by size like any other so it
        // is visible when it is large and out of the way when it is small.
        .sort((a, b) => b.views - a.views)
    return limit ? mapped.slice(0, limit) : mapped
}

/**
 * Format raw {code, views} pairs — from GA4, or anywhere else — into the same
 * CountryCount rows the DB path returns, so a consumer cannot tell which
 * source it got and the flag/name/share logic lives in exactly one place.
 */
export function shapeCountryCounts(
    rows: { code: string | null; views: number }[],
    limit?: number,
): CountryCount[] {
    return shape(rows.map((r) => ({ country: r.code, count: r.views })), limit)
}

/** Countries for ONE post. Pass `sinceDays` to window it. */
export async function getPostCountries(
    postId: number,
    { limit, sinceDays }: { limit?: number; sinceDays?: number } = {},
): Promise<CountryCount[]> {
    try {
        // _count._all, not _count.country: the latter counts non-null values,
        // so the "Unknown" bucket would always report 0.
        const grouped = await prisma.postView.groupBy({
            by: ['country'],
            where: {
                postId,
                ...(sinceDays
                    ? { createdAt: { gte: new Date(Date.now() - sinceDays * 86_400_000) } }
                    : {}),
            },
            _count: { _all: true },
        })
        return shape(
            grouped.map((g) => ({ country: g.country, count: g._count._all })),
            limit,
        )
    } catch {
        // post_views may not have the column yet on an un-migrated database.
        // A breakdown is a nice-to-have; it must never 500 an admin page.
        return []
    }
}

/** Countries across every post. */
export async function getSiteCountries(
    { limit, sinceDays }: { limit?: number; sinceDays?: number } = {},
): Promise<CountryCount[]> {
    try {
        const where = sinceDays
            ? { createdAt: { gte: new Date(Date.now() - sinceDays * 86_400_000) } }
            : {}
        const grouped = await prisma.postView.groupBy({
            by: ['country'],
            where,
            _count: { _all: true },
        })
        return shape(
            grouped.map((g) => ({ country: g.country, count: g._count._all })),
            limit,
        )
    } catch {
        return []
    }
}

/**
 * Top country per post, for the posts-list column. One grouped query for every
 * post rather than N queries — the list renders 10–30 rows at a time.
 */
export async function getTopCountryByPost(
    postIds: number[],
): Promise<Map<number, CountryCount | null>> {
    const out = new Map<number, CountryCount | null>()
    postIds.forEach((id) => out.set(id, null))
    if (!postIds.length) return out

    try {
        const grouped = await prisma.postView.groupBy({
            by: ['postId', 'country'],
            where: { postId: { in: postIds }, country: { not: null } },
            _count: { _all: true },
        })

        const best = new Map<number, { country: string; count: number }>()
        for (const g of grouped) {
            if (!g.country) continue
            const current = best.get(g.postId)
            if (!current || g._count._all > current.count) {
                best.set(g.postId, { country: g.country, count: g._count._all })
            }
        }

        for (const [postId, { country, count }] of best) {
            out.set(postId, {
                code: country,
                name: nameOf(country),
                flagUrl: flagOf(country),
                views: count,
                share: 0, // not meaningful for a single top entry
            })
        }
        return out
    } catch {
        return out
    }
}
