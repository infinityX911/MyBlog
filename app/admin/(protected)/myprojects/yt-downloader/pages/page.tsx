'use client';

/**
 * app/admin/(protected)/myprojects/yt-downloader/pages/page.tsx
 * YT-downloader CMS pages list — reuses the SAME DataTable + summary pills +
 * search/filter UI as the Blog Posts list (styling via the shared vp-* classes
 * in admin.css), adapted for CMS pages (no categories; URL is /<slug>).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Row } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import DataTable from '@/components/admin/datatable/DataTable';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { analyzeSeo, normalizeSeo, scoreColor } from '@/lib/seo/scoring';

type CmsPage = {
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'published';
    content?: string;
    createdAt?: string;
    updatedAt: string;
    seo?: Record<string, any> | null;
};

const SITE_URL = 'https://ytdownloader.com';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ViewCmsPages() {
    const router = useRouter();
    const [pages, setPages] = useState<CmsPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const fetchPages = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/yt/cms-pages');
            if (res.ok) setPages(await res.json());
            else router.push('/admin/login');
        } catch (err) {
            console.error('Error fetching pages:', err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchPages(); }, [fetchPages]);

    const seoScore = (p: CmsPage): number | null =>
        p.seo ? analyzeSeo(normalizeSeo(p.seo), p.title ?? '', p.content ?? '', p.slug ?? '', SITE_URL).score : null;

    const toggleStatus = async (page: CmsPage) => {
        const newStatus = page.status === 'published' ? 'draft' : 'published';
        setTogglingId(page.id);
        try {
            const res = await fetch(`/api/yt/cms-pages/${page.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) setPages(prev => prev.map(p => p.id === page.id ? { ...p, status: newStatus } : p));
        } catch { /* silent */ }
        finally { setTogglingId(null); }
    };

    const bulkDelete = async (rows: CmsPage[]) => {
        await Promise.all(rows.map(r => fetch(`/api/yt/cms-pages/${r.id}`, { method: 'DELETE' }).catch(() => {})));
        setPages(prev => prev.filter(p => !rows.some(r => r.id === p.id)));
    };

    const filters = useMemo(() => ({
        status: Array.from(new Set(pages.map(p => p.status).filter(Boolean))),
    }), [pages]);

    const totalPages = pages.length;
    const publishedCount = pages.filter(p => p.status === 'published').length;
    const draftCount = pages.filter(p => p.status === 'draft').length;
    const seoScores = pages.map(seoScore).filter((s): s is number => s !== null);
    const avgSeo = seoScores.length > 0 ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : null;

    const filteredData = useMemo(() => pages.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !q || p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchSearch && matchStatus;
    }), [pages, search, statusFilter]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="YouTube Downloader — Pages"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'YT Pages', path: '/admin/myprojects/yt-downloader/pages' },
                ]}
            />

            <div className="vp-summary-bar">
                <div className="vp-summary-pills">
                    <div className="vp-summary-pill">
                        <span className="vp-pill-num">{totalPages}</span>
                        <span className="vp-pill-lbl">Total Pages</span>
                    </div>
                    <div className="vp-summary-pill published">
                        <span className="vp-pill-num">{publishedCount}</span>
                        <span className="vp-pill-lbl">Published</span>
                    </div>
                    <div className="vp-summary-pill draft">
                        <span className="vp-pill-num">{draftCount}</span>
                        <span className="vp-pill-lbl">Drafts</span>
                    </div>
                    {avgSeo !== null && (
                        <div className="vp-summary-pill seo" style={{ '--seo-color': scoreColor(avgSeo) } as React.CSSProperties}>
                            <span className="vp-pill-num" style={{ color: scoreColor(avgSeo) }}>{avgSeo}</span>
                            <span className="vp-pill-lbl">Avg SEO Score</span>
                        </div>
                    )}
                </div>
                <button className="btn btn-primary vp-add-btn" onClick={() => router.push('/admin/myprojects/yt-downloader/pages/create')}>
                    <AddIcon fontSize="small" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    New Page
                </button>
            </div>

            <div className="vp-search-bar card shadow border-0 p-3 mb-3">
                <div className="vp-search-inner">
                    <div className="vp-search-wrap">
                        <svg className="vp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input type="text" className="vp-search-input" placeholder="Search by title or slug..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                        {search && <button className="vp-search-clear" onClick={() => setSearch('')} title="Clear search">✕</button>}
                    </div>
                    <div className="vp-filter-tabs">
                        {(['all', 'published', 'draft'] as const).map(s => (
                            <button key={s} className={`vp-filter-tab ${s} ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                                {s === 'all' ? `All (${totalPages})` : s === 'published' ? `Published (${publishedCount})` : `Drafts (${draftCount})`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <Row>
                <DataTable
                    title=""
                    data={filteredData}
                    loading={loading}
                    columns={[
                        {
                            key: 'title',
                            label: 'Title',
                            render: (_: any, row: CmsPage) => (
                                <div className="vp-col-title">
                                    <span className="vp-post-title">{row.title}</span>
                                    <span className="vp-post-slug">/{row.slug}</span>
                                </div>
                            ),
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (_: any, row: CmsPage) => (
                                <button className={`vp-status-toggle ${row.status}`}
                                    onClick={e => { e.stopPropagation(); toggleStatus(row); }}
                                    disabled={togglingId === row.id}
                                    title={`Click to ${row.status === 'published' ? 'unpublish' : 'publish'}`}>
                                    <span className={`vp-status-dot ${row.status}`} />
                                    {togglingId === row.id ? '...' : row.status === 'published' ? 'Published' : 'Draft'}
                                </button>
                            ),
                        },
                        {
                            key: 'seo',
                            label: 'SEO Score',
                            render: (_: any, row: CmsPage) => {
                                const score = seoScore(row);
                                if (score === null) return <span className="vp-na">No SEO</span>;
                                const color = scoreColor(score);
                                const label = score >= 80 ? 'Good' : score >= 60 ? 'OK' : 'Low';
                                return (
                                    <div className="vp-seo-wrap">
                                        <span className="vp-seo-circle" style={{ borderColor: color, color }}>{score}</span>
                                        <span className="vp-seo-label" style={{ color }}>{label}</span>
                                    </div>
                                );
                            },
                        },
                        {
                            key: 'words',
                            label: 'Words',
                            render: (_: any, row: CmsPage) => {
                                const wc = row.content ? row.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0;
                                return <span className={wc < 300 ? 'vp-words-low' : 'vp-words-ok'}>{wc.toLocaleString()}</span>;
                            },
                        },
                        {
                            key: 'updatedAt',
                            label: 'Updated',
                            render: (_: any, row: CmsPage) => (
                                <span className="vp-date" title={new Date(row.updatedAt).toLocaleString()}>{timeAgo(row.updatedAt)}</span>
                            ),
                        },
                    ]}
                    filters={filters}
                    onBulkDelete={bulkDelete}
                    actions={[
                        { icon: <VisibilityIcon fontSize="small" />, onClick: (row: any) => window.open(`/yt/${row.slug}`, '_blank'), className: 'view' },
                        { icon: <EditIcon fontSize="small" />, to: (row: any) => `/admin/myprojects/yt-downloader/pages/${row.id}/edit`, className: 'edit' },
                        { icon: <DeleteIcon fontSize="small" />, to: (row: any) => `/admin/myprojects/yt-downloader/pages/${row.id}/delete`, className: 'delete' },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewCmsPages;
