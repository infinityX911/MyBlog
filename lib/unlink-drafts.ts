// lib/unlink-drafts.ts
//
// Tutorial lessons link forward to the next lesson. That link gets written
// while the next lesson is still a draft, so publishing lesson N always
// shipped a 404 pointing at lesson N+1 — you could never publish one lesson
// at a time without breaking a link, and Google would crawl the broken one.
//
// This drops the anchor at render time and keeps the words. The moment the
// target post is published the link comes back on its own. Nothing to
// remember, nothing to edit twice.
//
// Deliberately narrow. It only judges two-segment post paths
// (/<category>/<slug>), because those are the only ones it can resolve with
// certainty from the posts table. Static routes, tag archives, CMS pages,
// external links and bare anchors are left exactly as written — silently
// unlinking a working link would be worse than leaving one dead one.

import { prisma } from '@/lib/prisma'

/** Matches a whole anchor and captures its href and its inner HTML. */
const ANCHOR = /<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

/** Two clean segments, nothing else. */
const POST_PATH = /^\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9-]*)\/?$/i

/**
 * First segments that are real app routes, not category silos. A link like
 * /tag/web-development is two segments but is never a post, so it must not be
 * looked up in the posts table and must never be unlinked.
 */
const NOT_A_CATEGORY = new Set([
    'tag', 'tags', 'category', 'categories', 'posts', 'post',
    'downloads', 'download', 'author', 'authors', 'members', 'member',
    'announcements', 'search', 'api', 'uploads', 'admin', 'yt',
    'login', 'signup', 'account', 'contact', '_next',
])

/**
 * Returns the post slug this href points at, or null if the href is anything
 * we cannot confidently resolve (external, anchor, mailto, static route, …).
 */
function postSlugFrom(href: string, origin?: string): string | null {
    if (!href) return null

    let path = href
    if (/^https?:\/\//i.test(href)) {
        // Absolute URL: only ours counts, and only when we know our own origin.
        if (!origin || !href.startsWith(origin)) return null
        path = href.slice(origin.length) || '/'
    } else if (!href.startsWith('/')) {
        // Relative, #fragment, mailto:, tel:, protocol-relative — not ours to judge.
        return null
    }

    path = path.split('#')[0].split('?')[0]
    const m = POST_PATH.exec(path)
    if (!m) return null
    if (NOT_A_CATEGORY.has(m[1].toLowerCase())) return null
    return m[2].toLowerCase()
}

/**
 * Strips links that point at posts which are missing or not published yet.
 * One database round-trip regardless of how many links the article has.
 */
export async function unlinkUnpublished(html: string, origin?: string): Promise<string> {
    if (!html || !html.includes('<a')) return html

    // Most internal links are written relative ("/web-development/php-basics"),
    // but an editor pasting from the address bar produces a full URL. Falling
    // back to the configured site URL means those get judged too, without
    // costing a settings lookup on every article render.
    const self = (origin || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')

    // Pass 1 — gather every candidate slug up front so this costs one query,
    // not one per link.
    const wanted = new Set<string>()
    for (const m of html.matchAll(ANCHOR)) {
        const slug = postSlugFrom(m[1], self)
        if (slug) wanted.add(slug)
    }
    if (wanted.size === 0) return html

    const live = await prisma.post.findMany({
        where: { slug: { in: [...wanted] }, status: 'published' },
        select: { slug: true },
    })
    const published = new Set(live.map((p) => p.slug.toLowerCase()))

    // Pass 2 — unwrap the ones that did not come back.
    return html.replace(ANCHOR, (whole, href: string, inner: string) => {
        const slug = postSlugFrom(href, self)
        if (slug === null || published.has(slug)) return whole
        return inner
    })
}
