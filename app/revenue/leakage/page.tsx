// app/revenue/leakage/page.tsx
// Canonical leakage page (Namkhan default property).
// PBS 2026-05-26 (#248 + #252): BedbankKpiStrip + LeakageAdrMatrix mounted via kpiStrip slot.

import PageRenderer from '@/app/_components/registry/PageRenderer';
import BedbankKpiStrip from '@/app/_components/registry/BedbankKpiStrip';
import LeakageAdrMatrix from '@/app/_components/registry/LeakageAdrMatrix';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function LeakagePage({ searchParams }: Props) {
  const propertyId = 260955;
  return (
    <PageRenderer
      pageSlug="leakage"
      propertyId={propertyId}
      searchParams={searchParams}
      title="Revenue · Leakage"
      subtitle="rate leakage · source transparency"
      layout="graphs-first"
      kpiStrip={
        <>
          <BedbankKpiStrip propertyId={propertyId} />
          <LeakageAdrMatrix propertyId={propertyId} searchParams={searchParams} />
        </>
      }
    />
  );
}
