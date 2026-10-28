'use client';
/**
 * DashboardInsights — Visitors-Device chart + Country list + Page-Views table +
 * Traffic-Sources table. Data comes from /api/admin/analytics/insights, which
 * returns REAL GA4 data once the GA4 Data API is configured (Admin → Blog →
 * Integrations) and DUMMY data until then (so the widgets never look empty).
 *
 * UI notes:
 *  - Country flags use real images (flagcdn.com) — emoji flags don't render on
 *    Windows, so we never rely on them.
 *  - Fully dark-mode aware via the `.dashboard-insights` CSS in admin.css.
 *  - Each card has a ⋯ menu: "Download CSV" (export that card's data) and
 *    "Refresh". Delete/Clear aren't offered because these numbers are read-only
 *    live Google Analytics data — there is nothing local to delete.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import { HiDotsHorizontal } from 'react-icons/hi';
import { FiDownload, FiRefreshCw, FiExternalLink } from 'react-icons/fi';
import {
    FaBolt, FaSearch, FaShareAlt, FaUsers, FaBullhorn, FaGlobe,
} from 'react-icons/fa';

interface Insights {
    source: 'ga4' | 'dummy';
    year: number;
    device: { month: string; desktop: number; mobile: number }[];
    countries: { name: string; code: string; users: number; share: number }[];
    pages: { path: string; views: number; bounce: number }[];
    sources: { source: string; users: number; sessions: number; bounce: number; duration: string }[];
    queries?: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
    queriesSource?: 'gsc' | 'dummy';
}

const nf = (n: number) => n.toLocaleString();

/** Compact axis labels: 10000 → 10k, keeps ticks inside the card. */
const kfmt = (v: number) =>
    v >= 1000 ? `${(v / 1000).toString().replace(/\.0$/, '')}k` : `${v}`;

