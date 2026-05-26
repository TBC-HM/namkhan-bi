// app/_components/registry/LeakageMonthStrip.tsx
// PBS 2026-05-27 (#258): 12 small tiles Jan-Dec showing total leakage per month for current year.

import { supabase } from '@/lib/supabase';

interface Props { propertyId: number }

interface Row {
  property_id: number;
  month_label: string;
  yr: number;
  total_leakage: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function LeakageMonthStrip({ propertyId }: Props) {
  const yr = new Date().getFullYear();
  const { data } = await supabase
    .from('v_leakage_monthly_total')
    .select('*')
    .eq('property_id', propertyId)
    .eq('yr', yr);

  const ccy: 'USD' | 'EUR' = propertyId === 1000001 ? 'EUR' : 'USD';
  const sym = ccy === 'EUR' ? '€' : '$';

  const byMonth = new Map<number, number>();
  for (const r of (data ?? []) as Row[]) {
    const m = Number((r.month_label ?? '').split('-')[1] ?? 0);
    if (m >= 1 && m <= 12) byMonth.set(m, Number(r.total_leakage ?? 0));
  }

  const max = Math.max(0, ...Array.from(byMonth.values()));

  const tiles = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const value = byMonth.get(month) ?? 0;
    const intensity = max > 0 ? value / max : 0;
    return { month, label: MONTH_LABELS[i], value, intensity };
  });

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 0 10px' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>
        Leakage per Month · {yr}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 6 }}>
        {tiles.map((t) => {
          const bg = t.intensity > 0
            ? `rgba(184, 84, 42, ${0.12 + t.intensity * 0.55})`
            : 'transparent';
          const valStr = t.value === 0
            ? '—'
            : t.value >= 1000
              ? `${sym}${Math.round(t.value / 1000)}k`
              : `${sym}${t.value}`;
          return (
            <div key={t.month} style={{
              padding: '8px 6px',
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 4,
              background: bg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}>
              <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)' }}>{t.label}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{valStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
