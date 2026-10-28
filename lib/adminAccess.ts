/**
 * lib/adminAccess.ts — the SINGLE source of truth for "which permission does
 * this admin route / tab require".
 *
 * Client-safe (no prisma / node imports) so BOTH the middleware (proxy.ts, for
 * blocking page + API access) AND the client Sidebar (for hiding tabs) import
 * the same map — they can never drift apart.
 *
 * Model: pages are gated by a VIEW permission (can you open this section at
 * all). Individual create/update/delete actions are additionally gated inside
 * each API handler by the specific CRUD permission (view-* / create-* / …).
 *
 * The Administrator role holds every permission (seed.ts), so admins see and
 * reach everything. Other roles only get what's granted to them.
 */

export interface AdminNavPerm {
    /** URL prefix this rule matches (longest match wins). */
    prefix: string;
    /** Permission slug required to VIEW/open it. */
    perm: string;
}

// ── Page routes → required view permission (ORDER: most specific first) ───────
export const ADMIN_PAGE_PERMS: AdminNavPerm[] = [
    // NOTE: /admin/dashboard is intentionally NOT gated here — it is the admin
    // LANDING page, reachable by anyone who holds 'access-admin-panel'. Its
    // sensitive analytics DATA is still gated at /api/admin/analytics
    // ('view-dashboard'), so a user without that perm sees an empty dashboard,
    // not the numbers. Gating the page too would bounce every admin-access user
    // who lacks 'view-dashboard' straight back out of the panel.

    { prefix: '/admin/management/permissions', perm: 'view-permissions' },
    { prefix: '/admin/management/roles', perm: 'view-roles' },
    { prefix: '/admin/management/users', perm: 'view-users' },
    { prefix: '/admin/management/notification-icons', perm: 'manage-notifications' },
    { prefix: '/admin/management/redirects', perm: 'manage-settings' },
    { prefix: '/admin/management/media', perm: 'view-media' },

    // Portfolio project
    { prefix: '/admin/myprojects/portfolio/navbar', perm: 'view-navbar' },
    { prefix: '/admin/myprojects/portfolio/headers', perm: 'view-header' },
    { prefix: '/admin/myprojects/portfolio/projects', perm: 'view-projects' },
    { prefix: '/admin/myprojects/portfolio/testimonials', perm: 'view-testimonials' },
    { prefix: '/admin/myprojects/portfolio/contactus', perm: 'view-contactus' },
    { prefix: '/admin/myprojects/portfolio/footer', perm: 'manage-footer' },

    // Blog project
    { prefix: '/admin/myprojects/blog/navbar', perm: 'view-navbar' },
    { prefix: '/admin/myprojects/blog/pages', perm: 'view-pages' },
    { prefix: '/admin/myprojects/blog/youtube', perm: 'view-youtube-channels' },
    { prefix: '/admin/myprojects/blog/footer', perm: 'manage-footer' },
    { prefix: '/admin/myprojects/blog/ads', perm: 'access-admin-panel' },
    { prefix: '/admin/myprojects/blog/integrations', perm: 'access-admin-panel' },
    { prefix: '/admin/myprojects/blog/categories', perm: 'view-categories' },
    { prefix: '/admin/myprojects/blog/comments', perm: 'view-comments' },
    { prefix: '/admin/myprojects/blog', perm: 'view-posts' }, // posts list/create (least specific blog)

    // Downloads + YT downloader
    { prefix: '/admin/myprojects/downloads', perm: 'manage-downloads' },
    { prefix: '/admin/myprojects/yt-downloader', perm: 'manage-yt-downloader' },

    // Top-level
    { prefix: '/admin/orders', perm: 'view-orders' },
    { prefix: '/admin/conversations', perm: 'oversee-messages' }, // read-only message oversight
    { prefix: '/admin/messages', perm: 'view-messages' },
    { prefix: '/admin/notifications', perm: 'view-notifications' },
    { prefix: '/admin/announcements', perm: 'manage-announcements' }, // announcement composer
    { prefix: '/admin/settings', perm: 'manage-settings' },
];

// ── Admin API routes → required permission (for GET/view; mutations still
//    re-checked per-method inside handlers). ORDER: most specific first. ──────
export const ADMIN_API_PERMS: AdminNavPerm[] = [
    { prefix: '/api/admin/analytics', perm: 'view-dashboard' },
    { prefix: '/api/admin/notifications', perm: 'view-admin-notifications' },
    { prefix: '/api/admin/support', perm: 'manage-support' },
    { prefix: '/api/admin/comments', perm: 'view-comments' },
    { prefix: '/api/permissions', perm: 'view-permissions' },
    { prefix: '/api/roles', perm: 'view-roles' },
    { prefix: '/api/users', perm: 'view-users' },
    { prefix: '/api/settings', perm: 'manage-settings' },
    { prefix: '/api/redirects', perm: 'manage-settings' },
    { prefix: '/api/blog/footer', perm: 'manage-footer' },
    { prefix: '/api/blog/ads', perm: 'access-admin-panel' },
    { prefix: '/api/blog/integrations', perm: 'access-admin-panel' },
    { prefix: '/api/blog/cms-pages', perm: 'view-pages' },
    { prefix: '/api/youtube-channels', perm: 'view-youtube-channels' },
    { prefix: '/api/yt/cms-pages', perm: 'manage-yt-downloader' },
    { prefix: '/api/activities', perm: 'view-activities' },
];

/** Longest-prefix match → the permission a path requires, or null if unmapped. */
function lookup(list: AdminNavPerm[], pathname: string): string | null {
    let best: AdminNavPerm | null = null;
    for (const r of list) {
        if (pathname === r.prefix || pathname.startsWith(r.prefix + '/')) {
            if (!best || r.prefix.length > best.prefix.length) best = r;
        }
    }
    return best ? best.perm : null;
}

export function permForAdminPage(pathname: string): string | null {
    return lookup(ADMIN_PAGE_PERMS, pathname);
}
export function permForAdminApi(pathname: string): string | null {
    return lookup(ADMIN_API_PERMS, pathname);
}

/** Does this user (by permission slugs) have access to a given path? */
export function canAccess(perm: string | null, userPerms: string[]): boolean {
    if (!perm) return true; // unmapped → not restricted here (handler may still gate)
    return userPerms.includes(perm);
}
