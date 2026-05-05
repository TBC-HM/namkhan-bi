// app/revenue/compset/_components/scoring/VersionHistoryTable.tsx
// Version history for scoring_config — flat list, latest first.
// Each row joins the latest audit entry's reason (passed in by the parent).

'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';
import type { VersionRow } from './types';
export type { VersionRow } from './types';

interface Props {
  rows: VersionRow[];
}

export default function VersionHistoryTable({ rows }: Props) {
  const columns: Column<VersionRow>[] = [
    {
      key: 'version',
      header: 'VERSION',
      numeric: true,
      sortValue: (r) => r.version,
      render: (r) => `v${r.version}`,
    },
    {
      key: 'status',
      header: 'STATUS',
      align: 'center',
      render: (r) => {
        if (r.is_active) return <StatusPill tone="active">Active</StatusPill>;
        if (r.retired_at) return <StatusPill tone="expired">Retired</StatusPill>;
        return <StatusPill tone="inactive">Draft</StatusPill>;
      },
    },
    {
      key: 'created_at',
      header: 'CREATED',
      sortValue: (r) => r.created_at ?? '',
      render: (r) => fmtIsoDate(r.created_at),
    },
    {
      key: 'activated_at',
      header: 'ACTIVATED',
      sortValue: (r) => r.activated_at ?? '',
      render: (r) => fmtIsoDate(r.activated_at),
    },
    {
      key: 'retired_at',
      header: 'RETIRED',
      sortValue: (r) => r.retired_at ?? '',
      render: (r) => fmtIsoDate(r.retired_at),
    },
    {
      key: 'created_by',
      header: 'CREATED BY',
      render: (r) =>
        r.created_by
          ? <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.created_by.slice(0, 8)}</span>
          : EMPTY,
    },
    {
      key: 'notes',
      header: 'NOTES',
      render: (r) => r.notes ?? EMPTY,
    },
    {
      key: 'last_audit_reason',
      header: 'LAST CHANGE REASON',
      render: (r) =>
        r.last_audit_reason
          ? <span style={{ color: 'var(--ink-soft)' }}>{r.last_audit_reason}</span>
          : EMPTY,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.config_id}
      defaultSort={{ key: 'version', dir: 'desc' }}
      emptyState={
        <div style={{ padding: '24px 16px', textAlign: 'center' }}>
          <div style={{ color: 'var(--ink-mute)', marginBottom: 4 }}>
            No versions yet.
          </div>
          <div style={{ color: 'var(--ink-faint)', fontSize: 'var(--t-xs)' }}>
            Save your first scoring config to start the version history.
          </div>
        </div>
      }
    />
  );
}
