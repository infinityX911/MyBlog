'use client';

/**
 * CardsPager.tsx — client-side pagination for the "Cards grid" block.
 *
 * Every card is rendered into the HTML; the ones outside the current page are
 * just hidden with CSS. That matters for SEO: a crawler still sees and follows
 * every card's link on the first request, so paginating a big hub page never
 * buries pages 2+ behind JavaScript. The wrapper uses `display: contents` when
 * visible, so the card itself stays the direct grid child and the layout is
 * byte-for-byte the same as an unpaginated grid.
 *
 * State is local (no URL change) — these are in-page card grids, not their own
 * routes, so a ?page= param would only create duplicate URLs to canonicalise.
 */

import { useState } from 'react';

export default function CardsPager({
    children,
    perPage,
}: {
    children: React.ReactNode[];
    perPage: number;
}) {
    const [page, setPage] = useState(1);
    const items = children ?? [];
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const current = Math.min(page, totalPages);
    const from = (current - 1) * perPage;
    const to = from + perPage;

    // Classes rather than inline colours, so globals.css can theme them — an
    // inline `background: transparent` and `color: inherit` looked fine in
    // light mode but left invisible borders on the dark background.
    const cls = (active: boolean) => `cards-pager-btn${active ? ' is-active' : ''}`;

    return (
        <>
            <div className="tut-cards">
                {items.map((child, i) => (
                    <div key={i} style={{ display: i >= from && i < to ? 'contents' : 'none' }}>
                        {child}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <nav className="cards-pager" aria-label="Cards pagination">
                    <button type="button" className={cls(false)} disabled={current === 1}
                        onClick={() => setPage(current - 1)} aria-label="Previous page">←</button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                        <button key={n} type="button" className={cls(n === current)}
                            aria-current={n === current ? 'page' : undefined}
                            onClick={() => setPage(n)}>{n}</button>
                    ))}

                    <button type="button" className={cls(false)} disabled={current === totalPages}
                        onClick={() => setPage(current + 1)} aria-label="Next page">→</button>
                </nav>
            )}
        </>
    );
}
