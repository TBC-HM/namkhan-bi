// app/h/[property_id]/revenue/leakage/page.tsx
// Registry-driven leakage page. Adding/removing containers = DB-only.
// PBS 2026-05-26 (#248 + #252 + #253): BedbankKpiStrip + RateDisciplineTrio + LeakageAdrMatrix via kpiStrip slot.

import { notFound } from 'next/navigation';
import PageRenderer from '@/app/_components/registry/PageRenderer';
import BedbankKpiStrip from '@/app/_components/registry/BedbankKpiStrip';
import LeakageAdrMatrix from '@/app/_components/registry/LeakageAdrMatrix';
import RateDisciplineTrio from '@/app/_components/registry/RateDisciplineTrio';

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
          <BedbankKpiStrip propertyId={propertyId} />
          <RateDisciplineTrio propertyId={propertyId} searchParams={searchParams} />
          <LeakageAdrMatrix propertyId={propertyId} searchParams={searchParams} />
        </>
      }
    />
  );
}
