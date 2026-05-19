// Search + property + status filter strip. All filters apply client-side.
// Property filter only renders on the KPIs tab.

'use client';

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
  { value: 'all',        label: 'All' },
  { value: 'wired',      label: 'Wired only' },
  { value: 'not_wired',  label: 'Not wired' },
  { value: 'live',       label: 'Live data' },
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
        <Pillbox
          label="Served by"
          value={property}
          options={PROPERTY_OPTIONS}
          onChange={onProperty}
        />
      )}
      <Pillbox
        label="Status"
        value={status}
        options={STATUS_OPTIONS}
        onChange={onStatus}
      />
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

const S: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  search: {
    flex: '1 1 240px',
    minWidth: 200,
    maxWidth: 360,
    padding: '8px 12px',
    border: '1px solid var(--line, rgba(251, 246, 233, 0.26))',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--ink, #fbf6e9)',
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
    fontSize: 13,
    outline: 'none',
  },
  pillGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pillLabel: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--ink-mute, #cfc3a3)',
    marginRight: 4,
  },
  pill: {
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 10,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 99,
    border: '1px solid var(--line-soft, rgba(251, 246, 233, 0.15))',
    background: 'transparent',
    color: 'var(--ink-soft, #ead9b4)',
    cursor: 'pointer',
    transition: 'background 100ms ease, color 100ms ease',
  },
  pillActive: {
    background: 'var(--ink, #fbf6e9)',
    color: 'var(--paper, #1a160f)',
    borderColor: 'var(--ink, #fbf6e9)',
    fontWeight: 600,
  },
};
