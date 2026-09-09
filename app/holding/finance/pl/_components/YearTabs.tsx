// app/holding/finance/pl/_components/YearTabs.tsx
// Year selector. The year list is DERIVED from the payload's by_month keys —
// there is no year literal in this module. A third year of data appears here
// on its own.

import Link from 'next/link';
import { PL_PATH, HAIR, INK_M, FOREST, type TabKey } from './ui';

export default function YearTabs({ tab, years, current }: {
  tab: TabKey; years: string[]; current: string | null;
}) {
  const item = (label: string, year: string | null) => {
    const active = (current ?? '') === (year ?? '');
    const href = year
      ? `${PL_PATH}?tab=${tab}&year=${year}`
      : `${PL_PATH}?tab=${tab}`;
    return (
      <Link key={label} href={href} style={{
        padding: '4px 12px', fontSize: 12, textDecoration: 'none',
        border: `1px solid ${active ? FOREST : HAIR}`,
        background: active ? FOREST : '#fff',
        color: active ? '#fff' : INK_M,
        fontWeight: active ? 700 : 500, borderRadius: 4,
      }}>{label}</Link>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>Year</span>
      {item('All', null)}
      {years.map((y) => item(y, y))}
    </div>
  );
}
