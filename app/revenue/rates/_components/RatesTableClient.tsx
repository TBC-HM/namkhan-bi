'use client';

import DataTable from '@/components/ui/DataTable';
import { fmtMoney, EMPTY } from '@/lib/format';

export interface RoomTypeRow {
  name: string;
  rates: number[];
  min: number;
  max: number;
}

export default function RatesTable({ rows }: { rows: RoomTypeRow[] }) {
  return (
    <DataTable<RoomTypeRow>
      rows={rows}
      rowKey={(r) => r.name}
      defaultSort={{ key: 'avg', dir: 'desc' }}
      emptyState="No rate data in selected window."
      columns={[
        {
          key: 'name',
          header: 'Room Type',
          sortValue: (r) => r.name,
          render: (r) => <strong style={{ fontWeight: 600 }}>{r.name}</strong>,
        },
        {
          key: 'min',
          header: 'Min',
          numeric: true,
          sortValue: (r) => (r.min === Infinity ? -1 : r.min),
          render: (r) => (r.min !== Infinity ? fmtMoney(r.min, 'USD') : EMPTY),
        },
        {
          key: 'avg',
          header: 'Avg',
          numeric: true,
          sortValue: (r) => (r.rates.length ? r.rates.reduce((a, b) => a + b, 0) / r.rates.length : 0),
          render: (r) => {
            const avg = r.rates.length ? r.rates.reduce((a, b) => a + b, 0) / r.rates.length : 0;
            return avg ? fmtMoney(avg, 'USD') : EMPTY;
          },
        },
        {
          key: 'max',
          header: 'Max',
          numeric: true,
          sortValue: (r) => (r.max === -Infinity ? -1 : r.max),
          render: (r) => (r.max !== -Infinity ? fmtMoney(r.max, 'USD') : EMPTY),
        },
        {
          key: 'spread',
          header: 'Spread',
          numeric: true,
          sortValue: (r) =>
            r.max !== -Infinity && r.min !== Infinity ? r.max - r.min : -1,
          render: (r) => {
            if (r.max === -Infinity || r.min === Infinity) return EMPTY;
            return (
              <span style={{ color: 'var(--ink-mute)' }}>
                {fmtMoney(r.max - r.min, 'USD')}
              </span>
            );
          },
        },
        {
          key: 'days',
          header: 'Days',
          numeric: true,
          sortValue: (r) => r.rates.length,
          render: (r) => (
            <span style={{ color: 'var(--ink-mute)' }}>{r.rates.length}</span>
          ),
        },
      ]}
    />
  );
}
