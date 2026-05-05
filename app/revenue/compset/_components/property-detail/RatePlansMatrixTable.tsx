// app/revenue/compset/_components/property-detail/RatePlansMatrixTable.tsx
//
// Section 4 of the deep-view: rate plans offered, pivoted by channel.
// Source rows arrive one-per-(channel × plan); we pivot client-side into
// one row per (taxonomy_code, plan_name) with channel presence ✓ / —.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { EMPTY, fmtBool, fmtTableUsd } from '@/lib/format';
import type { CompetitorRatePlanMixRow } from '../types';

interface Props {
  rows: CompetitorRatePlanMixRow[];
}

interface PivotedRow {
  key: string;
  category: string | null;
  taxonomy_code: string;
  plan_name: string;
  bdc: boolean;
  agoda: boolean;
  expedia: boolean;
  trip: boolean;
  direct: boolean;
  avg_rate_usd: number | null;
}

function pivot(rows: CompetitorRatePlanMixRow[]): PivotedRow[] {
  const map = new Map<string, PivotedRow>();
  for (const r of rows) {
    const key = `${r.taxonomy_code}::${r.plan_name}`;
    let cur = map.get(key);
    if (!cur) {
      cur = {
        key,
        category: r.category,
        taxonomy_code: r.taxonomy_code,
        plan_name: r.plan_name,
        bdc: false,
        agoda: false,
        expedia: false,
        trip: false,
        direct: false,
        avg_rate_usd: null,
      };
      map.set(key, cur);
    }
    const ch = (r.channel ?? '').toLowerCase();
    if (ch === 'bdc') cur.bdc = true;
    else if (ch === 'agoda') cur.agoda = true;
    else if (ch === 'expedia') cur.expedia = true;
    else if (ch === 'trip') cur.trip = true;
    else if (ch === 'direct') cur.direct = true;
    if (r.avg_rate_usd != null) {
      cur.avg_rate_usd =
        cur.avg_rate_usd != null
          ? (cur.avg_rate_usd + Number(r.avg_rate_usd)) / 2
          : Number(r.avg_rate_usd);
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    (a.category ?? '').localeCompare(b.category ?? '') ||
    a.plan_name.localeCompare(b.plan_name),
  );
}

export default function RatePlansMatrixTable({ rows }: Props) {
  const pivoted = pivot(rows);

  const columns: Column<PivotedRow>[] = [
    {
      key: 'category',
      header: 'CATEGORY',
      sortValue: (r) => r.category ?? '',
      render: (r) => r.category ?? EMPTY,
    },
    {
      key: 'plan_name',
      header: 'PLAN NAME',
      sortValue: (r) => r.plan_name,
      render: (r) => r.plan_name,
    },
    { key: 'bdc',     header: 'BDC',     align: 'center', render: (r) => fmtBool(r.bdc) },
    { key: 'agoda',   header: 'AGODA',   align: 'center', render: (r) => fmtBool(r.agoda) },
    { key: 'expedia', header: 'EXPEDIA', align: 'center', render: (r) => fmtBool(r.expedia) },
    { key: 'trip',    header: 'TRIP',    align: 'center', render: (r) => fmtBool(r.trip) },
    { key: 'direct',  header: 'DIRECT',  align: 'center', render: (r) => fmtBool(r.direct) },
    {
      key: 'avg_rate',
      header: 'AVG RATE',
      numeric: true,
      sortValue: (r) => Number(r.avg_rate_usd ?? 0),
      render: (r) => fmtTableUsd(r.avg_rate_usd),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={pivoted}
      rowKey={(r) => r.key}
      emptyState={
        <div style={{ padding: '20px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            Rate plans not yet captured.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Needs deeper Nimble parser pass.
          </div>
        </div>
      }
    />
  );
}
