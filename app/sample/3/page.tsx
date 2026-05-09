'use client';

// app/sample/3/page.tsx — BRIEF-LED.
// Refactored 2026-05-09 to use the locked Page shell + shared Panel.

import KpiBox from '@/components/kpi/KpiBox';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import SampleSwitcher from '../_components/SampleSwitcher';

const TABLE_ROWS = [
  { channel: 'Booking.com',  rn: 84,  rev: 14820, share: 0.34, adr: 176, comm: 0.18 },
  { channel: 'Direct',       rn: 72,  rev: 14112, share: 0.30, adr: 196, comm: 0.00 },
  { channel: 'Expedia',      rn: 28,  rev:  4928, share: 0.12, adr: 176, comm: 0.16 },
  { channel: 'Agoda',        rn: 22,  rev:  3696, share: 0.09, adr: 168, comm: 0.18 },
  { channel: 'Wholesale',    rn: 18,  rev:  2430, share: 0.07, adr: 135, comm: 0.00 },
  { channel: 'GDS',          rn:  8,  rev:  1424, share: 0.04, adr: 178, comm: 0.10 },
  { channel: 'Walk-in',      rn:  6,  rev:  1056, share: 0.04, adr: 176, comm: 0.00 },
];

export default function Sample3() {
  return (
    <Page eyebrow="Sample 3 · Brief-led" title="Channels · last 30d">
      <SampleSwitcher current={3} />

      <Brief />

      <div style={kpiStrip}>
        <KpiBox value={42466} unit="usd" label="Revenue 30d"   delta={{ value: 11.4, unit: 'pct', period: 'STLY' }} />
        <KpiBox value={30}    unit="pct" label="Direct share"  delta={{ value: 2.1,  unit: 'pp',  period: 'STLY' }} />
        <KpiBox value={14}    unit="pct" label="Net commission" delta={{ value: -0.4, unit: 'pp', period: 'WoW' }} />
        <KpiBox value={158}   unit="usd" label="Net ADR"        delta={{ value: 4,    unit: 'usd', period: 'LY'  }} />
      </div>

      <div style={grid2x2}>
        <Panel title="RN by channel · 30d" eyebrow="evidence">
          <BarChartH data={[{ k: 'BDC', v: 84 }, { k: 'Direct', v: 72 }, { k: 'Expedia', v: 28 }, { k: 'Agoda', v: 22 }, { k: 'Wholesale', v: 18 }, { k: 'GDS', v: 8 }, { k: 'Walk-in', v: 6 }]} />
        </Panel>
        <Panel title="Net ADR by channel · 30d" eyebrow="evidence">
          <BarChartH data={[{ k: 'Direct', v: 196 }, { k: 'GDS', v: 178 }, { k: 'BDC', v: 176 * 0.82 }, { k: 'Expedia', v: 176 * 0.84 }, { k: 'Agoda', v: 168 * 0.82 }, { k: 'Wholesale', v: 135 }]} />
        </Panel>
        <Panel title="Commission spend · 30d" eyebrow="evidence">
          <BarChartH data={[{ k: 'BDC', v: 2667 }, { k: 'Expedia', v: 788 }, { k: 'Agoda', v: 665 }, { k: 'GDS', v: 142 }, { k: 'Direct', v: 0 }, { k: 'Wholesale', v: 0 }]} />
        </Panel>
        <Panel title="Channel cost / occupied RN · 30d" eyebrow="evidence">
          <SparkChart series={[
            { label: 'BDC',    color: '#7d7565', data: [28,30,31,32,30,33,32,34,33,35,34,36,35,33,34] },
            { label: 'Direct', color: '#a8854a', data: [4,5,6,5,5,4,5,6,6,5,5,6,5,5,6] },
          ]} />
        </Panel>
      </div>

      <div style={{ marginBottom: 24 }}>
        <DataTable
          columns={[
            { key: 'channel', header: 'Channel',                              render: (r) => r.channel,                                              sortValue: (r) => r.channel },
            { key: 'rn',      header: 'RN',          align: 'right',          render: (r) => r.rn.toString(),                                        sortValue: (r) => r.rn },
            { key: 'rev',     header: 'Revenue',     align: 'right',          render: (r) => `$${(r.rev / 1000).toFixed(1)}k`,                       sortValue: (r) => r.rev },
            { key: 'share',   header: 'Share',       align: 'right',          render: (r) => `${(r.share * 100).toFixed(0)}%`,                       sortValue: (r) => r.share },
            { key: 'adr',     header: 'ADR',         align: 'right',          render: (r) => `$${r.adr}`,                                            sortValue: (r) => r.adr },
            { key: 'comm',    header: 'Comm',        align: 'right',
              render: (r) => <StatusPill tone={r.comm === 0 ? 'active' : r.comm > 0.16 ? 'expired' : 'pending'}>{`${(r.comm * 100).toFixed(0)}%`}</StatusPill>,
              sortValue: (r) => r.comm,
            },
          ]}
          rows={TABLE_ROWS}
          rowKey={(r) => r.channel}
        />
      </div>
    </Page>
  );
}

