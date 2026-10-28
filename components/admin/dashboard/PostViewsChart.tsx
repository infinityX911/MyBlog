'use client';

// components/admin/dashboard/PostViewsChart.tsx
//
// Real "post views over time" graph for the admin dashboard. Pulls daily
// totals from /api/admin/analytics/views (sourced from the post_views table).
// Fixed-height container so recharts' ResponsiveContainer always has a size
// (avoids the width(-1)/height(-1) warning).

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type Point = { date: string; views: number };

const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function PostViewsChart() {
  const [series, setSeries] = useState<Point[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/analytics/views?days=30')
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setSeries(Array.isArray(d.series) ? d.series : []);
        setTotal(Number(d.total) || 0);
        setUnavailable(Boolean(d.unavailable));
      })
      .catch(() => { /* leave empty */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="card shadow border-0 p-3 mt-1">
      <div className="d-flex align-items-center mb-2">
        <h6 className="mb-0 fw-bold">Post Views — last 30 days</h6>
        <span className="ms-auto fw-bold">{total.toLocaleString()} views</span>
      </div>

      {unavailable && (
        <p className="text-muted small mb-2">
          Views history table not found yet — run the database migration
          (<code>npx prisma migrate dev</code>) to start recording it.
        </p>
      )}

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="postViewsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5b4fcf" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#5b4fcf" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={24} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} width={36} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={fmtDay} formatter={(v: number | string) => [`${v} views`, 'Views']} />
            <Area type="monotone" dataKey="views" stroke="#5b4fcf" strokeWidth={2} fill="url(#postViewsFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {loading && <p className="text-muted small mt-2 mb-0">Loading…</p>}
    </div>
  );
}
