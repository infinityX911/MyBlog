/**
 * 04-lib-reserved-slugs.ts  →  deploy as  lib/reserved-slugs.ts
 *
 * CONFLICT-PREVENTION SYSTEM for CMS catch-all pages vs system paths.
 *
 * Two mechanisms cooperate:
 *
 *   1. ROUTER PRECEDENCE (free, built into Next.js): static segments ALWAYS
 *      beat dynamic ones. If app/(yt-downloader)/yt/tool/page.tsx exists, a
 *      CMS page slugged "tool" can never shadow it — the static route wins.
 *      So real application screens are inherently safe.
 *
 *   2. WRITE-TIME VALIDATION (this file): what the router can't protect is
 *      cross-cutting infrastructure (/admin, /api, /sitemap.xml…) and
 *      first-segment collisions with OTHER sites' internal prefixes. We refuse
 *      to persist such slugs, so the conflict is impossible instead of merely
 *      unrendered. Enforce in the CMS create/update API (file 09) — never
 *      client-side only.
 */

/** First path segments that CMS slugs may never claim, on any site. */
const RESERVED_FIRST_SEGMENTS = new Set<string>([
    // infrastructure
    'admin', 'api', '_next', 'static', 'public',
    // SEO endpoints (route handlers, files 06/07)
    'sitemap.xml', 'robots.txt', 'feed.xml', 'favicon.ico', 'manifest.json',
    // internal site prefixes from proxy.ts SITE_ROUTES — a CMS page named "yt"
    // would collide with the downloader's whole internal namespace
    'yt',
    // auth surfaces shared by the blog shell
    'login', 'signup', 'account', 'verify-email',
    // existing blog system routes (protect the default site's namespace)
    'posts', 'tag', 'u', 'downloads', 'contact', 'messages', 'notifications',
]);

/** Per-segment shape: lowercase kebab words, no dots/underscores/spaces.
 *  Mirrors the "clean URL slug" SEO check in lib/seo/scoring.ts. */
const SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SlugVerdict {
    ok: boolean;
    /** Machine-readable reason — map to a friendly message in the admin UI. */
    reason?: 'empty' | 'reserved' | 'bad-format' | 'too-long' | 'too-deep';
    offendingSegment?: string;
}

/**
 * Validate a CMS page slug BEFORE persisting.
 * Accepts nested slugs ("legal/privacy"); leading/trailing slashes are the
 * caller's normalization job (file 09 normalizes then validates).
 */
export function validateCmsSlug(slug: string): SlugVerdict {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return { ok: false, reason: 'empty' };
    if (trimmed.length > 191) return { ok: false, reason: 'too-long' }; // matches VarChar(191)

    const segments = trimmed.split('/').filter(Boolean);
    if (segments.length === 0) return { ok: false, reason: 'empty' };
    if (segments.length > 3)  return { ok: false, reason: 'too-deep' }; // sane URL depth

    // Only the FIRST segment can collide with system namespaces — /admin-tips
    // is fine, /admin/tips is not.
    if (RESERVED_FIRST_SEGMENTS.has(segments[0]))
        return { ok: false, reason: 'reserved', offendingSegment: segments[0] };

    for (const seg of segments) {
        if (!SEGMENT_RE.test(seg))
            return { ok: false, reason: 'bad-format', offendingSegment: seg };
    }
    return { ok: true };
}

/** Normalize raw admin input → canonical stored form ("About Us/" → "about-us"). */
export function normalizeCmsSlug(input: string): string {
    return input
        .trim().toLowerCase()
        .replace(/^\/+|\/+$/g, '')       // strip surrounding slashes
        .split('/')
        .map((seg) => seg
            .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/-+/g, '-'))
        .filter(Boolean)
        .join('/');
}
