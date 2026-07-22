// app/h/[property_id]/operations/inventory/assets/page.tsx
//
// Fixed asset register — currently 0 rows in fa.assets, so this is a pure
// zero-state page. Once assets are entered the strip pulls counts from
// getAssetRegister() and the table lands under a client wrapper.

import { redirect } from 'next/navigation';
import { DashboardPage, Container, MetricRow, type DashboardTab } from '@/app/(cockpit)/_design';
import { OPERATIONS_SUBPAGES } from '@/app/operations/_subpages';
import { NAMKHAN_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import { getAssetRegister } from '@/app/operations/inventory/_data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props { params: { property_id: string } }

const fmtInt = (n: number): string => Math.round(Number(n) || 0).toLocaleString('en-US');
const fmtUsd = (n: number): string => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

export default async function AssetsPage({ params }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId) || propertyId <= 0) {
    redirect(`/h/${NAMKHAN_PROPERTY_ID}/operations/inventory/assets`);
  }

  const assets = await getAssetRegister();
  const totalCost = assets.reduce((s, a) => s + (a.purchase_cost_usd ?? 0), 0);
  const totalNbv = assets.reduce((s, a) => s + (a.nbv_usd ?? 0), 0);
  const totalDep = totalCost - totalNbv;

  const tabs: DashboardTab[] = OPERATIONS_SUBPAGES.map((s) => ({
    key: s.href,
    label: s.label,
    href: s.href,
    active: s.href.endsWith('/inventory'),
  }));

  return (
    <DashboardPage title="Fixed asset register" tabs={tabs}>
      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow
          size="sm"
          tiles={[
            { label: 'Total assets',      value: fmtInt(assets.length), footnote: 'Rows in fa.assets' },
            { label: 'Original cost',     value: fmtUsd(totalCost),     footnote: 'Sum of purchase_cost_usd' },
            { label: 'Accumulated dep.',  value: fmtUsd(totalDep),      footnote: 'Straight-line, in-service date basis' },
            { label: 'Net book value',    value: fmtUsd(totalNbv),      footnote: 'Cost − depreciation' },
          ]}
        />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title={assets.length === 0 ? 'Asset register pending' : 'Fixed assets'} expandable={false}>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: '#1B1B1B' }}>
            {assets.length === 0 ? (
              <>Register loads with the catalog upload tomorrow. Once tagged assets are entered, this
              page renders the full FFE / equipment register grouped by fa.category, with straight-line
              NBV and condition-coded rows.</>
            ) : (
              <>{fmtInt(assets.length)} tagged assets on file. Detailed table view will land in the next
              iteration; totals above are live.</>
            )}
          </div>
        </Container>
      </div>
    </DashboardPage>
  );
}
