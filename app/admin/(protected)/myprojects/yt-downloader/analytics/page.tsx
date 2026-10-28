'use client';

/** YT-downloader analytics — totals, per-format, 30-day trend, recent downloads. */

import React, { useEffect, useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import HeaderPanel from '@/components/admin/dashboard/HeaderPanel';
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar,
} from 'recharts';

interface Stats {
    total: number;
    last30: number;
    byFormat: { ext: string; count: number }[];
    byCategory: { category: string; count: number }[];
    perDay: { date: string; count: number }[];
    recent: { id: number; videoTitle: string | null; videoId: string; ext: string; quality: string; createdAt: string }[];
}

function StatCard({ label, value, bg }: { label: string; value: React.ReactNode; bg: string }) {
    return (
        <div className="card shadow border-0 p-3" style={{ background: bg, color: '#fff' }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div>
        </div>
    );
}

function Analytics() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/yt/analytics');
                if (res.ok) setStats(await res.json());
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, []);

    return (
        <Container fluid className="right-content">
            <HeaderPanel
                title="YouTube Downloader — Analytics"
                breadcrumbs={[
                    { label: 'Home', path: '/' },
                    { label: 'Dashboard', path: '/admin/dashboard' },
                    { label: 'Analytics', path: '/admin/myprojects/yt-downloader/analytics' },
                ]}
            />

            {loading ? <p className="p-3">Loading…</p> : !stats ? (
                <div className="card shadow border-0 p-4 mt-1">
                    <p className="mb-0 text-muted">No analytics yet. Downloads are logged automatically once the DB migration is applied and users start converting videos.</p>
                </div>
            ) : (
                <>
                    <Row className="g-3 mt-1">
                        <Col xs={12} md={4}>
                            <StatCard label="Total Downloads" value={stats.total} bg="linear-gradient(135deg,#0369a1,#0c4a6e)" />
                        </Col>
                        <Col xs={12} md={4}>
                            <StatCard label="Last 30 Days" value={stats.last30} bg="linear-gradient(135deg,#065f46,#064e3b)" />
                        </Col>
                        <Col xs={12} md={4}>
                            <StatCard label="Formats Used" value={stats.byFormat.length} bg="linear-gradient(135deg,#9a3412,#431407)" />
                        </Col>
                    </Row>

                    <Row className="g-3 mt-1">
                        <Col xs={12} lg={8}>
                            <div className="card shadow border-0 p-3">
                                <h6 className="hd mb-3">Downloads — last 30 days</h6>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={stats.perDay}>
                                        <defs>
                                            <linearGradient id="ytFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#E31C1C" stopOpacity={0.4} />
                                                <stop offset="95%" stopColor="#E31C1C" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => String(d).slice(5)} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="count" stroke="#E31C1C" fill="url(#ytFill)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Col>
                        <Col xs={12} lg={4}>
                            <div className="card shadow border-0 p-3">
                                <h6 className="hd mb-3">By format</h6>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={stats.byFormat}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                        <XAxis dataKey="ext" tick={{ fontSize: 11 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#E31C1C" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Col>
                    </Row>

                    <div className="card shadow border-0 p-3 mt-3">
                        <h6 className="hd mb-3">Recent downloads</h6>
                        {stats.recent.length === 0 ? <p className="text-muted mb-0">Nothing yet.</p> : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle mb-0">
                                    <thead><tr><th>Video</th><th>Format</th><th>Quality</th><th>When</th></tr></thead>
                                    <tbody>
                                        {stats.recent.map(r => (
                                            <tr key={r.id}>
                                                <td>{r.videoTitle || r.videoId}</td>
                                                <td><code>{r.ext}</code></td>
                                                <td>{r.quality}</td>
                                                <td>{new Date(r.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </Container>
    );
}

export default Analytics;
