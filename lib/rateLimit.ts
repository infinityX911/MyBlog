/**
 * lib/rateLimit.ts
 *
 * Lightweight in-memory rate limiter. This app runs as a single custom Node
 * process (server.js), so a module-level Map is shared across all requests —
 * good enough to stop brute-force logins and signup spam without adding Redis.
 *
 * (If the app is ever scaled to multiple instances, swap the Map for a shared
 * store like Redis — the rateLimit() signature can stay the same.)
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Occasionally sweep expired buckets so the Map can't grow unbounded.
function sweep(now: number) {
    if (Math.random() > 0.01) return;
    for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
}

export interface RateResult {
    ok: boolean;
    remaining: number;
    retryAfter: number; // seconds until the window resets
}

/**
 * Fixed-window limiter.
 * @param key       unique bucket key, e.g. `login:1.2.3.4`
 * @param limit     max allowed hits per window
 * @param windowMs  window length in ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
    const now = Date.now();
    sweep(now);

    const b = buckets.get(key);
    if (!b || now > b.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, remaining: limit - 1, retryAfter: 0 };
    }

    b.count += 1;
    if (b.count > limit) {
        return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
    }
    return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}

/** Clear a key (e.g. after a successful login). */
export function rateLimitReset(key: string): void {
    buckets.delete(key);
}

/** Best-effort client IP from common proxy headers. */
export function getClientIp(headers: Headers | Record<string, any> | undefined): string {
    if (!headers) return 'unknown';
    const get = (name: string): string | null =>
        typeof (headers as Headers).get === 'function'
            ? (headers as Headers).get(name)
            : ((headers as Record<string, any>)[name] ?? null);

    const fwd = get('x-forwarded-for');
    if (fwd) return String(fwd).split(',')[0].trim();
    const real = get('x-real-ip');
    if (real) return String(real);
    return 'local';
}
