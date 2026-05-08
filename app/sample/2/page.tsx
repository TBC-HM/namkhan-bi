'use client';

// app/sample/2/page.tsx — HERO + SIDEBAR.
// Refactored 2026-05-09 to use the locked Page shell + shared Panel.

import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import SampleSwitcher from '../_components/SampleSwitcher';

const TABLE_ROWS = [
  { period: '2026-05', otb: 524, stly: 612, var_pct: -14.4, pickup: 47, status: 'risk'    },
  { period: '2026-06', otb: 681, stly: 658, var_pct:  3.5,  pickup: 58, status: 'on'      },
  { period: '2026-07', otb: 712, stly: 701, var_pct:  1.6,  pickup: 49, status: 'on'      },
  { period: '2026-08', otb: 423, stly: 502, var_pct: -15.7, pickup: 31, status: 'risk'    },
  { period: '2026-09', otb: 612, stly: 588, var_pct:  4.1,  pickup: 42, status: 'on'      },
  { period: '2026-10', otb: 588, stly: 542, var_pct:  8.5,  pickup: 38, status: 'lead'    },
  { period: '2026-11', otb: 412, stly: 468, var_pct: -12.0, pickup: 22, status: 'risk'    },
];

export default function Sample2() {
  return (
    <Page eyebrow="Sample 2 · Hero + sidebar" title="Pace · forward 6 months">
      <SampleSwitcher current={2} />

      <div style={kpiStrip}>
        <KpiBox value={3952} unit="usd"   label="OTB · 90d"            delta={{ value: -8.2, unit: 'pct',   period: 'STLY' }} />
        <KpiBox value={28}   unit="count" label="Risk months"          delta={{ value: 2,    unit: 'count', period: 'WoW'  }} />
        <KpiBox value={42}   unit="count" label="Pickup last 28d"      delta={{ value: 14,   unit: 'pct',   period: 'WoW'  }} />
        <KpiBox value={68}   unit="pct"   label="OTB vs target"        delta={{ value: -4,   unit: 'pp',    period: 'Bgt'  }} />
      </div>

      <div style={heroRow}>
        <Panel title="OTB vs STLY · next 12 months" eyebrow="hero">
          <BigPaceChart />
        </Panel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Top moves" eyebrow="insight">
            <InsightList items={[
              { tone: 'risk',  text: 'Aug pace −16% — open BAR floor' },
              { tone: 'risk',  text: 'May pace −14% — push direct promo' },
              { tone: 'lead',  text: 'Oct +9% — protect rate' },
              { tone: 'on',    text: 'Pickup 28d at +14% WoW' },
            ]} />
          </Panel>
          <Panel title="Decisions queued" eyebrow="awaiting you">
            <InsightList items={[
              { tone: 'pending', text: 'BAR ladder revision — long weekend' },
              { tone: 'pending', text: 'Wholesale allotment cut — Sep' },
              { tone: 'pending', text: 'Compset 5% adjust on Premium' },
            ]} />
          </Panel>
        </div>
      </div>

      <div style={twoCol}>
        <Panel title="Pickup curve · last 28d">
          <BarChart data={[3,5,4,7,6,9,11,14,12,15,18,21,19,22,24,28,26,31,29,33,38,35,41,39,44,47,49,52]} />
        </Panel>
        <Panel title="Wholesale vs direct mix">
          <DonutChart slices={[
            { label: 'Direct',    v: 30, color: '#a8854a' },
            { label: 'OTA',       v: 53, color: '#7d7565' },
            { label: 'Wholesale', v: 12, color: '#5a5040' },
            { label: 'GDS',       v: 5,  color: '#3d3a32' },
          ]} />
        </Panel>
      </div>

      <div style={{ marginBottom: 24 }}>
        <DataTable
          columns={[
            { key: 'period',  header: 'Stay month',                    render: (r) => r.period,                                                  sortValue: (r) => r.period },
            { key: 'otb',     header: 'OTB',         align: 'right',   render: (r) => r.otb.toLocaleString(),                                    sortValue: (r) => r.otb },
            { key: 'stly',    header: 'STLY',        align: 'right',   render: (r) => r.stly.toLocaleString(),                                   sortValue: (r) => r.stly },
            { key: 'var_pct', header: 'Δ %',         align: 'right',   render: (r) => `${r.var_pct > 0 ? '+' : ''}${r.var_pct.toFixed(1)}%`,    sortValue: (r) => r.var_pct },
            { key: 'pickup',  header: 'Pickup 28d',  align: 'right',   render: (r) => r.pickup.toString(),                                       sortValue: (r) => r.pickup },
            { key: 'status',  header: 'Status',      align: 'right',
              render: (r) => <StatusPill tone={r.status === 'risk' ? 'expired' : r.status === 'lead' ? 'active' : 'info'}>{r.status}</StatusPill>,
              sortValue: (r) => r.status,
            },
          ]}
          rows={TABLE_ROWS}
          rowKey={(r) => r.period}
        />
      </div>
    </Page>
  );
}

