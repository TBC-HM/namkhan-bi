'use client';
// app/revenue/_components/WindowSelect.tsx
// PBS 2026-07-09 pm: replaces the +7d/+30d/+90d/+180d/+365d pill row on
// Demand + Pace pages with a compact dropdown sitting inside the headline strip.

import { useRouter } from 'next/navigation';

export interface WindowOption { value: string; label: string }

interface Props {
  basePath: string;
  currentWin: string;
  currentCmp?: string | null;
  options: WindowOption[];
  label?: string;
}

export default function WindowSelect({ basePath, currentWin, currentCmp, options, label = 'Forward window' }: Props) {
  const router = useRouter();
  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = new URLSearchParams();
    p.set('win', e.target.value);
    if (currentCmp && currentCmp !== 'none') p.set('cmp', currentCmp);
    router.push(`${basePath}?${p.toString()}`);
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A' }}>{label}</span>
      <select
        value={currentWin}
        onChange={onChange}
        style={{
          fontFamily: 'inherit', fontSize: 12, padding: '4px 10px',
          borderRadius: 4, border: '1px solid #E6DFCC', background: '#FFFFFF',
          color: '#1B1B1B', fontWeight: 500, cursor: 'pointer',
        }}
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}
