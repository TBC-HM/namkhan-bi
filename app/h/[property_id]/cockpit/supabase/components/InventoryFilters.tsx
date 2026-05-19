// Filter strip: search + property + status. Stateless — orchestrator owns state.
// Filter controls are inputs/buttons, not visual cards — they are NOT
// "visual blocks" governed by the no-bespoke-visual rule.

'use client';

import type { CSSProperties } from 'react';
import type { PropertyFilter, StatusFilter, TabKey } from '../lib/types';

interface Props {
  tab: TabKey;
  search: string;
  onSearch: (next: string) => void;
  property: PropertyFilter;
  onProperty: (next: PropertyFilter) => void;
  status: StatusFilter;
  onStatus: (next: StatusFilter) => void;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'wired',     label: 'Wired' },
  { value: 'not_wired', label: 'Not wired' },
  { value: 'live',      label: 'Live data' },
];

const PROPERTY_OPTIONS: { value: PropertyFilter; label: string }[] = [
  { value: 'all',     label: 'Any' },
  { value: 'namkhan', label: 'Namkhan' },
  { value: 'donna',   label: 'Donna' },
  { value: 'both',    label: 'Both' },
];

export default function InventoryFilters({
  tab, search, onSearch, property, onProperty, status, onStatus,
}: Props) {
  return (
    <div style={S.wrap}>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search by name or view…"
        style={S.search}
        aria-label="Search inventory"
      />
      {tab === 'kpi' && (
        <Pillbox label="Served by" value={property} options={PROPERTY_OPTIONS} onChange={onProperty} />
      )}
      <Pillbox label="Status" value={status} options={STATUS_OPTIONS} onChange={onStatus} />
    </div>
  );
}

function Pillbox<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div style={S.pillGroup}>
      <span style={S.pillLabel}>{label}:</span>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{ ...S.pill, ...(active ? S.pillActive : null) }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  search: {
    flex: '1 1 240px',
    minWidth: 200,
    maxWidth: 360,
    padding: '8px 12px',
    border: '1px solid var(--hairline, #E6DFCC)',
    borderRadius: 4,
    background: 'var(--paper, #FFFFFF)',
    color: 'var(--ink, #1B1B1B)',
    fontFamily: 'inherit',
    fontSize: 13,
    outline: 'none',
  },
  pillGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pillLabel: { fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft, #5A5A5A)', marginRight: 4 },
  pill: {
    fontFamily: 'inherit',
    fontSize: 11,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 99,
    border: '1px solid var(--hairline, #E6DFCC)',
    background: 'var(--paper, #FFFFFF)',
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    transition: 'background 100ms ease, color 100ms ease',
  },
  pillActive: {
    background: 'var(--primary, #1F3A2E)',
    color: '#FFFFFF',
    borderColor: 'var(--primary, #1F3A2E)',
    fontWeight: 600,
  },
};
