// app/h/[property_id]/revenue/pulse/page.tsx
//
// PBS 2026-05-16: property-scoped Pulse — now renders the shared PulseShell.
// One source of truth for layout (app/revenue/_shared/PulseShell.tsx) — when
// the Donna PMS feed lands, the shell switches the empty-state branch to live
// data and BOTH routes benefit from a single change.

import PulseShell from '@/app/revenue/_shared/PulseShell';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DonnaRevenuePulsePage({
  params,
  searchParams,
}: {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  return <PulseShell propertyId={Number(params.property_id)} searchParams={searchParams ?? {}} />;
}
