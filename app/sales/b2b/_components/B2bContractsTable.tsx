'use client';

// Client-only renderer for the B2B/DMC partner contracts table.
// Server components cannot pass functions (render, sortValue) into client
// component props, so the column config lives here. The page passes
// already-serialized rows + flags; this file owns presentation only.
//
// PBS 2026-06-30: partner click now jumps straight to the merged channel
// landing (/revenue/channels/[source]) instead of /sales/b2b/partner/[id],
// which redirects there anyway.

import Link from 'next/link';
import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, fmtCountry, fmtBool, EMPTY } from '@/lib/format';

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  active:      { tone: 'active',   label: 'Active' },
  expiring:    { tone: 'pending',  label: 'Expiring' },
  expired:     { tone: 'expired',  label: 'Expired' },
  draft:       { tone: 'inactive', label: 'Draft' },
  suspended:   { tone: 'inactive', label: 'Suspended' },
  no_contract: { tone: 'expired',  label: 'No contract' },
};

export interface DisplayRow {
  key: string;
  contract_id: string | null;
  partner_short_name: string;
  country: string | null;
  flag: string | null;
  type: string;
  status: string;
  effective: string | null;
  expires: string | null;
  daysToExpiry: number | null;
  contact: string | null;
  autoRenew: boolean;
  reservationCount: number;
  revenue: number;
}

export default function B2bContractsTable({ rows }: { rows: DisplayRow[] }) {
  const columns: Column<DisplayRow>[] = [
    {
      key: 'partner',
      header: 'Partner',
      sortValue: (r) => r.partner_short_name.toLowerCase(),
      render: (r) => (
        <Link
          href={`/revenue/channels/${encodeURIComponent(r.partner_short_name)}`}
          style={{
            color: r.contract_id ? 'var(--ink, #1B1B1B)' : 'var(--st-bad, #B03826)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {r.partner_short_name}
        </Link>
      ),
    },
    {
      key: 'country',
      header: 'Country',
      sortValue: (r) => r.country ?? '',
      render: (r) => fmtCountry(r.flag, r.country),
    },
    { key: 'type', header: 'Type', sortValue: (r) => r.type, render: (r) => r.type },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      sortValue: (r) => r.status,
      render: (r) => {
        const t = STATUS_TONE[r.status] ?? STATUS_TONE.draft;
        return <StatusPill tone={t.tone}>{t.label}</StatusPill>;
      },
    },
    { key: 'effective', header: 'Effective', sortValue: (r) => r.effective ?? '', render: (r) => fmtIsoDate(r.effective) },
    { key: 'expires',   header: 'Expires',   sortValue: (r) => r.expires ?? '',   render: (r) => fmtIsoDate(r.expires) },
    {
      key: 'days',
      header: 'Days',
      numeric: true,
      sortValue: (r) => r.daysToExpiry ?? Number.MAX_SAFE_INTEGER,
      render: (r) =>
        r.daysToExpiry == null ? EMPTY :
        r.daysToExpiry > 0 ? `${r.daysToExpiry}` :
        r.daysToExpiry === 0 ? 'today' : `${Math.abs(r.daysToExpiry)}d ago`,
    },
    {
      key: 'bookings',
      header: 'Bookings',
      numeric: true,
      sortValue: (r) => r.reservationCount,
      render: (r) => r.reservationCount > 0 ? r.reservationCount.toLocaleString('en-US') : EMPTY,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      numeric: true,
      sortValue: (r) => r.revenue,
      render: (r) => r.revenue > 0 ? fmtTableUsd(r.revenue) : EMPTY,
    },
    {
      key: 'renew',
      header: 'Renew',
      align: 'center',
      sortValue: (r) => r.autoRenew ? 1 : 0,
      render: (r) => fmtBool(r.autoRenew),
    },
  ];
  return (
    <DataTable<DisplayRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.key}
      rowClassName={(r) => r.contract_id == null ? 'row-warn' : undefined}
      emptyState="No partners on file."
    />
  );
}
