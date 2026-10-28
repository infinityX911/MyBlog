'use client';

/**
 * app/admin/(protected)/myprojects/blog/page.tsx
 * Blog posts list — uses existing DataTable + MUI icons (consistent
 * with the rest of the admin panel) while adding enhanced SEO score
 * (via lib/seo/scoring.ts), word-count column, status toggle, and
 * a search + filter bar above the table.
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
import { analyzeSeo, scoreColor } from '@/lib/seo/scoring';

type Post = {
    id: number;
    title: string;
    slug: string;
    status: 'draft' | 'scheduled' | 'published';
    content?: string;
    wordCount?: number;
    viewCount?: number;
    /** Set only while status === 'scheduled' — when the publisher takes it live. */
    scheduledAt?: string | null;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    primaryCategoryId?: number | null;
    categories?: { id: number; name: string; slug?: string }[];
    excerpt?: string;
    seo?: Record<string, any>;
};

// Category-siloed public URL for a post (posts now live at /<category>/<slug>,
// not the old /posts/<slug>). Falls back to 'uncategorized' if no category.
function postPublicUrl(row: Post): string {
    const cats = row.categories ?? [];
    const cat = cats.find(c => c.id === row.primaryCategoryId) ?? cats[0];
    return `/${cat?.slug || 'uncategorized'}/${row.slug}`;
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  <  1) return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  <  7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ViewPosts() {
    const router = useRouter();
    const [posts, setPosts]     = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all');
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [siteUrl, setSiteUrl] = useState('');

    const fetchPosts = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/posts?admin=1');
            if (res.ok) {
                const d = await res.json();
                setPosts(Array.isArray(d) ? d : (d.posts ?? []));
            } else {
                router.push('/admin/login');
            }
        } catch (err) {
            console.error('Error fetching posts:', err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => { fetchPosts(); }, [fetchPosts]);

    // Blog site URL (for the canonical SEO check — matches the auto-canonical
    // the app generates, so list scores agree with the editor's SEO panel).
    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.ok ? r.json() : [])
            .then((all: any[]) => {
                const blog = Array.isArray(all) ? all.find((s: any) => s.siteKey === 'blog') : null;
                if (blog?.websiteUrl) setSiteUrl(blog.websiteUrl);
            })
            .catch(() => { /* optional */ });
    }, []);

    // Status toggle (inline — no page reload)
    const toggleStatus = async (post: Post) => {
        const newStatus = post.status === 'published' ? 'draft' : 'published';
        setTogglingId(post.id);
        try {
            const res = await fetch(`/api/posts/${post.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setPosts(prev => prev.map(p =>
                    p.id === post.id ? { ...p, status: newStatus } : p
                ));
            }
        } catch { /* silently fail */ }
        finally { setTogglingId(null); }
    };

    // Bulk delete — DataTable calls this with the selected rows (checkboxes +
    // "Delete selected" in the ⋯ menu). Deletes each via the API, then reloads.
    const bulkDelete = async (rows: any[]) => {
        await Promise.all(rows.map(r => fetch(`/api/posts/${r.id}`, { method: 'DELETE' }).catch(() => {})));
        fetchPosts();
    };

    // Build filter options for DataTable's built-in filter UI
    const filters = useMemo(() => ({
        status: Array.from(new Set(posts.map((p: Post) => p.status).filter(Boolean))),
    }), [posts]);

    // Summary counts
    const totalPosts     = posts.length;
    const publishedCount = posts.filter(p => p.status === 'published').length;
    const draftCount     = posts.filter(p => p.status === 'draft').length;
    const seoScores      = posts
        .map(p => {
            if (!p.seo) return null;
            // Pass full HTML to analyzeSeo — same as SeoPanel does.
            // analyzeSeo internally calls stripHtml() for text checks,
            // but keeps HTML for tag-based checks (img alt, headings).
            const { score } = analyzeSeo({
                focusKeyword: p.seo.focusKeyword ?? '',
                metaTitle: p.seo.metaTitle ?? '',
                metaDescription: p.seo.metaDescription ?? '',
                robotsIndex: p.seo.robotsIndex ?? true,
                robotsFollow: p.seo.robotsFollow ?? true,
                canonicalUrl: p.seo.canonicalUrl ?? '',
                ogTitle: p.seo.ogTitle ?? '',
                ogDescription: p.seo.ogDescription ?? '',
                ogImage: p.seo.ogImage ?? '',
                twitterTitle: p.seo.twitterTitle ?? '',
                twitterDescription: p.seo.twitterDescription ?? '',
                schemaType: p.seo.schemaType ?? '',
                schemaJson: p.seo.schemaJson ?? '',
            }, p.title ?? '', p.content ?? '', p.slug ?? '', siteUrl);
            return score;
        })
        .filter((s): s is number => s !== null);
    const avgSeo = seoScores.length > 0
        ? Math.round(seoScores.reduce((a, b) => a + b, 0) / seoScores.length)
        : null;

    // Client-side search + status filter applied on top of DataTable data
    const filteredData = useMemo(() => posts.filter(p => {
        const q = search.toLowerCase();
        const matchSearch = !q ||
            p.title.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q) ||
            (p.excerpt ?? '').toLowerCase().includes(q);
        const matchStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchSearch && matchStatus;
    }), [posts, search, statusFilter]);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="Blog Posts"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Blog', path: '/admin/myprojects/blog' },
                ]}
            />

            {/* ── Summary stats ──────────────────────────────────────── */}
            <div className="vp-summary-bar">
                <div className="vp-summary-pills">
                    <div className="vp-summary-pill">
                        <span className="vp-pill-num">{totalPosts}</span>
                        <span className="vp-pill-lbl">Total Posts</span>
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
                <button
                    className="btn btn-primary vp-add-btn"
                    onClick={() => router.push('/admin/myprojects/blog/create')}
                >
                    <AddIcon fontSize="small" style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    New Post
                </button>
            </div>

            {/* ── Search + status filter ─────────────────────────────── */}
            <div className="vp-search-bar card shadow border-0 p-3 mb-3">
                <div className="vp-search-inner">
                    <div className="vp-search-wrap">
                        <svg className="vp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            className="vp-search-input"
                            placeholder="Search by title, slug or excerpt..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                            <button className="vp-search-clear" onClick={() => setSearch('')} title="Clear search">✕</button>
                        )}
                    </div>
                    <div className="vp-filter-tabs">
                        {(['all', 'published', 'draft'] as const).map(s => (
                            <button
                                key={s}
                                className={`vp-filter-tab ${s} ${statusFilter === s ? 'active' : ''}`}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s === 'all'
                                    ? `All (${totalPosts})`
                                    : s === 'published'
                                        ? `Published (${publishedCount})`
                                        : `Drafts (${draftCount})`}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── DataTable ─────────────────────────────────────────── */}
            <Row>
                <DataTable
                    title=""
                    data={filteredData}
                    loading={loading}
                    onBulkDelete={bulkDelete}
                    columns={[
                        {
                            key: 'title',
                            label: 'Title',
                            render: (_: any, row: Post) => (
                                <div className="vp-col-title">
                                    <span className="vp-post-title">{row.title}</span>
                                    <span className="vp-post-slug">{postPublicUrl(row)}</span>
                                    {row.excerpt && (
                                        <span className="vp-post-excerpt">
                                            {row.excerpt.length > 80 ? row.excerpt.slice(0, 80) + '…' : row.excerpt}
                                        </span>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'categories',
                            label: 'Categories',
                            render: (_: any, row: Post) => {
                                const cats = Array.isArray(row.categories) ? row.categories : [];
                                if (cats.length === 0) return <span className="vp-na">—</span>;
                                return (
                                    <div className="vp-cat-wrap">
                                        {cats.slice(0, 2).map((c: any) => (
                                            <span key={c.id} className="vp-cat-chip">{c.name}</span>
                                        ))}
                                        {cats.length > 2 && (
                                            <span className="vp-cat-more">+{cats.length - 2}</span>
                                        )}
                                    </div>
                                );
                            },
                        },
                        {
                            key: 'status',
                            label: 'Status',
                            render: (_: any, row: Post) => (
                                <button
                                    className={`vp-status-toggle ${row.status}`}
                                    onClick={e => { e.stopPropagation(); toggleStatus(row); }}
                                    disabled={togglingId === row.id}
                                    title={
                                        row.status === 'scheduled' && row.scheduledAt
                                            // A scheduled row is not live yet, so the toggle
                                            // publishes it now — cancelling the timer.
                                            ? `Goes live ${new Date(row.scheduledAt).toLocaleString()} — click to publish now`
                                            : `Click to ${row.status === 'published' ? 'unpublish' : 'publish'}`
                                    }
                                >
                                    <span className={`vp-status-dot ${row.status}`} />
                                    {togglingId === row.id
                                        ? '...'
                                        : row.status === 'published' ? 'Published'
                                        : row.status === 'scheduled'
                                            ? `🕒 ${row.scheduledAt ? new Date(row.scheduledAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Scheduled'}`
                                            : 'Draft'}
                                </button>
                            ),
                        },
                        {
                            key: 'seo',
                            label: 'SEO Score',
                            render: (_: any, row: Post) => {
                                if (!row.seo) return <span className="vp-na">No SEO</span>;
                                const { score } = analyzeSeo({
                                    focusKeyword:       row.seo.focusKeyword       ?? '',
                                    metaTitle:          row.seo.metaTitle          ?? '',
                                    metaDescription:    row.seo.metaDescription    ?? '',
                                    robotsIndex:        row.seo.robotsIndex        ?? true,
                                    robotsFollow:       row.seo.robotsFollow       ?? true,
                                    canonicalUrl:       row.seo.canonicalUrl       ?? '',
                                    ogTitle:            row.seo.ogTitle            ?? '',
                                    ogDescription:      row.seo.ogDescription      ?? '',
                                    ogImage:            row.seo.ogImage            ?? '',
                                    twitterTitle:       row.seo.twitterTitle       ?? '',
                                    twitterDescription: row.seo.twitterDescription ?? '',
                                    schemaType:         row.seo.schemaType         ?? '',
                                    schemaJson:         row.seo.schemaJson         ?? '',
                                }, row.title ?? '', row.content ?? '', row.slug ?? '', siteUrl);
                                const color = scoreColor(score);
                                const label = score >= 80 ? 'Good' : score >= 60 ? 'OK' : 'Low';
                                return (
                                    <div className="vp-seo-wrap">
                                        <span className="vp-seo-circle" style={{ borderColor: color, color }}>
                                            {score}
                                        </span>
                                        <span className="vp-seo-label" style={{ color }}>{label}</span>
                                    </div>
                                );
                            },
                        },
                        {
                            key: 'wordCount',
                            label: 'Words',
                            render: (_: any, row: Post) => {
                                const wc = row.wordCount ??
                                    (row.content
                                        ? row.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
                                        : undefined);
                                if (wc === undefined) return <span className="vp-na">—</span>;
                                return (
                                    <span className={wc < 300 ? 'vp-words-low' : 'vp-words-ok'}>
                                        {wc.toLocaleString()}
                                    </span>
                                );
                            },
                        },
                        // Kept deliberately narrow. DataTable has no per-column
                        // width and gives every column at least ~100px, so each
                        // extra column takes that space straight out of Title.
                        // A "Linked from" column lived here briefly and cost
                        // roughly 150px of title width — not worth it.
                        {
                            key: 'viewCount',
                            label: 'Views',
                            render: (_: any, row: Post) => {
                                const v = row.viewCount ?? 0;
                                // A published post sitting on zero is worth a
                                // second look; a draft on zero is just normal.
                                const dim = v === 0 && row.status !== 'published';
                                return (
                                    <span
                                        className={dim ? 'vp-na' : 'vp-words-ok'}
                                        style={{ whiteSpace: 'nowrap' }}
                                        title="Unique readers, de-duplicated to one per visitor per day"
                                    >
                                        {v.toLocaleString()}
                                    </span>
                                );
                            },
                        },
                        {
                            key: 'updatedAt',
                            label: 'Updated',
                            render: (_: any, row: Post) => (
                                <span className="vp-date" title={new Date(row.updatedAt).toLocaleString()}>
                                    {timeAgo(row.updatedAt)}
                                </span>
                            ),
                        },
                    ]}
                    filters={filters}
                    actions={[
                        {
                            icon: <VisibilityIcon fontSize="small" />,
                            // Open the real category URL, in preview mode so drafts render too.
                            to: (row: any) => `${postPublicUrl(row)}?preview=1`,
                            className: 'view',
                        },
                        {
                            icon: <EditIcon fontSize="small" />,
                            to: (row: any) => `/admin/myprojects/blog/edit/${row.id}`,
                            className: 'edit',
                        },
                        {
                            icon: <DeleteIcon fontSize="small" />,
                            to: (row: any) => `/admin/myprojects/blog/${row.id}/delete`,
                            className: 'delete',
                        },
                    ]}
                />
            </Row>
        </Container>
    );
}

export default ViewPosts;
