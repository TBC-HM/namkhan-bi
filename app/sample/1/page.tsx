'use client';

// app/sample/1/page.tsx — CLASSIC: KPI strip · 3 chart row · table
// Demo data only; PBS picks the layout, then we wire real data per dept.

import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';

const TABLE_ROWS = [
  { day: '2026-05-09', occ: 0.78, adr: 184, rev: 4280, comp: 0.74, pickup: 12 },
  { day: '2026-05-10', occ: 0.82, adr: 188, rev: 4624, comp: 0.79, pickup: 18 },
  { day: '2026-05-11', occ: 0.71, adr: 175, rev: 3727, comp: 0.74, pickup: 6  },
  { day: '2026-05-12', occ: 0.66, adr: 172, rev: 3404, comp: 0.69, pickup: 4  },
  { day: '2026-05-13', occ: 0.85, adr: 192, rev: 4896, comp: 0.81, pickup: 21 },
  { day: '2026-05-14', occ: 0.91, adr: 198, rev: 5405, comp: 0.84, pickup: 27 },
  { day: '2026-05-15', occ: 0.94, adr: 205, rev: 5781, comp: 0.86, pickup: 31 },
];

export default function Sample1() {
  return (
    <div style={page}>
      <SampleHeader title="Pulse · last 7d" eyebrow="Sample 1 · Classic — KPIs · 3 charts · table" />

      {/* KPI strip — 4 tiles */}
      <div style={kpiStrip}>
        <KpiBox value={78}   unit="pct"     label="Occupancy"  delta={{ value: 4.2, unit: 'pp', period: 'STLY' }} compare={{ value: -1.1, unit: 'pp', period: 'Bgt' }} />
        <KpiBox value={184}  unit="usd"     label="ADR"        delta={{ value: 6,   unit: 'usd', period: 'STLY' }} />
        <KpiBox value={143}  unit="usd"     label="RevPAR"     delta={{ value: 11,  unit: 'usd', period: 'LY' }}  />
        <KpiBox value={4624} unit="usd"     label="Revenue 7d" delta={{ value: 8.1, unit: 'pct', period: 'STLY' }} />
      </div>

      {/* 3-chart row — equal width */}
      <div style={chartRow}>
        <Panel title="Daily revenue · 30d">
          <BarChart data={[42,38,46,52,48,55,61,58,52,49,57,63,68,71,66,59,62,68,74,78,72,70,75,82,88,85,79,84,91,96]} />
        </Panel>
        <Panel title="Channel mix · 30d">
          <DonutChart slices={[{ label: 'Direct', v: 30, color: '#a8854a' }, { label: 'OTA', v: 53, color: '#7d7565' }, { label: 'Wholesale', v: 12, color: '#5a5040' }, { label: 'GDS', v: 5, color: '#3d3a32' }]} />
        </Panel>
        <Panel title="Pace vs STLY · next 30d">
          <LineChart series={[
            { label: 'Now',  color: '#a8854a', data: [12,18,24,32,40,48,55,61,68,76,84,92,100,108,116,123,130,138,146,154,162,168,175,182,189,195,201,207,213,219] },
            { label: 'STLY', color: '#7d7565', data: [16,22,29,38,46,54,62,69,77,85,94,103,112,120,128,135,143,151,159,167,175,183,191,199,207,215,223,231,239,247] },
          ]} />
        </Panel>
      </div>

      {/* Data table — full width */}
      <div style={tableWrap}>
        <DataTable
          columns={[
            { key: 'day',    header: 'Date',                   render: (r) => r.day,                                            sortValue: (r) => r.day },
            { key: 'occ',    header: 'OCC',     align: 'right', render: (r) => `${(r.occ * 100).toFixed(0)}%`,                   sortValue: (r) => r.occ },
            { key: 'adr',    header: 'ADR',     align: 'right', render: (r) => `$${r.adr}`,                                      sortValue: (r) => r.adr },
            { key: 'rev',    header: 'Revenue', align: 'right', render: (r) => `$${(r.rev / 1000).toFixed(1)}k`,                 sortValue: (r) => r.rev },
            { key: 'comp',   header: 'Comp',    align: 'right', render: (r) => `${(r.comp * 100).toFixed(0)}%`,                  sortValue: (r) => r.comp },
            { key: 'pickup', header: 'Pickup',  align: 'right',
              render: (r) => <StatusPill tone={r.pickup > 20 ? 'active' : r.pickup > 10 ? 'pending' : 'inactive'}>{r.pickup > 0 ? `+${r.pickup}` : `${r.pickup}`}</StatusPill>,
              sortValue: (r) => r.pickup,
            },
          ]}
          rows={TABLE_ROWS}
          rowKey={(r) => r.day}
        />
      </div>

      <SampleFooter sampleName="1 · Classic" />
    </div>
  );
}

