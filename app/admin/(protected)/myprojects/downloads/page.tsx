'use client';

/**
 * app/admin/(protected)/myprojects/downloads/page.tsx
 * Downloads list — same layout as the Blog Posts list (summary pills, search +
 * status filter, DataTable, SEO score) adapted for downloads. Eye = public
 * detail page (/downloads/<slug>) in a new tab.
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

type Download = {
    id: number;
    title: string;
    slug: string;
    category?: string;
    fileType?: string;
    downloadCount?: number;
    featured?: boolean;
    status: 'draft' | 'scheduled' | 'published';
    /** Set only while status === 'scheduled' — when the publisher takes it live. */
    scheduledAt?: string | null;
    content?: string;
    excerpt?: string;
    createdAt?: string;
    updatedAt: string;
    seo?: Record<string, any> | null;
};

// The admin runs on the same host as the public site, so the live origin is the
// real domain (localhost in dev, your domain in prod) — no hardcoded brand URL.
const SITE_URL = typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || 'https://inkdrop.blog');

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000), hours = Math.floor(diff / 3600000), days = Math.floor(diff / 86400000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ViewDownloads() {
    const router = useRouter();
    const [rows, setRows] = useState<Download[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [togglingId, setTogglingId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/downloads');
            if (res.ok) { const d = await res.json(); setRows(Array.isArray(d) ? d : []); }
            else router.push('/admin/login');
        } catch (e) { console.error('Error fetching downloads:', e); }
        finally { setLoading(false); }
    }, [router]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const seoScore = (r: Download): number | null =>
        r.seo ? analyzeSeo(normalizeSeo(r.seo), r.title ?? '', r.content || r.excerpt || '', r.slug ?? '', SITE_URL).score : null;

    const toggleStatus = async (row: Download) => {
        const newStatus = row.status === 'published' ? 'draft' : 'published';
        setTogglingId(row.id);
        try {
            const res = await fetch(`/api/downloads/${row.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) setRows(prev => prev.map(p => p.id === row.id ? { ...p, status: newStatus } : p));
        } catch { /* silent */ }
        finally { setTogglingId(null); }
    };

    const bulkDelete = async (items: Download[]) => {
        await Promise.all(items.map(r => fetch(`/api/downloads/${r.id}`, { method: 'DELETE' }).catch(() => {})));
        setRows(prev => prev.filter(p => !items.some(r => r.id === p.id)));
    };

    const filters = useMemo(() => ({
        status: Array.from(new Set(rows.map(r => r.status).filter(Boolean))),
        category: Array.from(new Set(rows.map(r => r.category).filter(Boolean) as string[])),
    }), [rows]);

    const total = rows.length;
    const publishedCount = rows.filter(r => r.status === 'published').length;
    const draftCount = rows.filter(r => r.status === 'draft').length;
    const seoScores = rows.map(seoScore).filter((s): s is number => s !== null);
    const avgSeo = seoScores.length > 0 ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length) : null;

    const filteredData = useMemo(() => rows.filter(r => {
        const q = search.toLowerCase();
        const matchSearch = !q || r.title.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.excerpt ?? '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchSearch && matchStatus;
    }), [rows, search, statusFilter]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Downloads"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Downloads', path: '/admin/myprojects/downloads' },
                ]}
            />

            <div className="vp-summary-bar">
                <div className="vp-summary-pills">
                    <div className="vp-summary-pill"><span className="vp-pill-num">{total}</span><span className="vp-pill-lbl">Total</span></div>
                    <div className="vp-summary-pill published"><span className="vp-pill-num">{publishedCount}</span><span className="vp-pill-lbl">Published</span></div>
                    <div className="vp-summary-pill draft"><span className="vp-pill-num">{draftCount}</span><span className="vp-pill-lbl">Drafts</span></div>
                    {avgSeo !== null && (
                        <div className="vp-summary-pill seo" style={{ '--seo-color': scoreColor(avgSeo) } as React.CSSProperties}>
                            <span className="vp-pill-num" style={{ color: scoreColor(avgSeo) }}>{avgSeo}</span>
                            <span className="vp-pill-lbl">Avg SEO Score</span>
                        </div>
                    )}
                </div>
                <button className="btn btn-primary vp-add-btn" onClick={() => router.push('/admin/myprojects/downloads/create')}>
                    <AddIcon fontSize="small" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    New Download
                </button>
            </div>

            <div className="vp-search-bar card shadow border-0 p-3 mb-3">
                <div className="vp-search-inner">
                    <div className="vp-search-wrap">
                        <svg className="vp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input type="text" className="vp-search-input" placeholder="Search by title, slug or excerpt..."
                            value={search} onChange={e => setSearch(e.target.value)} />
                        {search && <button className="vp-search-clear" onClick={() => setSearch('')} title="Clear search">✕</button>}
                    </div>
                    <div className="vp-filter-tabs">
                        {(['all', 'published', 'draft'] as const).map(st => (
                            <button key={st} className={`vp-filter-tab ${st} ${statusFilter === st ? 'active' : ''}`} onClick={() => setStatusFilter(st)}>
                                {st === 'all' ? `All (${total})` : st === 'published' ? `Published (${publishedCount})` : `Drafts (${draftCount})`}
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
                    onBulkDelete={bulkDelete}
                    columns={[
                        {
                            key: 'title', label: 'Title',
                            render: (_: any, row: Download) => (
                                <div className="vp-col-title">
                                    <span className="vp-post-title">{row.title}</span>
                                    <span className="vp-post-slug">/downloads/{row.slug}</span>
                                    {row.excerpt && <span className="vp-post-excerpt">{row.excerpt.length > 80 ? row.excerpt.slice(0, 80) + '…' : row.excerpt}</span>}
                                </div>
                            ),
                        },
                        { key: 'category', label: 'Category', render: (_: any, row: Download) => <span className="vp-cat-chip">{row.category || '—'}</span> },
                        { key: 'fileType', label: 'Type', render: (_: any, row: Download) => <code>{row.fileType || '—'}</code> },
                        {
                            key: 'featured', label: 'Featured',
                            render: (_: any, row: Download) => row.featured ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>★ Yes</span> : <span className="vp-na">—</span>,
                        },
                        {
                            key: 'status', label: 'Status',
                            render: (_: any, row: Download) => (
                                <button className={`vp-status-toggle ${row.status}`} onClick={e => { e.stopPropagation(); toggleStatus(row); }}
                                    disabled={togglingId === row.id}
                                    title={row.status === 'scheduled' && row.scheduledAt
                                        ? `Goes live ${new Date(row.scheduledAt).toLocaleString()} — click to publish now`
                                        : `Click to ${row.status === 'published' ? 'unpublish' : 'publish'}`}>
                                    <span className={`vp-status-dot ${row.status}`} />
                                    {togglingId === row.id ? '...'
                                        : row.status === 'published' ? 'Published'
                                        : row.status === 'scheduled'
                                            ? `🕒 ${row.scheduledAt ? new Date(row.scheduledAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Scheduled'}`
                                            : 'Draft'}
                                </button>
                            ),
                        },
                        {
                            key: 'seo', label: 'SEO Score',
                            render: (_: any, row: Download) => {
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
                            key: 'updatedAt', label: 'Updated',
                            render: (_: any, row: Download) => <span className="vp-date" title={new Date(row.updatedAt).toLocaleString()}>{timeAgo(row.updatedAt)}</span>,
                        },
                    ]}
                    filters={filters}
                    actions={[
                        { icon: <VisibilityIcon fontSize="small" />, onClick: (row: any) => window.open(`/downloads/${row.slug}`, '_blank'), className: 'view' },
                        { icon: <EditIcon fontSize="small" />, to: (row: any) => `/admin/myprojects/downloads/${row.id}/edit`, className: 'edit' },
                        { icon: <DeleteIcon fontSize="small" />, to: (row: any) => `/admin/myprojects/downloads/${row.id}/delete`, className: 'delete' },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewDownloads;
