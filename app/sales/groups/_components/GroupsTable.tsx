'use client';

import DataTable, { type Column } from '@/components/ui/DataTable';
import StatusPill, { type StatusTone } from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';

export interface GroupRow {
  group_id: string;
  group_name: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  block_size: number | null;
  pickup: number | null;
  pickup_pct: number | null;
  cutoff_date: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string | null;
}

const STATUS_TONE: Record<string, { tone: StatusTone; label: string }> = {
  confirmed: { tone: 'active',   label: 'Confirmed' },
  tentative: { tone: 'pending',  label: 'Tentative' },
  cancelled: { tone: 'expired',  label: 'Cancelled' },
  open:      { tone: 'info',     label: 'Open' },
};

export default function GroupsTable({ rows }: { rows: GroupRow[] }) {
  const columns: Column<GroupRow>[] = [
    { key: 'group',     header: 'GROUP',     sortValue: (r) => (r.group_name ?? '').toLowerCase(), render: (r) => <span style={{ fontWeight: 500 }}>{r.group_name ?? EMPTY}</span> },
    { key: 'arrival',   header: 'ARRIVAL',   sortValue: (r) => r.arrival_date ?? '', render: (r) => fmtIsoDate(r.arrival_date) },
    { key: 'departure', header: 'DEPARTURE', sortValue: (r) => r.departure_date ?? '', render: (r) => fmtIsoDate(r.departure_date) },
    { key: 'block',     header: 'BLOCK',     numeric: true, sortValue: (r) => r.block_size ?? 0, render: (r) => r.block_size != null ? r.block_size.toLocaleString('en-US') : EMPTY },
    { key: 'pickup',    header: 'PICKUP',    numeric: true, sortValue: (r) => r.pickup ?? 0, render: (r) => r.pickup != null ? r.pickup.toLocaleString('en-US') : EMPTY },
    {
      key: 'pickup_pct', header: '%', numeric: true,
      sortValue: (r) => Number(r.pickup_pct) || 0,
      render: (r) => {
        if (r.pickup_pct == null) return EMPTY;
        const pct = Number(r.pickup_pct);
        const color = pct >= 80 ? 'var(--moss-glow)' : pct >= 50 ? 'var(--brass)' : 'var(--st-bad)';
        return <span style={{ color }}>{pct.toFixed(0)}%</span>;
      },
    },
    { key: 'cutoff',  header: 'CUT-OFF', sortValue: (r) => r.cutoff_date ?? '', render: (r) => fmtIsoDate(r.cutoff_date) },
    { key: 'contact', header: 'CONTACT', render: (r) => r.contact_name ?? EMPTY },
    {
      key: 'status', header: 'STATUS', align: 'center',
      sortValue: (r) => r.status ?? '',
      render: (r) => {
        const t = STATUS_TONE[(r.status ?? 'open').toLowerCase()] ?? STATUS_TONE.open;
        return <StatusPill tone={t.tone}>{t.label}</StatusPill>;
      },
    },
  ];
  return (
    <DataTable<GroupRow>
      columns={columns}
      rows={rows}
      rowKey={(r) => r.group_id}
      defaultSort={{ key: 'arrival', dir: 'asc' }}
      emptyState={<>No group blocks in <code>public.groups</code>.</>}
    />
  );
}
