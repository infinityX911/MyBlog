'use client';

/**
 * components/DownloadsExplorer.tsx
 *
 * Client-side filter + grid for the Downloads page. Replaces the old static
 * filter bar whose buttons did nothing and whose "PDF / ZIP" chips were
 * hardcoded. File-type chips are now derived from the ACTUAL file types present
 * in the published downloads, and both category and file-type filters really
 * filter the grid (with client-side pagination that resets on filter change).
 */
import { useMemo, useState, type ReactNode } from 'react';
import DownloadCard from '@/components/DownloadCard';
import type { Download } from '@/lib/downloads';
import styles from '../app/(blog)/downloads/Downloads.module.css';

interface CategoryInfo { name: string; emoji: string; count: number }

// Small icon map for common file types; anything else falls back to 📄.
const TYPE_EMOJI: Record<string, string> = {
    PDF: '📄', ZIP: '📦', DOC: '📝', DOCX: '📝', XLS: '📊', XLSX: '📊',
    PPT: '📽️', PPTX: '📽️', PNG: '🖼️', JPG: '🖼️', SVG: '🎨', TXT: '📃',
    CSV: '📊', JSON: '🔧', MP4: '🎬', ZIPX: '📦',
};

const PER_PAGE = 9;

export default function DownloadsExplorer({
    items,
    categories,
    featured,
    sidebar,
}: {
    items: Download[];
    categories: CategoryInfo[];
    featured?: ReactNode;
    sidebar?: ReactNode;
}) {
    const [category, setCategory] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string | null>(null);
    const [page, setPage] = useState(1);

    // Distinct file types actually present, sorted by frequency.
    const fileTypes = useMemo(() => {
        const counts = new Map<string, number>();
        for (const d of items) {
            const t = (d.fileType || '').toUpperCase().trim();
            if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    }, [items]);

    const filtered = useMemo(() => items.filter(d => {
        if (category && d.category !== category) return false;
        if (fileType && (d.fileType || '').toUpperCase().trim() !== fileType) return false;
        return true;
    }), [items, category, fileType]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

    const reset = (fn: () => void) => { fn(); setPage(1); };

    return (
        <>
            {/* Filter bar */}
            <div className={styles.filterBar}>
                <div className="container-fluid">
                    <div className={styles.filterInner}>
                        <button
                            className={`${styles.filterBtn} ${!category && !fileType ? styles.filterBtnActive : ''}`}
                            onClick={() => reset(() => { setCategory(null); setFileType(null); })}
                        >
                            All
                        </button>
                        {categories.map(cat => (
                            <button
                                key={cat.name}
                                className={`${styles.filterBtn} ${category === cat.name ? styles.filterBtnActive : ''}`}
                                onClick={() => reset(() => setCategory(category === cat.name ? null : cat.name))}
                            >
                                {cat.emoji} {cat.name}
                            </button>
                        ))}
                        {fileTypes.map(t => (
                            <button
                                key={t}
                                className={`${styles.filterBtn} ${fileType === t ? styles.filterBtnActive : ''}`}
                                onClick={() => reset(() => setFileType(fileType === t ? null : t))}
                            >
                                {TYPE_EMOJI[t] ?? '📄'} {t}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main layout */}
            <div className={styles.mainContent}>
                <div className="container-fluid">
                    <div className="row">
                        {/* Content column */}
                        <div className="col-12 col-lg-9">
                            {featured}

                            <div className={styles.sectionTitle}>
                                📦 All Resources <span>{filtered.length} file{filtered.length === 1 ? '' : 's'}</span>
                            </div>

                            {filtered.length > 0 ? (
                                <>
                                    <div className="row g-3 g-md-4">
                                        {pageItems.map(item => (
                                            <div key={item.id} className="col-12 col-sm-6 col-xl-4">
                                                <DownloadCard item={item} />
                                            </div>
                                        ))}
                                    </div>

                                    {totalPages > 1 && (
                                        <div className={styles.dlPager}>
                                            <button
                                                className={styles.dlPagerBtn}
                                                disabled={safePage <= 1}
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                            >
                                                ← Prev
                                            </button>
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                                <button
                                                    key={p}
                                                    className={`${styles.dlPagerNum} ${p === safePage ? styles.dlPagerNumActive : ''}`}
                                                    onClick={() => setPage(p)}
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                            <button
                                                className={styles.dlPagerBtn}
                                                disabled={safePage >= totalPages}
                                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            >
                                                Next →
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className={styles.emptyState}>
                                    <h3>No downloads match this filter</h3>
                                    <p>Try a different category or file type.</p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="col-12 col-lg-3 mt-4 mt-lg-0">
                            {sidebar}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
