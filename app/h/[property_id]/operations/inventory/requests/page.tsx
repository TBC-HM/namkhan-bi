// app/h/[property_id]/operations/inventory/requests/page.tsx
//
// Purchase requests — procurement.requests (0 rows today; zero-state).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getOpenRequests } from '@/app/operations/inventory/_data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export default async function RequestsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/requests`);
  }

  const rows = await getOpenRequests();
  const closedStates = ['approved','closed','rejected','converted_to_po','cancelled'];
  const open = rows.filter(r => !closedStates.includes(r.status));
  const totalOpen = open.reduce((s, r) => s + (r.total_estimated_usd ?? 0), 0);
  const urgent = rows.filter(r => r.priority === 'urgent' && !closedStates.includes(r.status)).length;
  const now = Date.now();
  const overdue = rows.filter(r => r.needed_by_date
    && !closedStates.includes(r.status)
    && new Date(r.needed_by_date).getTime() < now).length;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Purchase requests" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Open requests',    value: fmtInt(open.length), footnote: 'Not approved / closed / rejected / converted' },
            { label: 'Total est. value', value: fmtUsd(totalOpen),   footnote: 'Sum of total_estimated_usd on open PRs' },
            { label: 'Urgent priority',  value: fmtInt(urgent),      footnote: 'priority=urgent and still open' },
            { label: 'Past needed-by',   value: fmtInt(overdue),     footnote: 'needed_by_date in the past and still open' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={rows.length === 0 ? 'No purchase requests' : 'Purchase requests'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {rows.length === 0
              ? <>No requests in the queue. HODs raise requests via the Shop sub-tab; auto-approved items convert to POs instantly, others route to GM / owner.</>
              : <>{fmtInt(rows.length)} requests on file. Detailed table view lands in the next iteration; totals above are live.</>
            }
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
