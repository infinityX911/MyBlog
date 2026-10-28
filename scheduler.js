// scheduler.js
//
// Scheduled publishing. Runs INSIDE the custom server (server.js), so there is
// nothing to install on the VPS — no crontab, no extra container, no secret
// endpoint someone could hit.
//
// Every tick it asks each publishable table "which rows are due?" and flips
// them to `published`. Because the row genuinely becomes published, everything
// downstream — the blog feed, the sitemap, RSS, tutorial lookups, search — just
// works with no changes: they all already filter on status = 'published'.
// Until its moment arrives a scheduled row is invisible to the public for the
// same reason, so nothing can leak early.
//
// Timezone: Prisma stores DateTime as UTC in DATETIME(3) columns, so this pool
// is opened with `timezone: 'Z'` and compares against UTC_TIMESTAMP(3). Using
// the connection's local timezone here would silently publish hours early or
// late depending on how the container clock is set.

import mysql from 'mysql2/promise';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '98c5305ed4af9b42ccc6f4d518cc7e63';

function makePool() {
    return mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'api',
        connectionLimit: 2,
        waitForConnections: true,
        timezone: 'Z',
    });
}

/** Public base URL for the blog, from the admin settings row. */
async function getBlogBaseUrl(pool) {
    try {
        const [rows] = await pool.query(
            `SELECT website_url FROM site_settings WHERE site_key = 'blog' LIMIT 1`
        );
        const raw = (rows?.[0]?.website_url || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
        if (!raw) return null;
        const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        return withScheme.replace(/\/$/, '');
    } catch {
        return null;
    }
}

/**
 * Tell Bing/Yandex the URLs that just went live. Fire-and-forget.
 *
 * This already sends one batch per pass, so it does not suffer the
 * rapid-repeat-submission problem that lib/indexnow.ts had to be fixed for.
 * It does now check the response: a rejected batch used to look exactly like a
 * successful one, which is why a silent drop went unnoticed for a whole day.
 */
async function pingIndexNow(base, paths) {
    if (!base || !paths.length || !INDEXNOW_KEY) return;
    try {
        const urlList = [...new Set(paths.map((p) => `${base}${p.startsWith('/') ? '' : '/'}${p}`))];
        const res = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host: new URL(base).host,
                key: INDEXNOW_KEY,
                keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
                urlList,
            }),
        });
        if (!res.ok) {
            console.error(`[scheduler] IndexNow rejected: HTTP ${res.status} for ${urlList.length} URL(s)`, urlList);
        } else {
            console.log(`[scheduler] IndexNow submitted ${urlList.length} URL(s)`);
        }
    } catch (e) {
        console.error('[scheduler] IndexNow ping failed:', e?.message || e);
    }
}

/**
 * One pass. Returns the paths that went live, so the caller can log/ping.
 * published_at is set to the SCHEDULED time, not "now" — the post should be
 * dated when the author said it would appear, not whenever the loop happened
 * to run.
 */
async function publishDue(pool) {
    const paths = [];

    // ── Posts ────────────────────────────────────────────────────────────────
    // The public URL is /<primary category>/<slug>, falling back to the first
    // attached category, then "uncategorized" — the same rule the sitemap uses.
    const [posts] = await pool.query(
        `SELECT p.id, p.slug,
                COALESCE(pc.slug, anycat.slug, 'uncategorized') AS cat
           FROM posts p
           LEFT JOIN categories pc ON pc.id = p.primary_category_id
           LEFT JOIN (
                -- MIN() rather than a bare column so this still runs under
                -- ONLY_FULL_GROUP_BY, and so the pick is deterministic.
                SELECT pcat.post_id, MIN(c.slug) AS slug
                  FROM post_categories pcat
                  JOIN categories c ON c.id = pcat.category_id
                 GROUP BY pcat.post_id
           ) anycat ON anycat.post_id = p.id
          WHERE p.status = 'scheduled'
            AND p.scheduled_at IS NOT NULL
            AND p.scheduled_at <= UTC_TIMESTAMP(3)`
    );
    if (posts.length) {
        const ids = posts.map((r) => r.id);
        await pool.query(
            `UPDATE posts
                SET status = 'published',
                    published_at = COALESCE(published_at, scheduled_at),
                    scheduled_at = NULL
              WHERE id IN (?) AND status = 'scheduled'`,
            [ids]
        );
        // The archive lists this post, so it changed too. Matches what the
        // posts API route pings on a manual publish — a scheduled post and a
        // hand-published one should look identical to Bing.
        for (const r of posts) paths.push(`/${r.cat}/${r.slug}`, `/tag/${r.cat}`);
    }

    // ── CMS pages ────────────────────────────────────────────────────────────
    // Only the blog site is pinged: the yt site serves its pages on a different
    // origin, so its URLs can't be built from this base.
    const [pages] = await pool.query(
        `SELECT id, slug, site_key FROM cms_pages
          WHERE status = 'scheduled'
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= UTC_TIMESTAMP(3)`
    );
    if (pages.length) {
        await pool.query(
            `UPDATE cms_pages
                SET status = 'published',
                    published_at = COALESCE(published_at, scheduled_at),
                    scheduled_at = NULL
              WHERE id IN (?) AND status = 'scheduled'`,
            [pages.map((r) => r.id)]
        );
        for (const r of pages) if (r.site_key === 'blog') paths.push(`/${r.slug}`);
    }

    // ── Downloads ────────────────────────────────────────────────────────────
    const [downloads] = await pool.query(
        `SELECT id, slug FROM downloads
          WHERE status = 'scheduled'
            AND scheduled_at IS NOT NULL
            AND scheduled_at <= UTC_TIMESTAMP(3)`
    );
    if (downloads.length) {
        await pool.query(
            `UPDATE downloads
                SET status = 'published',
                    published_at = COALESCE(published_at, scheduled_at),
                    scheduled_at = NULL
              WHERE id IN (?) AND status = 'scheduled'`,
            [downloads.map((r) => r.id)]
        );
        for (const r of downloads) paths.push(`/downloads/${r.slug}`);
    }

    return paths;
}

/**
 * Start the loop. `intervalMs` defaults to a minute — fine granularity for a
 * blog, and cheap: the due-rows query is an index lookup that returns nothing
 * almost every time.
 *
 * The first pass runs shortly after boot so anything that came due while the
 * container was down (a deploy, a restart) goes live immediately instead of
 * waiting for the next tick.
 */
export function startScheduledPublisher({ intervalMs = 60_000, firstRunDelayMs = 10_000 } = {}) {
    const pool = makePool();
    let running = false;

    const tick = async () => {
        if (running) return;          // never let two passes overlap
        running = true;
        try {
            const paths = await publishDue(pool);
            if (paths.length) {
                console.log(`[scheduler] published ${paths.length}: ${paths.join(', ')}`);
                const base = await getBlogBaseUrl(pool);
                // '/' and the sitemap always change when something goes live,
                // and the API routes already include them; pingIndexNow dedupes.
                await pingIndexNow(base, ['/', '/sitemap.xml', ...paths]);
            }
        } catch (e) {
            // Never crash the server over a scheduling hiccup — try again next tick.
            console.error('[scheduler] pass failed:', e?.message || e);
        } finally {
            running = false;
        }
    };

    setTimeout(tick, firstRunDelayMs);
    const timer = setInterval(tick, intervalMs);
    timer.unref?.();               // don't hold the process open on shutdown
    console.log(`> Scheduled publisher running (every ${Math.round(intervalMs / 1000)}s)`);
    return () => clearInterval(timer);
}
