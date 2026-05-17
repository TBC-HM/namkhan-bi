// app/revenue/_shared/RateplansShell.tsx
// Property-aware Rate Plans dispatcher.

import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import NamkhanRateplansBody from '../rateplans/page';
import DonnaRateplansBody from '@/app/h/[property_id]/revenue/_donna/DonnaRateplansBody';
import DonnaRevenueCanonical from '@/app/h/[property_id]/revenue/_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '@/app/h/[property_id]/revenue/_surfaces';

export interface RateplansShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function RateplansShell({ propertyId, searchParams }: RateplansShellProps) {
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <NamkhanRateplansBody searchParams={searchParams} />;
  }
  if (propertyId === DONNA_PROPERTY_ID) {
    const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
    const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
    return <DonnaRateplansBody propertyId={propertyId} win={win} cmp={cmp} />;
  }
  const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
  const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={win}
      cmp={cmp}
      cfg={REVENUE_SURFACES.rateplans}
    />
  );
}
