// app/h/[property_id]/operations/inventory/suppliers/SuppliersList.tsx
//
// Client wrapper for the QB vendor register (gl.v_supplier_overview).

'use client';

import { ListContainer, type ListContainerColumn } from '@/app/(cockpit)/_design';

export interface SupplierRow {
  vendor_name: string;
  line_count: string;
  last_txn_date: string;
  gross_spend_usd: string;
  distinct_accounts: string;
  is_active_recent: string;
}

const COLUMNS: ListContainerColumn<SupplierRow>[] = [
  { key: 'vendor_name',       label: 'Vendor',
    render: (r) => <span>{r.vendor_name}</span> },
  { key: 'line_count',        label: 'Lines',       align: 'right', width: 90,
    render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.line_count}</span> },
  { key: 'last_txn_date',     label: 'Last txn',    align: 'right', width: 110,
    render: (r) => <span style={{ color: '#5A5A5A', fontSize: 12 }}>{r.last_txn_date}</span> },
  { key: 'gross_spend_usd',   label: 'Spend YTD',   align: 'right', width: 130,
    render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.gross_spend_usd}</span> },
  { key: 'distinct_accounts', label: 'Accts',       align: 'right', width: 80,
    render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.distinct_accounts}</span> },
  { key: 'is_active_recent',  label: 'Recent?',     align: 'center', width: 80,
    render: (r) => <span style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{r.is_active_recent}</span> },
];

function renderPeekRow(r: SupplierRow) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 130px 80px', gap: 12, alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.vendor_name}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.line_count}</span>
      <span style={{ fontSize: 12, color: '#5A5A5A', textAlign: 'right' }}>{r.last_txn_date}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.gross_spend_usd}</span>
      <span style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.distinct_accounts}</span>
    </div>
  );
}

interface Props {
  title: string;
  data: SupplierRow[];
}

export default function SuppliersList({ title, data }: Props) {
  return (
    <ListContainer<SupplierRow>
      title={title}
      subtitle={`${data.length.toLocaleString('en-US')} vendors · sorted by YTD spend`}
      data={data}
      preview={10}
      rowKey={(r) => r.vendor_name}
      renderRow={renderPeekRow}
      drawerColumns={COLUMNS}
      drawerDefaultSort={{ key: 'gross_spend_usd', direction: 'desc' }}
      drawerSearchKeys={['vendor_name']}
      showAllLabel={`Show all ${data.length.toLocaleString('en-US')}`}
      empty={{ title: 'No vendors', hint: 'gl.v_supplier_overview returned no rows.' }}
    />
  );
}
