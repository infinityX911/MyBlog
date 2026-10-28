/**
 * 01-proxy.ts  →  deploy as  proxy.ts  (project root, replacing the current file)
 *
 * Next.js 16 renamed middleware.ts → proxy.ts and requires a DEFAULT export —
 * your existing file already follows this; the logic below MERGES your existing
 * RBAC admin gate with the new multi-domain rewrite engine, in the right order.
 *
 * Design rules (why this stays fast at production traffic):
 *   1. ZERO database / fetch calls. Runs on every request; the host→site map is
 *      parsed ONCE at module scope from env. Site *content* config is loaded
 *      later, in Server Components, behind a tagged cache (lib/site-context.ts).
 *   2. Rewrites, never redirects. NextResponse.rewrite() changes which files
 *      serve the request WITHOUT touching the visible address bar.
 *   3. Route groups can't be rewrite targets (they don't exist in URL space),
 *      so each secondary site owns one real internal segment ("/yt"). The
 *      default site (blog) stays at root — zero churn for existing blog URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// ─────────────────────────────────────────────────────────────────────────────
// A. HOST → SITE MAP (env-driven; parsed once per process)
// ─────────────────────────────────────────────────────────────────────────────
// .env:
//   SITE_DOMAIN_MAP='{"blogdomain.com":"blog","ytdownloader.com":"yt"}'
//   ADMIN_HOSTS='blogdomain.com'            ← optional: lock /admin to one domain
//
// `siteKey` matches SiteSetting.siteKey in the DB (schema file 02).
// `prefix`  is the internal URL segment. '' = default site served at root.

interface SiteRoute {
    siteKey: string;
    prefix: '' | `/${string}`;
}

// Static registry of the internal prefixes each siteKey maps to. Adding a new
// site = add one line here + one folder under app/ + one SiteSetting row.
const SITE_ROUTES: Record<string, SiteRoute> = {
    blog: { siteKey: 'blog', prefix: '' },      // app/(blog)/…            (root)
    yt:   { siteKey: 'yt',   prefix: '/yt' },   // app/(yt-downloader)/yt/…
    // portfolio: { siteKey: 'portfolio', prefix: '/pf' },
};

// All non-empty internal prefixes — used to 404 direct hits (leak guard below).
const INTERNAL_PREFIXES = Object.values(SITE_ROUTES)
    .map((s) => s.prefix)
    .filter((p): p is `/${string}` => p !== '');

/** hostname → siteKey, e.g. { "ytdownloader.com": "yt" }. Parsed once. */
const DOMAIN_MAP: Record<string, string> = (() => {
    try {
        return JSON.parse(process.env.SITE_DOMAIN_MAP ?? '{}');
    } catch {
        console.error('[proxy] SITE_DOMAIN_MAP is not valid JSON — all hosts fall back to "blog"');
        return {};
    }
})();

