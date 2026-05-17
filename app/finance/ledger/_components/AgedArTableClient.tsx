'use client';

import DataTable from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtMoney, fmtIsoDate, EMPTY } from '@/lib/format';
import CloudbedsReservationLink from '@/components/cloudbeds/CloudbedsReservationLink';

export interface AgedRow {
  reservation_id: string;
  guest_name: string | null;
  source_name: string | null;
  check_out_date: string | null;
  open_balance: number;
  days_overdue: number | null;
  bucket: string;
  guest_email?: string | null;
  guest_phone?: string | null;
}

const BUCKET_LABEL: Record<string, string> = {
  '0_30': '0–30',
  '31_60': '31–60',
  '61_90': '61–90',
  '90_plus': '90+',
  current: 'Current',
};
const BUCKET_TONE: Record<string, StatusTone> = {
  current: 'active',
  '0_30': 'active',
  '31_60': 'pending',
  '61_90': 'pending',
  '90_plus': 'expired',
};

export default function AgedArTable({
  rows,
  onRowClick,
}: {
  rows: AgedRow[];
  onRowClick?: (r: AgedRow) => void;
}) {
  return (
    <DataTable<AgedRow>
      rows={rows}
      rowKey={(r) => r.reservation_id}
      defaultSort={{ key: 'open', dir: 'desc' }}
      emptyState="No aged receivables."
      columns={[
        {
          key: 'guest',
          header: 'Guest',
          sortValue: (r) => r.guest_name ?? '',
          render: (r) =>
            onRowClick ? (
              <button
                onClick={() => onRowClick(r)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600,
                  color: 'var(--brass)', textDecoration: 'underline',
                }}
              >
                {r.guest_name || EMPTY}
              </button>
            ) : (
              <strong style={{ fontWeight: 600 }}>{r.guest_name || EMPTY}</strong>
            ),
        },
        {
          key: 'reservation',
          header: 'Reservation #',
          sortValue: (r) => r.reservation_id,
          render: (r) => <CloudbedsReservationLink reservationId={r.reservation_id} />,
        },
        {
          key: 'source',
          header: 'Source',
          sortValue: (r) => r.source_name ?? '',
          render: (r) => <span style={{ color: 'var(--ink-mute)' }}>{r.source_name || EMPTY}</span>,
        },
        {
          key: 'co',
          header: 'Check-out',
          sortValue: (r) => r.check_out_date ?? '',
          render: (r) => fmtIsoDate(r.check_out_date),
        },
        {
          key: 'open',
          header: 'Balance',
          numeric: true,
          sortValue: (r) => Number(r.open_balance),
          render: (r) => fmtMoney(Number(r.open_balance), 'USD'),
        },
        {
          key: 'days',
          header: 'Days overdue',
          numeric: true,
          sortValue: (r) => r.days_overdue ?? -1,
          render: (r) => r.days_overdue ?? EMPTY,
        },
        {
          key: 'bucket',
          header: 'Bucket',
          align: 'center',
          sortValue: (r) => r.bucket,
          render: (r) => (
            <StatusPill tone={BUCKET_TONE[r.bucket] ?? 'inactive'}>
              {BUCKET_LABEL[r.bucket] ?? r.bucket}
            </StatusPill>
          ),
        },
      ]}
    />
  );
}
