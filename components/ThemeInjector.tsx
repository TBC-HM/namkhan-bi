// components/ThemeInjector.tsx
// Server component. Receives brand palette from property.brand and injects
// CSS variables that drive the entire page theme: page bg, top bar, surfaces,
// borders, text tones, accents.
//
// Tokens emitted (when palette has a `background` role — i.e. light-themed
// property like Donna). Dark-themed properties (Namkhan — palette only has
// `background_dark`) keep the hardcoded dark fallbacks baked into each
// component's inline `var(--name, #darkhex)` so /<dept> legacy routes that
// never hit ThemeInjector still render as before.

import type { ReactNode } from 'react';

type PaletteEntry = { hex: string; name: string; role: string; usage?: string };

const NAMKHAN_DEFAULTS = {
  primary: '#1F3A2E',
  bg: '#F4EFE2',
  surface: '#FFFFFF',
  sand: '#B8A878',
  terracotta: '#B8542A',
  neutral: '#363C3D',
  primaryFg: '#F4EFE2',
};

function roleToVar(palette: PaletteEntry[] | null | undefined) {
  if (!palette || palette.length === 0) return NAMKHAN_DEFAULTS;

  const byRole = (role: string) => palette.find((p) => p.role === role)?.hex;

  const primary = byRole('primary') ?? NAMKHAN_DEFAULTS.primary;
  const bg = byRole('background') ?? NAMKHAN_DEFAULTS.bg;
  const surface = byRole('surface') ?? byRole('neutral_light') ?? NAMKHAN_DEFAULTS.surface;
  const sand = byRole('secondary') ?? byRole('neutral_light') ?? NAMKHAN_DEFAULTS.sand;
  const terracotta = byRole('accent') ?? NAMKHAN_DEFAULTS.terracotta;
  const neutral = byRole('neutral') ?? byRole('neutral_dark') ?? NAMKHAN_DEFAULTS.neutral;
  const primaryFg = isLight(primary) ? '#1A1A1A' : '#F4EFE2';

  return { primary, bg, surface, sand, terracotta, neutral, primaryFg };
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// mix two hex colors at a given ratio (0..1 = amount of c2 in c1)
function mixHex(c1: string, c2: string, ratio: number): string {
  const h1 = c1.replace('#', '');
  const h2 = c2.replace('#', '');
  const r1 = parseInt(h1.slice(0, 2), 16);
  const g1 = parseInt(h1.slice(2, 4), 16);
  const b1 = parseInt(h1.slice(4, 6), 16);
  const r2 = parseInt(h2.slice(0, 2), 16);
  const g2 = parseInt(h2.slice(2, 4), 16);
  const b2 = parseInt(h2.slice(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function lightTokens(t: ReturnType<typeof roleToVar>) {
  // Surface ladder: page → card → card-inset → active
  const surf0 = t.bg;                          // page bg (sand)
  const surf1 = t.surface;                     // card/box bg (cream)
  const surf2 = mixHex(t.surface, '#ffffff', 0.5); // brighter inner bg (near-white)
  const surf3 = t.sand;                        // active/hover (coastal blue or similar)
  const surf1b = mixHex(t.surface, t.primary, 0.04); // slight tint below surf1

  // Borders — darken primary
  const border1 = hexToRgba(t.primary, 0.08);
  const border2 = hexToRgba(t.primary, 0.12);
  const border2b = hexToRgba(t.primary, 0.16);
  const border3 = hexToRgba(t.primary, 0.2);
  const border4 = hexToRgba(t.primary, 0.28);

  // Text ladder
  const text0 = t.primary;                     // primary text
  const text1 = mixHex(t.primary, '#000000', 0.2); // stronger
  const text2 = t.primary;
  const text3 = mixHex(t.primary, '#000000', 0.1);
  const text4 = mixHex(t.primary, t.bg, 0.7);  // very light
  const textMute = hexToRgba(t.primary, 0.6);
  const textDim = hexToRgba(t.primary, 0.45);
  const textPlace = hexToRgba(t.primary, 0.35);
  const textSoft = hexToRgba(t.primary, 0.55);
  const textWarm = mixHex(t.terracotta, t.primary, 0.4);

  // Accents from palette terracotta
  const accent = t.terracotta;
  const accent2 = mixHex(t.terracotta, t.bg, 0.3);
  const accent3 = mixHex(t.terracotta, t.bg, 0.45);
  const accent4 = mixHex(t.terracotta, t.bg, 0.55);

  // Status surfaces (warning / ok tint of bg)
  const surfWarn = mixHex(t.bg, t.terracotta, 0.08);
  const surfOk = mixHex(t.bg, '#3f8a4a', 0.06);

  return {
    surf0, surf1, surf1b, surf2, surf3,
    border1, border2, border2b, border3, border4,
    text0, text1, text2, text3, text4, textMute, textDim, textPlace, textSoft, textWarm,
    accent, accent2, accent3, accent4,
    surfWarn, surfOk,
  };
}

export default function ThemeInjector({
  palette,
  children,
}: {
  palette: PaletteEntry[] | null | undefined;
  children: ReactNode;
}) {
  const t = roleToVar(palette);

  // Properties whose palette declares a `background` role opt into the full
  // light theme. Properties without it (Namkhan today) keep dark fallbacks.
  const hasLightPageBg = !!palette?.find((p) => p.role === 'background');

  let lightVars = '';
  if (hasLightPageBg) {
    const L = lightTokens(t);
    lightVars = `
      --page-bg: ${t.bg};
      --page-fg: ${t.primary};
      --topbar-bg: ${hexToRgba(t.bg, 0.85)};
      --topbar-border: ${hexToRgba(t.primary, 0.15)};

      --surf-0: ${L.surf0};
      --surf-1: ${L.surf1};
      --surf-1b: ${L.surf1b};
      --surf-2: ${L.surf2};
      --surf-3: ${L.surf3};
      --surf-warn: ${L.surfWarn};
      --surf-ok: ${L.surfOk};

      --border-1: ${L.border1};
      --border-2: ${L.border2};
      --border-2b: ${L.border2b};
      --border-3: ${L.border3};
      --border-4: ${L.border4};

      --text-0: ${L.text0};
      --text-1: ${L.text1};
      --text-2: ${L.text2};
      --text-3: ${L.text3};
      --text-4: ${L.text4};
      --text-mute: ${L.textMute};
      --text-dim: ${L.textDim};
      --text-place: ${L.textPlace};
      --text-soft: ${L.textSoft};
      --text-warm: ${L.textWarm};

      --accent: ${L.accent};
      --accent-2: ${L.accent2};
      --accent-3: ${L.accent3};
      --accent-4: ${L.accent4};
    `;
  }

  const cssVars = `
    :root {
      --primary: ${t.primary};
      --primary-fg: ${t.primaryFg};
      --bg: ${t.bg};
      --surface: ${t.surface};
      --sand: ${t.sand};
      --terracotta: ${t.terracotta};
      --neutral: ${t.neutral};
      ${lightVars}
    }
    body { background-color: var(--bg); }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: cssVars }} />
      {children}
    </>
  );
}
