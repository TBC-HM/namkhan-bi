// lib/supabase-gl.ts
// Supabase client scoped to the `gl` schema (USALI 11th edition GL data).
// Use this for any gl.* table or view query.
// For cross-schema reads (governance.*, public.*) use the default `supabase` client.

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseGl = createClient(url, anonKey, {
  auth: { persistSession: false },
  db: { schema: 'gl' },
});

// Period helper — derive the array of period_yyyymm strings for a window selector.
// dataset is monthly so TODAY/7D/30D all collapse to current period.
export type PeriodWindow = 'TODAY' | '7D' | '30D' | '90D' | 'YTD';

export function periodsFor(window: PeriodWindow, today: Date = new Date()): string[] {
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1..12
  const fmt = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}`;

  const cur = fmt(y, m);
  if (window === 'TODAY' || window === '7D' || window === '30D') return [cur];
  if (window === '90D') {
    const out: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      out.push(fmt(d.getFullYear(), d.getMonth() + 1));
    }
    return out;
  }
  // YTD
  const out: string[] = [];
  for (let mm = 1; mm <= m; mm++) out.push(fmt(y, mm));
  return out;
}

export function priorPeriod(period: string): string {
  const [yy, mm] = period.split('-').map(Number);
  const d = new Date(yy, mm - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