/** Track body.dark so recharts (canvas-ish) ticks/grid adapt to the theme. */
function useDarkMode() {
    const [dark, setDark] = useState(false);
    useEffect(() => {
        const read = () => setDark(document.body.classList.contains('dark'));
        read();
        const obs = new MutationObserver(read);
        obs.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);
    return dark;
}

/** Colored icon per default-channel-group traffic source. */
function sourceIcon(name: string) {
    const n = name.toLowerCase();
    if (n.includes('organic') || n.includes('search')) return { icon: <FaSearch />, bg: 'rgba(16,185,129,.15)', fg: '#10b981' };
    if (n.includes('referral')) return { icon: <FaShareAlt />, bg: 'rgba(245,158,11,.15)', fg: '#f59e0b' };
    if (n.includes('social')) return { icon: <FaUsers />, bg: 'rgba(236,72,153,.15)', fg: '#ec4899' };
    if (n.includes('campaign') || n.includes('paid') || n.includes('email')) return { icon: <FaBullhorn />, bg: 'rgba(239,68,68,.15)', fg: '#ef4444' };
    if (n.includes('direct')) return { icon: <FaBolt />, bg: 'rgba(99,102,241,.15)', fg: '#6366f1' };
    return { icon: <FaGlobe />, bg: 'rgba(148,163,184,.18)', fg: '#94a3b8' };
}

/** Build + trigger a CSV download in the browser. */
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
    const esc = (c: string | number) => {
        const s = String(c ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reusable ⋯ card menu (Download CSV + Refresh). */
function CardMenu({ onDownload, onRefresh }: { onDownload: () => void; onRefresh: () => void }) {
    const [anchor, setAnchor] = useState<null | HTMLElement>(null);
    const close = () => setAnchor(null);
    return (
        <>
            <button className="dbi-menu-btn" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Card options">
                <HiDotsHorizontal size={18} />
            </button>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
                <MenuItem onClick={() => { onDownload(); close(); }}>
                    <ListItemIcon><FiDownload size={16} /></ListItemIcon> Download CSV
                </MenuItem>
                <MenuItem onClick={() => { onRefresh(); close(); }}>
                    <ListItemIcon><FiRefreshCw size={16} /></ListItemIcon> Refresh
                </MenuItem>
            </Menu>
        </>
    );
}

export default function DashboardInsights() {
    const thisYear = new Date().getFullYear();
    const [year, setYear] = useState(thisYear);
    const [nonce, setNonce] = useState(0);
    const [data, setData] = useState<Insights | null>(null);
    const [loading, setLoading] = useState(true);
    const dark = useDarkMode();
    const years = useMemo(() => Array.from({ length: 6 }, (_, i) => thisYear - i), [thisYear]);
    const refresh = useCallback(() => setNonce((n) => n + 1), []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        fetch(`/api/admin/analytics/insights?year=${year}&_=${nonce}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => { if (alive) { setData(d); setLoading(false); } })
            .catch(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [year, nonce]);

    const isDemo = data?.source === 'dummy';
    const badge = isDemo ? (
        <span className="dbi-demo-badge" title="Sample data. Connect the GA4 Data API in Integrations to show real numbers.">Demo data</span>
    ) : null;

    const tick = { fill: dark ? '#8b93b0' : '#6b7280', fontSize: 12 };
    const grid = dark ? 'rgba(255,255,255,0.07)' : '#eef0f5';

    return (
        <div className="row dashboard-insights" style={{ marginTop: 4 }}>
            {/* ── Visitors Device ─────────────────────────────────────────── */}
            <div className="col-12 col-xl-8 mb-3">
                <div className="card shadow border-0 p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="dbi-title">Page Views by Device {badge}</h5>
                        <div className="d-flex align-items-center gap-2">
                            <select className="form-control" style={{ width: 120 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                                {years.map((y) => <option key={y} value={y}>Year {y}</option>)}
                            </select>
                            <CardMenu
                                onRefresh={refresh}
                                onDownload={() => downloadCSV(`visitors-device-${year}.csv`, ['Month', 'Desktop', 'Mobile'],
                                    (data?.device ?? []).map((d) => [d.month, d.desktop, d.mobile]))}
                            />
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 320, paddingLeft: 4 }}>
                        {loading ? <div className="p-4 text-muted">Loading…</div> : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.device ?? []} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 8, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="dbiDesktop" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2c5fe0" />
                                            <stop offset="100%" stopColor="#1e3a8a" />
                                        </linearGradient>
                                        <linearGradient id="dbiMobile" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#7cb6ff" />
                                            <stop offset="100%" stopColor="#5b9bf5" />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={tick} dy={4} />
                                    <YAxis tickLine={false} axisLine={false} tick={tick} width={46} tickMargin={8} tickFormatter={kfmt} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: dark ? 'rgba(255,255,255,0.06)' : 'rgba(30,58,138,0.07)' }}
                                        contentStyle={dark
                                            ? { background: '#12254e', border: '1px solid #1e2e52', borderRadius: 10, color: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.35)' }
                                            : { background: '#fff', border: '1px solid #e6e8ef', borderRadius: 10, color: '#1f2a44', boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}
                                        labelStyle={{ color: dark ? '#fff' : '#1f2a44', fontWeight: 700, marginBottom: 4 }}
                                        itemStyle={{ color: dark ? '#c2c8de' : '#384056' }}
                                        formatter={(v: number) => nf(v)}
                                    />
                                    <Bar dataKey="desktop" name="Desktop" stackId="a" fill="url(#dbiDesktop)" maxBarSize={26} />
                                    <Bar dataKey="mobile" name="Mobile" stackId="a" fill="url(#dbiMobile)" maxBarSize={26} radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                    <div className="d-flex gap-4 mt-2" style={{ fontSize: 13, color: dark ? '#c2c8de' : '#384056' }}>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1e3a8a', borderRadius: 2, marginRight: 6 }} />Desktop</span>
                        <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#5b9bf5', borderRadius: 2, marginRight: 6 }} />Mobile</span>
                    </div>
                </div>
            </div>

            {/* ── Country ─────────────────────────────────────────────────── */}
            <div className="col-12 col-xl-4 mb-3">
                <div className="card shadow border-0 p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="dbi-title">Top Countries {badge}</h5>
                        <CardMenu
                            onRefresh={refresh}
                            onDownload={() => downloadCSV(`top-countries-${year}.csv`, ['Country', 'Code', 'Users', 'Share %'],
                                (data?.countries ?? []).map((c) => [c.name, c.code, c.users, c.share]))}
                        />
                    </div>
                    {(data?.countries ?? []).map((c) => (
                        <div key={c.code + c.name} className="dbi-row d-flex align-items-center justify-content-between py-2">
                            <span className="dbi-country-name d-flex align-items-center">
                                <img className="dbi-flag" alt={c.name}
                                    src={`https://flagcdn.com/w40/${(c.code || '').toLowerCase()}.png`}
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                                {c.name}
                            </span>
                            <span className="dbi-country-meta">{nf(c.users)} · {c.share}%</span>
                        </div>
                    ))}
                    {!loading && (data?.countries?.length ?? 0) === 0 && <p className="text-muted mb-0">No data yet.</p>}
                </div>
            </div>

            {/* ── Top Pages — the per-page breakdown behind the Page Views card ─ */}
            <div className="col-12 col-xl-6 mb-3">
                <div className="card shadow border-0 p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="dbi-title">Top Pages {badge}</h5>
                        <CardMenu
                            onRefresh={refresh}
                            onDownload={() => downloadCSV(`page-views-${year}.csv`, ['Page', 'Views', 'Bounce %'],
                                (data?.pages ?? []).map((p) => [p.path, p.views, p.bounce]))}
                        />
                    </div>
                    <div className="table-responsive">
                        <table className="table mb-0" style={{ fontSize: 14 }}>
                            <thead><tr><th>Page</th><th className="text-end">Views</th><th className="text-end">Bounce</th></tr></thead>
                            <tbody>
                                {(data?.pages ?? []).map((p) => (
                                    <tr key={p.path}>
                                        <td>
                                            <span className="d-flex align-items-center">
                                                <span className="dbi-page-icon"><FiExternalLink size={14} /></span>
                                                <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.path}</span>
                                            </span>
                                        </td>
                                        <td className="text-end align-middle">{nf(p.views)}</td>
                                        <td className="text-end align-middle">{p.bounce}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Traffic Sources ─────────────────────────────────────────── */}
            <div className="col-12 col-xl-6 mb-3">
                <div className="card shadow border-0 p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="dbi-title">Traffic Sources {badge}</h5>
                        <CardMenu
                            onRefresh={refresh}
                            onDownload={() => downloadCSV(`traffic-sources-${year}.csv`, ['Source', 'Users', 'Sessions', 'Bounce %', 'Duration'],
                                (data?.sources ?? []).map((s) => [s.source, s.users, s.sessions, s.bounce, s.duration]))}
                        />
                    </div>
                    <div className="table-responsive">
                        <table className="table mb-0" style={{ fontSize: 14 }}>
                            <thead><tr><th>Source</th><th className="text-end">Users</th><th className="text-end">Sessions</th><th className="text-end">Bounce</th><th className="text-end">Duration</th></tr></thead>
                            <tbody>
                                {(data?.sources ?? []).map((s) => {
                                    const ic = sourceIcon(s.source);
                                    return (
                                        <tr key={s.source}>
                                            <td>
                                                <span className="d-flex align-items-center" style={{ fontWeight: 600 }}>
                                                    <span className="dbi-src-icon" style={{ background: ic.bg, color: ic.fg }}>{ic.icon}</span>
                                                    {s.source}
                                                </span>
                                            </td>
                                            <td className="text-end align-middle">{nf(s.users)}</td>
                                            <td className="text-end align-middle">{nf(s.sessions)}</td>
                                            <td className="text-end align-middle">{s.bounce}%</td>
                                            <td className="text-end align-middle">{s.duration}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Top Search Queries (Google Search Console) ──────────────────── */}
            <div className="col-12 mb-3">
                <div className="card shadow border-0 p-3 h-100">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="dbi-title">
                            Top Search Queries
                            {data?.queriesSource === 'dummy' && (
                                <span className="dbi-demo-badge" title="Sample data. Connect the Search Console API in Integrations to show real queries.">Demo data</span>
                            )}
                        </h5>
                        <CardMenu
                            onRefresh={refresh}
                            onDownload={() => downloadCSV('search-queries.csv', ['Query', 'Clicks', 'Impressions', 'CTR %', 'Position'],
                                (data?.queries ?? []).map((q) => [q.query, q.clicks, q.impressions, q.ctr, q.position]))}
                        />
                    </div>
                    <p className="text-muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
                        What people search on Google to find your site (last 28 days).
                    </p>
                    <div className="table-responsive">
                        <table className="table mb-0" style={{ fontSize: 14 }}>
                            <thead><tr><th>Query</th><th className="text-end">Clicks</th><th className="text-end">Impressions</th><th className="text-end">CTR</th><th className="text-end">Position</th></tr></thead>
                            <tbody>
                                {(data?.queries ?? []).map((q) => (
                                    <tr key={q.query}>
                                        <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{q.query}</td>
                                        <td className="text-end align-middle">{nf(q.clicks)}</td>
                                        <td className="text-end align-middle">{nf(q.impressions)}</td>
                                        <td className="text-end align-middle">{q.ctr}%</td>
                                        <td className="text-end align-middle">{q.position}</td>
                                    </tr>
                                ))}
                                {!loading && (data?.queries?.length ?? 0) === 0 && (
                                    <tr><td colSpan={5} className="text-muted text-center py-3">No search data yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
