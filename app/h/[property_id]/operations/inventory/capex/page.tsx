// app/h/[property_id]/operations/inventory/capex/page.tsx
//
// CapEx pipeline — fa.capex_pipeline (0 rows today; page shows zero-state).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getCapexPipeline } from '@/app/operations/inventory/_data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export default async function CapexPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/capex`);
  }

  const rows = await getCapexPipeline();
  const proposed = rows.filter(r => ['proposed', 'under_review'].includes(r.status));
  const approved = rows.filter(r => r.status === 'approved');
  const closed   = rows.filter(r => ['ordered', 'received', 'rejected', 'cancelled'].includes(r.status));
  const sum = (arr: typeof rows) => arr.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0);

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="CapEx pipeline" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Proposed',       value: fmtUsd(sum(proposed)), footnote: `${fmtInt(proposed.length)} items` },
            { label: 'Approved',       value: fmtUsd(sum(approved)), footnote: `${fmtInt(approved.length)} items` },
            { label: 'In pipeline',    value: fmtUsd(sum(rows.filter(r => !['rejected','cancelled'].includes(r.status)))),
              footnote: `${fmtInt(rows.filter(r => !['rejected','cancelled'].includes(r.status)).length)} active` },
            { label: 'Closed/rejected', value: fmtUsd(sum(closed)),  footnote: `${fmtInt(closed.length)} archived` },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={rows.length === 0 ? 'CapEx pipeline is empty' : 'CapEx proposals'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {rows.length === 0
              ? <>No capex proposals on file. As proposals are logged in fa.capex_pipeline they surface here with IRR, payback and status flags.</>
              : <>{fmtInt(rows.length)} proposals loaded. Detailed table view lands in the next iteration; totals above are live.</>
            }
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
