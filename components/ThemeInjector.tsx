// components/ThemeInjector.tsx
// Server component. Receives brand palette from property.brand and injects CSS vars on <html>.
// Falls back to Namkhan defaults if no palette set.

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

export default function ThemeInjector({
  palette,
  children,
}: {
  palette: PaletteEntry[] | null | undefined;
  children: ReactNode;
}) {
  const t = roleToVar(palette);

  // 2026-05-12 — properties whose palette declares an explicit `background`
  // role (Donna et al.) opt their pages into a light theme. Properties
  // without it (Namkhan — palette only has `background_dark`) keep the
  // legacy hardcoded #0a0a0a Page background.
  const hasLightPageBg = !!palette?.find((p) => p.role === 'background');

  const pageBgLine = hasLightPageBg
    ? [
        `--page-bg: ${t.bg};`,
        `--page-fg: ${t.primary};`,
        // Sticky top bar — semi-opaque tint of the page bg so it stays readable
        // when scrolled. We can't override every inline #0f0d0a box style on a
        // dark-built component tree, but the top bar is the most prominent.
        `--topbar-bg: ${hexToRgba(t.bg, 0.85)};`,
        `--topbar-border: ${hexToRgba(t.primary, 0.15)};`,
      ].join('\n      ')
    : '';

  const cssVars = `
    :root {
      --primary: ${t.primary};
      --primary-fg: ${t.primaryFg};
      --bg: ${t.bg};
      --surface: ${t.surface};
      --sand: ${t.sand};
      --terracotta: ${t.terracotta};
      --neutral: ${t.neutral};
      ${pageBgLine}
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
