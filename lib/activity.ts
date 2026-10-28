/**
 * lib/activity.ts
 *
 * The single entry point for "something happened in the app".
 *
 * One call to recordEvent() can do up to three things at once:
 *   1. ALWAYS  → write an Activity row (the permanent audit trail / the
 *                dashboard "Recent Activities" feed).
 *   2. OPTIONAL → create a Notification row (broadcast to admins, or direct
 *                to a specific user) — the same table the bell icon reads.
 *   3. OPTIONAL → push that notification live over Socket.io so any open
 *                admin panel updates instantly (same channel the comment
 *                system already uses: io.to('admins').emit('new-notification')).
 *
 * Wiring a new action into the system is therefore a one-liner at the end of
 * any route handler, e.g.:
 *
 *   await recordEvent({
 *     type: 'post.create',
 *     action: `${actorName} published a post`,
 *     description: `"${post.title}"`,
 *     link: `/admin/myprojects/blog/${post.id}`,
 *     actorUserId: me,
 *     notify: 'admins',            // raise + broadcast a notification too
 *   });
 *
 * Failures here are swallowed and logged — logging an activity must never
 * break the primary action (creating the post, updating the profile, etc.).
 */

import { prisma } from './prisma';

// ── Retention ────────────────────────────────────────────────────────────────
// Activity is an audit/feed table, not permanent history — so we cap it.
// Anything older than this many days is pruned. A small random % of writes
// triggers the prune so we never run a DELETE on every single request.
const ACTIVITY_RETENTION_DAYS = Number(process.env.ACTIVITY_RETENTION_DAYS) || 90;
const PRUNE_PROBABILITY = 0.04; // ~4% of writes run a cleanup pass

async function maybePrune(): Promise<void> {
    if (Math.random() > PRUNE_PROBABILITY) return;
    try {
        const cutoff = new Date(Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await prisma.activity.deleteMany({ where: { createdAt: { lt: cutoff } } });
    } catch (err) {
        console.error('[activity prune]', err);
    }
}

export type NotifyTarget =
    | false            // activity only, no notification (default)
    | 'admins'         // broadcast notification (userId: null) — admin feed
    | 'all'            // fan-out: one notification per user (everyone gets it)
    | number;          // direct notification to this userId

export interface RecordEventInput {
    /** machine key, e.g. "profile.update", "post.create", "auth.login" */
    type: string;
    /** human-readable title, e.g. "Updated their profile" */
    action: string;
    /** optional detail line */
    description?: string;
    /** optional deep link */
    link?: string;
    /** who performed the action (for avatar/name in the feed) */
    actorUserId?: number | null;
    /** whose account/record this concerns (defaults to actorUserId) */
    subjectUserId?: number | null;
    /** optional structured payload, stored as JSON */
    meta?: Record<string, unknown>;
    /**
     * Whether to also raise a Notification:
     *   false      → no notification (audit only)         [default]
     *   'admins'   → broadcast to the admin feed
     *   <userId>   → direct notification to that user
     */
    notify?: NotifyTarget;
    /** Override the notification message (defaults to `action` + description) */
    notifyMessage?: string;
}

/** Resolve an actor's display name + avatar once, for the live push. */
async function getActor(actorUserId: number | null | undefined) {
    if (!actorUserId) return null;
    try {
        return await prisma.user.findUnique({
            where: { id: actorUserId },
            select: { name: true, avatarUrl: true },
        });
    } catch {
        return null;
    }
}

export async function recordEvent(input: RecordEventInput): Promise<void> {
    const {
        type,
        action,
        description,
        link,
        actorUserId = null,
        subjectUserId,
        meta,
        notify = false,
        notifyMessage,
    } = input;

    const subject = subjectUserId !== undefined ? subjectUserId : actorUserId;

    try {
        // 1. Audit trail — always.
        await prisma.activity.create({
            data: {
                type,
                action,
                description: description ?? null,
                link: link ?? null,
                actorUserId,
                userId: subject ?? null,
                meta: meta ? JSON.stringify(meta) : null,
            },
        });
    } catch (err) {
        console.error('[recordEvent] activity write failed:', err);
        // keep going — a failed audit row shouldn't block a notification
    }

    // Opportunistically trim old rows so the table never grows unbounded.
    void maybePrune();

    if (notify === false) return;

    const message = notifyMessage ?? (description ? `${action} — ${description}` : action);

    // Fan-out to EVERY user (e.g. "new post published"). One row per user so it
    // shows in each person's own bell, then a live push to their socket room.
    if (notify === 'all') {
        try {
            const users = await prisma.user.findMany({
                where: actorUserId ? { id: { not: actorUserId } } : {},
                select: { id: true },
            });
            if (users.length) {
                await prisma.notification.createMany({
                    data: users.map(u => ({ type, message, link: link ?? null, actorUserId, userId: u.id })),
                });
            }
            const actor = await getActor(actorUserId);
            const io = (globalThis as any).__io;
            if (io) {
                const base = { id: 0, type, message, link: link ?? null, createdAt: new Date(), actorUserId: actorUserId ?? null, actorAvatarUrl: actor?.avatarUrl ?? null, actorName: actor?.name ?? null };
                for (const u of users) io.to(`user:${u.id}`).emit('new-notification', base);
            }
        } catch (err) {
            console.error('[recordEvent] broadcast-all failed:', err);
        }
        return;
    }

    try {
        // 2. Notification row (broadcast or direct).
        const notification = await prisma.notification.create({
            data: {
                type,
                message,
                link: link ?? null,
                actorUserId,
                userId: notify === 'admins' ? null : notify, // null = broadcast
            },
        });

        // 3. Real-time push.
        const actor = await getActor(actorUserId);
        const io = (globalThis as any).__io;
        if (io) {
            const payload = {
                id: notification.id,
                type: notification.type,
                message: notification.message,
                link: notification.link,
                createdAt: notification.createdAt,
                actorUserId: actorUserId ?? null,
                actorAvatarUrl: actor?.avatarUrl ?? null,
                actorName: actor?.name ?? null,
            };
            if (notify === 'admins') {
                io.to('admins').emit('new-notification', payload);
            } else {
                // Direct: still emit to the admins room (admins with the feed
                // permission see it); a per-user room could be added later.
                io.to('admins').emit('new-notification', payload);
            }
        }
    } catch (err) {
        console.error('[recordEvent] notification failed:', err);
    }
}

/** Convenience: audit-only log (no notification). */
export function logActivity(
    input: Omit<RecordEventInput, 'notify' | 'notifyMessage'>
): Promise<void> {
    return recordEvent({ ...input, notify: false });
}
