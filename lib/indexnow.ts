// lib/indexnow.ts
// IndexNow: instantly notify Bing / Yandex / Seznam (and any IndexNow-enabled
// engine) when a URL is published or updated, instead of waiting for the next
// crawl. Fire-and-forget — never blocks the API response.
//
// Setup: the key below is also served as a plain-text file at
//   https://<host>/<KEY>.txt   (public/<KEY>.txt)
// which is how the engines verify we own the key. The key is NOT secret.
//
// WHY THE QUEUE (added 26 Aug 2026):
// Three posts were published inside ~900ms of each other. Each publish fired
// its own POST, and Bing recorded only the FIRST one — the other two never
// appeared in the IndexNow log and had to be submitted by hand. Rapid repeat
// submissions from one host get dropped.
//
// So calls are now coalesced: URLs accumulate for a few seconds and go out as
// a single POST. A batch publish becomes one submission containing everything,
// which is also what the IndexNow spec actually asks for.
import 'server-only';
import { getSiteUrl } from '@/lib/siteSettings';

// Public IndexNow key (matches public/98c5305ed4af9b42ccc6f4d518cc7e63.txt). Overridable via env.
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '98c5305ed4af9b42ccc6f4d518cc7e63';

// How long to gather URLs before submitting. Long enough to absorb a
// publish-several-at-once burst, short enough that a lone publish is still
// reported promptly.
const FLUSH_DELAY_MS = 5_000;

// Measured from the FIRST queued URL and never reset, so a steady trickle of
// saves can't postpone the submission indefinitely.
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush(): Promise<void> {
    flushTimer = null;
    const urlList = Array.from(pending);
    pending.clear();
    if (!urlList.length) return;

    try {
        const host = new URL(urlList[0]).host;
        const base = `${new URL(urlList[0]).protocol}//${host}`;
        const res = await fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host,
                key: INDEXNOW_KEY,
                keyLocation: `${base}/${INDEXNOW_KEY}.txt`,
                urlList,
            }),
        });
        // The old version ignored the response entirely, so a rejected batch
        // looked identical to a successful one. 200 and 202 both mean accepted.
        if (!res.ok) {
            console.error(
                `[indexnow] submission rejected: HTTP ${res.status} for ${urlList.length} URL(s)`,
                urlList,
            );
        } else {
            console.log(`[indexnow] submitted ${urlList.length} URL(s)`);
        }
    } catch (e) {
        console.error('[indexnow] ping failed:', e);
    }
}

/**
 * Queue one or more changed URLs for IndexNow. Accepts absolute URLs or paths
 * (paths are resolved against the configured public site URL).
 *
 * Returns as soon as the URLs are queued — the network call happens a few
 * seconds later, batched with anything else queued in the meantime.
 */
export async function pingIndexNow(pathsOrUrls: string[]): Promise<void> {
    try {
        if (!INDEXNOW_KEY || !pathsOrUrls?.length) return;
        const base = await getSiteUrl();

        for (const p of pathsOrUrls) {
            if (!p) continue;
            pending.add(
                /^https?:\/\//i.test(p) ? p : `${base}${p.startsWith('/') ? '' : '/'}${p}`,
            );
        }
        if (!pending.size) return;

        if (!flushTimer) {
            flushTimer = setTimeout(() => void flush(), FLUSH_DELAY_MS);
            // Don't hold the process open just for a pending ping.
            if (typeof (flushTimer as any).unref === 'function') (flushTimer as any).unref();
        }
    } catch (e) {
        console.error('[indexnow] queueing failed:', e);
    }
}

/**
 * Submit anything still queued right now instead of waiting for the timer.
 * Useful on shutdown, or from a script that exits immediately after publishing.
 */
export async function flushIndexNow(): Promise<void> {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await flush();
}
