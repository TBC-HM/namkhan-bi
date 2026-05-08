'use client';
// app/revenue/pricing/PricingTable.tsx
// Client wrapper — render + sortValue fns can't cross the RSC boundary.
// Pattern: B2bContractsTable.tsx (design doc reference).

import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import type { BarRow } from './page';

interface Props {
  rows: BarRow[];
}

// Formatters
const fmtDate = (iso: string) => iso; // already ISO YYYY-MM-DD
const fmtUsd  = (v: number | null) =>
  v == null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtLak  = (v: number | null) =>
  v == null ? '—' : `₭${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtNights = (v: number | null) => (v == null ? '—' : `${v}n`);

type ToneType = 'active' | 'inactive' | 'expired' | 'pending' | 'info';

const ctaTone = (closed: boolean | null): ToneType =>
  closed ? 'expired' : 'active';

export default function PricingTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '16px 0' }}>
        No BAR rates on file for the next 30 days.
      </p>
    );
  }

  return (
    <DataTable
      columns={[
        {
          key: 'rate_date',
          header: 'Date',
          sortValue: (r: BarRow) => r.rate_date,
          render: (r: BarRow) => fmtDate(r.rate_date),
        },
        {
          key: 'room_type',
          header: 'Room Type',
          sortValue: (r: BarRow) => r.room_type,
          render: (r: BarRow) => r.room_type,
        },
        {
          key: 'channel',
          header: 'Channel',
          sortValue: (r: BarRow) => r.channel ?? '',
          render: (r: BarRow) => r.channel ?? '—',
        },
        {
          key: 'bar_rate_usd',
          header: 'BAR (USD)',
          numeric: true,
          sortValue: (r: BarRow) => r.bar_rate_usd ?? -1,
          render: (r: BarRow) => fmtUsd(r.bar_rate_usd),
        },
        {
          key: 'bar_rate_lak',
          header: 'BAR (LAK)',
          numeric: true,
          sortValue: (r: BarRow) => r.bar_rate_lak ?? -1,
          render: (r: BarRow) => fmtLak(r.bar_rate_lak),
        },
        {
          key: 'min_stay',
          header: 'Min Stay',
          numeric: true,
          sortValue: (r: BarRow) => r.min_stay ?? 0,
          render: (r: BarRow) => fmtNights(r.min_stay),
        },
        {
          key: 'closed_to_arrival',
          header: 'CTA',
          align: 'center' as const,
          render: (r: BarRow) => (
            <StatusPill tone={ctaTone(r.closed_to_arrival)}>
              {r.closed_to_arrival ? 'Closed' : 'Open'}
            </StatusPill>
          ),
        },
      ]}
      rows={rows}
      rowKey={(r: BarRow) => `${r.rate_date}-${r.room_type}-${r.channel ?? 'all'}`}
      emptyState="No BAR rates for the next 30 days."
    />
  );
}
