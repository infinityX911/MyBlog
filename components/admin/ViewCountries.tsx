'use client';
/**
 * ViewCountries — country breakdown of post views, from the site's own
 * post_views rows (not GA4).
 *
 * Used in three places, all from the same endpoint:
 *   <ViewCountries />              → site-wide
 *   <ViewCountries postId={58} />  → one post
 *
 * Styling reuses the `.dbi-*` classes DashboardInsights already defines in
 * admin.css, so this matches the existing country card and inherits dark mode
 * for free instead of introducing a second look.
 *
 * Flags are flagcdn images, never emoji — regional-indicator emoji render as
 * bare letters on Windows, which is the reason the GA4 card uses images too.
 */
import { useEffect, useState } from 'react';

interface CountryRow {
    code: string | null;
    name: string;
    flagUrl: string | null;
    views: number;
    share: number;
}

interface Props {
    /** Omit for the site-wide breakdown. */
    postId?: number;
    /** Window the result, e.g. 30 for the last month. Omit for all time. */
    days?: number;
    limit?: number;
    title?: string;
}

export default function ViewCountries({ postId, days, limit = 6, title }: Props) {
    const [rows, setRows] = useState<CountryRow[] | null>(null);
    const [total, setTotal] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        const qs = new URLSearchParams();
        if (postId) qs.set('postId', String(postId));
        if (days) qs.set('days', String(days));
        if (limit) qs.set('limit', String(limit));

        fetch(`/api/admin/analytics/view-countries?${qs}`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d) => {
                if (!alive) return;
                setRows(d.countries ?? []);
                setTotal(d.total ?? 0);
            })
            .catch(() => alive && setFailed(true));

        return () => {
            alive = false;
        };
    }, [postId, days, limit]);

    const heading = title ?? (postId ? 'Readers by country' : 'All views by country');

    return (
        <div className="dbi-card">
            <div className="d-flex align-items-center justify-content-between mb-2">
                <h6 className="dbi-title mb-0">{heading}</h6>
                {total > 0 && <span className="dbi-country-meta">{total.toLocaleString()} views</span>}
            </div>

            {failed && <p className="dbi-country-meta mb-0">Could not load country data.</p>}

            {!failed && rows === null && <p className="dbi-country-meta mb-0">Loading…</p>}

            {/* An empty result is normal until the column has been migrated and
                a few views have come in — say so plainly rather than showing an
                empty box that looks broken. */}
            {!failed && rows !== null && rows.length === 0 && (
                <p className="dbi-country-meta mb-0">
                    No country data yet. Views recorded from now on will be counted.
                </p>
            )}

            {!failed &&
                rows?.map((c) => (
                    <div
                        key={c.code ?? 'unknown'}
                        className="dbi-row d-flex align-items-center justify-content-between py-2"
                    >
                        <span className="dbi-country-name d-flex align-items-center">
                            {c.flagUrl && (
                                <img
                                    className="dbi-flag"
                                    alt=""
                                    src={c.flagUrl}
                                    onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            )}
                            {c.name}
                        </span>
                        <span className="dbi-country-meta">
                            {c.views.toLocaleString()} · {c.share}%
                        </span>
                    </div>
                ))}
        </div>
    );
}
