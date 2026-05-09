// 3-graph row at the top of /revenue/parity, mirroring the staff/compset pattern.
// Pure SVG, no chart library. All data from existing views.

interface TrendPoint { day: string; severity: string; n: number }
interface BreachLite { severity: string; rule_code: string }
interface MatrixLite { stay_date: string; num_comps_undercutting: number | null; comps_with_price: number | null }

interface Props {
  trend: TrendPoint[];
  breaches: BreachLite[];
  matrix: MatrixLite[];
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
};
const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function ParityGraphs({ trend, breaches, matrix }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 12,
      marginTop: 14,
    }}>
      <div style={CARD}>
        <div style={TITLE}>Breaches detected · last 30 days</div>
        <div style={SUB}>Daily count, stacked by severity</div>
        <TrendChart trend={trend} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Open by severity</div>
        <div style={SUB}>What's actionable right now</div>
        <SeverityChart breaches={breaches} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Comp undercut · per stay date</div>
        <div style={SUB}># comps cheaper than Namkhan</div>
        <UndercutChart matrix={matrix} />
      </div>
    </div>
  );
}

// ---------- Chart 1: trend over 30 days ----------
function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return <Empty />;

  // Build day -> severity -> count
  const byDay: Record<string, Record<string, number>> = {};
  trend.forEach((t) => {
    if (!byDay[t.day]) byDay[t.day] = {};
    byDay[t.day][t.severity] = (byDay[t.day][t.severity] ?? 0) + Number(t.n);
  });
  const days = Object.keys(byDay).sort();
  if (days.length === 0) return <Empty />;

  // Pad to last 14 days for context
  const today = new Date();
  const padded: { day: string; critical: number; high: number; medium: number; low: number; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay[key] ?? {};
    const c = Number(row.critical ?? 0);
    const h = Number(row.high ?? 0);
    const m = Number(row.medium ?? 0);
    const l = Number(row.low ?? 0);
    padded.push({ day: key, critical: c, high: h, medium: m, low: l, total: c + h + m + l });
  }

  const w = 320, h = 140, pad = 24;
  const innerW = w - pad - 8;
  const innerH = h - pad - 16;
  const maxV = Math.max(1, ...padded.map((d) => d.total));
  const barW = (innerW / padded.length) - 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
      <text x={4} y={20} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{maxV}</text>
      {padded.map((d, i) => {
        const x = pad + i * (innerW / padded.length) + 1;
        const baseY = 12 + innerH;
        let y = baseY;
        const layers: { n: number; fill: string }[] = [
          { n: d.critical, fill: 'var(--st-bad)' },
          { n: d.high,     fill: '#a05a3c' },
          { n: d.medium,   fill: 'var(--brass)' },
          { n: d.low,      fill: 'var(--ink-mute)' },
        ];
        return (
          <g key={d.day}>
            {layers.map((layer, li) => {
              if (layer.n === 0) return null;
              const segH = (layer.n / maxV) * innerH;
              y -= segH;
              const sevName = ['critical', 'high', 'medium', 'low'][li];
              return (
                <rect key={li} x={x} y={y} width={barW} height={segH} fill={layer.fill}>
                  <title>{`${d.day} · ${sevName} ${layer.n} · total ${d.total} breaches · v_parity_breach_trend`}</title>
                </rect>
              );
            })}
            {i % 3 === 0 && (
              <text x={x + barW / 2} y={h - 4} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 7, fill: 'var(--ink-mute)' }}>
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <g transform={`translate(${pad}, ${h - 18})`} style={{ fontFamily: 'var(--mono)', fontSize: 7 }}>
        <rect x={0} y={-4} width={6} height={2} fill="var(--st-bad)" />
        <text x={9} y={0} style={{ fill: 'var(--ink)' }}>CRIT</text>
        <rect x={42} y={-4} width={6} height={2} fill="#a05a3c" />
        <text x={51} y={0} style={{ fill: 'var(--ink)' }}>HIGH</text>
        <rect x={84} y={-4} width={6} height={2} fill="var(--brass)" />
        <text x={93} y={0} style={{ fill: 'var(--ink)' }}>MED</text>
        <rect x={120} y={-4} width={6} height={2} fill="var(--ink-mute)" />
        <text x={129} y={0} style={{ fill: 'var(--ink-mute)' }}>LOW</text>
      </g>
    </svg>
  );
}

// ---------- Chart 2: open by severity (vertical bars) ----------
function SeverityChart({ breaches }: { breaches: BreachLite[] }) {
  if (breaches.length === 0) return <Empty />;
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  breaches.forEach((b) => {
    const s = (b.severity ?? '').toLowerCase();
    counts[s] = (counts[s] ?? 0) + 1;
  });

  const order: { key: string; label: string; fill: string }[] = [
    { key: 'critical', label: 'CRIT',   fill: 'var(--st-bad)' },
    { key: 'high',     label: 'HIGH',   fill: '#a05a3c' },
    { key: 'medium',   label: 'MED',    fill: 'var(--brass)' },
    { key: 'low',      label: 'LOW',    fill: 'var(--ink-mute)' },
  ];

  const w = 320, h = 140, pad = 24;
  const innerW = w - pad - 8;
  const innerH = h - pad - 16;
  const max = Math.max(1, ...Object.values(counts));
  const groupW = innerW / order.length;
  const barW = groupW * 0.6;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
      <text x={4} y={20} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{max}</text>
      {order.map((o, i) => {
        const n = counts[o.key] ?? 0;
        const x = pad + i * groupW + (groupW - barW) / 2;
        const baseY = 12 + innerH;
        const bh = (n / max) * innerH;
        return (
          <g key={o.key}>
            <rect x={x} y={baseY - bh} width={barW} height={bh} fill={o.fill} opacity={n > 0 ? 1 : 0.3}>
              <title>{`${o.label} · ${n} open breach${n === 1 ? '' : 'es'} · v_parity_breaches`}</title>
            </rect>
            <text x={x + barW / 2} y={baseY - bh - 3} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink)', fontWeight: 600 }}>
              {n}
            </text>
            <text x={x + barW / 2} y={h - 4} textAnchor="middle"
              style={{ fontFamily: 'var(--mono)', fontSize: 8, fill: 'var(--ink-mute)' }}>
              {o.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------- Chart 3: undercut count per stay date ----------
function UndercutChart({ matrix }: { matrix: MatrixLite[] }) {
  const rows = matrix
    .filter((m) => m.num_comps_undercutting != null && (m.comps_with_price ?? 0) > 0)
    .sort((a, b) => a.stay_date.localeCompare(b.stay_date))
    .slice(-20);
  if (rows.length === 0) return <Empty />;

  const w = 320, h = 140, pad = 24;
  const innerW = w - pad - 8;
  const innerH = h - pad - 16;
  const max = Math.max(1, ...rows.map((r) => Number(r.num_comps_undercutting ?? 0)));
  const barW = (innerW / rows.length) - 1.5;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 140 }}>
      <text x={4} y={20} style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute)' }}>{max}</text>
      {rows.map((r, i) => {
        const n = Number(r.num_comps_undercutting ?? 0);
        const total = Number(r.comps_with_price ?? 0);
        const x = pad + i * (innerW / rows.length);
        const baseY = 12 + innerH;
        const bh = (n / max) * innerH;
        const fill = n === 0 ? 'var(--moss)' : n / Math.max(1, total) > 0.5 ? 'var(--st-bad)' : 'var(--brass)';
        return (
          <g key={r.stay_date}>
            <rect x={x} y={baseY - bh} width={barW} height={bh} fill={fill}>
              <title>{`${r.stay_date} · ${n} of ${total} comps undercutting · v_parity_matrix`}</title>
            </rect>
            {i % 4 === 0 && (
              <text x={x + barW / 2} y={h - 4} textAnchor="middle"
                style={{ fontFamily: 'var(--mono)', fontSize: 7, fill: 'var(--ink-mute)' }}>
                {r.stay_date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
      <g transform={`translate(${pad}, ${h - 18})`} style={{ fontFamily: 'var(--mono)', fontSize: 7 }}>
        <rect x={0} y={-4} width={6} height={2} fill="var(--moss)" />
        <text x={9} y={0} style={{ fill: 'var(--ink)' }}>NONE</text>
        <rect x={42} y={-4} width={6} height={2} fill="var(--brass)" />
        <text x={51} y={0} style={{ fill: 'var(--ink)' }}>SOME</text>
        <rect x={84} y={-4} width={6} height={2} fill="var(--st-bad)" />
        <text x={93} y={0} style={{ fill: 'var(--ink)' }}>MANY</text>
      </g>
    </svg>
  );
}

function Empty() {
  return (
    <div style={{
      height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-faint)', fontStyle: 'italic',
    }}>
      No data yet
    </div>
  );
}
