// app/cockpit-v2/_components/tokens.ts
// Brand palette + dimensional tokens local to the cockpit-v2 surface.
// These mirror brand CSS variables so server components don't need
// runtime CSS lookup. Stay consistent with DESIGN_NAMKHAN_BI.md.

export const TOKENS = {
  bg: '#0a0a0a',
  bgRaised: '#13110e',
  bgDeep: '#0e0e0c',
  ink: 'var(--ink)',
  inkSoft: 'rgba(233,225,206,0.78)',
  text: 'var(--ink)',
  text2: 'rgba(233,225,206,0.6)',
  text3: 'rgba(233,225,206,0.4)',
  border: 'rgba(199,154,107,0.25)',
  borderSoft: 'rgba(199,154,107,0.12)',
  sand: '#bfa980',
  brass: '#a8854a',
  terracotta: '#b85f4e',
  ochre: '#c4a06b',
  oxblood: '#8e3a35',
  forest: '#7a9b6a',
  moss: '#6b9379',
  sky: '#9a8866',
};

export const SERIF = '"Fraunces", "Times New Roman", serif';
export const MONO = 'JetBrains Mono, ui-monospace, monospace';