// ─── shared primitives (used by all 3 samples) ──────────────────────────

function SampleHeader({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase',
        color: '#a8854a', marginBottom: 6,
      }}>{eyebrow}</div>
      <h1 style={{
        fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic',
        fontWeight: 300, fontSize: 32, color: '#e9e1ce', margin: 0,
      }}>{title}</h1>
    </div>
  );
}
function SampleFooter({ sampleName }: { sampleName: string }) {
  return (
    <div style={{
      marginTop: 48, paddingTop: 16, borderTop: '1px solid #1f1c15',
      display: 'flex', gap: 12, alignItems: 'center',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5a5448',
    }}>
      <span>Sample {sampleName}</span>
      <span style={{ color: '#3d3a32' }}>·</span>
      <a href="/sample" style={{ color: '#9b907a', textDecoration: 'none' }}>← all samples</a>
      <span style={{ color: '#3d3a32' }}>·</span>
      <a href="/sample/1" style={{ color: '#9b907a', textDecoration: 'none' }}>Sample 1</a>
      <a href="/sample/2" style={{ color: '#9b907a', textDecoration: 'none' }}>Sample 2</a>
      <a href="/sample/3" style={{ color: '#9b907a', textDecoration: 'none' }}>Sample 3</a>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0f0d0a', border: '1px solid #1f1c15', borderRadius: 10,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a',
      }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}
function BarChart({ data }: { data: number[] }) {
  const W = 480, H = 160, padL = 8, padR = 8, padB = 8, padT = 8;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data) || 1;
  const barW = innerW / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }} preserveAspectRatio="xMidYMid meet">
      {data.map((v, i) => {
        const h = (v / max) * innerH;
        return <rect key={i} x={padL + i * barW + 1} y={padT + innerH - h} width={Math.max(1, barW - 2)} height={h} fill="#a8854a" opacity={0.85} />;
      })}
    </svg>
  );
}
function DonutChart({ slices }: { slices: { label: string; v: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.v, 0) || 1;
  const r = 60, R = 88, cx = 110, cy = 90;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 220 180" style={{ width: 220, height: 180 }}>
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
function LineChart({ series }: { series: { label: string; color: string; data: number[] }[] }) {
  const W = 480, H = 160, padL = 8, padR = 8, padB = 8, padT = 8;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allMax = Math.max(...series.flatMap((s) => s.data)) || 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }} preserveAspectRatio="xMidYMid meet">
        {series.map((s, idx) => {
          const xStep = innerW / (s.data.length - 1 || 1);
          const pts = s.data.map((v, i) => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / allMax) * innerH).toFixed(1)}`).join(' ');
          return <polyline key={s.label} points={pts} fill="none" stroke={s.color} strokeWidth={idx === 0 ? 2 : 1.4} strokeDasharray={idx === 0 ? undefined : '3,2'} />;
        })}
      </svg>
      <div style={{ display: 'flex', gap: 14, fontSize: 11, marginTop: 4 }}>
        {series.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 2, background: s.color, display: 'inline-block' }} />
            <span style={{ color: '#9b907a' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────
const page: React.CSSProperties = {
  minHeight: '100vh', background: '#0a0a0a', color: '#e9e1ce',
  fontFamily: "'Inter Tight', system-ui, sans-serif",
  padding: '32px 48px 64px',
  maxWidth: 1280, margin: '0 auto',
};
const kpiStrip: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24,
};
const chartRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24,
};
const tableWrap: React.CSSProperties = { marginBottom: 24 };
