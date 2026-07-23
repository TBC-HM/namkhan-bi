// app/holding/it/cockpit/_components/tokens.ts
//
// PBS 2026-07-23 (4th pass — verified from /h/260955/revenue screenshot):
// canonical is cream page bg + white KPI tiles + forest primary + dark top nav.
// Matches .cockpit-design tokens.css. /cockpit/tasks special-cases itself to
// white (page-level override); the default that /h/[pid]/revenue and every
// HodLanding uses is CREAM.
//
// PBS burn note: I flipped cream → white in the 3rd pass off the /cockpit/tasks
// wrapper. That was a page-level override, not the canonical. Reverted here.

export const TOKENS = {
  // ── surfaces ──────────────────────────────────────────────────────────
  bg:         '#F4EFE2',        // cream page body (--bg)
  bgRaised:   '#FFFFFF',        // white cards / KPI tile fills (--paper)
  bgDeep:     '#F4EFE2',        // same as bg

  // ── text ──────────────────────────────────────────────────────────────
  ink:        '#1B1B1B',        // (--ink)
  inkSoft:    '#5A5A5A',        // (--ink-soft)
  text:       '#1B1B1B',
  text2:      '#5A5A5A',
  text3:      '#8A8A8A',

  // ── borders / hairlines ───────────────────────────────────────────────
  border:     '#E6DFCC',        // (--hairline)
  borderSoft: '#E6DFCC',

  // ── canonical accents ────────────────────────────────────────────────
  brass:      '#B8A878',        // sand — status-amber, LY-chip fill (--sand)
  sand:       '#B8A878',
  ochre:      '#B8A878',

  forest:     '#1F3A2E',        // primary — active tab, CTAs (--primary)
  moss:       '#1F3A2E',
  sky:        '#1F3A2E',

  // ── status ────────────────────────────────────────────────────────────
  terracotta: '#B8542A',        // (--status-red)
  oxblood:    '#8E3A35',

  // ── tinted accents ───────────────────────────────────────────────────
  accentSoft: '#B8A87822',
  accentLine: '#B8A87855',
  blueSoft:   '#1F3A2E22',
  blueLine:   '#1F3A2E55',
  deepInk:    '#1F3A2E',
};

export const SERIF = '"Fraunces", "Times New Roman", serif';
export const MONO = 'JetBrains Mono, ui-monospace, monospace';
