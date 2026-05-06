'use client';

// app/operations/inventory/catalog/_CatalogTableClient.tsx
// Client wrapper around <DataTable>. Column defs include render/sortValue
// fns which cannot cross the server→client boundary, so they must live
// in a 'use client' file. Server page passes only plain JSON rows.

import DataTable, { Column } from '@/components/ui/DataTable';
import { fmtUSD, fmtTableUsd, fmtIsoDate, EMPTY } from '@/lib/format';

export interface CatalogRow {
  sku: string;
  item_name: string;
  category_code: string | null;
  category_name: string | null;
  unit_code: string | null;
  last_unit_cost_usd: number | null;
  gl_account_code: string | null;
  is_perishable: boolean;
  catalog_status: string;
  is_active: boolean;
  updated_at: string | null;
  last_sold_at: string | null;
  ytd_sales_usd: number | null;
}

export default function CatalogTableClient({ rows }: { rows: CatalogRow[] }) {
  const columns: Column<CatalogRow>[] = [
    {
      key: 'sku',
      header: 'SKU',
      width: '140px',
      render: (r) => <span style={{ fontFamily: 'var(--mono)' }}>{r.sku}</span>,
      sortValue: (r) => r.sku,
    },
    {
      key: 'item_name',
      header: 'Item',
      render: (r) => r.item_name,
      sortValue: (r) => r.item_name,
    },
    {
      key: 'category',
      header: 'Category',
      width: '180px',
      render: (r) => r.category_code
        ? <span title={r.category_name ?? ''} style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.category_code}</span>
        : EMPTY,
      sortValue: (r) => r.category_code ?? '',
    },
    {
      key: 'unit',
      header: 'UoM',
      width: '70px',
      align: 'center',
      render: (r) => r.unit_code
        ? <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.unit_code}</span>
        : EMPTY,
      sortValue: (r) => r.unit_code ?? '',
    },
    {
      key: 'cost',
      header: 'Last cost',
      width: '110px',
      align: 'right',
      numeric: true,
      render: (r) => r.last_unit_cost_usd != null ? fmtUSD(r.last_unit_cost_usd) : EMPTY,
      sortValue: (r) => r.last_unit_cost_usd ?? -1,
    },
    {
      key: 'last_sold',
      header: 'Last sale',
      width: '110px',
      render: (r) => <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{fmtIsoDate(r.last_sold_at)}</span>,
      sortValue: (r) => r.last_sold_at ?? '',
    },
    {
      key: 'ytd_sales',
      header: 'YTD sales',
      width: '110px',
      align: 'right',
      numeric: true,
      render: (r) => fmtTableUsd(r.ytd_sales_usd),
      sortValue: (r) => r.ytd_sales_usd ?? -1,
    },
    {
      key: 'gl',
      header: 'GL acct',
      width: '110px',
      render: (r) => r.gl_account_code
        ? <span style={{ fontFamily: 'var(--mono)', fontSize: 'var(--t-xs)' }}>{r.gl_account_code}</span>
        : EMPTY,
    },
    {
      key: 'flags',
      header: 'Flags',
      width: '120px',
      render: (r) => {
        const parts: string[] = [];
        if (r.is_perishable) parts.push('perishable');
        if (!r.is_active) parts.push('inactive');
        return (
          <span style={{ fontSize: 'var(--t-xs)', color: 'var(--ink-soft)' }}>
            {parts.length ? parts.join(' · ') : EMPTY}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      align: 'center',
      render: (r) => (
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: 'var(--t-xs)',
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: r.catalog_status === 'approved' ? 'var(--ok, #2f6f3a)' : 'var(--ink-soft)',
        }}>{r.catalog_status}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.sku}
      defaultSort={{ key: 'item_name', dir: 'asc' }}
      emptyState={
        <div style={{ padding: '36px 12px', textAlign: 'center', color: 'var(--ink-soft)' }}>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 'var(--t-lg)' }}>
            No products yet.
          </div>
          <div style={{ marginTop: 6, fontSize: 'var(--t-sm)' }}>
            Click <strong>+ Upload products</strong> to bulk-load from a Cloudbeds export CSV.
          </div>
        </div>
      }
    />
  );
}
