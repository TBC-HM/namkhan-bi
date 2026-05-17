// lib/financeCharts.ts
// Server-side SVG chart helpers for the Finance · P&L page.
// Replaces the dense 7×12 "margin leakage heatmap" with 3 small side-by-side
// charts (PBS 2026-05-14): GOP trend · dept-profit trend · cost-ratio trend.
//
// Same style/colour tokens as lib/svgCharts.ts.

const ACCENT   = '#a8854a'; // brass
const ACCENT_2 = '#6f5140'; // warm
const MUTE     = '#7d7565'; // ink-mute
const FAINT    = '#d8cca8'; // line-soft
const TEXT_DIM = '#4a443c';
const GOOD     = '#3a8e5b';
const BAD      = '#b34939';

function fmtMonthShort(p: string): string {
  try { return new Date(p + '-01').toLocaleDateString('en-GB', { month: 'short' }); }
  catch { return p; }
}

function niceUpper(max: number): number {
  if (max <= 0) return 1;
  const k = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.5, 2, 3, 5, 7.5, 10]) {
    if (max <= k * m) return k * m;
  }
  return k * 10;
}

function niceRange(min: number, max: number): [number, number] {
  if (min >= 0) return [0, niceUpper(max)];
  const absMax = Math.max(Math.abs(min), Math.abs(max));
  const u = niceUpper(absMax);
  return [-u, u];
}

function fmtK(n: number): string {
  if (n === 0) return '0';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `${sign}$${(a / 1_000).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
}

function fmtPct(n: number, dp = 0): string {
  return `${n.toFixed(dp)}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) GOP trend · 12 months  (line + zero baseline + latest-value label)
// ─────────────────────────────────────────────────────────────────────────────

export interface GopTrendPoint { period: string; gop: number | null }

