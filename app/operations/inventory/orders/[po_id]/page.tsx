// app/operations/inventory/orders/[po_id]/page.tsx
// PO detail — header, line items with per-line ReceiptModal, receipt log.

import Link from 'next/link';
import Card from '@/components/sections/Card';
import { supabase } from '@/lib/supabase';
import { fmtMoney } from '@/lib/format';
import ReceiptModal from '../../_components/ReceiptModal';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface Props { params: { po_id: string } }

export default async function PoDetailPage({ params }: Props) {
  const [{ data: po }, { data: items }, { data: receipts }] = await Promise.all([
    supabase
      .schema('procurement')
      .from('purchase_orders')
      .select('*, vendor:vendor_id(name), location:delivery_location_id(location_name)')
      .eq('po_id', params.po_id)
      .maybeSingle(),
    supabase
      .schema('procurement')
      .from('po_items')
      .select('*, item:item_id(sku, item_name)')
      .eq('po_id', params.po_id),
    supabase
      .schema('procurement')
      .from('receipts')
      .select('*')
      .eq('po_id', params.po_id)
      .order('received_at', { ascending: false }),
  ]);

  if (!po) {
    return <Card title="PO" emphasis="not found"><p><Link href="/operations/inventory/orders">← Back</Link></p></Card>;
  }

  return (
    <>
      <div className="breadcrumb">
        <Link href="/operations/inventory/orders">Orders</Link>{' · '}
        <strong>{po.po_number ?? po.po_id.slice(0, 8) + '…'}</strong>
      </div>

      <Card
        title={po.po_number ?? 'PO'}
        emphasis={po.vendor?.name ?? '—'}
        sub={`Status: ${po.status.replace(/_/g, ' ')}${po.qb_bill_ref ? ` · QB bill: ${po.qb_bill_ref}` : ''}`}
      >
        <dl className="inv-dl">
          <dt>Delivery location</dt>
          <dd>{po.location?.location_name ?? '—'}</dd>
          <dt>Expected delivery</dt>
          <dd>{po.expected_delivery_date ?? '—'}</dd>
          <dt>Total</dt>
          <dd>{fmtMoney(Number(po.total_usd ?? 0))}</dd>
          {po.source_pr_id && (<>
            <dt>Source PR</dt>
            <dd><Link href={`/operations/inventory/requests/${po.source_pr_id}`}>{po.source_pr_id.slice(0, 8)}…</Link></dd>
          </>)}
        </dl>
      </Card>

      <Card title="Line items" emphasis={`${items?.length ?? 0}`}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>SKU</th><th>Item</th>
              <th style={{ textAlign: 'right' }}>Ordered</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Unit cost</th>
              <th style={{ textAlign: 'right' }}>Line total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it: any) => (
              <tr key={it.po_item_id}>
                <td>{it.item?.sku}</td>
                <td>{it.item?.item_name}</td>
                <td style={{ textAlign: 'right' }}>{it.quantity_ordered}</td>
                <td style={{ textAlign: 'right' }}>{it.quantity_received}</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(Number(it.unit_cost_usd ?? 0))}</td>
                <td style={{ textAlign: 'right' }}>{fmtMoney(Number(it.total_usd ?? 0))}</td>
                <td>
                  <ReceiptModal
                    poId={po.po_id}
                    poItemId={it.po_item_id}
                    itemName={it.item?.item_name ?? ''}
                    qtyOrdered={Number(it.quantity_ordered)}
                    qtyReceived={Number(it.quantity_received)}
                    unitCostUsd={Number(it.unit_cost_usd ?? 0)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {(receipts?.length ?? 0) > 0 && (
        <Card title="Receipts log" emphasis={`${receipts!.length}`}>
          <table className="inv-table">
            <thead>
              <tr><th>When</th><th>Qty</th><th>Batch</th><th>Expiry</th><th>QC</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {receipts!.map((r: any) => (
                <tr key={r.receipt_id}>
                  <td>{r.received_at.slice(0, 16).replace('T', ' ')}</td>
                  <td>{r.received_qty}</td>
                  <td>{r.batch_code ?? '—'}</td>
                  <td>{r.expiry_date ?? '—'}</td>
                  <td>{r.quality_check_passed ? '✓' : r.quality_check_passed === false ? '✕' : '—'}</td>
                  <td>{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
