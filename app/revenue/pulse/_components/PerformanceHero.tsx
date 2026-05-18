// app/revenue/pulse/_components/PerformanceHero.tsx
// Cloudbeds-style daily performance chart:
//   - Gray bars: Occupancy LY (right Y axis, %)
//   - Solid blue line: ADR (left Y, $)
//   - Dashed blue: ADR LY
//   - Solid orange line: RevPAR (left Y, $)
//   - Dashed orange: RevPAR LY
//   - Daily X-axis ticks (every Nth label depending on window length)
// Server component — pure SVG, no client JS, themes via CSS variables.

export interface HeroRow {
  night_date: string;
  occupancy_pct: number;
  adr: number;
  revpar: number;
  stly_occupancy_pct: number | null;
  stly_adr: number | null;
  stly_revpar: number | null;
  total_rooms: number;
  rooms_sold: number;
}

export default function PerformanceHero({ rows }: { rows: HeroRow[] }) {
  if (rows.length === 0) return null;

  const W = 1120;
  const H = 320;
  const PAD_L = 56;
  const PAD_R = 64;
  const PAD_T = 16;
  const PAD_B = 56;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const n = rows.length;

  const maxDollar = Math.max(
    1,
    ...rows.map((r) => Math.max(r.adr, r.revpar, r.stly_adr ?? 0, r.stly_revpar ?? 0)),
  );
  const niceDollar = niceCeil(maxDollar);

  const xCenter = (i: number) => PAD_L + ((i + 0.5) * innerW) / n;
  const barW = Math.max(4, (innerW / n) * 0.55);
  const yDollar = (v: number) => PAD_T + innerH - (v / niceDollar) * innerH;
  const yPct = (v: number) => PAD_T + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  // Line builders
  const linePath = (key: 'adr' | 'revpar' | 'stly_adr' | 'stly_revpar') => {
    const pts: string[] = [];
    let pen = 'M';
    rows.forEach((r, i) => {
      const v = (r as any)[key] as number | null;
      if (v == null || v <= 0) {
        pen = 'M';
        return;
      }
      pts.push(`${pen} ${xCenter(i).toFixed(2)} ${yDollar(v).toFixed(2)}`);
      pen = 'L';
    });
    return pts.join(' ');
  };

  const adrPath = linePath('adr');
  const revparPath = linePath('revpar');
  const stlyAdrPath = linePath('stly_adr');
  const stlyRevparPath = linePath('stly_revpar');

  // Dollar Y ticks (left)
  const dollarTicks = niceTicks(niceDollar, 5);
  // Pct Y ticks (right)
  const pctTicks = [0, 20, 40, 60, 80, 100];

  // X-axis labels — every 3rd or 5th day depending on window
  const labelEvery = n <= 7 ? 1 : n <= 14 ? 2 : n <= 30 ? 3 : 5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxWidth: W }} xmlns="http://www.w3.org/2000/svg">
      {/* Y gridlines (left $ axis) */}
      {dollarTicks.map((t) => (
        <g key={`yg-${t}`}>
          <line
            x1={PAD_L}
            y1={yDollar(t)}
            x2={W - PAD_R}
            y2={yDollar(t)}
            stroke="var(--tbl-border, rgba(0,0,0,0.08))"
            strokeDasharray="2,3"
          />
          <text
            x={PAD_L - 8}
            y={yDollar(t) + 3}
            textAnchor="end"
            style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-mute, #7d7565)' }}
          >
            ${t.toLocaleString('en-US')}
          </text>
        </g>
      ))}

      {/* Pct Y axis labels (right) */}
      {pctTicks.map((t) => (
        <text
          key={`yp-${t}`}
          x={W - PAD_R + 8}
          y={yPct(t) + 3}
          textAnchor="start"
          style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-mute, #7d7565)' }}
        >
          {t}%
        </text>
      ))}

      {/* Bars: Occupancy LY (if present), gray with low opacity */}
      {rows.map((r, i) => {
        const occLy = r.stly_occupancy_pct;
        if (occLy == null) return null;
        const x = xCenter(i) - barW / 2;
        const y = yPct(occLy);
        const h = PAD_T + innerH - y;
        return (
          <rect
            key={`occly-${i}`}
            x={x}
            y={y}
            width={barW}
            height={h}
            fill="var(--ink-mute, #7d7565)"
            opacity={0.25}
            rx={1}
          />
        );
      })}

      {/* Bars: Occupancy THIS YEAR — slim overlay bar in brass */}
      {rows.map((r, i) => {
        if (r.occupancy_pct <= 0) return null;
        const x = xCenter(i) - barW / 4;
        const y = yPct(r.occupancy_pct);
        const h = PAD_T + innerH - y;
        return (
          <rect
            key={`occty-${i}`}
            x={x}
            y={y}
            width={barW / 2}
            height={h}
            fill="var(--brass, #a8854a)"
            opacity={0.55}
            rx={1}
          />
        );
      })}

      {/* RevPAR LY (dashed orange) */}
      {stlyRevparPath && (
        <path
          d={stlyRevparPath}
          fill="none"
          stroke="#E07856"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.7}
        />
      )}
      {/* RevPAR (solid orange) */}
      <path d={revparPath} fill="none" stroke="#E07856" strokeWidth={2} strokeLinejoin="round" />

      {/* ADR LY (dashed blue) */}
      {stlyAdrPath && (
        <path
          d={stlyAdrPath}
          fill="none"
          stroke="var(--sky, #4c8eb8)"
          strokeWidth={1.5}
          strokeDasharray="4,3"
          opacity={0.7}
        />
      )}
      {/* ADR (solid blue) */}
      <path d={adrPath} fill="none" stroke="var(--sky, #4c8eb8)" strokeWidth={2} strokeLinejoin="round" />

      {/* Hover dots */}
      {rows.map((r, i) => (
        <g key={`pts-${i}`}>
          {r.adr > 0 && (
            <circle cx={xCenter(i)} cy={yDollar(r.adr)} r={2.5} fill="var(--sky, #4c8eb8)">
              <title>
                {`${r.night_date}\nADR $${Math.round(r.adr)} · RevPAR $${Math.round(r.revpar)} · Occ ${r.occupancy_pct.toFixed(1)}%${r.stly_adr != null ? `\nLY: ADR $${Math.round(r.stly_adr)} · RevPAR $${Math.round(r.stly_revpar ?? 0)} · Occ ${r.stly_occupancy_pct?.toFixed(1) ?? '—'}%` : ''}`}
              </title>
            </circle>
          )}
          {r.revpar > 0 && (
            <circle cx={xCenter(i)} cy={yDollar(r.revpar)} r={2.5} fill="#E07856">
              <title>{`${r.night_date} · RevPAR $${Math.round(r.revpar)}`}</title>
            </circle>
          )}
        </g>
      ))}

      {/* X-axis labels */}
      {rows.map((r, i) => {
        if (i % labelEvery !== 0 && i !== n - 1) return null;
        const label = fmtTick(r.night_date);
        return (
          <text
            key={`xl-${i}`}
            x={xCenter(i)}
            y={H - PAD_B + 16}
            textAnchor="middle"
            style={{ fontFamily: 'var(--mono)', fontSize: 9, fill: 'var(--ink-mute, #7d7565)' }}
          >
            {label}
          </text>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD_L}, ${H - 14})`}>
        <LegendSwatch x={0} kind="bar" tone="var(--ink-mute, #7d7565)" opacity={0.25} label="Occ LY" />
        <LegendSwatch x={70} kind="bar" tone="var(--brass, #a8854a)" opacity={0.55} label="Occ TY" />
        <LegendSwatch x={140} kind="line" tone="var(--sky, #4c8eb8)" label="ADR" />
        <LegendSwatch x={195} kind="line" tone="var(--sky, #4c8eb8)" dashed label="ADR LY" />
        <LegendSwatch x={260} kind="line" tone="#E07856" label="RevPAR" />
        <LegendSwatch x={325} kind="line" tone="#E07856" dashed label="RevPAR LY" />
      </g>
    </svg>
  );
}

function LegendSwatch({
  x,
  kind,
  tone,
  label,
  dashed,
  opacity = 1,
}: {
  x: number;
  kind: 'bar' | 'line';
  tone: string;
  label: string;
  dashed?: boolean;
  opacity?: number;
}) {
  return (
    <g transform={`translate(${x}, 0)`}>
      {kind === 'bar' ? (
        <rect x={0} y={-8} width={10} height={10} fill={tone} opacity={opacity} rx={1} />
      ) : (
        <line x1={0} y1={-3} x2={14} y2={-3} stroke={tone} strokeWidth={2} strokeDasharray={dashed ? '4,3' : undefined} opacity={opacity} />
      )}
      <text
        x={kind === 'bar' ? 14 : 18}
        y={1}
        style={{ fontFamily: 'var(--mono)', fontSize: 10, fill: 'var(--ink-mute, #7d7565)' }}
      >
        {label}
      </text>
    </g>
  );
}

// Helpers ----------------------------------------------------------------

function niceCeil(v: number): number {
  if (v <= 100) return Math.ceil(v / 10) * 10;
  if (v <= 1000) return Math.ceil(v / 50) * 50;
  if (v <= 5000) return Math.ceil(v / 200) * 200;
  return Math.ceil(v / 500) * 500;
}

function niceTicks(max: number, n: number): number[] {
  const step = max / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(i * step));
}

function fmtTick(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