const ADMIN_HOSTS: string[] = (process.env.ADMIN_HOSTS ?? '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

/** Normalize "www.YTdownloader.com:3000" → "ytdownloader.com". */
function normalizeHost(raw: string | null): string {
    if (!raw) return '';
    return raw.toLowerCase().split(':')[0].replace(/^www\./, '');
}

/** Resolve the SiteRoute for a request host. Unknown hosts (bare IP, preview
 *  URLs, localhost) fall back to the default site so dev keeps working. */
function resolveSite(host: string): SiteRoute {
    const key = DOMAIN_MAP[host] ?? 'blog';
    return SITE_ROUTES[key] ?? SITE_ROUTES.blog;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. ADMIN / API RBAC GATE  (your existing logic, verbatim semantics)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_ACCESS_PERMISSION = 'access-admin-panel';
const PROTECTED_API_PREFIXES = ['/api/users', '/api/roles', '/api/permissions'];

async function adminGate(req: NextRequest): Promise<NextResponse | null> {
    const { pathname } = req.nextUrl;

    // Public admin-adjacent routes — always pass.
    if (
        pathname.startsWith('/admin/login') ||
        pathname.startsWith('/admin/forgot-password') ||
        pathname.startsWith('/admin/reset-password') ||
        pathname.startsWith('/api/auth')
    ) return NextResponse.next();

    const isAdminPage    = pathname.startsWith('/admin');
    const isProtectedApi = PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isAdminPage && !isProtectedApi) return null; // not ours — continue pipeline

    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
        return isProtectedApi
            ? NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
            : NextResponse.redirect(new URL('/admin/login', req.url));
    }

    // Permissions are embedded in the JWT at sign-in (lib/auth.ts). Every
    // sensitive API route re-checks via lib/rbac.ts — this gate is defense
    // in depth + page routing UX, not the only line of defense.
    const permissions = (token.permissions as string[] | undefined) ?? [];
    if (!permissions.includes(ADMIN_ACCESS_PERMISSION)) {
        return isProtectedApi
            ? NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
            : NextResponse.redirect(new URL('/?denied=admin', req.url));
    }
    return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────────────────────
// C. THE PROXY PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export default async function proxy(req: NextRequest) {
    const url  = req.nextUrl;
    const host = normalizeHost(req.headers.get('host'));
    const { pathname } = url;
    const site = resolveSite(host);

    // 1) LEAK GUARD — internal prefixes must never be reachable directly.
    //    blogdomain.com/yt/about would otherwise serve the downloader's page
    //    on the blog domain (duplicate content + SEO poisoning). Only the host
    //    that OWNS a prefix may see it — and even then only via our rewrite,
    //    so a literal browser hit on ytdownloader.com/yt/... 404s too (it
    //    would double-prefix below and miss every route anyway; we make the
    //    intent explicit here).
    if (INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        return NextResponse.rewrite(new URL('/404', req.url)); // hard not-found
    }

    // 2) ADMIN + PROTECTED APIs — shared across every domain, served as-is at
    //    /admin (no rewrite: app/admin is a real root segment). Optionally
    //    restrict which domains expose the panel at all.
    if (pathname.startsWith('/admin') || pathname.startsWith('/api')) {
        if (
            pathname.startsWith('/admin') &&
            ADMIN_HOSTS.length > 0 &&
            !ADMIN_HOSTS.includes(host)
        ) {
            return NextResponse.rewrite(new URL('/404', req.url));
        }
        const verdict = await adminGate(req);
        if (verdict) return verdict;
        return NextResponse.next(); // unprotected API / permitted admin traffic
    }

    // 3) SITE REWRITE — the heart of multi-domain serving.
    //    ytdownloader.com/about  →  internally  /yt/about
    //    ytdownloader.com/       →  internally  /yt
    //    blogdomain.com/*        →  untouched (default site lives at root)
    //
    //    We also stamp x-site-key so Server Components resolve the active site
    //    with a header read instead of re-deriving it from Host (and so the
    //    resolution logic lives in exactly one place: this file).
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-site-key', site.siteKey);

    if (site.prefix) {
        const rewritten = url.clone();
        rewritten.pathname = `${site.prefix}${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
}

// ─────────────────────────────────────────────────────────────────────────────
// D. MATCHER — run on pages + the protected APIs, skip static machinery.
//    (Your old matcher only covered /admin + 3 APIs; multi-domain rewriting
//    requires seeing every page request, so we invert: match everything except
//    Next internals and files with an extension.)
// ─────────────────────────────────────────────────────────────────────────────
export const config = {
    matcher: [
        // Everything except: _next internals, static files (has a dot, e.g.
        // .png/.css — but robots.txt & sitemap.xml MUST still be matched so
        // per-domain rewriting reaches their route handlers).
        '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt$(?<!robots\\.txt)|xml$(?<!sitemap\\.xml))).*)',
    ],
};

/*
 * NOTE on the matcher regex: Next's matcher must be statically analyzable and
 * some regex engines used by the compiler dislike lookbehind. If your build
 * rejects the pattern above, use this simpler, equally correct alternative —
 * match everything except _next, then early-return inside proxy() for static
 * file extensions:
 *
 *   export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
 *
 *   // first line inside proxy():
 *   if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|map)$/i.test(pathname))
 *       return NextResponse.next();
 */
