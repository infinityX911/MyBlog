// components/BlogPagination.tsx — URL-based pagination (server component).
// SEO-friendly (real <a> links, ?page=N), preserves other query params (e.g. tag).
// Styling: app/(blog)/globals.css (.pagination-nav / .page-*) with light+dark.
import Link from 'next/link';

function pageList(current: number, total: number): (number | '...')[] {
    const wanted = [1, current - 1, current, current + 1, total];
    const uniq = [...new Set(wanted.filter((n) => n >= 1 && n <= total))].sort((a, b) => a - b);
    const out: (number | '...')[] = [];
    let prev = 0;
    for (const n of uniq) {
        if (n - prev > 1) out.push('...');
        out.push(n);
        prev = n;
    }
    return out;
}

export default function BlogPagination({
    currentPage,
    totalPages,
    basePath,
    params = {},
}: {
    currentPage: number;
    totalPages: number;
    basePath: string;
    params?: Record<string, string | undefined>;
}) {
    if (totalPages <= 1) return null;

    const href = (p: number) => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
        if (p > 1) sp.set('page', String(p));
        const qs = sp.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    };

    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;

    return (
        <nav className="pagination-nav" aria-label="Pagination">
            {prevDisabled ? (
                <span className="page-btn page-disabled" aria-disabled="true">← Prev</span>
            ) : (
                <Link href={href(currentPage - 1)} className="page-btn" rel="prev">← Prev</Link>
            )}

            <div className="page-nums">
                {pageList(currentPage, totalPages).map((p, i) =>
                    p === '...' ? (
                        <span key={`e${i}`} className="page-ellipsis">…</span>
                    ) : p === currentPage ? (
                        <span key={p} className="page-num page-active" aria-current="page">{p}</span>
                    ) : (
                        <Link key={p} href={href(p)} className="page-num">{p}</Link>
                    ),
                )}
            </div>

            {nextDisabled ? (
                <span className="page-btn page-disabled" aria-disabled="true">Next →</span>
            ) : (
                <Link href={href(currentPage + 1)} className="page-btn" rel="next">Next →</Link>
            )}
        </nav>
    );
}
