// app/revenue/compset/_components/scoring/EventTypesTable.tsx
// Read-only display of marketing.calendar_event_types via the public proxy.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { EMPTY } from '@/lib/format';
import type { EventTypeRow } from './types';

function fmtWindow(min: number | null, max: number | null): string {
  if (min == null && max == null) return EMPTY;
  if (min != null && max != null) return `${min}d–${max}d`;
  if (min != null) return `≥${min}d`;
  if (max != null) return `≤${max}d`;
  return EMPTY;
}

function fmtMarkets(arr: string[] | null): string {
  if (!arr || arr.length === 0) return EMPTY;
  return arr.join(' · ');
}

interface Props {
  rows: EventTypeRow[];
}

export default function EventTypesTable({ rows }: Props) {
  const columns: Column<EventTypeRow>[] = [
    {
      key: 'type_code',
      header: 'TYPE CODE',
      sortValue: (r) => r.type_code,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 'var(--t-xs)',
            color: 'var(--ink-soft)',
            letterSpacing: 'var(--ls-loose)',
          }}
        >
          {r.type_code}
        </span>
      ),
    },
    {
      key: 'display_name',
      header: 'DISPLAY NAME',
      sortValue: (r) => r.display_name,
      render: (r) => r.display_name,
    },
    {
      key: 'category',
      header: 'CATEGORY',
      sortValue: (r) => r.category ?? '',
      render: (r) => r.category ?? EMPTY,
    },
    {
      key: 'default_demand_score',
      header: 'DEFAULT DEMAND',
      numeric: true,
      sortValue: (r) => Number(r.default_demand_score ?? 0),
      render: (r) => r.default_demand_score ?? EMPTY,
    },
    {
      key: 'lead_window',
      header: 'LEAD WINDOW',
      render: (r) => fmtWindow(r.marketing_lead_days_min, r.marketing_lead_days_max),
    },
    {
      key: 'scrape_window',
      header: 'SCRAPE WINDOW',
      render: (r) => fmtWindow(r.scrape_lead_days_min, r.scrape_lead_days_max),
    },
    {
      key: 'source_markets',
      header: 'SOURCE MARKETS',
      render: (r) => fmtMarkets(r.default_source_markets),
    },
    {
      key: 'notes',
      header: 'NOTES',
      render: (r) => (
        r.notes
          ? <span style={{ color: 'var(--ink-soft)', fontSize: 'var(--t-sm)' }}>{r.notes}</span>
          : EMPTY
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.type_code}
      defaultSort={{ key: 'default_demand_score', dir: 'desc' }}
      emptyState={
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            No event types loaded.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Seed marketing.calendar_event_types to define demand baselines.
          </div>
        </div>
      }
    />
  );
}
