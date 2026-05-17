// app/h/[property_id]/revenue/pace/page.tsx
// PBS 2026-05-16: routes through shared PaceShell — single source of truth.

import PaceShell from '@/app/revenue/_shared/PaceShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRevenuePacePage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <PaceShell propertyId={Number(params.property_id)} searchParams={searchParams ?? {}} />;
}
