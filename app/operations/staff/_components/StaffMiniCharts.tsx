// app/operations/staff/_components/StaffMiniCharts.tsx
// PBS 2026-05-13 — 3 side-by-side mini charts under KPIs, above tables.
// Same pattern as the /revenue pages: ResponsiveContainer + Recharts.
//
//   1. Headcount over time
//   2. Total company cost (USD)
//   3. Cost per head (USD)

'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceDot,
} from 'recharts';

export type StaffTrendPoint = {
  period_month: string;
  headcount: number;
  total_grand_usd: number;
};

const C = {
  grid:   'var(--line-soft, #d8cca8)',
  axis:   'var(--ink-mute, #7d7565)',
  brass:  'var(--brass, #a8854a)',
  moss:   '#1c4d3a',
  good:   '#2c7a4b',
  bg:     'var(--surf-1, #fbf9f2)',
  border: 'var(--kpi-frame, rgba(168,133,74,0.45))',
  label:  'var(--ink, #1c1815)',
};

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
}

function fmtUsdShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `$${Math.round(abs / 1_000)}k`;
  return `$${Math.round(abs)}`;
}

export default function StaffMiniCharts({
  rows,
  selectedMonth,
}: {
  rows: StaffTrendPoint[];
  selectedMonth: string;
}) {
  const series = [...rows]
    .sort((a, b) => a.period_month.localeCompare(b.period_month))
    .map(r => ({
      m: monthLabel(r.period_month),
      iso: r.period_month,
      hc: Number(r.headcount || 0),
      cost: Number(r.total_grand_usd || 0),
      cph: r.headcount > 0 ? Number(r.total_grand_usd || 0) / r.headcount : 0,
    }));

  if (series.length === 0) {
    return (
      <div className="panel dashed" style={{ padding: 16, color: 'var(--ink-mute)', fontStyle: 'italic', textAlign: 'center' }}>
        No payroll history yet.
      </div>
    );
  }

  // Tooltip style + label
  const tooltipStyle = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.label,
    fontSize: 12,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      <ChartCard title="Headcount">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: C.axis, fontSize: 10 }} domain={['auto','auto']} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v}`, 'Headcount']} />
            <Line type="monotone" dataKey="hc" stroke={C.moss} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <ReferenceDot
              x={series.find(s => s.iso === selectedMonth)?.m ?? ''}
              y={series.find(s => s.iso === selectedMonth)?.hc ?? 0}
              r={5} fill={C.brass} stroke="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Total cost · USD">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: C.axis, fontSize: 10 }} tickFormatter={fmtUsdShort} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtUsdShort(Number(v)), 'Total cost']} />
            <Line type="monotone" dataKey="cost" stroke={C.brass} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <ReferenceDot
              x={series.find(s => s.iso === selectedMonth)?.m ?? ''}
              y={series.find(s => s.iso === selectedMonth)?.cost ?? 0}
              r={5} fill={C.moss} stroke="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cost / head · USD">
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fill: C.axis, fontSize: 10 }} tickFormatter={fmtUsdShort} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtUsdShort(Number(v)), 'Per head']} />
            <Line type="monotone" dataKey="cph" stroke={C.good} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            <ReferenceDot
              x={series.find(s => s.iso === selectedMonth)?.m ?? ''}
              y={series.find(s => s.iso === selectedMonth)?.cph ?? 0}
              r={5} fill={C.brass} stroke="none"
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: '12px 12px 6px', height: 200, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        fontFamily: 'var(--mono)',
        fontSize: 'var(--t-xs)',
        letterSpacing: 'var(--ls-extra)',
        textTransform: 'uppercase',
        color: 'var(--brass)',
        marginBottom: 6,
      }}>
        {title}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
