'use client';
export const dynamic = 'force-dynamic';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const PRESETS = [
  { label: 'Last 7 days',              back: 'last_7',   fwd: '' },
  { label: 'Last 30 days',             back: 'last_30',  fwd: '' },
  { label: 'Last 90 days',             back: 'last_90',  fwd: '' },
  { label: 'Year to date',             back: 'ytd',      fwd: '' },
  { label: 'Last 365 days',            back: 'last_365', fwd: '' },
  { label: 'Last 7 + Next 7 days',     back: 'last_7',   fwd: 'next_7' },
  { label: 'Last 30 + Next 30 days',   back: 'last_30',  fwd: 'next_30' },
  { label: 'Last 30 + Next 90 days',   back: 'last_30',  fwd: 'next_90' },
  { label: 'Last 90 + Next 90 days',   back: 'last_90',  fwd: 'next_90' },
  { label: 'Last 30 + Next 180 days',  back: 'last_30',  fwd: 'next_180' },
  { label: 'Last 30 + Next 365 days',  back: 'last_30',  fwd: 'next_year' },
];

interface Kpi {
  label: string;
  value: string | number;
}

export default function PeriodWiringPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentBack = sp.get('back') ?? 'last_30';
  const currentFwd  = sp.get('fwd')  ?? '';

  const currentPreset = PRESETS.find(p => p.back === currentBack && p.fwd === currentFwd)
    ?? PRESETS.find(p => p.back === currentBack)
    ?? PRESETS[1];

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState({ from: '', to: '', fwdTo: '' });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const preset = PRESETS[parseInt(e.target.value)];
    const params = new URLSearchParams(sp.toString());
    params.set('back', preset.back);
    if (preset.fwd) params.set('fwd', preset.fwd);
    else params.delete('fwd');
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/period-preview?back=${currentBack}&fwd=${currentFwd}`)
      .then(r => r.json())
      .then(data => {
        if (data.kpis) setKpis(data.kpis);
        if (data.window) setWindow(data.window);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [currentBack, currentFwd]);

  const selectedIndex = PRESETS.findIndex(p => p.back === currentBack && p.fwd === currentFwd);

  return (
    <div className="pt-6">
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Period Window
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '1rem' }}>
          Select a combined look-back + look-forward window. This sets the global period for the entire dashboard.
        </p>
        <select
          value={selectedIndex >= 0 ? selectedIndex : 1}
          onChange={handleChange}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '0.9rem',
            background: '#fff',
            cursor: 'pointer',
            minWidth: '260px',
          }}
        >
          {PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
        {(window.from || window.to) && (
          <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.5rem' }}>
            {window.from} → {window.fwdTo || window.to}
          </p>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#888', fontSize: '0.85rem' }}>Loading KPIs…</p>
      ) : kpis.length > 0 ? (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {kpis.map((k, i) => (
            <div key={i} style={{ border: '1px solid #e5e0d8', borderRadius: '4px', padding: '1rem' }}>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888', marginBottom: '0.4rem' }}>{k.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 500 }}>{k.value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: '#aaa', fontSize: '0.85rem' }}>
          Change the period above — KPI boxes will update once the API route is connected.
        </p>
      )}
    </div>
  );
}
