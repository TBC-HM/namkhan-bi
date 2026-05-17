// app/revenue/_shared/ChannelsShell.tsx
// Property-aware Channels dispatcher.

import { NAMKHAN_PROPERTY_ID, DONNA_PROPERTY_ID } from '@/lib/dept-cfg/by-property';
import NamkhanChannelsBody from '../channels/page';
import DonnaChannelsBody from '@/app/h/[property_id]/revenue/_donna/DonnaChannelsBody';
import DonnaRevenueCanonical from '@/app/h/[property_id]/revenue/_DonnaRevenueCanonical';
import { REVENUE_SURFACES } from '@/app/h/[property_id]/revenue/_surfaces';

export interface ChannelsShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function ChannelsShell({ propertyId, searchParams }: ChannelsShellProps) {
  if (propertyId === NAMKHAN_PROPERTY_ID) {
    return <NamkhanChannelsBody searchParams={searchParams} />;
  }
  if (propertyId === DONNA_PROPERTY_ID) {
    const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
    const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
    return <DonnaChannelsBody propertyId={propertyId} win={win} cmp={cmp} />;
  }
  const win = typeof searchParams?.win === 'string' ? searchParams.win : undefined;
  const cmp = typeof searchParams?.cmp === 'string' ? searchParams.cmp : undefined;
  return (
    <DonnaRevenueCanonical
      propertyId={propertyId}
      win={win}
      cmp={cmp}
      cfg={REVENUE_SURFACES.channels}
    />
  );
}
