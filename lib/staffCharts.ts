// lib/staffCharts.ts
// Server-rendered SVG charts for /operations/staff. Match /revenue/channels visual language.
// Brand palette resolved hex (matches :root tokens — SVG attrs can't read CSS vars).

const ACCENT    = '#a8854a'; // brass
const ACCENT_2  = '#c4a06b'; // brass-soft
const MUTE      = '#7d7565'; // ink-mute
const FAINT     = '#d8cca8'; // line-soft
const TEXT_DIM  = '#4a443c'; // ink-soft
const MOSS      = '#1a2e21';
const MOSS_GLOW = '#6b9379';
const ST_BAD    = '#a14b3a'; // st-bad-ish
const ST_WARN   = '#c08a2e';

const fmtUsd = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

const fmtMonth = (iso: string) => {
  const [y, m] = iso.split('-');
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m) - 1] ?? '';
  return `${month} ${y.slice(2)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) Monthly cost trend · 12-month area chart of total payroll cost (USD)
//    Plus a thin headcount line series in mute on a secondary axis.
// ─────────────────────────────────────────────────────────────────────────────

export interface CostTrendPoint {
  period: string;       // '2025-01-01'
  cost_usd: number;     // company cost USD
  headcount: number;    // distinct staff paid
}

export function staffCostTrendSvg(points: CostTrendPoint[]): string {
  if (!points.length) return '';
  const W = 520, H = 260;
  const padL = 50, padR = 50, padT = 20, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const maxCost = Math.max(...sorted.map((p) => p.cost_usd), 1);
  const niceMaxCost = Math.ceil(maxCost / 5000) * 5000;
  const maxHc = Math.max(...sorted.map((p) => p.headcount), 1);
  const niceMaxHc = Math.ceil(maxHc / 10) * 10;
  const xStep = innerW / Math.max(1, sorted.length - 1);

  const costXY = sorted.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + innerH - (p.cost_usd / niceMaxCost) * innerH;
    return [x, y] as const;
  });
  const hcXY = sorted.map((p, i) => {
    const x = padL + i * xStep;
    const y = padT + innerH - (p.headcount / niceMaxHc) * innerH;
    return [x, y] as const;
  });
  const lineStr = costXY.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaStr = `M ${costXY[0][0].toFixed(1)},${(padT + innerH).toFixed(1)} L ${lineStr.replace(/ /g, ' L ')} L ${costXY[costXY.length - 1][0].toFixed(1)},${(padT + innerH).toFixed(1)} Z`;
  const hcLineStr = hcXY.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Y-axis (left = cost USD)
  const yTicks = [0, niceMaxCost / 2, niceMaxCost];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - (v / niceMaxCost) * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${FAINT}" stroke-dasharray="2,2"/><text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${fmtUsd(v)}</text>`;
  }).join('');

  // Y-axis right (HC)
  const yRTicks = [0, niceMaxHc / 2, niceMaxHc];
  const yRLabels = yRTicks.map((v) => {
    const y = padT + innerH - (v / niceMaxHc) * innerH;
    return `<text x="${W - padR + 5}" y="${y + 3}" text-anchor="start" font-size="9" fill="${MUTE}">${Math.round(v)}</text>`;
  }).join('');

  // X-axis labels (every other month)
  const xLabels = sorted.map((p, i) => {
    if (i % 2 !== 0 && i !== sorted.length - 1) return '';
    const x = padL + i * xStep;
    return `<text x="${x.toFixed(1)}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${MUTE}">${fmtMonth(p.period)}</text>`;
  }).join('');

  // Hover dots
  const dots = sorted.map((p, i) => {
    const [x, y] = costXY[i];
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${ACCENT}" fill-opacity="0" stroke="none">
      <title>${fmtUsd(p.cost_usd)} · ${fmtMonth(p.period)} · ${p.headcount} paid · ops.payroll_monthly</title>
    </circle><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${ACCENT}" pointer-events="none"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;">
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + innerH}" stroke="${MUTE}"/>
    <line x1="${W - padR}" y1="${padT}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    ${yRLabels}
    <path d="${areaStr}" fill="${ACCENT}" fill-opacity="0.12"/>
    <polyline points="${lineStr}" fill="none" stroke="${ACCENT}" stroke-width="2"/>
    <polyline points="${hcLineStr}" fill="none" stroke="${MOSS}" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.7"/>
    ${dots}
    ${xLabels}
    <text x="${padL - 32}" y="${padT + innerH / 2}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}" transform="rotate(-90 ${padL - 32} ${padT + innerH / 2})">Monthly cost (USD)</text>
    <text x="${W - padR + 32}" y="${padT + innerH / 2}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}" transform="rotate(90 ${W - padR + 32} ${padT + innerH / 2})">Headcount</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Cost per worked day · ranked horizontal bars by department
//    Color-coded: green ≤ p33, amber ≤ p66, red > p66 of the dept range.
// ─────────────────────────────────────────────────────────────────────────────

export interface CostPerDayBar {
  dept: string;
  cost_usd: number;       // total period cost USD for the dept
  days_worked: number;    // total days worked across staff
  staff_count: number;    // distinct staff paid
}

export function staffCostPerDaySvg(rows: CostPerDayBar[]): string {
  if (!rows.length) return '';
  const items = rows
    .map((r) => ({ ...r, cpd: r.days_worked > 0 ? r.cost_usd / r.days_worked : 0 }))
    .filter((r) => r.cpd > 0)
    .sort((a, b) => b.cpd - a.cpd);
  if (!items.length) return '';

  const W = 520, H = 260;
  const padL = 145, padR = 60, padT = 16, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...items.map((i) => i.cpd), 1);
  const niceMax = Math.ceil(max / 5) * 5;
  const rowH = Math.min(22, innerH / items.length);

  // Tertile thresholds for color
  const sorted = [...items].map((i) => i.cpd).sort((a, b) => a - b);
  const t1 = sorted[Math.floor(sorted.length / 3)] ?? 0;
  const t2 = sorted[Math.floor(2 * sorted.length / 3)] ?? 0;
  const colorFor = (v: number) => v <= t1 ? MOSS_GLOW : v <= t2 ? ST_WARN : ST_BAD;

  const bars = items.map((it, i) => {
    const y = padT + i * rowH;
    const w = (it.cpd / niceMax) * innerW;
    const c = colorFor(it.cpd);
    const dept = it.dept.length > 22 ? it.dept.slice(0, 22) + '…' : it.dept;
    return `
      <text x="${padL - 6}" y="${(y + rowH/2 + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="${TEXT_DIM}">${dept}</text>
      <rect x="${padL}" y="${(y + 3).toFixed(1)}" width="${w.toFixed(1)}" height="${(rowH - 6).toFixed(1)}" fill="${c}" fill-opacity="0.85" rx="2">
        <title>$${it.cpd.toFixed(0)}/day · ${it.dept} · ${fmtUsd(it.cost_usd)} cost / ${it.days_worked} days · ${it.staff_count} staff</title>
      </rect>
      <text x="${padL + w + 4}" y="${(y + rowH/2 + 3).toFixed(1)}" text-anchor="start" font-size="10" fill="${TEXT_DIM}">$${it.cpd.toFixed(0)}</text>`;
  }).join('');

  // Axis line
  const xTicks = [0, niceMax / 2, niceMax];
  const xLabels = xTicks.map((v) => {
    const x = padL + (v / niceMax) * innerW;
    return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="${MUTE}">$${v.toFixed(0)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + items.length * rowH}" stroke="${MUTE}"/>
    ${bars}
    ${xLabels}
    <text x="${padL + innerW/2}" y="${H - 2}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}">USD per worked day · last paid month</text>
  </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Tenure distribution · histogram of active staff by hire-date bucket
// ─────────────────────────────────────────────────────────────────────────────

export interface TenureBucket {
  label: string;       // '<1 y'
  count: number;
  total_cost_usd: number;
}

export function staffTenureDistSvg(buckets: TenureBucket[]): string {
  if (!buckets.length) return '';
  const W = 520, H = 260;
  const padL = 50, padR = 24, padT = 24, padB = 50;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const niceMax = Math.ceil(max / 5) * 5 || max;
  const barW = innerW / buckets.length - 12;

  const bars = buckets.map((b, i) => {
    const x = padL + i * (innerW / buckets.length) + 6;
    const h = (b.count / niceMax) * innerH;
    const y = padT + innerH - h;
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${ACCENT}" fill-opacity="0.85" rx="2">
        <title>${b.count} staff · ${b.label} tenure · ${fmtUsd(b.total_cost_usd)}/mo monthly cost · v_staff_register_extended</title>
      </rect>
      <text x="${(x + barW/2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${TEXT_DIM}">${b.count}</text>
      <text x="${(x + barW/2).toFixed(1)}" y="${H - 30}" text-anchor="middle" font-size="9" fill="${MUTE}">${b.label}</text>
      <text x="${(x + barW/2).toFixed(1)}" y="${H - 16}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}">${fmtUsd(b.total_cost_usd)}/mo</text>`;
  }).join('');

  // Y-axis grid
  const yTicks = [0, niceMax / 2, niceMax];
  const yLabels = yTicks.map((v) => {
    const y = padT + innerH - (v / niceMax) * innerH;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${FAINT}" stroke-dasharray="2,2"/><text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="9" fill="${MUTE}">${Math.round(v)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:260px;">
    <line x1="${padL}" y1="${padT + innerH}" x2="${W - padR}" y2="${padT + innerH}" stroke="${MUTE}"/>
    ${yLabels}
    ${bars}
    <text x="${padL - 32}" y="${padT + innerH / 2}" text-anchor="middle" font-size="9" fill="${TEXT_DIM}" transform="rotate(-90 ${padL - 32} ${padT + innerH / 2})">Active staff</text>
  </svg>`;
}
