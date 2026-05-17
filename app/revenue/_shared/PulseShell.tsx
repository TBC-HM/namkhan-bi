// app/revenue/_shared/PulseShell.tsx
//
// PBS 2026-05-16: property-aware Pulse dispatcher. ONE shell, both properties.
// Namkhan (260955) gets the full live Pulse body (existing /revenue/pulse page).
// Donna (and future properties) gets the canonical empty-state scaffold from
// _DonnaRevenueCanonical with the Pulse surface config — so layout/KPI labels
// stay in sync with Namkhan but data lands when the Mews PMS feed wires up.
//
// Both routes — `/revenue/pulse` (Namkhan-only legacy) and `/h/[id]/revenue/pulse`
// (property-scoped) — render this same component. Layout changes touch ONE file.

import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import NamkhanPulseBody from '../pulse/page';
import DonnaPulseBody from '@/app/h/[property_id]/revenue/_donna/DonnaPulseBody';
import DonnaRevenueCanonical from '@/app/h/[property_id]/revenue/_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '@/app/h/[property_id]/revenue/_surfaces';

export interface PulseShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PulseShell({ propertyId, searchParams }: PulseShellProps) {
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <NamkhanPulseBody searchParams={searchParams} />;
  }
  // Donna: live Mews-backed body (real KPIs from pms.reservation_rooms_mews).
  if (propertyId === DONNA_PROPERTY_ID) {
    const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
    const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
    return <DonnaPulseBody propertyId={propertyId} win={win} cmp={cmp} />;
  }
  // Future properties without a data feed: canonical empty-state scaffold.
  const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
  const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={win}
      cmp={cmp}
      cfg={REVENUE_SURFACES.pulse}
    />
  );
}
