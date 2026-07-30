// app/h/[property_id]/operations/inventory/orders/page.tsx
//
// Purchase orders — procurement.purchase_orders with links to the PO detail
// page (per-line ReceiptModal lives there). List view revived 2026-07-30
// (inventory completion brief).

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

interface PoRaw {
  po_id: string;
  po_number: string | null;
  expected_delivery_date: string | null;
  total_usd: number | null;
  status: string | null;
  issued_at: string | null;
}

async function fetchOrders(): Promise<PoRaw[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .schema('procurement')
    .from('purchase_orders')
    .select('po_id, po_number, expected_delivery_date, total_usd, status, issued_at')
    .order('issued_at', { ascending: false, nullsFirst: false })
    .limit(500);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[inventory/orders] procurement.purchase_orders fetch failed', error);
    return [];
  }
  return (data ?? []) as PoRaw[];
}

export default async function OrdersPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/orders`);
  }

  const rows = await fetchOrders();
  const basePath = `/h/${propertyId}/operations/inventory`;
  const closed = ['received', 'closed', 'cancelled'];
  const open = rows.filter((r) => !closed.includes(r.status ?? ''));
  const totalOpen = open.reduce((s, r) => s + Number(r.total_usd ?? 0), 0);
  const partial = rows.filter((r) => r.status === 'partially_received').length;
  const now = Date.now();
  const overdue = open.filter((r) => r.expected_delivery_date && new Date(r.expected_delivery_date).getTime() < now).length;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Purchase orders" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Open POs',           value: fmtInt(open.length), footnote: 'Not received / closed / cancelled' },
            { label: 'Total open value',   value: fmtUsd(totalOpen),   footnote: 'Sum of total_usd on open POs' },
            { label: 'Partially received', value: fmtInt(partial),     footnote: 'Awaiting balance delivery' },
            { label: 'Overdue delivery',   value: fmtInt(overdue),     footnote: 'ETA in the past' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={rows.length === 0 ? 'No purchase orders' : 'Purchase orders'} expandable={false}>
          {rows.length === 0 ? (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
              No POs on file. Once a purchase request is approved (or auto-approved under the cap),
              it converts to a PO and lands here — open it to record goods receipts.
            </div>
          ) : (
            <table className="inv-table">
              <thead>
                <tr>
                  <th>PO</th><th>Status</th><th style={{ textAlign: 'right' }}>Total USD</th>
                  <th>ETA</th><th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.po_id}>
                    <td>
                      <Link href={`${basePath}/orders/${r.po_id}`} style={{ textDecoration: 'underline' }}>
                        {r.po_number ?? r.po_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{(r.status ?? '—').replace(/_/g, ' ')}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUsd(Number(r.total_usd ?? 0))}</td>
                    <td>{r.expected_delivery_date ?? '—'}</td>
                    <td>{r.issued_at?.slice(0, 10) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Container>
      </div>
    </DashboardPage>
  );
}
