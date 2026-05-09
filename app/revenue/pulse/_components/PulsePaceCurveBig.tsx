// app/revenue/pulse/_components/PulsePaceCurveBig.tsx
//
// PBS 2026-05-09: ONE big chart — booking-pace curve (OTB vs STLY vs Budget),
// full-width, 320px tall. Consumes the same PaceCurveRow[] as the small
// version. RM watches one line, not six.

import type { PaceCurveRow } from '@/lib/pulseData';

interface Props {
  rows: PaceCurveRow[];
}

function buildSvg(rows: PaceCurveRow[]): string {
  if (!rows.length) return '';
  // Use a wider, taller viewBox; preserveAspectRatio="none"-style sizing keeps
  // it responsive. Inline width:100%; height:320px applied on the wrapper.
  const W = 1200, H = 320;
  const padL = 56, padR = 24, padT = 18, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const all: number[] = [];
  for (const r of rows) {
    if (r.rooms_actual != null) all.push(Number(r.rooms_actual));
    if (r.rooms_otb != null) all.push(Number(r.rooms_otb));
    if (r.rooms_stly_daily_avg != null) all.push(Number(r.rooms_stly_daily_avg));
    if (r.rooms_budget_daily_avg != null) all.push(Number(r.rooms_budget_daily_avg));
  }
  const max = Math.max(1, ...all);
  const xStep = innerW / Math.max(1, rows.length - 1);
  const xy = (i: number, v: number) =>
    `${(padL + i * xStep).toFixed(1)},${(padT + innerH - (v / max) * innerH).toFixed(1)}`;
  const series = (key: keyof PaceCurveRow) => {
    const pts: string[] = [];
    rows.forEach((r, i) => {
      const v = (r as any)[key];
      if (v != null) pts.push(`${pts.length === 0 ? 'M' : 'L'}${xy(i, Number(v))}`);
    });
    return pts.join(' ');
  };

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayIdx = rows.findIndex((r) => r.day >= todayIso);
  const todayLine =
    todayIdx >= 0
      ? `<line x1="${(padL + todayIdx * xStep).toFixed(1)}" y1="${padT}" x2="${(padL + todayIdx * xStep).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#a8854a" stroke-dasharray="3,4" opacity="0.55"/>
         <text x="${(padL + todayIdx * xStep + 4).toFixed(1)}" y="${(padT + 12).toFixed(1)}" font-size="10" fill="#a8854a">today</text>`
      : '';

  // y gridlines
  const yTicks = [0, max / 2, max].map((v) => {
    const y = padT + innerH - (v / max) * innerH;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#d8cca8" stroke-dasharray="2,3" opacity="0.6"/>
            <text x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#7d7565">${Math.round(v)}</text>`;
  }).join('');

  // x ticks: first, today, last (and a couple in between)
  const labelIdx = [0, Math.floor(rows.length / 4), Math.floor(rows.length / 2), Math.floor(3 * rows.length / 4), rows.length - 1];
  const xLabels = labelIdx
    .filter((i, k, arr) => arr.indexOf(i) === k && i >= 0 && i < rows.length)
    .map((i) => {
      const x = padL + i * xStep;
      return `<text x="${x.toFixed(1)}" y="${(padT + innerH + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="#7d7565">${rows[i].day.slice(5)}</text>`;
    }).join('');

  // hover dots (per series, per point)
  const hoverDots = rows.map((r, i) => {
    const cx = (padL + i * xStep).toFixed(1);
    const parts: string[] = [r.day];
    if (r.rooms_actual != null) parts.push(`actual ${Math.round(Number(r.rooms_actual))}`);
    if (r.rooms_otb != null) parts.push(`OTB ${Math.round(Number(r.rooms_otb))}`);
    if (r.rooms_stly_daily_avg != null) parts.push(`STLY ${Math.round(Number(r.rooms_stly_daily_avg))}`);
    if (r.rooms_budget_daily_avg != null) parts.push(`budget ${Math.round(Number(r.rooms_budget_daily_avg))}`);
    parts.push('v_pace_curve');
    const txt = parts.join(' · ');
    const ys: string[] = [];
    const pushY = (v: number | null | undefined) => {
      if (v == null) return;
      ys.push((padT + innerH - (Number(v) / max) * innerH).toFixed(1));
    };
    pushY(r.rooms_actual);
    pushY(r.rooms_otb);
    pushY(r.rooms_stly_daily_avg);
    pushY(r.rooms_budget_daily_avg);
    return ys.map((cy) => `<circle cx="${cx}" cy="${cy}" r="6" fill="transparent"><title>${txt}</title></circle>`).join('');
  }).join('');

  // legend swatches
  const legend = `
    <g font-size="10" fill="#4a443c">
      <rect x="${padL}" y="${(padT - 8).toFixed(1)}" width="10" height="2" fill="#1a2e21"/>
      <text x="${(padL + 14).toFixed(1)}" y="${(padT - 4).toFixed(1)}">Actual</text>
      <rect x="${(padL + 70).toFixed(1)}" y="${(padT - 8).toFixed(1)}" width="10" height="2" fill="#a8854a"/>
      <text x="${(padL + 84).toFixed(1)}" y="${(padT - 4).toFixed(1)}">OTB</text>
      <rect x="${(padL + 130).toFixed(1)}" y="${(padT - 8).toFixed(1)}" width="10" height="2" fill="#7d7565"/>
      <text x="${(padL + 144).toFixed(1)}" y="${(padT - 4).toFixed(1)}">STLY</text>
      <rect x="${(padL + 190).toFixed(1)}" y="${(padT - 8).toFixed(1)}" width="10" height="2" fill="#3B5BFF"/>
      <text x="${(padL + 204).toFixed(1)}" y="${(padT - 4).toFixed(1)}">Budget</text>
    </g>`;

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:320px;display:block;">
    <line x1="${padL}" y1="${(padT + innerH).toFixed(1)}" x2="${(W - padR).toFixed(1)}" y2="${(padT + innerH).toFixed(1)}" stroke="#7d7565"/>
    ${yTicks}
    ${todayLine}
    ${xLabels}
    <path d="${series('rooms_actual')}" fill="none" stroke="#1a2e21" stroke-width="2.5"><title>Pace · actual occupied · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_otb')}" fill="none" stroke="#a8854a" stroke-width="2"><title>Pace · OTB · ${rows.length} days · v_pace_curve</title></path>
    <path d="${series('rooms_stly_daily_avg')}" fill="none" stroke="#7d7565" stroke-width="1.5" stroke-dasharray="4,3"><title>Pace · STLY daily avg · v_pace_curve</title></path>
    <path d="${series('rooms_budget_daily_avg')}" fill="none" stroke="#3B5BFF" stroke-width="1.5" stroke-dasharray="4,3"><title>Pace · budget daily avg · v_pace_curve</title></path>
    ${hoverDots}
    ${legend}
  </svg>`;
}

export default function PulsePaceCurveBig({ rows }: Props) {
  const svg = buildSvg(rows);
  return (
    <div style={card}>
      <div style={title}>Booking pace curve</div>
      <div style={sub}>−30d → +30d · room-nights · Actual / OTB / STLY / Budget · v_pace_curve</div>
      {svg ? (
        <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%' }} />
      ) : (
        <div style={empty}>No pace data yet</div>
      )}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--paper-warm)',
  border: '1px solid var(--paper-deep)',
  borderRadius: 8,
  padding: '14px 16px',
};
const title: React.CSSProperties = {
  fontSize: 'var(--t-md)',
  fontWeight: 600,
  color: 'var(--ink)',
  marginBottom: 2,
};
const sub: React.CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: 'var(--t-xs)',
  letterSpacing: 'var(--ls-loose)',
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  marginBottom: 10,
};
const empty: React.CSSProperties = {
  height: 320,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ink-faint)',
  fontStyle: 'italic',
  fontSize: 'var(--t-sm)',
};
