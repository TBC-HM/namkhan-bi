// app/h/[property_id]/operations/inventory/par/page.tsx
//
// Par-level discipline — inv.v_inv_par_status (0 rows today, no par rules set).

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getParStatus } from '@/app/operations/inventory/_data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;
const fmtPct = (n: number | null): string => n == null ? 'N/A' : `${Math.round(n)}%`;

export default async function ParPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/par`);
  }

  const rows = await getParStatus();
  const belowPar = rows.filter((r) => ['below_par','below_min','out_of_stock'].includes(r.par_status)).length;
  const reorderTotal = rows.filter((r) => r.short_quantity != null && r.short_quantity > 0)
    .reduce((s, r) => s + (r.reorder_value_usd ?? 0), 0);
  const avgPct = rows.length === 0 ? null : rows.reduce((s, r) => s + (r.pct_of_par ?? 0), 0) / rows.length;
  const overMax = rows.filter((r) => ['over_max','overstocked'].includes(r.par_status)).length;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Par-level discipline" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Below par',        value: fmtInt(belowPar),    footnote: 'At/under reorder point in any location' },
            { label: 'Reorder $ value',  value: fmtUsd(reorderTotal), footnote: 'Sum of reorder_value_usd for items below par' },
            { label: 'Avg % of par',     value: fmtPct(avgPct),      footnote: 'Mean of pct_of_par across par-tracked rows' },
            { label: 'Par rules tracked', value: fmtInt(rows.length), footnote: 'Rows in inv.par_levels' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={rows.length === 0 ? 'No par rules set' : 'Par status by item × location'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {rows.length === 0
              ? <>Set par per item × location so the system can flag below-par shelves and estimate reorder $. Rules land in inv.par_levels; live status surfaces here.</>
              : <>{fmtInt(rows.length)} par rules active. Detailed table view lands in the next iteration; totals above are live.</>
            }
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
