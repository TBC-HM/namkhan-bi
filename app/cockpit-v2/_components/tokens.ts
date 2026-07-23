// app/cockpit-v2/_components/tokens.ts
//
// PBS 2026-07-23 (3rd pass — live-verified): every canonical page (/cockpit/tasks,
// /h/[pid]/revenue) wraps DashboardPage in `<div style={{ background: '#FFFFFF' }}>`,
// hard-overriding the .cockpit-design cream. Ergo the actual live design surface is
// pure paper white with hairlines, dark ink text, and primary #1F3A2E accents only
// on active tabs / delta cells. No sand/gold in headline strips or containers.
//
// Deleted the assumption that --bg cream #F4EFE2 was the visible page — every real
// page bypasses it. Keys unchanged for back-compat with legacy consumers.

export const TOKENS = {
  // ── surfaces (paper white — the ONLY canonical background) ───────────
  bg:         '#FFFFFF',
  bgRaised:   '#FFFFFF',
  bgDeep:     '#FFFFFF',

  // ── text ──────────────────────────────────────────────────────────────
  ink:        '#1B1B1B',
  inkSoft:    '#5A5A5A',
  text:       '#1B1B1B',
  text2:      '#5A5A5A',
  text3:      '#8A8A8A',

  // ── borders / hairlines ───────────────────────────────────────────────
  border:     '#E6DFCC',
  borderSoft: '#E6DFCC',

  // ── accents (used SPARINGLY: active-tab underline, primary CTA only) ─
  brass:      '#B8A878',       // sand — reserved for status-amber, not decoration
  sand:       '#B8A878',
  ochre:      '#B8A878',

  forest:     '#1F3A2E',       // primary — active state + primary CTA background
  moss:       '#1F3A2E',
  sky:        '#1F3A2E',

  // ── status ────────────────────────────────────────────────────────────
  terracotta: '#B8542A',       // status-red (deltas / warnings)
  oxblood:    '#8E3A35',

  // ── tinted accents ───────────────────────────────────────────────────
  accentSoft: '#B8A87822',
  accentLine: '#B8A87855',
  blueSoft:   '#1F3A2E22',
  blueLine:   '#1F3A2E55',
  deepInk:    '#1F3A2E',
};

export const SERIF = '"Inter Tight", system-ui, sans-serif';
export const MONO = 'JetBrains Mono, ui-monospace, monospace';
