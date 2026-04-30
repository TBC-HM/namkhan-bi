// lib/svgCharts.ts
// Server-side SVG chart generators that render replacement chart SVGs for the mockup.
// Each function returns a complete <svg>…</svg> string matching the mockup's viewBox/aesthetic.
// If data is empty, returns the mockup's original SVG via the `fallback` arg (caller passes it).

const ACCENT = '#b8854a';
const MUTE = '#9ca3af';
const FAINT = '#e5e7eb';
const TEXT_DIM = '#6b7280';

// ─────────────────────────────────────────────────────────────────────────────
// 1) Daily revenue · last 90d  (Pulse)
//    viewBox 520 260, area+polyline accent-coloured, y-axis 0→max
// ─────────────────────────────────────────────────────────────────────────────

export interface DailyRevPoint { night_date: string; total_rev: number; }

export function dailyRevenue90dSvg(points: DailyRevPoint[]): string {
  if (!points.length) return '';
  const W = 520, H = 260;
  const padL = 50, padR = 20, padT = 20, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...points.map((p) => p.total_rev), 1);
  const niceMax = Math.ceil(max / 1000) * 1000; // round to next $1k
  const xStep = innerW / Math.max(1, points.length - 1);

  const xy = points.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + innerH - (p.total_rev / niceMax) * innerH;
    return [x, y] as const;
  });
  const lineStr = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaStr = `M ${xy[0][0].toFixed(1)},${(padT + innerH).toFixed(1)} L ${lineStr.replace(/ /g, ' L ')} L ${xy[xy.length - 1][0].toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

  // y-axis ticks at 0 / max/2 / max
  const yTicks = [0, niceMax / 2, niceMax];
  const yLabels = yTicks.map((v, i) => {
    const y = padT + innerH - (v / niceMax) * innerH;
    const lbl = v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v.toFixed(0)}`;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${FAINT}" stroke-dasharray="2,2"/><text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${lbl}</text>`;
  }).join('');

  // x-axis: first / mid / last date label
  const fmtDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch { return d; }
  };
  const xLabels = [0, Math.floor(points.length / 2), points.length - 1].map((i) => {
    const x = padL + i * xStep;
    return `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${MUTE}">${fmtDate(points[i].night_date)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;">
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    <path d="${areaStr}" fill="${ACCENT}" fill-opacity="0.10"/>
    <polyline points="${lineStr}" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    ${xLabels}
    <text x="${padL - 30}" y="${padT + innerH / 2}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}" transform="rotate(-90 ${padL - 30} ${padT + innerH / 2})">Daily revenue (USD)</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Channel mix · 30d (Pulse)
//    Stacked horizontal bar (Direct / OTA / Wholesale / Other)
// ─────────────────────────────────────────────────────────────────────────────

export interface ChannelMixSlice { label: string; pct: number; color: string; }

export function channelMix30dSvg(slices: ChannelMixSlice[]): string {
  if (!slices.length) return '';
  const W = 520, H = 260;
  const barY = 80, barH = 40, padL = 30, padR = 30;
  const innerW = W - padL - padR;
  let cursor = padL;
  const segments = slices.map((s) => {
    const w = (s.pct / 100) * innerW;
    const seg = `<rect x="${cursor.toFixed(1)}" y="${barY}" width="${w.toFixed(1)}" height="${barH}" fill="${s.color}" opacity="0.85"/>
      <text x="${(cursor + w / 2).toFixed(1)}" y="${barY + barH / 2 + 4}" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">${s.pct.toFixed(0)}%</text>`;
    cursor += w;
    return seg;
  }).join('');

  const legend = slices.map((s, i) => `
    <rect x="${padL + i * 110}" y="160" width="14" height="14" fill="${s.color}" opacity="0.85"/>
    <text x="${padL + i * 110 + 20}" y="171" font-size="11" fill="${TEXT_DIM}">${s.label} (${s.pct.toFixed(0)}%)</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;">
    <text x="${padL}" y="60" font-size="12" font-weight="600" fill="${TEXT_DIM}">Revenue mix · last 30 days</text>
    ${segments}
    ${legend}
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) OTB vs STLY by stay month (Pace)
//    Side-by-side bars per month, viewBox 600 280
// ─────────────────────────────────────────────────────────────────────────────

export interface PaceMonthRow { ci_month: string; otb: number; stly: number; }

export function paceOtbStlySvg(rows: PaceMonthRow[]): string {
  if (!rows.length) return '';
  const W = 600, H = 280;
  const padL = 50, padR = 20, padT = 20, padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...rows.flatMap((r) => [r.otb, r.stly]), 1);
  const niceMax = Math.ceil(max / 50) * 50;
  const groupW = innerW / rows.length;
  const barW = Math.max(4, (groupW - 6) / 2);

  const yTicks = [0, niceMax / 2, niceMax];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - (v / niceMax) * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${FAINT}" stroke-dasharray="2,2"/><text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${v}</text>`;
  }).join('');

  const bars = rows.map((r, i) => {
    const xBase = padL + i * groupW + 3;
    const otbH = (r.otb / niceMax) * innerH;
    const stlyH = (r.stly / niceMax) * innerH;
    const xLbl = padL + i * groupW + groupW / 2;
    return `
      <rect x="${xBase}" y="${(padT + innerH - otbH).toFixed(1)}" width="${barW.toFixed(1)}" height="${otbH.toFixed(1)}" fill="${ACCENT}" opacity="0.85"/>
      <rect x="${(xBase + barW + 1).toFixed(1)}" y="${(padT + innerH - stlyH).toFixed(1)}" width="${barW.toFixed(1)}" height="${stlyH.toFixed(1)}" fill="${MUTE}" opacity="0.7"/>
      <text x="${xLbl.toFixed(1)}" y="${H - 30}" text-anchor="middle" font-size="9" fill="${MUTE}">${String(r.ci_month).slice(0, 7)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:280px;">
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    ${bars}
    <text x="${padL}" y="${H - 12}" font-size="10" fill="${ACCENT}" font-weight="600">■ OTB</text>
    <text x="${padL + 60}" y="${H - 12}" font-size="10" fill="${MUTE}" font-weight="600">■ STLY</text>
  </svg>`;
}
