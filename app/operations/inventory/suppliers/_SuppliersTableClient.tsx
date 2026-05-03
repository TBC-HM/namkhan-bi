'use client';

// app/operations/inventory/suppliers/_SuppliersTableClient.tsx
// Client wrapper around <DataTable> for the supplier register.

import Link from 'next/link';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtIsoDate, EMPTY } from '@/lib/format';
import type { SupplierSummaryRow } from '../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

function statusToPill(s: string) {
  // DB constraint: active | suspended | terminated | prospect
  switch (s) {
    case 'active':     return <StatusPill tone="active">Active</StatusPill>;
    case 'prospect':   return <StatusPill tone="pending">Prospect</StatusPill>;
    case 'suspended':  return <StatusPill tone="expired">Suspended</StatusPill>;
    case 'terminated': return <StatusPill tone="inactive">Terminated</StatusPill>;
    default:           return <StatusPill tone="info">{s}</StatusPill>;
  }
}

function pctScore(n: number | null | undefined): string {
  if (n == null) return EMPTY;
  // scores are stored 0–1 — show as %
  const v = n <= 1 ? n * 100 : n;
  return `${Math.round(v)}%`;
}

export default function SuppliersTableClient({ rows }: { rows: SupplierSummaryRow[] }) {
  const cols: Column<SupplierSummaryRow>[] = [
    { key: 'code', header: 'Code', width: '110px',
      render: (r) => (
        <Link
          href={`/operations/inventory/suppliers/${r.supplier_id}`}
          style={{ ...mono, color: 'var(--brass)', textDecoration: 'none' }}
        >{r.code}</Link>
      ),
      sortValue: (r) => r.code },
    { key: 'name', header: 'Name',
      render: (r) => (
        <Link
          href={`/operations/inventory/suppliers/${r.supplier_id}`}
          style={{ color: 'var(--ink)', textDecoration: 'none' }}
        >{r.name}</Link>
      ),
      sortValue: (r) => r.name },
    { key: 'type', header: 'Type', width: '120px',
      render: (r) => r.supplier_type ? <span style={mono}>{r.supplier_type}</span> : EMPTY,
      sortValue: (r) => r.supplier_type ?? '' },
    { key: 'origin', header: 'Origin', width: '180px',
      render: (r) => (
        <span>
          {r.city ? `${r.city}, ${r.country}` : r.country}
          {r.is_local_sourcing && (
            <span style={{ marginLeft: 6, ...mono, color: 'var(--moss-glow)' }}>· LOCAL</span>
          )}
        </span>
      ),
      sortValue: (r) => `${r.country}::${r.city ?? ''}` },
    { key: 'lead', header: 'Lead', numeric: true, width: '70px',
      render: (r) => r.lead_time_days != null ? <span style={mono}>{`${r.lead_time_days}d`}</span> : EMPTY,
      sortValue: (r) => r.lead_time_days ?? -1 },
    { key: 'pay', header: 'Pay terms', numeric: true, width: '90px',
      render: (r) => r.payment_terms_days != null ? <span style={mono}>{`${r.payment_terms_days}d`}</span> : EMPTY,
      sortValue: (r) => r.payment_terms_days ?? -1 },
    { key: 'rel', header: 'Reliability', numeric: true, width: '100px',
      render: (r) => <span style={mono}>{pctScore(r.reliability_score)}</span>,
      sortValue: (r) => r.reliability_score ?? -1 },
    { key: 'qual', header: 'Quality', numeric: true, width: '90px',
      render: (r) => <span style={mono}>{pctScore(r.quality_score)}</span>,
      sortValue: (r) => r.quality_score ?? -1 },
    { key: 'items', header: 'Items', numeric: true, width: '70px',
      render: (r) => <span style={mono}>{r.items_supplied}</span>,
      sortValue: (r) => r.items_supplied },
    { key: 'contacts', header: 'Contacts', numeric: true, width: '80px',
      render: (r) => <span style={mono}>{r.contact_count}</span>,
      sortValue: (r) => r.contact_count },
    { key: 'last_price', header: 'Last price', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.last_price_update)}</span>,
      sortValue: (r) => r.last_price_update ?? '' },
    { key: 'status', header: 'Status', align: 'center', width: '100px',
      render: (r) => statusToPill(r.status),
      sortValue: (r) => r.status },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.supplier_id}
      defaultSort={{ key: 'rel', dir: 'desc' }}
      emptyState="No suppliers yet. Use + Upload suppliers to bulk-load from CSV."
    />
  );
}
