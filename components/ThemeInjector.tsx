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

export default function ThemeInjector({
  palette,
  children,
}: {
  palette: PaletteEntry[] | null | undefined;
  children: ReactNode;
}) {
  const t = roleToVar(palette);

  const cssVars = `
    :root {
      --primary: ${t.primary};
      --primary-fg: ${t.primaryFg};
      --bg: ${t.bg};
      --surface: ${t.surface};
      --sand: ${t.sand};
      --terracotta: ${t.terracotta};
      --neutral: ${t.neutral};
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
