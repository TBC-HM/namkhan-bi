'use client';
// app/h/[property_id]/revenue/reservations/RangeChips.tsx
//
// PBS 2026-08-21 · URL-driven date-range chip row for the Reservations
// page. Chips are Next <Link>-style client anchors (via router.push)
// so switching a chip only changes ?range=... without a hard reload.
// Custom range = two <input type=date> that submit ?range=custom&from&to.

import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';

type RangeKey = 'today_yesterday' | 'next7' | 'next30' | 'custom';

interface Props {
  basePath: string;      // "/h/260955/revenue/reservations"
  range: RangeKey;       // currently active
  from: string;          // YYYY-MM-DD (pre-filled for custom)
  to: string;            // YYYY-MM-DD (pre-filled for custom)
}

const CHIPS: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: 'today_yesterday', label: 'Today + Yesterday' },
  { key: 'next7',           label: 'Next 7 days' },
  { key: 'next30',          label: 'Next 30 days' },
];

function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid var(--hairline, #E6DFCC)`,
    background: active ? 'var(--ink, #1B1B1B)' : 'var(--paper, #FFFFFF)',
    color: active ? 'var(--paper, #FFFFFF)' : 'var(--ink, #1B1B1B)',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
}

export default function RangeChips({ basePath, range, from, to }: Props) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(range === 'custom');
  const [fromLocal, setFromLocal] = useState(from);
  const [toLocal, setToLocal] = useState(to);

  const go = (key: Exclude<RangeKey, 'custom'>) => {
    setCustomOpen(false);
    router.push(`${basePath}?range=${key}`);
  };

  const applyCustom = () => {
    const f = fromLocal || from;
    const t = toLocal || to;
    router.push(`${basePath}?range=custom&from=${f}&to=${t}`);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      {CHIPS.map((c) => (
        <button
          key={c.key}
          type="button"
          style={chipStyle(range === c.key)}
          onClick={() => go(c.key)}
        >
          {c.label}
        </button>
      ))}
      <button
        type="button"
        style={chipStyle(range === 'custom')}
        onClick={() => setCustomOpen((v) => !v)}
      >
        Custom range
      </button>
      {customOpen && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginLeft: 6,
            fontSize: 12,
            fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
            color: 'var(--ink, #1B1B1B)',
          }}
        >
          <input
            type="date"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            style={{
              padding: '3px 6px',
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'inherit',
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink, #1B1B1B)',
            }}
          />
          <span>→</span>
          <input
            type="date"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            style={{
              padding: '3px 6px',
              border: '1px solid var(--hairline, #E6DFCC)',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'inherit',
              background: 'var(--paper, #FFFFFF)',
              color: 'var(--ink, #1B1B1B)',
            }}
          />
          <button
            type="button"
            onClick={applyCustom}
            style={{
              ...chipStyle(true),
              padding: '4px 12px',
            }}
          >
            Apply
          </button>
        </span>
      )}
    </div>
  );
}
'