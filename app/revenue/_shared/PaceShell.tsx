// app/revenue/_shared/PaceShell.tsx
// Property-aware Pace dispatcher — see PulseShell.

import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import NamkhanPaceBody from '../pace/page';
import DonnaPaceBody from '@/app/h/[property_id]/revenue/_donna/DonnaPaceBody';
import DonnaRevenueCanonical from '@/app/h/[property_id]/revenue/_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '@/app/h/[property_id]/revenue/_surfaces';

export interface PaceShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PaceShell({ propertyId, searchParams }: PaceShellProps) {
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <NamkhanPaceBody searchParams={searchParams as any} />;
  }
  if (propertyId === DONNA_PROPERTY_ID) {
    const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
    const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
    return <DonnaPaceBody propertyId={propertyId} win={win} cmp={cmp} />;
  }
  const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
  const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={win}
      cmp={cmp}
      cfg={REVENUE_SURFACES.pace}
    />
  );
}
