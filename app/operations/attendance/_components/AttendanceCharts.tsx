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

// PBS 2026-05-13: utilization row for the expandable all-employees chart.
export type UtilizationRow = {
  staff_id: string;
  full_name: string;
  dept_name: string;
  hours_30d: number;
  expected_30d: number;   // contract_hours_pw × 30/7
  pct: number;             // (actual / expected) × 100
  contract_known: boolean;
};

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
  utilization,
}: {
  daily: DailyPoint[];
  topEmployees: TopEmployee[];
  utilization?: UtilizationRow[];
}) {
  const dailySorted = [...daily]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .map(p => ({ ...p, m: shortDate(p.work_date) }));

  return (
    <>
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

    {/* PBS 2026-05-13: expand to see all employees with 100% reference line. */}
    {utilization && utilization.length > 0 && (
      <UtilizationExpand rows={utilization} />
    )}
    </>
  );
}

// =============================================================================
// All-employees utilization vs contract — expandable

function UtilizationExpand({ rows }: { rows: UtilizationRow[] }) {
  // Sort: overtime first (>100%), then descending; underused at bottom.
  const sorted = [...rows].sort((a, b) => b.pct - a.pct);
  const max = Math.max(150, ...sorted.map((r) => r.pct));
  const overtime = sorted.filter((r) => r.pct > 110).length;
  const under = sorted.filter((r) => r.pct < 80).length;
  const onTarget = sorted.length - overtime - under;

  return (
    <details style={{
      marginTop: 14,
      border: '1px solid var(--kpi-frame, rgba(168,133,74,0.45))',
      background: 'var(--paper-warm)',
      borderRadius: 6,
      overflow: 'hidden',
    }}>
      <summary style={{
        cursor: 'pointer', padding: '10px 14px',
        background: 'var(--paper)',
        borderBottom: '1px solid var(--line-soft)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 11,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--brass)', fontWeight: 600,
        }}>
          ▾ All employees · utilization vs contract · last 30 days
        </span>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'var(--ink-mute)',
        }}>
          {sorted.length} people · <span style={{ color: 'var(--oxblood-soft, #c97b6a)' }}>{overtime} overtime</span> · <span style={{ color: C.good }}>{onTarget} on target</span> · <span style={{ color: 'var(--brass)' }}>{under} under</span>
        </span>
      </summary>

      <div style={{ padding: '10px 14px' }}>
        {/* Hour-pct ruler */}
        <div style={{
          display: 'grid', gridTemplateColumns: '220px 1fr 80px',
          alignItems: 'end', marginBottom: 6,
        }}>
          <div style={{
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--brass)', fontWeight: 600,
          }}>
            Employee · Dept
          </div>
          <div style={{ position: 'relative', height: 16 }}>
            {[0, 25, 50, 75, 100, 125, 150].filter((t) => t <= max).map((t) => (
              <div key={t} style={{
                position: 'absolute', left: `${(t / max) * 100}%`, top: 0,
                transform: 'translateX(-50%)',
                fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-mute)',
              }}>
                {t}%
              </div>
            ))}
          </div>
          <div style={{
            textAlign: 'right',
            fontFamily: 'var(--mono)', fontSize: 9,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--brass)', fontWeight: 600,
          }}>
            Hours · pct
          </div>
        </div>

        {sorted.map((r) => {
          const pct = Math.min(r.pct, max);
          const barW = (pct / max) * 100;
          const refLine = (100 / max) * 100;
          const isOvertime = r.pct > 110;
          const isUnder = r.pct < 80;
          const color = isOvertime ? 'var(--oxblood-soft, #c97b6a)'
                      : isUnder    ? 'var(--brass)'
                                   : C.good;
          return (
            <div key={r.staff_id} style={{
              display: 'grid', gridTemplateColumns: '220px 1fr 80px',
              alignItems: 'center', minHeight: 22, marginBottom: 2,
            }}>
              <div style={{ overflow: 'hidden', paddingRight: 8 }}>
                <div style={{
                  fontSize: 11, color: 'var(--ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.full_name}
                  {!r.contract_known && (
                    <span title="No contract hours on file — assumed 40h/wk"
                      style={{ marginLeft: 4, fontSize: 8, color: 'var(--ink-mute)' }}>
                      *
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--mono)', fontSize: 8,
                  letterSpacing: '0.10em', textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {r.dept_name}
                </div>
              </div>

              {/* Bar track */}
              <div style={{
                position: 'relative', height: 14,
                background: 'var(--paper-deep)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                {/* The bar */}
                <div title={`${r.hours_30d.toFixed(1)}h of ${r.expected_30d.toFixed(0)}h expected · ${r.pct.toFixed(0)}%`}
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${barW}%`,
                    background: color,
                  }} />
                {/* 100% reference line */}
                <div style={{
                  position: 'absolute', left: `${refLine}%`, top: -2, bottom: -2,
                  width: 0, borderLeft: '2px dashed var(--ink)',
                }} />
              </div>

              <div style={{
                textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10,
                color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
              }}>
                <span style={{ fontWeight: 600 }}>{r.hours_30d.toFixed(0)}h</span>
                <span style={{ color, marginLeft: 6 }}>{r.pct.toFixed(0)}%</span>
              </div>
            </div>
          );
        })}

        <div style={{
          marginTop: 10, fontSize: 10, color: 'var(--ink-mute)',
          fontFamily: 'var(--mono)', letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>
          dashed line = 100% of contract · &gt;110% overtime · &lt;80% under · * = no contract hours, assumed 40h/wk
        </div>
      </div>
    </details>
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
