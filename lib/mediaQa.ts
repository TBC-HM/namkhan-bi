// lib/mediaQa.ts
// Media QA score helpers — badge colours + label formatter.
// Shared across LibraryTab, ClarifyTab, VideoLibraryTab, CoverageTab, AssetEditDrawer.
// PBS 2026-07-13 — v1 of the 3-tier scoring engine (technical / aesthetic / marketing).

export interface QaBadge {
  bg: string;
  fg: string;
  label: string;
  tone: 'hero' | 'ota' | 'social' | 'archive' | 'unscored';
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#B48A3A';
const RED    = '#B03826';
const INK    = '#1B1B1B';

export function qaBadge(quality: number | null | undefined): QaBadge {
  if (quality == null || Number.isNaN(Number(quality))) {
    return { bg: HAIR, fg: INK_M, label: '—', tone: 'unscored' };
  }
  const q = Math.round(Number(quality));
  if (q >= 80) return { bg: FOREST, fg: WHITE, label: q + '%', tone: 'hero'   };
  if (q >= 60) return { bg: CREAM,  fg: INK,   label: q + '%', tone: 'ota'    };
  if (q >= 40) return { bg: AMBER,  fg: WHITE, label: q + '%', tone: 'social' };
  return                   { bg: RED,    fg: WHITE, label: q + '%', tone: 'archive' };
}

export function qualityIndex(t?: number | null, a?: number | null, m?: number | null): number | null {
  if (t == null && a == null && m == null) return null;
  const T = Number(t ?? 0), A = Number(a ?? 0), M = Number(m ?? 0);
  return Math.round(T * 0.4 + A * 0.3 + M * 0.3);
}