// ─── brief — story-first AI summary ────────────────────────────────────

function Brief() {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #0f0d0a 0%, #100c08 100%)',
      border: '1px solid #2a261d', borderRadius: 12, padding: '20px 22px', marginBottom: 20,
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(120px, auto)', gap: 18, alignItems: 'start',
    }}>
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#a8854a', marginBottom: 8 }}>
          ✦ Vector · brief
        </div>
        <p style={{ margin: 0, fontFamily: "'Fraunces', Georgia, serif", fontStyle: 'italic', fontSize: 18, lineHeight: 1.55, color: '#e9e1ce' }}>
          Direct grew 2.1pp share month-on-month — first time in 6 months. BDC is still the volume leader but the commission gap (vs Direct) is 14pp at $0.18/rev. Push direct via the spring email next week; protect the BAR ladder on Premium.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Tag tone="risk" label="Risk · BDC dependency" />
          <Tag tone="lead" label="Lead · Direct momentum" />
          <Tag tone="on"   label="On · Net ADR +$4 vs LY" />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button style={briefBtn(true)}>✦ Ask Vector</button>
        <button style={briefBtn(false)}>✦ Refresh brief</button>
      </div>
    </div>
  );
}
function Tag({ tone, label }: { tone: 'risk' | 'lead' | 'on'; label: string }) {
  const map = {
    risk: { bg: '#1f0e0c', fg: '#f5b1ad', bd: '#5a2825' },
    lead: { bg: '#1f1810', fg: '#c4a06b', bd: '#3a2e1a' },
    on:   { bg: '#0f1e15', fg: '#7c9a6b', bd: '#1c3526' },
  } as const;
  const c = map[tone];
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg, borderRadius: 999, padding: '3px 10px', fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
  );
}
function briefBtn(filled: boolean): React.CSSProperties {
  return {
    background: filled ? '#a8854a' : 'transparent',
    border: '1px solid #3a3327', borderRadius: 8,
    color: filled ? '#0a0a0a' : '#a8854a',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase',
    padding: '6px 12px', fontWeight: filled ? 600 : 500, whiteSpace: 'nowrap',
  };
}

// ─── chart helpers ───────────────────────────────────────────────────────

function BarChartH({ data }: { data: { k: string; v: number }[] }) {
  const W = 460, H = 180, padL = 80, padR = 12, padT = 6, padB = 6;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.v)) || 1;
  const rowH = innerH / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180 }} preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const w = (d.v / max) * innerW;
        const y = padT + i * rowH + 2;
        return (
          <g key={d.k}>
            <text x={padL - 6} y={y + rowH / 2 + 3} textAnchor="end" fontSize="10" fill="#9b907a" fontFamily="'JetBrains Mono', monospace">{d.k}</text>
            <rect x={padL} y={y} width={w} height={Math.max(2, rowH - 6)} fill="#a8854a" opacity={0.85} rx={2}>
              <title>{`${d.k} · ${Math.round(d.v).toLocaleString()} · ${((d.v / data.reduce((s, x) => s + x.v, 0)) * 100).toFixed(1)}% mix (sample mockup)`}</title>
            </rect>
            <text x={padL + w + 4} y={y + rowH / 2 + 3} fontSize="10" fill="#d8cca8">{Math.round(d.v).toLocaleString()}</text>
          </g>
        );
      })}
    </svg>
  );
}
function SparkChart({ series }: { series: { label: string; color: string; data: number[] }[] }) {
  const W = 460, H = 160, padL = 8, padR = 8, padT = 16, padB = 8;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allMax = Math.max(...series.flatMap((s) => s.data)) || 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160 }} preserveAspectRatio="xMidYMid meet">
        {series.map((s, idx) => {
          const xStep = innerW / (s.data.length - 1 || 1);
          const pts = s.data.map((v, i) => `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / allMax) * innerH).toFixed(1)}`).join(' ');
          const lastV = s.data[s.data.length - 1] ?? 0;
          const firstV = s.data[0] ?? 0;
          return (
            <g key={s.label}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={idx === 0 ? 1.6 : 2.2}>
                <title>{`${s.label} · ${s.data.length}pt series · ${firstV} → ${lastV} (sample mockup)`}</title>
              </polyline>
              {s.data.map((v, i) => (
                <circle key={i} cx={padL + i * xStep} cy={padT + innerH - (v / allMax) * innerH} r={1.5} fill={s.color} fillOpacity={0}>
                  <title>{`${s.label} · pt ${i + 1} · ${v} (sample mockup)`}</title>
                </circle>
              ))}
            </g>
          );
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

const kpiStrip: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 };
const grid2x2:  React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 14, marginBottom: 24 };
