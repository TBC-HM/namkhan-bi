// app/h/[property_id]/operations/inventory/InventoryStockList.tsx
//
// Client-side wrapper around ListContainer for the Stock-on-Hand table.
// Owns the row renderer + column definitions (which contain render fns) so
// the server page can pass only plain serialisable data across the RSC boundary.
//
// Fix for digest 3224079219: passing renderRow / drawerColumns[].render from
// a server component to a "use client" ListContainer breaks RSC serialisation.

'use client';

import { ListContainer, type ListContainerColumn } from '@/app/(cockpit)/_design';

export interface StockRow {
  item_id: string;
  sku: string | null;
  item_name: string;
  category_name: string | null;
  total_on_hand: number;
  value_usd_estimate: number;
  locations_with_stock: number;
  last_movement_at: string | null;
  last_count_at: string | null;
}

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

const COLUMNS: ListContainerColumn<StockRow>[] = [
  { key: 'sku',                  label: 'SKU',           width: 140,
    render: (r) => (
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
        {r.sku ?? '—'}
      </span>
    ) },
  { key: 'item_name',            label: 'Item',
    render: (r) => <span>{r.item_name}</span> },
  { key: 'category_name',        label: 'Category',      width: 180,
    render: (r) => (
      <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.category_name ?? '—'}</span>
    ) },
  { key: 'total_on_hand',        label: 'On hand',       align: 'right', width: 90,
    render: (r) => <span>{fmtInt(r.total_on_hand)}</span> },
  { key: 'value_usd_estimate',   label: 'Value (USD)',   align: 'right', width: 110,
    render: (r) => <span>{fmtUsd(r.value_usd_estimate)}</span> },
  { key: 'locations_with_stock', label: 'Locations',     align: 'right', width: 90,
    render: (r) => <span>{fmtInt(r.locations_with_stock)}</span> },
  { key: 'last_movement_at',     label: 'Last movement', align: 'right', width: 120,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{fmtDate(r.last_movement_at)}</span> },
  { key: 'last_count_at',        label: 'Last count',    align: 'right', width: 120,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{fmtDate(r.last_count_at)}</span> },
];

function renderPeekRow(r: StockRow) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 90px 110px', gap: 12, alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#5A5A5A' }}>
        {r.sku ?? '—'}
      </span>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {r.item_name}
      </span>
      <span style={{ fontSize: 12, color: '#5A5A5A' }}>{r.category_name ?? '—'}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtInt(r.total_on_hand)}
      </span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {fmtUsd(r.value_usd_estimate)}
      </span>
    </div>
  );
}

interface Props {
  title: string;
  data: StockRow[];
  isZeroState: boolean;
}

export default function InventoryStockList({ title, data, isZeroState }: Props) {
  const itemCount = data.length;
  return (
    <ListContainer<StockRow>
      title={title}
      subtitle={`${fmtInt(itemCount)} items · sorted by name`}
      data={data}
      preview={10}
      rowKey={(r) => r.item_id}
      renderRow={renderPeekRow}
      drawerColumns={COLUMNS}
      drawerDefaultSort={{ key: 'item_name', direction: 'asc' }}
      drawerSearchKeys={['sku', 'item_name', 'category_name']}
      showAllLabel={`Show all ${fmtInt(itemCount)}`}
      empty={
        isZeroState
          ? {
              title: 'All items currently at zero',
              hint: 'Awaiting opening counts. Enter counts under the Counts sub-tab.',
            }
          : { title: 'No items', hint: 'v_inv_stock_on_hand returned no rows for this property.' }
      }
    />
  );
}