// ─── chart helpers ───────────────────────────────────────────────────────

function InsightList({ items }: { items: { tone: 'risk' | 'lead' | 'on' | 'pending'; text: string }[] }) {
  const dot: Record<typeof items[number]['tone'], string> = { risk: '#c0584c', lead: '#a8854a', on: '#7c9a6b', pending: '#7d7565' };
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#c9bb96', lineHeight: 1.4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot[it.tone], flexShrink: 0, marginTop: 6 }} />
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

function BigPaceChart() {
  const months = ['May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr'];
  const otb  = [524,681,712,423,612,588,412,318,288,302,358,402];
  const stly = [612,658,701,502,588,542,468,392,360,348,388,422];
  const W = 880, H = 280, padL = 32, padR = 12, padT = 16, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...otb, ...stly) * 1.1;
  const xStep = innerW / (months.length - 1);
  const otbPts  = otb.map((v, i)  => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / max) * innerH).toFixed(1)}`).join(' ');
  const stlyPts = stly.map((v, i) => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / max) * innerH).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 280 }} preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={padL} x2={W - padR} y1={padT + innerH * (1 - p)} y2={padT + innerH * (1 - p)} stroke="#2a261d" strokeDasharray="2,3" />
      ))}
      <polyline points={stlyPts} fill="none" stroke="#7d7565" strokeWidth={1.4} strokeDasharray="3,3" />
      <polyline points={otbPts}  fill="none" stroke="#a8854a" strokeWidth={2.2} />
      {months.map((m, i) => (
        <text key={m} x={padL + i * xStep} y={H - 8} textAnchor="middle" fontSize="9" fill="#7d7565" fontFamily="'JetBrains Mono', monospace">{m}</text>
      ))}
      {otb.map((v, i) => (
        <circle key={i} cx={padL + i * xStep} cy={padT + innerH - (v / max) * innerH} r={3.5} fill="#a8854a" />
      ))}
      <g transform={`translate(${padL}, ${padT})`}>
        <line x1={0} y1={0} x2={20} y2={0} stroke="#a8854a" strokeWidth={2} />
        <text x={26} y={4} fontSize="10" fill="#9b907a">OTB</text>
        <line x1={66} y1={0} x2={86} y2={0} stroke="#7d7565" strokeWidth={1.4} strokeDasharray="3,3" />
        <text x={92} y={4} fontSize="10" fill="#9b907a">STLY</text>
      </g>
    </svg>
  );
}

function BarChart({ data }: { data: number[] }) {
  const W = 480, H = 140, padL = 8, padR = 8, padB = 8, padT = 8;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data) || 1;
  const barW = innerW / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 140 }} preserveAspectRatio="xMidYMid meet">
      {data.map((v, i) => {
        const h = (v / max) * innerH;
        return <rect key={i} x={padL + i * barW + 1} y={padT + innerH - h} width={Math.max(1, barW - 2)} height={h} fill="#a8854a" opacity={0.85} />;
      })}
    </svg>
  );
}
function DonutChart({ slices }: { slices: { label: string; v: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.v, 0) || 1;
  const r = 50, R = 78, cx = 100, cy = 80;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 200 160" style={{ width: 200, height: 160 }}>
        {slices.map((s) => {
          const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const a1 = ((acc + s.v) / total) * Math.PI * 2 - Math.PI / 2;
          acc += s.v;
          const large = s.v / total > 0.5 ? 1 : 0;
          const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
          const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
          const xi0 = cx + r * Math.cos(a1), yi0 = cy + r * Math.sin(a1);
          const xi1 = cx + r * Math.cos(a0), yi1 = cy + r * Math.sin(a0);
          return <path key={s.label} d={`M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${xi0},${yi0} A${r},${r} 0 ${large} 0 ${xi1},${yi1} Z`} fill={s.color} opacity={0.9} />;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: s.color, display: 'inline-block', borderRadius: 2 }} />
            <span style={{ color: '#9b907a', minWidth: 70 }}>{s.label}</span>
            <span style={{ color: '#d8cca8' }}>{((s.v / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const kpiStrip: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 };
const heroRow:  React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 14, marginBottom: 24 };
const twoCol:   React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 24 };
