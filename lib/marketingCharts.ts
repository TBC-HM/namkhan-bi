// lib/marketingCharts.ts
// Server-rendered SVG charts for /marketing snapshot. Matches the visual
// language of lib/staffCharts.ts (same pad/stroke/font tokens, same brand
// palette resolved to hex because <svg> can't read CSS variables).

const ACCENT    = '#a8854a'; // brass
const ACCENT_2  = '#c4a06b'; // brass-soft
const MUTE      = '#7d7565'; // ink-mute
const FAINT     = '#d8cca8'; // line-soft
const TEXT_DIM  = '#4a443c'; // ink-soft
const MOSS      = '#1a2e21';
const MOSS_GLOW = '#6b9379';
const ST_BAD    = '#a14b3a';
const ST_WARN   = '#c08a2e';

// ─────────────────────────────────────────────────────────────────────────────
// 1) Inventory by tier — horizontal bar of room-type counts (units sold)
// ─────────────────────────────────────────────────────────────────────────────

export interface InventoryTierRow {
  tier: string;
  units: number;
  room_types: number;
}

export function inventoryByTierSvg(rows: InventoryTierRow[]): string {
  if (!rows.length) return '';
  const W = 520, H = 260;
  const padL = 90, padR = 50, padT = 16, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const sorted = [...rows].sort((a, b) => b.units - a.units);
  const max = Math.max(...sorted.map((r) => r.units), 1);
  const niceMax = Math.ceil(max / 5) * 5;
  const barH = Math.min(28, innerH / sorted.length - 6);

  const tierColor = (tier: string) =>
    tier === 'premium' ? ACCENT : tier === 'signature' ? MOSS_GLOW : ACCENT_2;

  const bars = sorted.map((r, i) => {
    const y = padT + i * (innerH / sorted.length);
    const w = (r.units / niceMax) * innerW;
    const color = tierColor(r.tier.toLowerCase());
    return `
      <g>
        <text x="${padL - 8}" y="${y + barH / 2 + 4}"
          text-anchor="end" font-family="JetBrains Mono, ui-monospace, monospace"
          font-size="11" fill="${TEXT_DIM}" letter-spacing="0.04em"
          style="text-transform:uppercase">${escape(r.tier)}</text>
        <rect x="${padL}" y="${y}" width="${Math.max(2, w)}" height="${barH}"
          rx="2" fill="${color}">
          <title>${escape(r.tier)} · ${r.units} units · ${r.room_types} room type${r.room_types === 1 ? '' : 's'}</title>
        </rect>
        <text x="${padL + w + 6}" y="${y + barH / 2 + 4}"
          font-family="Fraunces, Georgia, serif" font-size="13"
          fill="${TEXT_DIM}" font-style="italic">
          ${r.units}<tspan font-size="10" fill="${MUTE}" font-style="normal" dx="4">/ ${r.room_types} types</tspan>
        </text>
      </g>`;
  }).join('');

  // X-axis ticks
  const ticks = [0, niceMax / 2, niceMax].map((t) => {
    const x = padL + (t / niceMax) * innerW;
    return `
      <line x1="${x}" x2="${x}" y1="${padT}" y2="${padT + innerH}" stroke="${FAINT}" stroke-width="0.5" />
      <text x="${x}" y="${H - padB + 14}" text-anchor="middle"
        font-family="JetBrains Mono, monospace" font-size="9" fill="${MUTE}">${t}</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      ${ticks}
      ${bars}
      <text x="${padL}" y="${H - 4}" font-family="JetBrains Mono, monospace"
        font-size="9" fill="${MUTE}" letter-spacing="0.06em"
        style="text-transform:uppercase">UNITS</text>
    </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Facilities + activities by category — vertical bars
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryCountRow {
  label: string;
  count: number;
  tone?: 'good' | 'neutral' | 'warn';
}

export function categoryBarsSvg(rows: CategoryCountRow[]): string {
  if (!rows.length) return '';
  const W = 520, H = 260;
  const padL = 36, padR = 16, padT = 22, padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(...rows.map((r) => r.count), 1);
  const niceMax = Math.max(5, Math.ceil(max / 5) * 5);
  const slot = innerW / rows.length;
  const barW = Math.min(48, slot * 0.7);

  const toneColor = (t: 'good' | 'neutral' | 'warn' | undefined) =>
    t === 'good' ? MOSS_GLOW : t === 'warn' ? ST_WARN : ACCENT;

  const bars = rows.map((r, i) => {
    const x = padL + i * slot + (slot - barW) / 2;
    const h = (r.count / niceMax) * innerH;
    const y = padT + innerH - h;
    return `
      <g>
        <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(2, h)}"
          rx="2" fill="${toneColor(r.tone)}">
          <title>${escape(r.label)} · ${r.count}</title>
        </rect>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
          font-family="Fraunces, Georgia, serif" font-size="13" font-style="italic"
          fill="${TEXT_DIM}">${r.count}</text>
        <text x="${x + barW / 2}" y="${padT + innerH + 14}" text-anchor="middle"
          font-family="JetBrains Mono, monospace" font-size="9.5" fill="${MUTE}"
          letter-spacing="0.04em" style="text-transform:uppercase">
          ${escape(r.label)}
        </text>
      </g>`;
  }).join('');

  // y-axis grid
  const grid = [0, 0.5, 1].map((p) => {
    const y = padT + innerH - p * innerH;
    return `<line x1="${padL}" x2="${padL + innerW}" y1="${y}" y2="${y}" stroke="${FAINT}" stroke-width="0.5" />`;
  }).join('');

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      ${grid}
      ${bars}
    </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Channel presence — handle filled vs follower-data status
// ─────────────────────────────────────────────────────────────────────────────

export interface ChannelStatusRow {
  platform: string;
  has_handle: boolean;
  followers: number | null;
}

export function channelMatrixSvg(rows: ChannelStatusRow[]): string {
  if (!rows.length) return '';
  const W = 520, H = 260;
  const padL = 90, padR = 90, padT = 16, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Sort: claimed (with handle) on top, then alphabetical
  const sorted = [...rows].sort((a, b) => {
    if (a.has_handle !== b.has_handle) return b.has_handle ? 1 : -1;
    return a.platform.localeCompare(b.platform);
  });

  const slot = innerH / sorted.length;
  const dot = 9;

  const items = sorted.map((r, i) => {
    const y = padT + i * slot + slot / 2;
    const handleColor = r.has_handle ? MOSS_GLOW : MUTE;
    const followerColor = r.followers && r.followers > 0 ? MOSS_GLOW : ST_BAD;
    const followerLabel = r.followers && r.followers > 0
      ? r.followers.toLocaleString('en-US')
      : 'no data';
    return `
      <g>
        <text x="${padL - 12}" y="${y + 4}" text-anchor="end"
          font-family="JetBrains Mono, monospace" font-size="11"
          fill="${TEXT_DIM}" letter-spacing="0.04em"
          style="text-transform:uppercase">${escape(r.platform)}</text>
        <circle cx="${padL + 16}" cy="${y}" r="${dot / 2}" fill="${handleColor}">
          <title>${r.has_handle ? 'Handle claimed' : 'Handle missing — set in /settings/property/social'}</title>
        </circle>
        <text x="${padL + 32}" y="${y + 4}"
          font-family="Inter Tight, system-ui, sans-serif" font-size="11"
          fill="${MUTE}">${r.has_handle ? 'claimed' : 'no handle'}</text>
        <circle cx="${padL + innerW - 70}" cy="${y}" r="${dot / 2}" fill="${followerColor}">
          <title>${r.followers && r.followers > 0 ? `${r.followers} followers` : 'No follower data — manual entry pending'}</title>
        </circle>
        <text x="${padL + innerW - 56}" y="${y + 4}"
          font-family="Fraunces, Georgia, serif" font-size="13" font-style="italic"
          fill="${r.followers && r.followers > 0 ? TEXT_DIM : MUTE}">
          ${escape(followerLabel)}
        </text>
      </g>`;
  }).join('');

  // legend headers
  const legend = `
    <text x="${padL + 16}" y="${padT - 4}" text-anchor="middle"
      font-family="JetBrains Mono, monospace" font-size="8.5" fill="${MUTE}"
      letter-spacing="0.08em" style="text-transform:uppercase">handle</text>
    <text x="${padL + innerW - 70}" y="${padT - 4}" text-anchor="middle"
      font-family="JetBrains Mono, monospace" font-size="8.5" fill="${MUTE}"
      letter-spacing="0.08em" style="text-transform:uppercase">followers</text>`;

  return `
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg">
      ${legend}
      ${items}
    </svg>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// utils
// ─────────────────────────────────────────────────────────────────────────────

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
