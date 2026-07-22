// app/h/[property_id]/operations/inventory/catalog/CatalogList.tsx
//
// Client wrapper around ListContainer for the item catalog.
// Server pre-formats every cell into a plain string so the RSC boundary
// only carries JSON — no fn props (digest 3224079219 fix).

'use client';

import { ListContainer, type ListContainerColumn } from '@/app/(cockpit)/_design';

export interface CatalogItemRow {
  item_id: string;
  sku: string;
  item_name: string;
  category_name: string;
  on_hand: string;
  value_usd: string;
  last_movement: string;
}

const COLUMNS: ListContainerColumn<CatalogItemRow>[] = [
  { key: 'sku',           label: 'SKU',           width: 140,
    render: (r) => (
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11 }}>
        {r.sku}
      </span>
    ) },
  { key: 'item_name',     label: 'Item',
    render: (r) => <span>{r.item_name}</span> },
  { key: 'category_name', label: 'Category',      width: 180,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.category_name}</span> },
  { key: 'on_hand',       label: 'On hand',       align: 'right', width: 90,
    render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.on_hand}</span> },
  { key: 'value_usd',     label: 'Value (USD)',   align: 'right', width: 110,
    render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value_usd}</span> },
  { key: 'last_movement', label: 'Last movement', align: 'right', width: 130,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.last_movement}</span> },
];

function renderPeekRow(r: CatalogItemRow) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 90px 110px', gap: 12, alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: '#5A5A5A' }}>{r.sku}</span>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.item_name}</span>
      <span style={{ fontSize: 12, color: '#5A5A5A' }}>{r.category_name}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.on_hand}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.value_usd}</span>
    </div>
  );
}

interface Props {
  title: string;
  data: CatalogItemRow[];
}

export default function CatalogList({ title, data }: Props) {
  return (
    <ListContainer<CatalogItemRow>
      title={title}
      subtitle={`${data.length.toLocaleString('en-US')} items · sorted by name`}
      data={data}
      preview={10}
      rowKey={(r) => r.item_id}
      renderRow={renderPeekRow}
      drawerColumns={COLUMNS}
      drawerDefaultSort={{ key: 'item_name', direction: 'asc' }}
      drawerSearchKeys={['sku', 'item_name', 'category_name']}
      showAllLabel={`Show all ${data.length.toLocaleString('en-US')}`}
      empty={{ title: 'No items', hint: 'Catalog empty — upload SKUs via /catalog upload button.' }}
    />
  );
}
