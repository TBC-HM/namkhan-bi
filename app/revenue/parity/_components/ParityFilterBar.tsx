// app/revenue/parity/_components/ParityFilterBar.tsx
//
// Lighthouse-style filter row. Mirrors the screenshot reference shipped
// 2026-05-09: Member rate toggle · Lowest rate filter · Device · LOS ·
// Guests · Room · Meal plan · Refresh rates button.
//
// Visual rules (locked):
//   • Sits inside <Panel> in the page; this bar is a single horizontal flex
//     row, all controls share a common pill shape.
//   • No hardcoded fontSize literals — every size resolves through the
//     `var(--t-*)` typography scale.
//   • The "Refresh rates" CTA on the right is a brass-bordered pill that
//     stands in for the pre-existing ParityRunButton (which fires the
//     parity_agent run); we accept it as a child for that reason.
//
// This is a client component because the toggle + select interactions
// would otherwise need a no-op and cause a hydration mismatch.

'use client';

import { useState, type ReactNode } from 'react';

interface Props {
  lastShopLabel: string;
  /** Pre-existing run button (server-prepared with the live agent status). */
  refreshSlot?: ReactNode;
}

const SELECTS = [
  { key: 'lowest',  label: 'Lowest',  options: ['Lowest', 'Median', 'Highest'] },
  { key: 'device',  label: 'Desktop', options: ['Desktop', 'Mobile'] },
  { key: 'los',     label: '1 night', options: ['1 night', '2 nights', '3 nights', '7 nights'] },
  { key: 'guests',  label: '2 guests', options: ['1 guest', '2 guests', '3 guests', '4 guests'] },
  { key: 'room',    label: 'Any room', options: ['Any room', 'Riverview', 'Suite'] },
  { key: 'meal',    label: 'Any meal', options: ['Any meal', 'Room only', 'Breakfast', 'Half board'] },
];

export default function ParityFilterBar({ lastShopLabel, refreshSlot }: Props) {
  const [memberRate, setMemberRate] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(SELECTS.map((s) => [s.key, s.label]))
  );

  return (
    <div style={S.bar}>
      {/* Member rate toggle */}
      <button
        type="button"
        style={S.toggleWrap}
        onClick={() => setMemberRate((v) => !v)}
        aria-pressed={memberRate}
      >
        <span
          style={{
            ...S.toggle,
            background: memberRate ? 'var(--brass)' : 'var(--paper-deep)',
          }}
        >
          <span
            style={{
              ...S.toggleKnob,
              transform: memberRate ? 'translateX(14px)' : 'translateX(0)',
            }}
          />
        </span>
        <span style={S.toggleLabel}>Member rate</span>
      </button>

      <span style={S.divider} aria-hidden />

      {/* Selects */}
      {SELECTS.map((s) => (
        <select
          key={s.key}
          value={vals[s.key]}
          onChange={(e) => setVals((v) => ({ ...v, [s.key]: e.target.value }))}
          style={S.select}
        >
          {s.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ))}

      <span style={{ flex: 1 }} />

      {/* Last shop chip */}
      <span style={S.shopChip}>
        UPDATED <strong style={{ color: 'var(--ink)' }}>{lastShopLabel}</strong>
      </span>

      {/* Refresh CTA — receives the live ParityRunButton */}
      {refreshSlot}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    padding: '10px 12px',
    background: 'var(--paper-warm)',
    border: '1px solid var(--paper-deep)',
    borderRadius: 8,
  },
  toggleWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 10px 4px 6px',
    background: 'var(--paper)',
    border: '1px solid var(--paper-deep)',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'var(--sans)',
    fontSize: 'var(--t-base)',
    color: 'var(--ink)',
  },
  toggle: {
    position: 'relative',
    width: 26,
    height: 14,
    borderRadius: 999,
    transition: 'background 120ms ease',
    flexShrink: 0,
  },
  toggleKnob: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: 'var(--paper)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
    transition: 'transform 120ms ease',
  },
  toggleLabel: {
    fontFamily: 'var(--sans)',
    fontSize: 'var(--t-base)',
    fontWeight: 500,
    color: 'var(--ink)',
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    background: 'var(--paper-deep)',
    margin: '2px 4px',
  },
  select: {
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '5px 22px 5px 10px',
    background:
      'var(--paper) url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\' fill=\'none\'><path d=\'M1 1l4 4 4-4\' stroke=\'%237d7565\' stroke-width=\'1.5\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/></svg>") no-repeat right 8px center',
    border: '1px solid var(--paper-deep)',
    borderRadius: 999,
    fontFamily: 'var(--sans)',
    fontSize: 'var(--t-base)',
    color: 'var(--ink)',
    cursor: 'pointer',
    minWidth: 0,
  },
  shopChip: {
    fontFamily: 'var(--mono)',
    fontSize: 'var(--t-xs)',
    letterSpacing: 'var(--ls-extra)',
    textTransform: 'uppercase',
    color: 'var(--ink-mute)',
    padding: '4px 10px',
    background: 'var(--paper)',
    border: '1px solid var(--paper-deep)',
    borderRadius: 999,
  },
};
