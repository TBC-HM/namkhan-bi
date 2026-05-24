// app/_components/registry/SourceCompareChart.tsx
// PBS #199 v8 (2026-05-25) — per-category "2025 / 2026" comparison chart.
// User picks any source from the active category; chart shows monthly
// revenue this year vs last year side-by-side.
// State via URL: ?src_<cat>=<encoded source> (independent per tab).
'use client';

import { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Container, Chart } from '@/app/(cockpit)/_design';

interface MonthlyRow {
  source_name: string;
  month: string;        // YYYY-MM-DD
  rooms_revenue: number;
  reservations: number;
}

interface Props {
  category: string;           // 'direct' | 'ota' | 'dmc' | 'bedbank' | 'group'
  sources: string[];          // sources visible in this category
  rows: MonthlyRow[];         // monthly per-source data (2024-onwards)
  moneyCurrency: 'USD' | 'EUR';
}

export default function SourceCompareChart({ category, sources, rows, moneyCurrency }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const paramKey = `src_${category}`;
  const activeSrc = sp?.get(paramKey) ?? (sources[0] ?? '');

  const data = useMemo(() => {
    const byMonth: Record<string, { y25: number; y26: number; res25: number; res26: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      byMonth[mm] = { y25: 0, y26: 0, res25: 0, res26: 0 };
    }
    for (const r of rows) {
      if (r.source_name !== activeSrc) continue;
      const mm = r.month.slice(5, 7);
      const yr = Number(r.month.slice(0, 4));
      if (!byMonth[mm]) continue;
      if (yr === 2025) {
        byMonth[mm].y25 += r.rooms_revenue;
        byMonth[mm].res25 += r.reservations;
      }
      if (yr === 2026) {
        byMonth[mm].y26 += r.rooms_revenue;
        byMonth[mm].res26 += r.reservations;
      }
    }
    const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return Object.entries(byMonth).map(([mm, v]) => ({
      month: monthLabel[Number(mm) - 1],
      y25: Math.round(v.y25),
      y26: Math.round(v.y26),
    }));
  }, [rows, activeSrc]);

  const total25 = data.reduce((s, r) => s + r.y25, 0);
  const total26 = data.reduce((s, r) => s + r.y26, 0);
  const sym = moneyCurrency === 'EUR' ? '€' : '$';

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    params.set(paramKey, e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Container
      title={`2025 / 2026 · ${activeSrc || 'pick a source'}`}
      subtitle={`monthly revenue · ${sym}${Math.round(total25).toLocaleString('en-US')} (2025) → ${sym}${Math.round(total26).toLocaleString('en-US')} (2026)`}
    >
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginRight: 8 }}>
          Source
        </label>
        <select value={activeSrc} onChange={onChange} style={selectStyle}>
          {sources.length === 0 ? (
            <option value="">(no sources)</option>
          ) : (
            sources.map((s) => <option key={s} value={s}>{s}</option>)
          )}
        </select>
      </div>
      <Chart
        variant="bar"
        data={data}
        xKey="month"
        series={[
          { key: 'y25', label: '2025', color: '#B8A878' },
          { key: 'y26', label: '2026', color: '#1F3A2E' },
        ]}
        height={220}
        empty={{ title: 'No data', hint: 'No monthly rows for this source in 2025 or 2026' }}
      />
    </Container>
  );
}

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  background: 'var(--paper, #FFFFFF)',
  border: '1px solid var(--hairline, #E6DFCC)',
  borderRadius: 4,
  color: 'var(--ink, #1B1B1B)',
  minWidth: 220,
};
