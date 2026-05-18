// app/revenue/_shared/PulseShell.tsx
// PBS 2026-05-18: single source of truth. The rebuilt Namkhan body
// (= app/revenue/pulse/page.tsx) now accepts propertyId and renders the
// same JSX layout for both properties. No more Donna branch — DonnaPulseBody
// is deleted. Data flows through public.mv_kpi_daily which UNIONs both
// Cloudbeds + Mews per Phase A3.

import NamkhanPulseBody from '../pulse/page';

export interface PulseShellProps {
  propertyId: number;
  searchParams: Record<string, string | string[] | undefined>;
}

export default function PulseShell({ propertyId, searchParams }: PulseShellProps) {
  return (
    <NamkhanPulseBody
      searchParams={searchParams as any}
      propertyId={propertyId}
    />
  );
}
