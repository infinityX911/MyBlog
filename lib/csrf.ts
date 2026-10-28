/**
 * lib/csrf.ts
 *
 * Defense-in-depth CSRF guard for state-changing POST routes. A cross-site
 * page can submit a forged request, but the browser stamps it with the
 * attacker's Origin — so we reject any request whose Origin/Referer host
 * doesn't match our own. (The reset flow is already protected by the secret
 * token/OTP; this just adds a second wall.)
 */

import { NextRequest } from 'next/server';

export function isSameOrigin(req: NextRequest): boolean {
    const host = req.headers.get('host');
    if (!host) return false;

    const origin = req.headers.get('origin');
    if (origin) {
        try { return new URL(origin).host === host; } catch { return false; }
    }

    // Some browsers omit Origin on same-origin requests — fall back to Referer.
    const referer = req.headers.get('referer');
    if (referer) {
        try { return new URL(referer).host === host; } catch { return false; }
    }

    // No Origin and no Referer → reject to be safe for these sensitive routes.
    return false;
}
