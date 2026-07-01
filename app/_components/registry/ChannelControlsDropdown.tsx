'use client';
// PBS 2026-05-29 #56 — replaces broken Window/Category pill rows on /channels with native <select> dropdowns
// that PRESERVE all existing searchParams on change (the old pills built URLs from a 3-key whitelist
// and dropped ch, gst_month, drill, etc on every click).
import { useRouter, useSearchParams } from 'next/navigation';

interface Opt { label: string; value: string }

interface Props {
  basePath: string;
  windowOptions: Opt[];
  currentWindow: string;
  defaultWindow: string;
  // PBS 2026-07-01: Category selector deprecated — CategoryCompareGrid now
  // shows all 3 categories simultaneously. Props remain optional so consumers
  // that still pass them don't need to change; the select renders only when
  // categoryOptions has entries.
  categoryOptions?: Opt[];
  currentCategory?: string;
  defaultCategory?: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--ink-soft, #5A5A5A)',
};

const selectStyle: React.CSSProperties = {
  fontSize: 13, padding: '5px 10px',
  border: '1px solid var(--hairline, #E6DFCC)',
  background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
  borderRadius: 4, fontWeight: 600, cursor: 'pointer',
};

export default function ChannelControlsDropdown(p: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function navigate(key: 'win' | 'tab', value: string, defaultValue: string) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    if (value === defaultValue) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(`${p.basePath}${qs ? '?' + qs : ''}`);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={labelStyle}>Window</span>
        <select
          aria-label="Window"
          style={selectStyle}
          value={p.currentWindow}
          onChange={(e) => navigate('win', e.target.value, p.defaultWindow)}
        >
          {p.windowOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {p.categoryOptions && p.categoryOptions.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelStyle}>Category</span>
          <select
            aria-label="Category"
            style={selectStyle}
            value={p.currentCategory ?? ''}
            onChange={(e) => navigate('tab', e.target.value, p.defaultCategory ?? '')}
          >
            {p.categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
