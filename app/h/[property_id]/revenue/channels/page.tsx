// app/h/[property_id]/revenue/channels/page.tsx
// PBS 2026-05-16: routes through shared ChannelsShell — single source of truth.

import ChannelsShell from '@/app/revenue/_shared/ChannelsShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRevenueChannelsPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <ChannelsShell propertyId={Number(params.property_id)} searchParams={searchParams ?? {}} />;
}
