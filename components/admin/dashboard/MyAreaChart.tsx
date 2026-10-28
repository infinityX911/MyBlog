'use client';

/**
 * MyAreaChart.tsx
 * Converted from: component/Carts/MyAreaChart.js
 *
 * Zero changes — recharts works identically in Next.js
 * Just added 'use client' (recharts uses browser APIs)
 */

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';

// A smooth two-hump wave that mirrors the reference dashboard's "Total Sales"
// area chart (soft white line + fading white-blue fill on the blue card).
interface Point { name: string; value: number }

// Fallback demo wave (used only if no real series is passed in).
const demoData: Point[] = [
    { name: 'Jan', value: 46 },
    { name: 'Feb', value: 66 },
    { name: 'Mar', value: 76 },
    { name: 'Apr', value: 60 },
    { name: 'May', value: 46 },
    { name: 'Jun', value: 38 },
    { name: 'Jul', value: 48 },
    { name: 'Aug', value: 60 },
    { name: 'Sep', value: 54 },
    { name: 'Oct', value: 70 },
    { name: 'Nov', value: 86 },
    { name: 'Dec', value: 100 },
];

const MyAreaChart = ({ data }: { data?: Point[] }) => {
    // Use the real series when supplied; otherwise fall back to the demo wave.
    const chartData = data && data.length ? data : demoData;
    // Thin the X labels so long ranges (24 hourly / 30 daily) don't collide;
    // short ranges (≤12) show every label.
    const tickInterval = chartData.length > 12 ? Math.ceil(chartData.length / 6) - 1 : 0;
    const axisTick = { fontSize: 10, fill: 'rgba(255,255,255,0.75)' };
    const firstName = chartData[0]?.name;
    const lastName = chartData[chartData.length - 1]?.name;
    // Anchor the first/last X labels INWARD (start/end) so they never clip at the
    // card edges, while the area itself still runs edge-to-edge (margin right 0).
    const renderXTick = (p: any) => {
        const anchor = p.payload.value === firstName ? 'start'
            : p.payload.value === lastName ? 'end' : 'middle';
        return (
            <text x={p.x} y={p.y} dy={12} textAnchor={anchor} fontSize={10} fill="rgba(255,255,255,0.75)">
                {p.payload.value}
            </text>
        );
    };
    return (
        <div className="w-100" style={{ width: '100%', height: '200px', margin: '0', padding: '0' }}>
            <ResponsiveContainer width="100%" height="100%">
                {/* Small right/top margins so the last X label and the top Y label
                    have room and don't clip against the card edges. */}
                <AreaChart data={chartData} margin={{ top: 12, right: 12, bottom: 2, left: 2 }}>
                    <defs>
                        <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    {/* Faint horizontal guide lines. */}
                    <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.12)" vertical={false} />
                    {/* Visible-but-light calibration. scale="point" keeps the first &
                        last points on the left/right edges. */}
                    <XAxis
                        dataKey="name"
                        scale="point"
                        padding={{ left: 0, right: 0 }}
                        interval={tickInterval}
                        tick={renderXTick}
                        axisLine={false}
                        tickLine={false}
                    />
                    {/* Auto-scale to the data's own max (with headroom) so the wave
                        fills the card whether values are ~100 (demo) or single digits
                        (a new site's real visitor counts). */}
                    <YAxis
                        domain={[0, (dataMax: number) => Math.max(4, Math.ceil(dataMax * 1.3))]}
                        width={30}
                        tickCount={4}
                        allowDecimals={false}
                        tick={axisTick}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.35)', strokeWidth: 1 }}
                        contentStyle={{ background: '#1f2f66', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                        labelStyle={{ color: '#cdd8ff' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="rgba(255,255,255,0.7)"
                        fill="url(#colorUv)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: '#fff', stroke: '#2c7be5', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default MyAreaChart;
