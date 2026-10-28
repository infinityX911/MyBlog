// app/api/post-view/[slug]/route.ts
// POST /api/post-view/<slug>  → counts a post view.
//
// - Increments the denormalized Post.viewCount (fast total for cards/totals).
// - Logs a PostView event row (time-series history for the admin graph).
//
// NOTE: lives under /api/post-view (NOT /api/posts/[slug]) on purpose —
// /api/posts already has an /[id] dynamic segment, and Next.js forbids two
// different slug names ([id] vs [slug]) at the same path level.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rateLimit'

/**
 * Visitor country, from the CDN edge — we never geolocate the IP ourselves and
 * never store it. Cloudflare sets CF-IPCountry on every proxied request; the
 * others are here so moving hosts doesn't silently blank the column.
 *
 * Cloudflare uses two non-country sentinels that must NOT be stored as if they
 * were places: "XX" (could not determine) and "T1" (Tor exit node). Both become
 * null, which reads correctly as "unknown" in the breakdowns.
 */
function readCountry(headers: Headers): string | null {
  const raw =
    headers.get('cf-ipcountry') ??
    headers.get('x-vercel-ip-country') ??
    headers.get('x-geo-country')
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return null
  if (code === 'XX' || code === 'T1') return null
  return code
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const ip = getClientIp(req.headers)

    // Light guard so the counter can't be trivially inflated by a script,
    // while still allowing normal re-reads/refreshes.
    const rl = rateLimit(`post-view:${ip}:${slug}`, 5, 10 * 60 * 1000)
    if (!rl.ok) {
      const current = await prisma.post.findUnique({ where: { slug }, select: { viewCount: true } })
      return NextResponse.json({ views: current?.viewCount ?? 0, throttled: true })
    }

    const ua = req.headers.get('user-agent') ?? ''
    const visitorHash = createHash('sha256').update(`${ip}|${ua}`).digest('hex').slice(0, 64)

    const found = await prisma.post.findUnique({ where: { slug }, select: { id: true, viewCount: true } })
    if (!found) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    // One view per visitor per post per day. The hash was already being stored
    // and simply never consulted, so a refresh — or an author re-reading their
    // own draft — counted every single time. That made the number describe page
    // loads, not readers, which is not what anyone reads it as.
    //
    // Failing open matters here: if post_views hasn't been migrated yet this
    // throws, and a view that can't be de-duplicated is still better counted
    // than dropped.
    let alreadySeen = false
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      alreadySeen = !!(await prisma.postView.findFirst({
        where: { postId: found.id, visitorHash, createdAt: { gte: since } },
        select: { id: true },
      }))
    } catch {
      /* post_views table not migrated yet — fall through and count it */
    }

    if (alreadySeen) {
      return NextResponse.json({ views: found.viewCount, counted: false })
    }

    const post = await prisma.post.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
      select: { id: true, viewCount: true },
    })

    // Log the event for time-series analytics. Non-fatal: if the post_views
    // table hasn't been migrated yet, the counter above still works.
    try {
      await prisma.postView.create({
        data: { postId: post.id, visitorHash, country: readCountry(req.headers) },
      })
    } catch {
      /* post_views table not migrated yet — ignore */
    }

    return NextResponse.json({ views: post.viewCount, counted: true })
  } catch {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
}
