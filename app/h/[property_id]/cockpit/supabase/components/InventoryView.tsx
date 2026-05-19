// Client orchestrator: owns tab/filter/drawer state and renders
// the inventory page via design primitives only.
// Constitution: ALL visual blocks here come from @/app/(cockpit)/_design.

'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  DashboardPage, Container, KpiTile, Drawer,
  type DashboardTab, type StatusTone,
} from '@/app/(cockpit)/_design';
import type {
  InventoryRow, TabKey, PropertyFilter, StatusFilter,
} from '../lib/types';
import InventoryHeader from './InventoryHeader';
import InventoryFilters from './InventoryFilters';
import InventoryDrawerBody from './InventoryDrawerBody';

interface Props {
  rows: InventoryRow[];
  propertyName: string;
}

const TAB_LABELS: Record<TabKey, string> = {
  kpi:       'KPIs',
  container: 'Containers',
  graph:     'Graphs',
  component: 'Components',
};

const TAB_ORDER: TabKey[] = ['kpi', 'container', 'graph', 'component'];

function groupKey(row: InventoryRow): string {
  if (row.kind === 'container') return row.page_slug ?? row.section ?? 'other';
  return row.section ?? 'other';
}

function compareCodes(a: InventoryRow, b: InventoryRow): number {
  if (a.kind === 'kpi' && b.kind === 'kpi') {
    const ai = Number(a.code); const bi = Number(b.code);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
  }
  return a.code.localeCompare(b.code);
}

function tileLabel(row: InventoryRow): string {
  if (row.kind === 'kpi') return `#${row.code} · ${row.name}`;
  return row.name;
}

function tileValue(row: InventoryRow): string {
  if (row.primary_view) return row.primary_view;
  const n = row.bound_views?.length ?? 0;
  return `${n} view${n === 1 ? '' : 's'}`;
}

function statusTone(row: InventoryRow): StatusTone {
  return row.status_color === 'green' ? 'green'
    : row.status_color === 'amber' ? 'amber'
    : 'red';
}

export default function InventoryView({ rows, propertyName }: Props) {
  const [tab, setTab] = useState<TabKey>('kpi');
  const [search, setSearch] = useState('');
  const [property, setProperty] = useState<PropertyFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [drawerRow, setDrawerRow] = useState<InventoryRow | null>(null);

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
    const c: Record<TabKey, number> = { kpi: 0, container: 0, graph: 0, component: 0 };
    for (const r of rows) c[r.kind]++;
    return c;
  }, [rows]);

  const tabs: DashboardTab[] = TAB_ORDER.map((k) => ({
    key: k,
    label: TAB_LABELS[k],
    active: tab === k,
    onSelect: () => setTab(k),
    count: tabCounts[k],
  }));

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (r.kind !== tab) return false;
      if (needle) {
        const hay = `${r.name ?? ''} ${r.primary_view ?? ''} ${r.code ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (tab === 'kpi' && property !== 'all') {
        const n = !!r.served_by_namkhan; const d = !!r.served_by_donna;
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

  const sections = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, InventoryRow[]>();
    for (const row of filtered) {
      const k = groupKey(row);
      if (!map.has(k)) { map.set(k, []); order.push(k); }
      map.get(k)!.push(row);
    }
    return order.map((key) => ({
      key,
      items: (map.get(key) ?? []).slice().sort(compareCodes),
    }));
  }, [filtered]);

  return (
    <DashboardPage
      title="Supabase Inventory"
      subtitle="Read-only discovery surface. Tiles flip red → green when frontend wires a view."
      tabs={tabs}
    >
      <InventoryHeader
        total={totals.total}
        green={totals.green}
        red={totals.red}
        amber={totals.amber}
        propertyName={propertyName}
      />

      <InventoryFilters
        tab={tab}
        search={search} onSearch={setSearch}
        property={property} onProperty={setProperty}
        status={status} onStatus={setStatus}
      />

      {sections.length === 0 && (
        <Container title={TAB_LABELS[tab]} subtitle="No items match the current filters.">
          <div style={{ fontSize: 12, color: 'var(--ink-soft, #5A5A5A)' }}>Adjust filters or insert new registry rows.</div>
        </Container>
      )}

      {sections.map(({ key, items }) => {
        const wired    = items.filter((r) => r.status_color === 'green').length;
        const notWired = items.filter((r) => r.status_color === 'red').length;
        const partial  = items.filter((r) => r.status_color === 'amber').length;
        const subtitleBits: string[] = [`${wired} wired`, `${notWired} not wired`];
        if (partial > 0) subtitleBits.push(`${partial} partial`);
        return (
          <Container
            key={key}
            title={`${key} (${items.length})`}
            subtitle={subtitleBits.join(' · ')}
            density="compact"
          >
            <div style={gridStyle}>
              {items.map((row) => (
                <KpiTile
                  key={`${row.kind}:${row.code}`}
                  label={tileLabel(row)}
                  value={tileValue(row)}
                  unit={row.chart_type ?? undefined}
                  status={statusTone(row)}
                  footnote={row.notes ?? undefined}
                  size="sm"
                  onClick={() => setDrawerRow(row)}
                />
              ))}
            </div>
          </Container>
        );
      })}

      <Drawer
        open={drawerRow !== null}
        onClose={() => setDrawerRow(null)}
        title={drawerRow ? tileLabel(drawerRow) : ''}
        subtitle={drawerRow?.primary_view ?? (drawerRow ? `${drawerRow.bound_views?.length ?? 0} bound views` : '')}
        width="lg"
      >
        {drawerRow && <InventoryDrawerBody row={drawerRow} />}
      </Drawer>
    </DashboardPage>
  );
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 12,
};
