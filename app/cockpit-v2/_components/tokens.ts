// app/cockpit-v2/_components/tokens.ts
//
// PBS 2026-07-23 (2nd pass): aligned with canonical `.cockpit-design` tokens
// from app/(cockpit)/_design/internal/tokens.css. Previous pass over-goldened
// the palette (#C79A6B brass + #084838 forest) — canonical is muted sand
// #B8A878 + deep forest #1F3A2E on cream page #F4EFE2 with white paper cards.
//
// Source of truth: documentation.documents doc_type='design_system' v11
// + reference_design_system_v6_v7 memory + /cockpit/tasks live page.

export const TOKENS = {
  // ── surfaces ──────────────────────────────────────────────────────────
  bg:         '#F4EFE2',        // canonical cream page bg (--bg)
  bgRaised:   '#FFFFFF',        // paper white for raised cards (--paper)
  bgDeep:     '#F4EFE2',        // cream deep

  // ── text ──────────────────────────────────────────────────────────────
  ink:        '#1B1B1B',        // primary text (--ink)
  inkSoft:    '#5A5A5A',        // secondary text (--ink-soft)
  text:       '#1B1B1B',
  text2:      '#5A5A5A',
  text3:      '#8A8A8A',        // status-grey (--status-grey)

  // ── borders / hairlines ───────────────────────────────────────────────
  border:     '#E6DFCC',        // canonical hairline (--hairline)
  borderSoft: '#E6DFCC',        // same — canon has one hairline

  // ── canonical accents (muted sand + deep forest) ─────────────────────
  brass:      '#B8A878',        // canonical sand (--sand) — NOT bright gold
  sand:       '#B8A878',
  ochre:      '#B8A878',

  forest:     '#1F3A2E',        // canonical primary (--primary)
  moss:       '#1F3A2E',
  sky:        '#1F3A2E',

  // ── status ────────────────────────────────────────────────────────────
  terracotta: '#B8542A',        // canonical warning (--terracotta / --status-red)
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
