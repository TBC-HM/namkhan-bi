// app/h/[property_id]/revenue/rateplans/page.tsx
// PBS 2026-05-16: routes through shared RateplansShell — single source of truth.

import RateplansShell from '@/app/revenue/_shared/RateplansShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRevenueRateplansPage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <RateplansShell propertyId={Number(params.property_id)} searchParams={searchParams ?? {}} />;
}
