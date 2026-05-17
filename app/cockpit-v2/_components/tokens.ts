// app/cockpit-v2/_components/tokens.ts
//
// PBS 2026-05-17: switched from Namkhan dark-warm-brass to the Beyond Circle
// holding palette (peach + teal on navy). Matches /tbc home + the holding
// brand identity. Cockpit backend now reads as "holding-owned, not property".
//
// Source: app/tbc/_styles.module.css `--tbc-*` variables.

export const TOKENS = {
  // ── surfaces (BC dark navy, not black) ───────────────────────────────
  bg:         '#0B0E11',        // BC primary background
  bgRaised:   '#12161B',        // panels / raised surfaces
  bgDeep:     '#181D24',        // elevated cards, code blocks

  // ── text (BC alice-blue on dark) ─────────────────────────────────────
  ink:        '#F0F8FF',        // primary text — alice-blue
  inkSoft:    '#A8AEB8',        // secondary text — dim cool grey
  text:       '#F0F8FF',
  text2:      '#A8AEB8',
  text3:      '#6C7380',        // muted

  // ── borders / lines ──────────────────────────────────────────────────
  border:     '#2A3340',        // strong line — BC line-strong
  borderSoft: '#1F2630',        // soft line — BC line

  // ── BC signature accents (peach + teal) ──────────────────────────────
  brass:      '#F7AC67',        // BC PEACH — primary accent (replaces warm-tan brass)
  sand:       '#F5C481',        // light peach for gradients
  ochre:      '#F7AC67',        // alias of peach (kept for back-compat with components)

  forest:     '#29818D',        // BC TEAL — secondary accent (replaces forest green)
  moss:       '#29818D',        // alias of teal
  sky:        '#29818D',        // alias of teal

  // ── status colours (kept warm so they still read as warning/success) ─
  terracotta: '#E07856',        // muted warning — peach-red on navy
  oxblood:    '#8E3A35',        // deep error red

  // ── BC-specific tokens ───────────────────────────────────────────────
  accentSoft: '#F7AC6722',      // peach @ ~13% alpha for tinted backgrounds
  accentLine: '#F7AC6755',      // peach @ ~33% alpha for accent borders
  blueSoft:   '#29818D22',
  blueLine:   '#29818D55',
  deepInk:    '#002428',        // BC deep teal — for "press"/active states on peach
};

export const SERIF = '"Fraunces", "Times New Roman", serif';
export const MONO = 'JetBrains Mono, ui-monospace, monospace';
