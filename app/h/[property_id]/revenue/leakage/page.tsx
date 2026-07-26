// app/h/[property_id]/revenue/leakage/page.tsx
// Registry-driven leakage page. Adding/removing containers = DB-only.
// PBS 2026-05-27 (#258): YtdTiles + MonthStrip + TrendSlim + BedbankKpiStrip + RateDiscipline + AdrMatrix via kpiStrip slot.
// PBS 2026-07-26 (goal 41, ADR-172): + OTA / DMC / Direct ChannelKpiStrip rows under Bedbank.

import { notFound } from 'next/navigation';
import PageRenderer from '@/app/_components/registry/PageRenderer';
import LeakageYtdTiles from '@/app/_components/registry/LeakageYtdTiles';
import LeakageMonthStrip from '@/app/_components/registry/LeakageMonthStrip';
import LeakageTrendSlim from '@/app/_components/registry/LeakageTrendSlim';
import BedbankKpiStrip from '@/app/_components/registry/BedbankKpiStrip';
import ChannelKpiStrip from '@/app/_components/registry/ChannelKpiStrip';
import LeakageAdrMatrix from '@/app/_components/registry/LeakageAdrMatrix';
import RateDisciplineTrio from '@/app/_components/registry/RateDisciplineTrio';
import SourceAdrHonestyTile from '@/app/_components/registry/SourceAdrHonestyTile';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  params: { property_id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function LeakagePage({ params, searchParams }: Props) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();
  return (
    <PageRenderer
      pageSlug="leakage"
      propertyId={propertyId}
      searchParams={searchParams}
      title="Revenue · Leakage"
      subtitle="rate leakage · source transparency · driven by v_container_registry + v_graph_registry"
      layout="graphs-first"
      kpiStrip={
        <>
          <LeakageYtdTiles propertyId={propertyId} />
          <LeakageMonthStrip propertyId={propertyId} />
          <LeakageTrendSlim propertyId={propertyId} />
          <BedbankKpiStrip propertyId={propertyId} />
          <ChannelKpiStrip propertyId={propertyId} label="OTA KPIs · YTD" view="v_ota_kpis_totals" />
          <ChannelKpiStrip propertyId={propertyId} label="DMC KPIs · YTD" view="v_dmc_kpis_totals" />
          <ChannelKpiStrip propertyId={propertyId} label="Direct KPIs · YTD" view="v_direct_kpis_totals" />
          <SourceAdrHonestyTile propertyId={propertyId} searchParams={searchParams} />
          <RateDisciplineTrio propertyId={propertyId} searchParams={searchParams} />
          <LeakageAdrMatrix propertyId={propertyId} searchParams={searchParams} />
        </>
      }
    />
  );
}
