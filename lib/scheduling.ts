/**
 * lib/scheduling.ts — shared parsing for the draft / scheduled / published
 * status used by posts, CMS pages and downloads.
 *
 * A row is only ever in one of three states:
 *   draft      — invisible, no date
 *   scheduled  — invisible, with a scheduledAt in the future; the publisher
 *                loop in scheduler.js flips it to `published` when due
 *   published  — live
 *
 * Keeping this in one place matters: every public query in the app filters on
 * status = 'published', so a typo that let 'scheduled' through as 'published'
 * would silently publish a post early on one route but not another.
 */

export type PublishStatus = 'draft' | 'scheduled' | 'published';

export const PUBLISH_STATUSES: PublishStatus[] = ['draft', 'scheduled', 'published'];

export type PublishState = {
    status: PublishStatus;
    /** Set only when status === 'scheduled'. */
    scheduledAt: Date | null;
};

/**
 * Normalize whatever the client sent into a safe {status, scheduledAt} pair.
 *
 * - An unknown status falls back to `draft` — never to `published`.
 * - `scheduled` without a usable date also falls back to `draft`: a scheduled
 *   row with no time would sit invisible forever with no way to notice.
 * - A scheduled time in the PAST is kept as-is rather than rejected; the
 *   publisher loop picks it up on its next pass (within a minute), which is
 *   what someone who picked a time a few seconds ago actually wants.
 */
export function resolvePublishState(rawStatus: unknown, rawScheduledAt?: unknown): PublishState {
    const status = PUBLISH_STATUSES.includes(rawStatus as PublishStatus)
        ? (rawStatus as PublishStatus)
        : 'draft';

    if (status !== 'scheduled') return { status, scheduledAt: null };

    const when = parseDate(rawScheduledAt);
    if (!when) return { status: 'draft', scheduledAt: null };
    return { status: 'scheduled', scheduledAt: when };
}

function parseDate(v: unknown): Date | null {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v !== 'string' || !v.trim()) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
}

/** True when this state should be treated as live right now. */
export function isLive(status: string): boolean {
    return status === 'published';
}
