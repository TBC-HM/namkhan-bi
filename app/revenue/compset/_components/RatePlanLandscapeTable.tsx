// app/revenue/compset/_components/RatePlanLandscapeTable.tsx
// Cross-comp rate plan landscape table.

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import { fmtTableUsd, EMPTY } from '@/lib/format';
import type { RatePlanLandscapeRow } from './types';

interface Props {
  rows: RatePlanLandscapeRow[];
}

export default function RatePlanLandscapeTable({ rows }: Props) {
  const columns: Column<RatePlanLandscapeRow>[] = [
    {
      key: 'plan_name',
      header: 'PLAN TYPE',
      sortValue: (r) => r.plan_name,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.plan_name}</div>
          {r.category && (
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 'var(--t-xs)',
                color: 'var(--ink-mute)',
                letterSpacing: 'var(--ls-loose)',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {r.category}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'namkhan_offers',
      header: 'NAMKHAN',
      align: 'center',
      sortValue: (r) => (r.namkhan_offers ? 1 : 0),
      render: (r) =>
        r.namkhan_offers ? (
          <span style={{ color: 'var(--moss-glow)', fontWeight: 700 }}>YES</span>
        ) : (
          <span style={{ color: 'var(--st-bad)', fontWeight: 700 }}>NO</span>
        ),
    },
    {
      key: 'comps_offering',
      header: 'COMPS OFFERING',
      numeric: true,
      sortValue: (r) => Number(r.comps_offering_excl_self ?? 0),
      render: (r) => (
        <span style={{ fontFamily: 'var(--mono)' }}>
          {r.comps_offering_excl_self ?? 0}
        </span>
      ),
    },
    {
      key: 'avg_rate',
      header: 'AVG COMP RATE',
      numeric: true,
      sortValue: (r) => Number(r.avg_rate_usd ?? 0),
      render: (r) => fmtTableUsd(r.avg_rate_usd),
    },
    {
      key: 'avg_discount',
      header: 'AVG DISC',
      numeric: true,
      sortValue: (r) => Number(r.avg_discount_when_promoted ?? 0),
      render: (r) =>
        r.avg_discount_when_promoted != null
          ? `${Number(r.avg_discount_when_promoted).toFixed(1)}%`
          : EMPTY,
    },
    {
      key: 'comps_list',
      header: 'COMPS OFFERING IT',
      render: (r) => (
        <span
          style={{
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-xs)',
          }}
        >
          {r.comps_offering_list && r.comps_offering_list.length > 0
            ? r.comps_offering_list.slice(0, 4).join(' · ') +
              (r.comps_offering_list.length > 4
                ? ` · +${r.comps_offering_list.length - 4}`
                : '')
            : EMPTY}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.taxonomy_code}
      rowClassName={(r) => (!r.namkhan_offers ? 'row-warn' : undefined)}
      emptyState={
        <div
          style={{
            padding: '20px 16px',
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontSize: 'var(--t-sm)',
          }}
        >
          No rate-plan landscape rows yet — agent has not run.
        </div>
      }
    />
  );
}
