/**
 * proxy.ts — Next.js 16 middleware (default export required).
 *
 * TWO jobs, in order:
 *   1. MULTI-DOMAIN REWRITES — maps each domain to its internal site segment
 *      (ytdownloader domain → /yt/*) without changing the address bar.
 *      Config is env-driven, zero DB calls (runs on every request):
 *
 *        SITE_DOMAIN_MAP='{"mytubedownloader.com":"yt","inkdrop.blog":"blog"}'
 *        ADMIN_HOSTS='inkdrop.blog'   ← optional: lock /admin to one domain
 *
 *      On the YT domain, blog routes simply don't exist: every path is
 *      rewritten into /yt/*, so /posts/... 404s there (clean SEO separation).
 *
 *   2. ADMIN / API RBAC GATE — a valid session is not enough for /admin/*;
 *      the JWT must carry the 'access-admin-panel' permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { permForAdminPage } from '@/lib/adminAccess';
import { hasYtAccess } from '@/lib/yt/allowlist';

// ─────────────────────────────────────────────────────────────────────────────
// A. HOST → SITE MAP (env-driven; parsed once per process)
// ─────────────────────────────────────────────────────────────────────────────
interface SiteRoute {
    siteKey: string;
    prefix: '' | `/${string}`;
}

// Static registry of internal prefixes. Adding a future site = one line here
// + one folder under app/ + one SiteSetting row in Admin → Settings.
const SITE_ROUTES: Record<string, SiteRoute> = {
    blog: { siteKey: 'blog', prefix: '' },      // app/(blog)/…          (root)
    yt:   { siteKey: 'yt',   prefix: '/yt' },   // app/(yt-downloader)/yt/…
    tut:  { siteKey: 'tut',  prefix: '/tut' },  // app/(tutorials)/tut/…
};

// All non-empty internal prefixes — used to 404 direct hits in production.
const INTERNAL_PREFIXES = Object.values(SITE_ROUTES)
    .map((s) => s.prefix)
    .filter((p): p is `/${string}` => p !== '');

/** hostname → siteKey, e.g. { "mytubedownloader.com": "yt" }. Parsed once. */
const DOMAIN_MAP: Record<string, string> = (() => {
    try {
        return JSON.parse(process.env.SITE_DOMAIN_MAP ?? '{}');
    } catch {
        console.error('[proxy] SITE_DOMAIN_MAP is not valid JSON — all hosts fall back to default site');
        return {};
    }
})();

// Multi-domain mode is ON only when a map is configured. On localhost/dev
// (no map) everything behaves exactly as before: blog at root, /yt reachable
// directly for testing.
const MULTI_DOMAIN = Object.keys(DOMAIN_MAP).length > 0;

const DEFAULT_SITE_KEY = process.env.DEFAULT_SITE_KEY || 'blog';

const ADMIN_HOSTS: string[] = (process.env.ADMIN_HOSTS ?? '')
    .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);

/** Normalize "www.MyTube.com:3000" → "mytube.com". */
function normalizeHost(raw: string | null): string {
    if (!raw) return '';
    return raw.toLowerCase().split(':')[0].replace(/^www\./, '');
}

/** Resolve the SiteRoute for a request host. Unknown hosts (bare IP, preview
 *  URLs, localhost) fall back to the default site so dev keeps working. */
function resolveSite(host: string): SiteRoute {
    const key = DOMAIN_MAP[host] ?? DEFAULT_SITE_KEY;
    return SITE_ROUTES[key] ?? SITE_ROUTES.blog;
}

// ─────────────────────────────────────────────────────────────────────────────
// B. ADMIN / API RBAC GATE (unchanged semantics from the previous proxy.ts)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_ACCESS_PERMISSION = 'access-admin-panel';

// REST namespaces that are 100% admin-only with no public sub-routes.
// NOTE: /api/posts is intentionally NOT listed — it has public sub-routes.
const PROTECTED_API_PREFIXES = ['/api/users', '/api/roles', '/api/permissions'];

