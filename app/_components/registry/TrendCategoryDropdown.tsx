'use client';
// PBS 2026-05-31 #55 — All-time trend chart category selector.
// URL-state via ?cat=all|direct|ota|bedbank|dmc|group · preserves every other searchParam.
// Default value 'all' deletes the param to keep canonical URLs clean.
import { useRouter, useSearchParams } from 'next/navigation';

interface Opt { label: string; value: string }

interface Props {
  basePath: string;
  current: string;       // current ?cat= value (defaults to 'all')
  options: Opt[];
}

const selectStyle: React.CSSProperties = {
  fontSize: 13, padding: '4px 10px',
  border: '1px solid var(--hairline, #E6DFCC)',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  borderRadius: 4, fontWeight: 600, cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ink-soft, #5A5A5A)', marginRight: 8,
};

export default function TrendCategoryDropdown(p: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function navigate(value: string) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (value === 'all') params.delete('cat'); else params.set('cat', value);
    const qs = params.toString();
    router.push(`${p.basePath}${qs ? '?' + qs : ''}`);
  }

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center' }}>
      <span style={labelStyle}>Category</span>
      <select
        aria-label="Trend category"
        style={selectStyle}
        value={p.current}
        onChange={(e) => navigate(e.target.value)}
      >
        {p.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