export function gopTrendSvg(points: GopTrendPoint[]): string {
  if (!points.length) return '';
  const W = 360, H = 220;
  const padL = 44, padR = 12, padT = 18, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const values = points.map((p) => p.gop ?? 0);
  const minV = Math.min(0, ...values);
  const maxV = Math.max(0, ...values);
  const [yMin, yMax] = niceRange(minV, maxV);
  const range = yMax - yMin || 1;

  const xStep = innerW / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => {
    const x = padL + i * xStep;
    const v = p.gop ?? 0;
    const y = padT + innerH - ((v - yMin) / range) * innerH;
    return { x, y, v: p.gop, period: p.period };
  });

  const lineStr = xy.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const zeroY = padT + innerH - ((0 - yMin) / range) * innerH;

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - ((v - yMin) / range) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${FAINT}" stroke-dasharray="2,2"/>` +
           `<text x="${padL - 4}" y="${y.toFixed(1) + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${fmtK(v)}</text>`;
  }).join('');

  // First / mid / last month labels
  const xIdx = [0, Math.floor(points.length / 2), points.length - 1];
  const xLabels = xIdx.map((i) => {
    const x = padL + i * xStep;
    return `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${MUTE}">${fmtMonthShort(points[i].period)}</text>`;
  }).join('');

  const dots = xy.map(({ x, y, v, period }) => {
    const fill = (v ?? 0) >= 0 ? GOOD : BAD;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${fill}"/>` +
           `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${fill}" fill-opacity="0">` +
           `<title>${fmtMonthShort(period)} ${period.slice(0,4)} · GOP ${v == null ? 'no data' : fmtK(v)}</title>` +
           `</circle>`;
  }).join('');

  const last = xy[xy.length - 1];
  const lastLbl = `<text x="${(last.x - 4).toFixed(1)}" y="${(last.y - 6).toFixed(1)}" text-anchor="end" font-size="10" font-weight="600" fill="${(last.v ?? 0) >= 0 ? GOOD : BAD}">${fmtK(last.v ?? 0)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" stroke="${TEXT_DIM}" stroke-width="1"/>
    <polyline points="${lineStr}" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    ${dots}
    ${lastLbl}
    ${xLabels}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Departmental profit trend · 12 months (multi-line)
//    Pass per-department monthly profit series. Renders one line per series.
// ─────────────────────────────────────────────────────────────────────────────

export interface DeptProfitSeries {
  name: string;
  color: string;
  points: Array<{ period: string; value: number | null }>;
}

export function deptProfitTrendSvg(series: DeptProfitSeries[]): string {
  if (!series.length || !series[0].points.length) return '';
  const W = 360, H = 220;
  const padL = 44, padR = 12, padT = 24, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const periods = series[0].points.map((p) => p.period);
  const n = periods.length;

  const allVals = series.flatMap((s) => s.points.map((p) => p.value ?? 0));
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const [yMin, yMax] = niceRange(minV, maxV);
  const range = yMax - yMin || 1;
  const xStep = innerW / Math.max(1, n - 1);

  const zeroY = padT + innerH - ((0 - yMin) / range) * innerH;
  const yTicks = [yMin, 0, yMax];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - ((v - yMin) / range) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${FAINT}" stroke-dasharray="2,2"/>` +
           `<text x="${padL - 4}" y="${y.toFixed(1) + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${fmtK(v)}</text>`;
  }).join('');

  const xIdx = [0, Math.floor(n / 2), n - 1];
  const xLabels = xIdx.map((i) => {
    const x = padL + i * xStep;
    return `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${MUTE}">${fmtMonthShort(periods[i])}</text>`;
  }).join('');

  const lines = series.map((s) => {
    const pts = s.points.map((p, i) => {
      const x = padL + i * xStep;
      const v = p.value ?? 0;
      const y = padT + innerH - ((v - yMin) / range) * innerH;
      return [x, y] as const;
    });
    const ptStr = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const dots = pts.map(([x, y], i) =>
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${s.color}"/>` +
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${s.color}" fill-opacity="0">` +
      `<title>${s.name} · ${fmtMonthShort(periods[i])} ${periods[i].slice(0,4)} · ${s.points[i].value == null ? 'no data' : fmtK(s.points[i].value as number)}</title>` +
      `</circle>`).join('');
    return `<polyline points="${ptStr}" fill="none" stroke="${s.color}" stroke-width="1.8"/>${dots}`;
  }).join('');

  // Legend at top
  const legend = series.map((s, i) => {
    const x = padL + i * 78;
    return `<rect x="${x}" y="6" width="10" height="10" fill="${s.color}" rx="2"/>` +
           `<text x="${x + 14}" y="15" font-size="10" fill="${TEXT_DIM}">${s.name}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px;">
    ${legend}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W - padR}" y2="${zeroY.toFixed(1)}" stroke="${TEXT_DIM}" stroke-width="1"/>
    ${lines}
    ${xLabels}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Cost ratios · 12 months (multi-line in pct)
//    Pass per-ratio monthly series. Each series is a 0..100+ percentage.
// ─────────────────────────────────────────────────────────────────────────────

export interface CostRatioSeries {
  name: string;
  color: string;
  /** Target threshold (rendered as dashed line at this pct). Optional. */
  target?: number;
  points: Array<{ period: string; pct: number | null }>;
}

export function costRatioTrendSvg(series: CostRatioSeries[]): string {
  if (!series.length || !series[0].points.length) return '';
  const W = 360, H = 220;
  const padL = 44, padR = 12, padT = 24, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const periods = series[0].points.map((p) => p.period);
  const n = periods.length;

  const allVals = series.flatMap((s) => s.points.map((p) => p.pct ?? 0)).filter((v) => isFinite(v));
  const maxV = Math.max(0, ...allVals);
  const yMax = Math.max(40, Math.ceil(maxV / 10) * 10); // at least 40% so target lines remain visible
  const range = yMax || 1;
  const xStep = innerW / Math.max(1, n - 1);

  const yTicks = [0, yMax / 2, yMax];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - (v / range) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${FAINT}" stroke-dasharray="2,2"/>` +
           `<text x="${padL - 4}" y="${y.toFixed(1) + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${fmtPct(v)}</text>`;
  }).join('');

  const xIdx = [0, Math.floor(n / 2), n - 1];
  const xLabels = xIdx.map((i) => {
    const x = padL + i * xStep;
    return `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${MUTE}">${fmtMonthShort(periods[i])}</text>`;
  }).join('');

  // Target lines (one per series with a target value)
  const targets = series.filter((s) => s.target != null).map((s) => {
    const y = padT + innerH - ((s.target as number) / range) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${s.color}" stroke-width="1" stroke-dasharray="3,3" stroke-opacity="0.4"/>`;
  }).join('');

  const lines = series.map((s) => {
    const pts = s.points.map((p, i) => {
      const x = padL + i * xStep;
      const v = p.pct ?? 0;
      const y = padT + innerH - (v / range) * innerH;
      return [x, y, p.pct] as const;
    });
    const ptStr = pts
      .filter(([, , v]) => v != null && isFinite(v as number))
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const dots = pts.map(([x, y, v], i) => {
      if (v == null || !isFinite(v)) return '';
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${s.color}"/>` +
             `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${s.color}" fill-opacity="0">` +
             `<title>${s.name} · ${fmtMonthShort(periods[i])} ${periods[i].slice(0,4)} · ${fmtPct(v as number, 1)}</title>` +
             `</circle>`;
    }).join('');
    return `<polyline points="${ptStr}" fill="none" stroke="${s.color}" stroke-width="1.8"/>${dots}`;
  }).join('');

  const legend = series.map((s, i) => {
    const x = padL + i * 96;
    const tgt = s.target != null ? ` · tgt ${fmtPct(s.target)}` : '';
    return `<rect x="${x}" y="6" width="10" height="10" fill="${s.color}" rx="2"/>` +
           `<text x="${x + 14}" y="15" font-size="10" fill="${TEXT_DIM}">${s.name}${tgt}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:220px;">
    ${legend}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    ${targets}
    ${lines}
    ${xLabels}
  </svg>`;
}

// Standard colours for legend consistency across pages
export const FIN_COLORS = {
  rooms:    '#a8854a',
  fb:       '#6f5140',
  ood:      '#3a8e5b',
  labour:   '#b34939',
  fbCost:   '#d9a54e',
  ag:       '#7a8a8e',
} as const;
