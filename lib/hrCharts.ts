// lib/hrCharts.ts — server-side SVG chart helpers for the HR · Lifecycle page.
// Mirrors lib/financeCharts.ts pattern: 3 small side-by-side charts.
//
// 1) Seniority distribution histogram   (vertical bars by tenure bucket)
// 2) Avg seniority per department       (horizontal bars · years)
// 3) Indemnización exposure per dept    (horizontal bars · € · Donna only;
//                                        Namkhan gets a headcount chart instead)

import type { DeptSeniorityStats, SeniorityBucket } from '@/lib/hr/seniority';

const ACCENT   = '#a8854a'; // brass
const ACCENT_2 = '#6f5140'; // warm
const MUTE     = '#7d7565';
const FAINT    = '#d8cca8';
const TEXT_DIM = '#4a443c';
const BAD      = '#b34939';

function niceUpper(max: number): number {
  if (max <= 0) return 1;
  const k = Math.pow(10, Math.floor(Math.log10(max)));
  for (const m of [1, 1.5, 2, 3, 5, 7.5, 10]) {
    if (max <= k * m) return k * m;
  }
  return k * 10;
}

function fmtKEur(n: number): string {
  if (n === 0) return '€0';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`;
  return `€${n.toFixed(0)}`;
}

function fmtYears(n: number): string {
  return `${n.toFixed(1)}y`;
}

// ─── 1) Seniority distribution histogram ────────────────────────────────────
export function seniorityHistogramSvg(buckets: SeniorityBucket[]): string {
  if (!buckets.length) return '';
  const W = 360, H = 220;
  const padL = 36, padR = 12, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const yMax = niceUpper(maxCount);
  const barW = innerW / buckets.length * 0.7;
  const barGap = innerW / buckets.length * 0.3;

  // Y-axis gridlines (3 ticks)
  const yTicks = [0, yMax / 2, yMax];
  const gridLines = yTicks.map((v) => {
    const y = padT + innerH - (v / yMax) * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${FAINT}" stroke-width="0.5" stroke-dasharray="2,2"/>
            <text x="${padL - 4}" y="${y + 3}" text-anchor="end" font-size="9" fill="${MUTE}" font-family="var(--mono)">${Math.round(v)}</text>`;
  }).join('');

  const bars = buckets.map((b, i) => {
    const x = padL + i * (barW + barGap) + barGap / 2;
    const h = b.count > 0 ? (b.count / yMax) * innerH : 0;
    const y = padT + innerH - h;
    const fill = i < 2 ? ACCENT : i < 4 ? ACCENT_2 : BAD;
    return `<g>
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${fill}" rx="2"/>
      <text x="${x + barW / 2}" y="${padT + innerH + 14}" text-anchor="middle" font-size="10" fill="${TEXT_DIM}" font-family="var(--mono)">${b.label}</text>
      ${b.count > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-weight="600" fill="${TEXT_DIM}" font-family="var(--mono)">${b.count}</text>` : ''}
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    ${gridLines}
    ${bars}
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}" stroke-width="1"/>
  </svg>`;
}

// ─── 2) Avg seniority per department · horizontal bars ──────────────────────
export function deptAvgSeniorityBarSvg(byDept: DeptSeniorityStats[]): string {
  if (!byDept.length) return '';
  // Sort by avg years desc, cap at top 8 to fit
  const sorted = [...byDept].filter((d) => d.headcount > 0).sort((a, b) => b.avgYears - a.avgYears).slice(0, 8);
  const W = 360, H = 220;
  const padL = 110, padR = 36, padT = 8, padB = 16;
  const innerW = W - padL - padR;
  const rowH = (H - padT - padB) / Math.max(1, sorted.length);
  const barH = rowH * 0.7;
  const xMax = Math.max(...sorted.map((d) => d.avgYears), 1);
  const xUpper = niceUpper(xMax);

  const bars = sorted.map((d, i) => {
    const y = padT + i * rowH + (rowH - barH) / 2;
    const w = (d.avgYears / xUpper) * innerW;
    const labelTxt = d.dept_code.length > 16 ? d.dept_code.slice(0, 15) + '…' : d.dept_code;
    return `<g>
      <text x="${padL - 6}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="10" fill="${TEXT_DIM}" font-family="var(--mono)">${labelTxt}</text>
      <rect x="${padL}" y="${y}" width="${w}" height="${barH}" fill="${ACCENT}" rx="2"/>
      <text x="${padL + w + 4}" y="${y + barH / 2 + 3}" font-size="10" fill="${TEXT_DIM}" font-family="var(--mono)">${fmtYears(d.avgYears)} · n=${d.headcount}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    ${bars}
  </svg>`;
}

// ─── 3) Indemnización exposure per dept · horizontal bars (Donna only) ──────
//       For Namkhan we render headcount per dept instead.
export function deptExposureOrHeadcountBarSvg(byDept: DeptSeniorityStats[], isDonna: boolean): string {
  if (!byDept.length) return '';
  const showExposure = isDonna && byDept.some((d) => (d.exposureUnfair ?? 0) > 0);
  const sorted = [...byDept].filter((d) => d.headcount > 0).sort((a, b) => {
    const av = showExposure ? (a.exposureUnfair ?? 0) : a.headcount;
    const bv = showExposure ? (b.exposureUnfair ?? 0) : b.headcount;
    return bv - av;
  }).slice(0, 8);

  const W = 360, H = 220;
  const padL = 110, padR = 50, padT = 8, padB = 16;
  const innerW = W - padL - padR;
  const rowH = (H - padT - padB) / Math.max(1, sorted.length);
  const barH = rowH * 0.7;
  const values = sorted.map((d) => showExposure ? (d.exposureUnfair ?? 0) : d.headcount);
  const xMax = Math.max(...values, 1);
  const xUpper = niceUpper(xMax);

  const bars = sorted.map((d, i) => {
    const v = showExposure ? (d.exposureUnfair ?? 0) : d.headcount;
    const y = padT + i * rowH + (rowH - barH) / 2;
    const w = (v / xUpper) * innerW;
    const labelTxt = d.dept_code.length > 16 ? d.dept_code.slice(0, 15) + '…' : d.dept_code;
    const valLabel = showExposure ? fmtKEur(v) : `${v} ppl`;
    const fill = showExposure ? BAD : ACCENT_2;
    return `<g>
      <text x="${padL - 6}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="10" fill="${TEXT_DIM}" font-family="var(--mono)">${labelTxt}</text>
      <rect x="${padL}" y="${y}" width="${w}" height="${barH}" fill="${fill}" rx="2"/>
      <text x="${padL + w + 4}" y="${y + barH / 2 + 3}" font-size="10" fill="${TEXT_DIM}" font-family="var(--mono)">${valLabel}</text>
    </g>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    ${bars}
  </svg>`;
}
