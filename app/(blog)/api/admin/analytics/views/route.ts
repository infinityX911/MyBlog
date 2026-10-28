/**
 * app/api/admin/analytics/views/route.ts
 *
 * GET /api/admin/analytics/views?days=30
 *   → daily post-view totals for the admin dashboard graph.
 *   Requires the 'view-dashboard' permission. (proxy.ts does NOT cover
 *   /api/admin/analytics, so this in-handler gate is the only one.)
 *
 * Source: Google Analytics 4, so this graph agrees with what GA itself reports.
 * The post_views table is the fallback for when GA4 is not configured, errors,
 * or is over quota; if that is missing too, a zero-filled series with
 * unavailable:true keeps the dashboard rendering instead of erroring.
 * The response carries `source` so a caller can tell which one it got.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { isGa4Configured, ga4DailyViews } from '@/lib/analytics/ga4'

const DAY_MS = 24 * 60 * 60 * 1000

function zeroSeries(since: Date, days: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10),
    views: 0,
  }))
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission('view-dashboard')
  if (auth.error) return auth.error

  const raw = Number(req.nextUrl.searchParams.get('days') ?? 30)
  const days = Number.isFinite(raw) && raw > 0 && raw <= 365 ? Math.floor(raw) : 30

  const since = new Date(Date.now() - (days - 1) * DAY_MS)
  since.setHours(0, 0, 0, 0)

  // GA4 first: the admin should show the same numbers Google does, not our own
  // tally. post_views only ever counted POST pages, so it read far lower than
  // GA for the same window.
  if (await isGa4Configured()) {
    try {
      const byDay = await ga4DailyViews(days)
      const series = Array.from({ length: days }, (_, i) => {
        const key = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10)
        return { date: key, views: byDay.get(key) ?? 0 }
      })
      const total = series.reduce((a, b) => a + b.views, 0)
      return NextResponse.json({ days, total, series, source: 'ga4' })
    } catch (err) {
      console.warn('[GET /api/admin/analytics/views] GA4 unavailable, DB fallback:', err)
    }
  }

  try {
    // Parameterised aggregation (${since} is bound, not concatenated → no injection).
    const rows = await prisma.$queryRaw<{ day: Date; views: bigint }[]>`
      SELECT DATE(created_at) AS day, COUNT(*) AS views
      FROM post_views
      WHERE created_at >= ${since}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `

    const byDay = new Map<string, number>()
    for (const r of rows) {
      const d = r.day instanceof Date ? r.day : new Date(r.day)
      byDay.set(d.toISOString().slice(0, 10), Number(r.views))
    }

    const series = Array.from({ length: days }, (_, i) => {
      const key = new Date(since.getTime() + i * DAY_MS).toISOString().slice(0, 10)
      return { date: key, views: byDay.get(key) ?? 0 }
    })
    const total = series.reduce((a, b) => a + b.views, 0)

    return NextResponse.json({ days, total, series, source: 'db' })
  } catch (err) {
    // post_views not migrated yet (or DB error) → empty series, no crash.
    console.warn('[GET /api/admin/analytics/views] unavailable:', err)
    return NextResponse.json({ days, total: 0, series: zeroSeries(since, days), source: 'db', unavailable: true })
  }
}
