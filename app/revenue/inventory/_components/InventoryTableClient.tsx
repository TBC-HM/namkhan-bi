// app/revenue/inventory/_components/InventoryTableClient.tsx
//
// Client wrapper for the inventory DataTable. DataTable is 'use client' —
// function props can't cross the server→client boundary.

'use client';

import DataTable from '@/components/ui/DataTable';
import { fmtMoney, EMPTY } from '@/lib/format';

export interface DayRow {
  date: string;
  total_avail: number;
  min_rate: number;
  max_rate: number;
}

export default function InventoryTable({ rows }: { rows: DayRow[] }) {
  return (
    <DataTable<DayRow>
      rows={rows}
      rowKey={(r) => r.date}
      defaultSort={{ key: 'date', dir: 'asc' }}
      emptyState="No inventory data in selected window."
      columns={[
        {
          key: 'date',
          header: 'Date',
          sortValue: (r) => r.date,
          render: (r) => <strong style={{ fontWeight: 600 }}>{r.date}</strong>,
        },
        {
          key: 'avail',
          header: 'Available',
          numeric: true,
          sortValue: (r) => r.total_avail,
          render: (r) => {
            const color =
              r.total_avail === 0
                ? 'var(--st-bad)'
                : r.total_avail <= 3
                ? 'var(--brass)'
                : 'inherit';
            return <span style={{ color, fontWeight: 600 }}>{r.total_avail}</span>;
          },
        },
        {
          key: 'min',
          header: 'Min Rate',
          numeric: true,
          sortValue: (r) => (r.min_rate === Infinity ? -1 : r.min_rate),
          render: (r) => (r.min_rate !== Infinity ? fmtMoney(r.min_rate, 'USD') : EMPTY),
        },
        {
          key: 'max',
          header: 'Max Rate',
          numeric: true,
          sortValue: (r) => (r.max_rate === -Infinity ? -1 : r.max_rate),
          render: (r) => (r.max_rate !== -Infinity ? fmtMoney(r.max_rate, 'USD') : EMPTY),
        },
        {
          key: 'spread',
          header: 'Spread',
          numeric: true,
          sortValue: (r) =>
            r.min_rate !== Infinity && r.max_rate !== -Infinity ? r.max_rate - r.min_rate : -1,
          render: (r) => {
            if (r.min_rate === Infinity || r.max_rate === -Infinity) return EMPTY;
            return (
              <span style={{ color: 'var(--ink-mute)' }}>
                {fmtMoney(r.max_rate - r.min_rate, 'USD')}
              </span>
            );
          },
        },
      ]}
    />
  );
}
