// app/revenue/pace/_components/GranSelect.tsx
// PBS 2026-07-14 · Granularity dropdown for /revenue/pace (was pill buttons).
// Client component so we can useRouter().push() on change without a form submit.
'use client';

import { useRouter } from 'next/navigation';

export interface GranOption { k: string; label: string }

export default function GranSelect({
  value, options, hrefFor,
}: {
  value: string;
  options: GranOption[];
  /** Precomputed href per gran value — server-side page.tsx builds the map, we just navigate.  */
  hrefFor: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <label style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, color:'#5A5A5A', letterSpacing:'0.05em', textTransform:'uppercase' }}>
      Granularity
      <select
        value={value}
        onChange={(e) => { const next = hrefFor[e.target.value]; if (next) router.push(next); }}
        style={{ padding:'4px 8px', fontSize:11, border:'1px solid #E6DFCC', borderRadius:3, color:'#1B1B1B', background:'#FFFFFF', textTransform:'none', letterSpacing:'0' }}
      >
        {options.map(o => <option key={o.k} value={o.k}>{o.label}</option>)}
      </select>
    </label>
  );
}
