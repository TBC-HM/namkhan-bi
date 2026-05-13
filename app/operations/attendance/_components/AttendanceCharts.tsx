// app/operations/attendance/_components/AttendanceCharts.tsx
// 3 mini line charts for the attendance page.

'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';

export type DailyPoint = {
  work_date: string;
  events: number;
  distinct_employees: number;
  hours: number;
};

export type TopEmployee = { full_name: string; hours: number };

const C = {
  grid:    'var(--line-soft, #d8cca8)',
  axis:    'var(--ink-mute, #7d7565)',
  brass:   'var(--brass, #c89a5a)',
  moss:    '#1c4d3a',
  good:    'var(--st-good, #2c7a4b)',
  bg:      'var(--paper-warm, #f4ecd8)',
  border:  'var(--kpi-frame, rgba(168,133,74,0.45))',
  label:   'var(--ink, #1c1815)',
  labelMute: 'var(--ink-mute, #7d7565)',
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[Number(m) - 1]} ${Number(d)}`;
}

const tooltipStyle: React.CSSProperties = {
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4,
  padding: '6px 10px', color: C.label, fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
};
const itemStyle: React.CSSProperties  = { color: C.label, fontFamily: 'var(--sans)' };
const labelStyle: React.CSSProperties = { color: C.labelMute, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 };

export function AttendanceCharts({
  daily,
  topEmployees,
}: {
  daily: DailyPoint[];
  topEmployees: TopEmployee[];
}) {
  const dailySorted = [...daily]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .map(p => ({ ...p, m: shortDate(p.work_date) }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      <ChartCard title="Hours / day · last 90 days">
        <ResponsiveContainer>
          <LineChart data={dailySorted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis tick={{ fill: C.axis, fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} labelStyle={labelStyle} cursor={{ stroke: C.brass, strokeWidth: 1 }} formatter={(v: any) => [`${Number(v).toFixed(1)}h`, 'Hours']} />
            <Line type="monotone" dataKey="hours" stroke={C.brass} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Distinct people / day">
        <ResponsiveContainer>
          <LineChart data={dailySorted} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: C.axis, fontSize: 10 }} interval="preserveStartEnd" minTickGap={30} />
            <YAxis tick={{ fill: C.axis, fontSize: 10 }} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} labelStyle={labelStyle} cursor={{ stroke: C.brass, strokeWidth: 1 }} formatter={(v: any) => [`${v}`, 'People']} />
            <Line type="monotone" dataKey="distinct_employees" stroke={C.moss} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Top 10 by hours · last 30 days">
        <ResponsiveContainer>
          <BarChart data={topEmployees} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} layout="vertical">
            <CartesianGrid stroke={C.grid} strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" tick={{ fill: C.axis, fontSize: 10 }} />
            <YAxis type="category" dataKey="full_name" tick={{ fill: C.axis, fontSize: 9 }} width={110} />
            <Tooltip contentStyle={tooltipStyle} itemStyle={itemStyle} labelStyle={labelStyle} cursor={{ fill: 'rgba(168,133,74,0.1)' }} formatter={(v: any) => [`${Number(v).toFixed(1)}h`, 'Hours']} />
            <Bar dataKey="hours" fill={C.good} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{
      padding: '12px 12px 6px', height: 240, display: 'flex', flexDirection: 'column',
      background: 'var(--paper-warm)', border: '1px solid var(--kpi-frame)', borderRadius: 6,
    }}>
      <div style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 6,
      }}>{title}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
