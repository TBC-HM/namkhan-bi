// app/sales/b2b/_components/B2bKpiStrip.tsx
// Persistent KPI strip across all B2B/DMC sub-tabs.
// PBS 2026-06-30: migrated from legacy .kpi-box divs to canonical <KpiTile/>
// primitive so the b2b page matches every other page's KPI strip aesthetic
// (paper background, hairline borders, no dark tile bodies).

import { KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { getDmcKpisLive } from '@/lib/dmc';
import { fmtTableUsd } from '@/lib/format';

export default async function B2bKpiStrip() {
  const k = await getDmcKpisLive();

  const adr = k.totalRns > 0 ? k.totalRevenue / k.totalRns : 0;
  const avgBookingValue = k.reservationCount > 0 ? k.totalRevenue / k.reservationCount : 0;

  const tiles: KpiTileProps[] = [
    {
      label: 'Active LPAs',
      value: k.activeContracts,
      size: 'sm',
      footnote: `of ${k.contractCount} on file`,
    },
    {
      label: 'Expiring 90d',
      value: k.expiringIn90,
      size: 'sm',
      footnote: 'auto-alerts armed',
      status: k.expiringIn90 > 0 ? 'amber' : 'green',
    },
    {
      label: 'LPA reservations',
      value: k.reservationCount,
      size: 'sm',
      footnote: `${k.totalRns} room nights`,
    },
    {
      label: 'Mapped',
      value: `${k.matchedReservations}/${k.reservationCount}`,
      size: 'sm',
      footnote: `${k.unmatchedSources} unmapped sources`,
      status: k.unmatchedSources > 0 ? 'amber' : 'green',
    },
    {
      label: 'LPA revenue',
      value: Math.round(k.totalRevenue),
      currency: 'USD',
      size: 'sm',
      footnote: 'all-time on LPA rate plan',
    },
    {
      label: 'Avg booking value',
      value: avgBookingValue > 0 ? Math.round(avgBookingValue) : 0,
      currency: 'USD',
      size: 'sm',
      footnote: k.totalRns > 0 ? `${fmtTableUsd(adr)} ADR` : 'no data',
    },
  ];

  return (
    <div
      style={{
        gridColumn: '1 / -1',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 10,
        marginBottom: 14,
      }}
    >
      {tiles.map((t, i) => <KpiTile key={i} {...t} />)}
    </div>
  );
}
