// app/revenue/pace/_components/PaceTableClient.tsx
//
// Client wrapper around the bucket DataTable on /revenue/pace.
// DataTable is 'use client' — function props can't cross the server→client
// boundary, so column config + render fns live here.

'use client';

import DataTable from '@/components/ui/DataTable';
import { fmtMoney, EMPTY } from '@/lib/format';
import type { BucketRow } from './PaceGraphs';

type Gran = 'day' | 'week' | 'month';

function fmtMonth(yyyymm: string) {
  const [y, m] = yyyymm.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

export default function PaceBucketsTable({
  rows,
  gran,
}: {
  rows: BucketRow[];
  gran: Gran;
}) {
  const granLabels: Record<Gran, string> = { day: 'Day', week: 'Week', month: 'Month' };
  return (
    <DataTable<BucketRow>
      rows={rows}
      rowKey={(r) => r.key}
      emptyState="No on-the-books in this window."
      columns={[
        {
          key: 'period',
          header: granLabels[gran],
          sortValue: (r) => r.key,
          render: (r) => (
            <strong style={{ fontWeight: 600 }}>
              {gran === 'month' ? fmtMonth(r.key) : r.key}
            </strong>
          ),
        },
        {
          key: 'days',
          header: 'Days',
          numeric: true,
          sortValue: (r) => r.days,
          render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{r.days}</span>,
        },
        {
          key: 'rns',
          header: 'OTB RN',
          numeric: true,
          sortValue: (r) => r.rns,
          render: (r) => r.rns,
        },
        {
          key: 'rev',
          header: 'Revenue',
          numeric: true,
          sortValue: (r) => r.rev,
          render: (r) => fmtMoney(r.rev, 'USD'),
        },
        {
          key: 'adr',
          header: 'ADR',
          numeric: true,
          sortValue: (r) => (r.rns > 0 ? r.rev / r.rns : 0),
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>
              ${r.rns > 0 ? Math.round(r.rev / r.rns) : 0}
            </span>
          ),
        },
        {
          key: 'occ',
          header: 'Occ %',
          numeric: true,
          sortValue: (r) => (r.capacity > 0 ? (r.rns / r.capacity) * 100 : 0),
          render: (r) => {
            const occB = r.capacity > 0 ? (r.rns / r.capacity) * 100 : 0;
            const color =
              occB > 70
                ? 'var(--moss-glow)'
                : occB < 30
                ? 'var(--st-bad)'
                : 'var(--ink-soft)';
            return <span style={{ color }}>{occB.toFixed(1)}%</span>;
          },
        },
        {
          key: 'cxl',
          header: 'Cancel',
          numeric: true,
          sortValue: (r) => r.cxl,
          render: (r) =>
            r.cxl > 0 ? (
              <span style={{ color: 'var(--st-bad)' }}>{r.cxl}</span>
            ) : (
              EMPTY
            ),
        },
        {
          key: 'stly',
          header: 'STLY',
          numeric: true,
          sortValue: (r) => (r.stlyRn > 0 ? (r.rns / r.stlyRn) * 100 : -1),
          render: (r) => {
            if (r.stlyRn <= 0) return EMPTY;
            const pct = (r.rns / r.stlyRn) * 100;
            const color =
              pct >= 100
                ? 'var(--moss-glow)'
                : pct >= 70
                ? 'var(--ink-soft)'
                : 'var(--st-bad)';
            return (
              <span style={{ color }}>
                {r.stlyRn} RN · {pct.toFixed(0)}%
              </span>
            );
          },
        },
      ]}
    />
  );
}
