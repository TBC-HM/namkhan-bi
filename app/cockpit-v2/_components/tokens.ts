// app/cockpit-v2/_components/tokens.ts
//
// PBS 2026-07-23: swapped from Beyond Circle dark palette to Namkhan
// canonical paper-white. Key names unchanged so every existing consumer
// (10 legacy pages · GroupedTabBar · TabBar · Pill) modernizes with a
// single file change. Structural rewrites to canonical primitives
// (DashboardPage / Container / KpiTile) happen page-by-page after this.
//
// Colour rules follow design_system v6/v7 + token-ladder burn rule
// (var(--paper-warm) resolves DARK on Namkhan — always hardcode #FFFFFF).

export const TOKENS = {
  // ── surfaces (paper white + hairline neutrals) ───────────────────────
  bg:         '#FFFFFF',        // paper white — primary background
  bgRaised:   '#FAFAF7',        // very slight off-white for raised strips
  bgDeep:     '#F5F0E1',        // cream — elevated cards / code blocks

  // ── text (dark ink on paper) ─────────────────────────────────────────
  ink:        '#1B1B1B',        // primary text
  inkSoft:    '#5A5A5A',        // secondary text
  text:       '#1B1B1B',
  text2:      '#5A5A5A',
  text3:      '#8A8A8A',        // muted / captions

  // ── borders / lines ──────────────────────────────────────────────────
  border:     '#E6DFCC',        // canonical hairline
  borderSoft: '#F0EBDD',        // even softer hairline

  // ── Namkhan signature accents (gold + forest) ────────────────────────
  brass:      '#C79A6B',        // Namkhan gold — primary accent
  sand:       '#E8D3A9',        // light sand for gradients
  ochre:      '#C79A6B',        // alias of brass (back-compat)

  forest:     '#084838',        // Namkhan forest — secondary accent
  moss:       '#084838',        // alias of forest
  sky:        '#084838',        // alias of forest

  // ── status colours (contrast-adjusted for light background) ──────────
  terracotta: '#B85A3A',        // muted warning — deeper for legibility on white
  oxblood:    '#8E3A35',        // deep error red

  // ── tinted accents ───────────────────────────────────────────────────
  accentSoft: '#C79A6B22',      // gold @ ~13% alpha
  accentLine: '#C79A6B55',      // gold @ ~33% alpha
  blueSoft:   '#08483822',      // forest @ ~13% alpha
  blueLine:   '#08483855',      // forest @ ~33% alpha
  deepInk:    '#083830',        // deep forest — for "press"/active states
};

export const SERIF = '"Fraunces", "Times New Roman", serif';
export const MONO = 'JetBrains Mono, ui-monospace, monospace';
