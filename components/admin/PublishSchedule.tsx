'use client';

/**
 * components/admin/PublishSchedule.tsx
 *
 * The shared Status control for every editor (posts, CMS pages, downloads).
 * Replaces the old two-option Draft/Published select and adds "Scheduled",
 * which reveals a date+time picker.
 *
 * Timezone: <input type="datetime-local"> gives a LOCAL wall-clock string with
 * no zone ("2026-08-09T14:30"). We convert to a real ISO instant before saving
 * and back again for display, so the author picks "2pm my time" and it goes
 * live at 2pm their time — regardless of the server's timezone.
 */

import { useMemo } from 'react';

export type PublishStatus = 'draft' | 'scheduled' | 'published';

/** ISO instant → the "YYYY-MM-DDTHH:mm" the input wants, in local time. */
export function isoToLocalInput(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The input's local string → an ISO instant to send to the API. */
export function localInputToIso(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);           // parsed as LOCAL time — what we want
    return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Sensible default when someone picks "Scheduled": tomorrow, 9am local. */
export function defaultScheduleLocal(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return isoToLocalInput(d.toISOString());
}

/**
 * Just the date+time field and its hint, for editors that already have their
 * own status control (the post editor uses a three-button row, not a select).
 */
export function ScheduleField({
    scheduledLocal,
    onScheduledChange,
}: {
    scheduledLocal: string;
    onScheduledChange: (local: string) => void;
}) {
    const minLocal = useMemo(() => isoToLocalInput(new Date().toISOString()), []);
    const when = scheduledLocal ? new Date(scheduledLocal) : null;
    const valid = when && !isNaN(when.getTime());
    const isPast = valid && when.getTime() <= Date.now();

    return (
        <div className="blog-schedule-field">
            <label className="blog-field-label">Publish on</label>
            <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={scheduledLocal}
                min={minLocal}
                onChange={(e) => onScheduledChange(e.target.value)}
            />
            {!valid ? (
                <span className="blog-schedule-hint err">Pick a date and time, or this saves as a draft.</span>
            ) : isPast ? (
                <span className="blog-schedule-hint warn">That time has passed — it goes live within a minute of saving.</span>
            ) : (
                <span className="blog-schedule-hint">
                    Goes live on <b>{when!.toLocaleString(undefined, {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: 'numeric', minute: '2-digit',
                    })}</b> (your local time). Hidden from the site, sitemap and search engines until then.
                </span>
            )}
        </div>
    );
}

export default function PublishSchedule({
    status,
    onStatusChange,
    scheduledLocal,
    onScheduledChange,
    label = 'Status',
}: {
    status: PublishStatus;
    onStatusChange: (s: PublishStatus) => void;
    /** "YYYY-MM-DDTHH:mm" local string (use isoToLocalInput to build it). */
    scheduledLocal: string;
    onScheduledChange: (local: string) => void;
    label?: string;
}) {
    // Block past times in the picker itself — the API tolerates them (it just
    // publishes on the next pass) but offering them is confusing.
    const minLocal = useMemo(() => isoToLocalInput(new Date().toISOString()), []);

    const when = scheduledLocal ? new Date(scheduledLocal) : null;
    const valid = when && !isNaN(when.getTime());
    const isPast = valid && when.getTime() <= Date.now();

    return (
        <>
            <div className="form-group para mb-3">
                <label><b>{label}</b></label>
                <select
                    className="form-control"
                    value={status}
                    onChange={(e) => {
                        const next = e.target.value as PublishStatus;
                        onStatusChange(next);
                        // Pre-fill a time so "Scheduled" is never saved empty
                        // (an empty schedule silently falls back to Draft).
                        if (next === 'scheduled' && !scheduledLocal) {
                            onScheduledChange(defaultScheduleLocal());
                        }
                    }}
                >
                    <option value="draft">Draft</option>
                    <option value="scheduled">🕒 Scheduled</option>
                    <option value="published">Published</option>
                </select>
            </div>

            {status === 'scheduled' && (
                <div className="form-group para mb-3">
                    <label><b>Publish on</b></label>
                    <input
                        type="datetime-local"
                        className="form-control"
                        value={scheduledLocal}
                        min={minLocal}
                        onChange={(e) => onScheduledChange(e.target.value)}
                    />
                    {!valid ? (
                        <small className="text-danger">
                            Pick a date and time, or this will be saved as a draft.
                        </small>
                    ) : isPast ? (
                        <small className="text-warning">
                            That time has already passed — it will go live within a minute of saving.
                        </small>
                    ) : (
                        <small className="text-muted">
                            Goes live automatically on{' '}
                            <b>{when!.toLocaleString(undefined, {
                                weekday: 'short', day: 'numeric', month: 'short',
                                hour: 'numeric', minute: '2-digit',
                            })}</b>{' '}
                            (your local time). It stays hidden from the site, the sitemap and
                            search engines until then.
                        </small>
                    )}
                </div>
            )}
        </>
    );
}
