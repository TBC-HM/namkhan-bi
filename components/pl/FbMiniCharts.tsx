'use client';

// components/pl/FbMiniCharts.tsx
// PBS 2026-06-09 #159 — three small charts under the head KPI strip on /operations/restaurant:
//   FbCaptureChart   — capture % monthly trend (line)
//   FbAvgTicketChart — avg check $ monthly trend (line)
//   FbCategoryChart  — top categories revenue last 6 months (stacked bar)
// All three pull from gold views v_fb_capture_monthly / v_fb_avg_ticket_monthly / v_fb_category_monthly.

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const C = {
  grid: '#E0E0E0',
  axis: '#5A5A5A',
  ink: '#000',
  primary: '#000',
  good: '#1c4d3a',
  bg: '#FFFFFF',
};

const CAT_COLORS = ['#000000', '#5a7da3', '#a8854a', '#6b9379', '#8e3a35', '#c4a06b', '#5A5A5A'];

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  if (!y || !m) return yyyymm;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function FbCaptureChart({ rows }: { rows: Array<{ period_yyyymm: string; capture_pct: number | string | null; res_in_house: number; res_with_purchase: number; sold_room_nights?: number; fb_cover_days?: number; capture_per_rn_pct?: number | string | null }> }) {
  const data = rows.map(r => ({
    m: monthLabel(r.period_yyyymm),
    per_res: Number(r.capture_pct ?? 0),
    per_rn: Number(r.capture_per_rn_pct ?? 0),
  }));
  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} />
          <YAxis tick={{ fill: C.axis, fontSize: 10 }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 4, color: C.ink, fontSize: 11 }}
                   formatter={(v: any, k: any) => [`${Number(v).toFixed(1)}%`, k === 'per_res' ? 'per res' : 'per room-night']} />
          <Legend wrapperStyle={{ fontSize: 10, color: C.axis }} />
          <Line type="monotone" dataKey="per_res" stroke={C.good} strokeWidth={2} dot={{ r: 2, fill: C.good }} activeDot={{ r: 4 }} name="per res" />
          <Line type="monotone" dataKey="per_rn"  stroke={C.ink}  strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2, fill: C.ink }} activeDot={{ r: 4 }} name="per room-night" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FbAvgTicketChart({ rows }: { rows: Array<{ period_yyyymm: string; avg_check: number | string | null; revenue: number | string; reservations: number | string }> }) {
  const data = rows.map(r => ({ m: monthLabel(r.period_yyyymm), avg: Number(r.avg_check ?? 0) }));
  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} />
          <YAxis tick={{ fill: C.axis, fontSize: 10 }} tickFormatter={(v: number) => `$${Math.round(v)}`} />
          <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 4, color: C.ink, fontSize: 11 }}
                   formatter={(v: any) => [`$${Number(v).toFixed(2)}`, 'Avg check']} />
          <Line type="monotone" dataKey="avg" stroke={C.ink} strokeWidth={2} dot={{ r: 2, fill: C.ink }} activeDot={{ r: 4 }} name="Avg check" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FbCategoryChart({ rows }: { rows: Array<{ period_yyyymm: string; category: string; revenue: number | string }> }) {
  // Pivot: pick top-6 categories by total revenue across the window, group everything else as 'Other'.
  const totalsByCat = new Map<string, number>();
  for (const r of rows) totalsByCat.set(r.category, (totalsByCat.get(r.category) ?? 0) + Number(r.revenue ?? 0));
  const topCats = [...totalsByCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const topSet = new Set(topCats);
  const monthSet = new Set<string>();
  const byMonth: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const cat = topSet.has(r.category) ? r.category : 'Other';
    monthSet.add(r.period_yyyymm);
    byMonth[r.period_yyyymm] ??= {};
    byMonth[r.period_yyyymm][cat] = (byMonth[r.period_yyyymm][cat] ?? 0) + Number(r.revenue ?? 0);
  }
  const months = [...monthSet].sort();
  const data = months.map(m => ({ m: monthLabel(m), ...byMonth[m] }));
  const series = [...topCats, 'Other'].filter(c => data.some(d => (d as Record<string, unknown>)[c]));
  return (
    <div style={{ width: '100%', height: 140 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
          <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} />
          <YAxis tick={{ fill: C.axis, fontSize: 10 }} tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${Math.round(v)}`} />
          <Tooltip contentStyle={{ background: C.bg, border: `1px solid ${C.grid}`, borderRadius: 4, color: C.ink, fontSize: 11 }}
                   formatter={(v: any, k: any) => [`$${Math.round(Number(v)).toLocaleString()}`, k]} />
          <Legend wrapperStyle={{ fontSize: 10, color: C.axis }} />
          {series.map((cat, i) => (
            <Bar key={cat} dataKey={cat} stackId="rev" fill={CAT_COLORS[i % CAT_COLORS.length]} name={cat} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
