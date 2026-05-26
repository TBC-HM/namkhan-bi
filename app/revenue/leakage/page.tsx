// app/revenue/leakage/page.tsx
// Canonical leakage page (Namkhan default property).
// PBS 2026-05-27 (#258): YtdTiles + MonthStrip + TrendSlim + BedbankKpiStrip + RateDiscipline + AdrMatrix via kpiStrip slot.

import PageRenderer from '@/app/_components/registry/PageRenderer';
import LeakageYtdTiles from '@/app/_components/registry/LeakageYtdTiles';
import LeakageMonthStrip from '@/app/_components/registry/LeakageMonthStrip';
import LeakageTrendSlim from '@/app/_components/registry/LeakageTrendSlim';
import BedbankKpiStrip from '@/app/_components/registry/BedbankKpiStrip';
import LeakageAdrMatrix from '@/app/_components/registry/LeakageAdrMatrix';
import RateDisciplineTrio from '@/app/_components/registry/RateDisciplineTrio';

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
          <LeakageYtdTiles propertyId={propertyId} />
          <LeakageMonthStrip propertyId={propertyId} />
          <LeakageTrendSlim propertyId={propertyId} />
          <BedbankKpiStrip propertyId={propertyId} />
          <RateDisciplineTrio propertyId={propertyId} searchParams={searchParams} />
          <LeakageAdrMatrix propertyId={propertyId} searchParams={searchParams} />
        </>
      }
    />
  );
}
