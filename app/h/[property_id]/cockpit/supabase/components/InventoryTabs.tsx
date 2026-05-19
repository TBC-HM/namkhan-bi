// Orchestrator client component: holds tab + filter + search state,
// renders Header / Filters / TabStrip / Grid. router.refresh() re-runs the
// server fetch so a new wiring row inserted via SQL appears on next click.

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  InventoryRow, PropertyFilter, StatusFilter, TabKey,
} from '../lib/types';
import InventoryHeader from './InventoryHeader';
import InventoryFilters from './InventoryFilters';
import InventoryGrid from './InventoryGrid';

interface Props {
  rows: InventoryRow[];
  propertyName: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'kpi',       label: 'KPIs' },
  { key: 'container', label: 'Containers' },
  { key: 'graph',     label: 'Graphs' },
];

export default function InventoryTabs({ rows, propertyName }: Props) {
  const [tab, setTab] = useState<TabKey>('kpi');
  const [search, setSearch] = useState('');
  const [property, setProperty] = useState<PropertyFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();

  const totals = useMemo(() => {
    let green = 0, red = 0, amber = 0;
    for (const r of rows) {
      if (r.status_color === 'green') green++;
      else if (r.status_color === 'red') red++;
      else if (r.status_color === 'amber') amber++;
    }
    return { green, red, amber, total: rows.length };
  }, [rows]);

  const tabCounts = useMemo(() => {
    const c: Record<TabKey, number> = { kpi: 0, container: 0, graph: 0 };
    for (const r of rows) c[r.kind]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.kind !== tab) return false;
      if (needle) {
        const hay = `${r.name ?? ''} ${r.primary_view ?? ''} ${r.code ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (tab === 'kpi' && property !== 'all') {
        const n = !!r.served_by_namkhan;
        const d = !!r.served_by_donna;
        if (property === 'namkhan' && !n) return false;
        if (property === 'donna'   && !d) return false;
        if (property === 'both'    && !(n && d)) return false;
      }
      if (status === 'wired'     && !r.is_wired) return false;
      if (status === 'not_wired' &&  r.is_wired) return false;
      if (status === 'live'      &&  r.data_status !== 'live') return false;
      return true;
    });
  }, [rows, tab, search, property, status]);

  function handleRefresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div style={S.wrap}>
      <InventoryHeader
        total={totals.total}
        green={totals.green}
        red={totals.red}
        amber={totals.amber}
        propertyName={propertyName}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />

      <div style={S.tabStrip} role="tablist" aria-label="Inventory kind">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              style={{ ...S.tab, ...(active ? S.tabActive : null) }}
            >
              <span>{t.label}</span>
              <span style={S.tabCount}>{tabCounts[t.key]}</span>
            </button>
          );
        })}
      </div>

      <InventoryFilters
        tab={tab}
        search={search}
        onSearch={setSearch}
        property={property}
        onProperty={setProperty}
        status={status}
        onStatus={setStatus}
      />

      <InventoryGrid rows={filtered} kind={tab} />
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column' },
  tabStrip: {
    display: 'flex',
    gap: 4,
    marginBottom: 16,
    borderBottom: '1px solid var(--line-soft, rgba(251, 246, 233, 0.15))',
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--ink-mute, #cfc3a3)',
    fontFamily: 'var(--mono, "JetBrains Mono", ui-monospace, monospace)',
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    transition: 'color 100ms ease, border-color 100ms ease',
  },
  tabActive: {
    color: 'var(--ink, #fbf6e9)',
    borderBottomColor: 'var(--brass, #d4a866)',
    fontWeight: 600,
  },
  tabCount: {
    fontSize: 10,
    color: 'var(--ink-faint, #a59a7d)',
    background: 'var(--line-soft, rgba(251, 246, 233, 0.15))',
    padding: '1px 6px',
    borderRadius: 99,
    fontWeight: 500,
  },
};
