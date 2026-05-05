// app/revenue/inventory/_components/InventoryGraphs.tsx
//
// 3 SVG charts at the top of /revenue/inventory:
//   1. Availability trend over the window
//   2. Rate spread per day (min vs max line)
//   3. Tightness heatmap (count of tight days per week)

interface DayRow {
  date: string;
  total_avail: number;
  min_rate: number;
  max_rate: number;
}

interface Props {
  rows: DayRow[];
}

const CARD: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
  minHeight: 220,
};
const TITLE: React.CSSProperties = {
  fontSize: 'var(--t-md)', fontWeight: 600, color: 'var(--ink)', marginBottom: 2,
};
const SUB: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)', color: 'var(--ink-mute)',
  textTransform: 'uppercase', marginBottom: 10,
};

export default function InventoryGraphs({ rows }: Props) {
  const data = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 12,
        marginTop: 14,
      }}
    >
      <div style={CARD}>
        <div style={TITLE}>Availability trend</div>
        <div style={SUB}>Rooms available per night · sellable inventory</div>
        <AvailChart rows={data} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>BAR rate spread</div>
        <div style={SUB}>Min vs max rate per night · USD</div>
        <SpreadChart rows={data} />
      </div>
      <div style={CARD}>
        <div style={TITLE}>Tightness pulse</div>
        <div style={SUB}>Inventory by tightness band</div>
        <TightnessChart rows={data} />
      </div>
    </div>
  );
}

function AvailChart({ rows }: { rows: DayRow[] }) {
  if (rows.length === 0) return <Empty />;
  const w = 320, h = 160, pad = 24;
  const innerW = w - pad - 4;
  const innerH = h - pad - 16;
  const max = Math.max(1, ...rows.map((r) => r.total_avail));
  const barW = innerW / rows.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 160 }}>
      <text x={4} y={pad - 4} style={axisTxt}>{max}</text>
      <text x={4} y={pad + innerH} style={axisTxt}>0</text>
      {rows.map((r, i) => {
        const bh = (r.total_avail / max) * innerH;
        const x = pad + i * barW + 0.5;
        const y = pad + innerH - bh;
        const fill =
          r.total_avail === 0
            ? 'var(--st-bad)'
            : r.total_avail <= 3
            ? 'var(--brass)'
            : 'var(--moss)';
        return (
          <rect
            key={r.date}
            x={x}
            y={y}
            width={Math.max(1, barW - 1)}
            height={bh}
            fill={fill}
          >
            <title>{`${r.date} · ${r.total_avail} avail`}</title>
          </rect>
        );
      })}
      <text x={pad} y={h - 4} style={axisTxt}>
        {rows[0].date.slice(5)}
      </text>
      <text x={w - 32} y={h - 4} style={axisTxt}>
        {rows[rows.length - 1].date.slice(5)}
      </text>
    </svg>
  );
}

function SpreadChart({ rows }: { rows: DayRow[] }) {
  const data = rows.filter((r) => r.min_rate !== Infinity && r.max_rate !== -Infinity);
  if (data.length === 0) return <Empty />;
  const w = 320, h = 160, padL = 32, padR = 4, padT = 12, padB = 16;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const all = data.flatMap((r) => [r.min_rate, r.max_rate]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = Math.max(1, max - min);
  const xAt = (i: number) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yAt = (v: number) => padT + innerH - ((v - min) / range) * innerH;

  const minPath = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.min_rate).toFixed(1)}`).join(' ');
  const maxPath = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(r.max_rate).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 160 }}>
      <text x={4} y={padT + 6} style={axisTxt}>${Math.round(max)}</text>
      <text x={4} y={padT + innerH} style={axisTxt}>${Math.round(min)}</text>
      <path d={maxPath} fill="none" stroke="var(--brass)" strokeWidth={1.5} />
      <path d={minPath} fill="none" stroke="var(--moss)" strokeWidth={1.5} />
      <g transform={`translate(${padL}, ${padT - 2})`} style={{ fontFamily: 'var(--mono)', fontSize: 8 }}>
        <rect x={0} y={-6} width={9} height={2} fill="var(--moss)" />
        <text x={12} y={-2} style={{ fill: 'var(--ink)' }}>Min BAR</text>
        <rect x={66} y={-6} width={9} height={2} fill="var(--brass)" />
        <text x={78} y={-2} style={{ fill: 'var(--ink-mute)' }}>Max BAR</text>
      </g>
    </svg>
  );
}

function TightnessChart({ rows }: { rows: DayRow[] }) {
  const sellouts = rows.filter((r) => r.total_avail === 0).length;
  const tight = rows.filter((r) => r.total_avail > 0 && r.total_avail <= 3).length;
  const open = rows.filter((r) => r.total_avail > 3).length;
  const total = sellouts + tight + open;
  if (total === 0) return <Empty />;

  const w = 320;
  const h = 160;
  const barH = 28;
  const padL = 8;
  const padR = 70;
  const barMaxW = w - padL - padR;

  const bands = [
    { label: 'Sellouts (0)', count: sellouts, color: 'var(--st-bad)' },
    { label: 'Tight (1–3)',  count: tight,    color: 'var(--brass)' },
    { label: 'Open (4+)',    count: open,     color: 'var(--moss)'  },
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 160 }}>
      {bands.map((b, i) => {
        const y = 16 + i * (barH + 8);
        const wPx = (b.count / total) * barMaxW;
        return (
          <g key={b.label}>
            <rect x={padL} y={y} width={barMaxW} height={barH} fill="var(--paper-deep)" />
            <rect x={padL} y={y} width={wPx} height={barH} fill={b.color} />
            <text x={padL + 6} y={y + barH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--paper-warm)', fontWeight: 600 }}>
              {b.label}
            </text>
            <text x={w - padR + 4} y={y + barH / 2 + 4} style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink)', fontWeight: 600 }}>
              {b.count} · {((b.count / total) * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Empty() {
  return (
    <div style={{
      height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-faint)', fontStyle: 'italic', fontSize: 'var(--t-sm)',
    }}>
      No data
    </div>
  );
}

const axisTxt: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 9,
  fill: 'var(--ink-mute)',
};
