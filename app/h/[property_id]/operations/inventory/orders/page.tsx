// app/h/[property_id]/operations/inventory/orders/page.tsx
//
// Purchase orders — procurement.purchase_orders (0 rows today; zero-state).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getOpenPOs } from '@/app/operations/inventory/_data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export default async function OrdersPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/orders`);
  }

  const rows = await getOpenPOs();
  const open = rows.filter(r => !['received','closed','cancelled'].includes(r.status));
  const totalOpen = open.reduce((s, r) => s + (r.total_usd ?? 0), 0);
  const partial = rows.filter(r => r.status === 'partially_received').length;
  const now = Date.now();
  const overdue = rows.filter(r => r.expected_delivery_date
    && !['received','closed','cancelled'].includes(r.status)
    && new Date(r.expected_delivery_date).getTime() < now).length;

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
        <Container title={rows.length === 0 ? 'No purchase orders' : 'Open POs'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {rows.length === 0
              ? <>No POs on file. Once a purchase request is approved and converted to a PO, it lands here with vendor, ETA, and balance.</>
              : <>{fmtInt(rows.length)} POs on file. Detailed table view lands in the next iteration; totals above are live.</>
            }
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
