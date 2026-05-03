'use client';

// app/operations/inventory/suppliers/[id]/_DetailTablesClient.tsx
// Client wrappers around <DataTable> for the four supplier-detail tables.

import Link from 'next/link';
import DataTable, { Column } from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';
import type {
  SupplierContact,
  SupplierItemRow,
  SupplierAlternateRow,
  SupplierPriceRow,
} from '../../_data';

const mono: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' };

// ---------- Contacts ----------

export function ContactsTable({ rows }: { rows: SupplierContact[] }) {
  const cols: Column<SupplierContact>[] = [
    { key: 'name', header: 'Name',
      render: (r) => (
        <span>
          {r.name}
          {r.is_primary && <span style={{ marginLeft: 6, ...mono, color: 'var(--moss-glow)' }}>· PRIMARY</span>}
        </span>
      ),
      sortValue: (r) => r.name },
    { key: 'title', header: 'Title', width: '160px',
      render: (r) => r.title ?? EMPTY, sortValue: (r) => r.title ?? '' },
    { key: 'email', header: 'Email', width: '220px',
      render: (r) => r.email ? <a href={`mailto:${r.email}`} style={{ color: 'var(--brass)', textDecoration: 'none', ...mono }}>{r.email}</a> : EMPTY,
      sortValue: (r) => r.email ?? '' },
    { key: 'phone', header: 'Phone', width: '140px',
      render: (r) => r.phone ? <span style={mono}>{r.phone}</span> : EMPTY,
      sortValue: (r) => r.phone ?? '' },
    { key: 'wa', header: 'WhatsApp', width: '140px',
      render: (r) => r.whatsapp ? <span style={mono}>{r.whatsapp}</span> : EMPTY,
      sortValue: (r) => r.whatsapp ?? '' },
    { key: 'notes', header: 'Notes',
      render: (r) => r.notes ?? EMPTY },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => String(r.contact_id)}
      defaultSort={{ key: 'name', dir: 'asc' }}
      emptyState="No contacts on file. Add via the database (or wait for the contact form, Phase 2.5b)."
    />
  );
}

// ---------- Items supplied ----------

export function ItemsSuppliedTable({ rows }: { rows: SupplierItemRow[] }) {
  const cols: Column<SupplierItemRow>[] = [
    { key: 'sku', header: 'SKU', width: '120px',
      render: (r) => <span style={mono}>{r.sku}</span>, sortValue: (r) => r.sku },
    { key: 'name', header: 'Item',
      render: (r) => r.item_name, sortValue: (r) => r.item_name },
    { key: 'cat', header: 'Category', width: '180px',
      render: (r) => r.category_name ?? EMPTY, sortValue: (r) => r.category_name ?? '' },
    { key: 'cost', header: 'Last cost', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.last_unit_cost_usd), sortValue: (r) => r.last_unit_cost_usd ?? -1 },
    { key: 'role', header: 'Role', align: 'center', width: '110px',
      render: (r) => r.is_primary
        ? <StatusPill tone="active">Primary</StatusPill>
        : <StatusPill tone="info">Alternate</StatusPill>,
      sortValue: (r) => (r.is_primary ? 'a' : 'b') },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => r.item_id}
      defaultSort={{ key: 'role', dir: 'asc' }}
      emptyState="No items linked. Set primary_vendor_id or alternate_vendor_id on inv.items rows."
    />
  );
}

// ---------- Alternates ----------

export function AlternatesTable({ rows }: { rows: SupplierAlternateRow[] }) {
  const cols: Column<SupplierAlternateRow>[] = [
    { key: 'rank', header: 'Rank', numeric: true, width: '60px',
      render: (r) => <span style={mono}>{r.preference_rank}</span>, sortValue: (r) => r.preference_rank },
    { key: 'code', header: 'Code', width: '110px',
      render: (r) => (
        <Link href={`/operations/inventory/suppliers/${r.alternate_supplier_id}`}
          style={{ color: 'var(--brass)', textDecoration: 'none', ...mono }}>
          {r.alternate_code}
        </Link>
      ),
      sortValue: (r) => r.alternate_code },
    { key: 'name', header: 'Alternate supplier',
      render: (r) => (
        <Link href={`/operations/inventory/suppliers/${r.alternate_supplier_id}`}
          style={{ color: 'var(--ink)', textDecoration: 'none' }}>
          {r.alternate_name}
        </Link>
      ),
      sortValue: (r) => r.alternate_name },
    { key: 'notes', header: 'Notes',
      render: (r) => r.notes ?? EMPTY },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => String(r.alt_id)}
      defaultSort={{ key: 'rank', dir: 'asc' }}
      emptyState="No alternates configured."
    />
  );
}

// ---------- Price history ----------

export function PriceHistoryTable({ rows }: { rows: SupplierPriceRow[] }) {
  const cols: Column<SupplierPriceRow>[] = [
    { key: 'date', header: 'Effective', width: '110px',
      render: (r) => <span style={mono}>{fmtIsoDate(r.effective_date)}</span>,
      sortValue: (r) => r.effective_date ?? '' },
    { key: 'sku', header: 'SKU', width: '120px',
      render: (r) => r.inv_sku ? <span style={mono}>{r.inv_sku}</span> : EMPTY,
      sortValue: (r) => r.inv_sku ?? '' },
    { key: 'usd', header: 'Unit $ USD', numeric: true, width: '110px',
      render: (r) => fmtTableUsd(r.unit_price_usd),
      sortValue: (r) => r.unit_price_usd ?? -1 },
    { key: 'lak', header: 'Unit ₭ LAK', numeric: true, width: '120px',
      render: (r) => r.unit_price_lak != null
        ? <span style={mono}>{`₭${Math.round(r.unit_price_lak).toLocaleString('en-US')}`}</span>
        : EMPTY,
      sortValue: (r) => r.unit_price_lak ?? -1 },
    { key: 'moq', header: 'MOQ', numeric: true, width: '70px',
      render: (r) => r.min_order_qty != null ? <span style={mono}>{r.min_order_qty}</span> : EMPTY,
      sortValue: (r) => r.min_order_qty ?? -1 },
    { key: 'src', header: 'Source', width: '120px',
      render: (r) => r.source ? <span style={mono}>{r.source}</span> : EMPTY,
      sortValue: (r) => r.source ?? '' },
    { key: 'src_ref', header: 'Ref', width: '160px',
      render: (r) => r.source_ref ? <span style={mono}>{r.source_ref}</span> : EMPTY },
    { key: 'notes', header: 'Notes',
      render: (r) => r.notes ?? EMPTY },
  ];
  return (
    <DataTable
      columns={cols}
      rows={rows}
      rowKey={(r) => String(r.price_id)}
      defaultSort={{ key: 'date', dir: 'desc' }}
      emptyState="No price history yet. Use the form below to log a quote, invoice, or price-list update."
    />
  );
}