async function adminGate(req: NextRequest): Promise<NextResponse | null> {
    const { pathname } = req.nextUrl;

    // Public admin-adjacent routes — always pass.
    if (
        pathname.startsWith('/admin/login') ||
        pathname.startsWith('/admin/forgot-password') ||  // public: request reset
        pathname.startsWith('/admin/reset-password') ||   // public: set new password
        pathname.startsWith('/api/auth')                  // signOut hits /api/auth/signout
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
    // in depth + page-routing UX, not the only line of defense.
    const permissions = (token.permissions as string[] | undefined) ?? [];
    const roles = (token.roles as string[] | undefined) ?? [];
    const isSuperAdmin = roles.includes('administrator');
    if (!isSuperAdmin && !permissions.includes(ADMIN_ACCESS_PERMISSION)) {
        return isProtectedApi
            ? NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
            : NextResponse.redirect(new URL('/?denied=admin', req.url));
    }

    // ── Per-tab permission ────────────────────────────────────────────────
    // Block DIRECT access to an admin section the user can't view (e.g. typing
    // /admin/management/users without 'view-users'). The Sidebar hides the tab
    // too, but this is the real enforcement for hand-typed URLs. Administrators
    // hold every permission (seed.ts) so they reach everything.
    if (isAdminPage && !isSuperAdmin) {
        const needed = permForAdminPage(pathname);
        if (needed && !permissions.includes(needed)) {
            // Keep the user INSIDE the admin (on the always-reachable dashboard
            // landing) rather than bouncing them out to the public site.
            return NextResponse.redirect(new URL('/admin/dashboard?denied=1', req.url));
        }
    }

    return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────────────────────
// B2. YOUTUBE DOWNLOADER GATE — permission-gated, invisible to everyone else.
//
// Access is the 'use-yt-downloader' permission (lib/yt/allowlist.ts).
// Gating it here rather than only in the layout means an unauthorised request
// is answered before React renders anything, and one rule covers the pages, the
// yt domain and the download APIs alike.
//
// robots.txt is deliberately EXEMPT: a crawler must be able to read
// "Disallow: /" — 404ing it would leave Google guessing and crawling anyway.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Paths that must stay reachable even on the downloader's own domain, or the
 * gate becomes a lock with the key inside: you could never sign in to become
 * the allowed user, and a crawler could never read the "Disallow: /" that keeps
 * it away.
 */
function isYtGateExempt(pathname: string): boolean {
    return (
        pathname.endsWith('/robots.txt') ||
        pathname.startsWith('/api/auth') ||   // NextAuth sign-in / sign-out / session
        pathname.startsWith('/admin') ||      // admin has its own RBAC gate below
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname.startsWith('/_next')
    );
}

function isYtPath(pathname: string, siteKey: string): boolean {
    if (isYtGateExempt(pathname)) return false;
    if (siteKey === 'yt') return true;                       // the whole yt domain
    if (pathname === '/yt' || pathname.startsWith('/yt/')) return true;
    // The tool's own endpoints. /api/yt/cms-pages, /api/yt/analytics and
    // /api/yt/cookies are admin surfaces already guarded by their own
    // permission checks.
    return pathname.startsWith('/api/yt/info')
        || pathname.startsWith('/api/yt/download')
        || pathname.startsWith('/api/yt/diagnose');
}

async function ytGate(req: NextRequest, siteKey: string): Promise<NextResponse | null> {
    if (!isYtPath(req.nextUrl.pathname, siteKey)) return null;

    // Permissions and roles are baked into the JWT at sign-in (lib/auth.ts), so
    // this stays a pure token read — no database call on every request.
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (hasYtAccess(token?.permissions as string[] | undefined, token?.roles as string[] | undefined)) {
        return null;
    }

    return new NextResponse('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex, nofollow' },
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// C. THE PROXY PIPELINE
// ─────────────────────────────────────────────────────────────────────────────
export default async function proxy(req: NextRequest) {
    const url  = req.nextUrl;
    const { pathname } = url;

    // Static assets (matcher can't express this without lookbehind) — but
    // robots.txt and sitemap.xml MUST reach their per-site route handlers.
    if (
        /\.(png|jpe?g|gif|webp|avif|svg|ico|css|js|map|woff2?|ttf)$/i.test(pathname) ||
        pathname.startsWith('/_next') ||
        pathname.includes('favicon.ico')
    ) {
        return NextResponse.next();
    }

    const host = normalizeHost(req.headers.get('host'));
    const site = resolveSite(host);

    // 0) DOWNLOADER GATE — runs before everything else so an unauthorised
    //    request never reaches the rewrite, the admin gate or React.
    const ytVerdict = await ytGate(req, site.siteKey);
    if (ytVerdict) return ytVerdict;

    // 1) LEAK GUARD (production only) — internal prefixes must never be
    //    reachable directly: blogdomain.com/yt/about would serve downloader
    //    pages on the blog domain (duplicate content / SEO poisoning).
    //    In dev (no SITE_DOMAIN_MAP) /yt stays directly accessible.
    if (
        MULTI_DOMAIN &&
        INTERNAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ) {
        return NextResponse.rewrite(new URL('/404', req.url));
    }

    // 2) ADMIN + APIs — shared across every domain, served as-is (no rewrite).
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
        return NextResponse.next();
    }

    // 3) SITE REWRITE — ytdomain.com/about → internally /yt/about.
    //    Also stamp x-site-key so Server Components resolve the active site
    //    with a header read (lib/site-context.ts).
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
// D. MATCHER — multi-domain rewriting must see every page request (including
//    /robots.txt and /sitemap.xml); static files are early-returned above.
// ─────────────────────────────────────────────────────────────────────────────
export const config = {
    matcher: ['/((?!_next/static|_next/image).*)'],
};
