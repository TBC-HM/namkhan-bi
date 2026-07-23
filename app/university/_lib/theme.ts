// app/university/_lib/theme.ts
// TBC University · design tokens. University layer on the house design system
// (paper-white, hairline, ink, green, warm). Every University surface imports
// these — no page redefines its own colors. See documentation.documents
// doc_type='design_system' § TBC University.

export const INK = '#1B1B1B';
export const INK_SOFT = '#5A5A5A';
export const INK_FAINT = '#8A8A8A';
export const HAIR = '#E6DFCC';
export const GREEN = '#084838';
export const WARM = '#F5F0E1';
export const GOLD = '#B48A3A';
export const RED = '#B03826';
export const PAPER = '#FFFFFF';

// Reader typography — staff readers, generous sizes (owner mandate:
// "design a little more for humans and leading").
export const BODY_SIZE = 15;        // px — article body
export const BODY_LEADING = 1.75;   // line-height — article body
export const LEAD_SIZE = 16.5;      // px — lead paragraph

// Callout tints (paper-compatible, subtle)
export const TIP_BG = '#EEF4EF';      // green-tinted
export const TIP_BORDER = '#0848384D';
export const WARN_BG = '#FBF3E2';     // amber-tinted
export const WARN_BORDER = '#B48A3A80';
export const NEVER_BG = '#FAEDEA';    // red-tinted
export const NEVER_BORDER = '#B0382666';

export const SANS = 'var(--sans, "Inter Tight", system-ui, sans-serif)';

// Public storage bucket for annotated screenshots.
export const SHOTS_BUCKET = 'university-shots';
export function shotUrl(file: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kpenyneooigsyuuomgct.supabase.co';
  return `${base}/storage/v1/object/public/${SHOTS_BUCKET}/${encodeURIComponent(file)}`;
}
