// app/guest/journey/page.tsx
// PBS 2026-07-07 v3 — Registry-driven rewrite (task #86).
// Journey funnel (pre-stay · in-stay · post-stay) now sourced entirely from
// public.v_container_registry rows for page_slug='journey'. Hand-built KpiTile
// blocks + 11 inline queries removed. PageRenderer runs in embedded mode so we
// keep GUEST_SUBPAGES tabs (the registry engine defaults to REVENUE_SUBPAGES).
//
// Container set (kpi.container_registry · page_slug='journey'):
//   10 · funnel_kpis           table       v_journey_funnel_kpis           both
//   20 · today_pulse           table       v_front_desk_pulse_today        both
//   30 · lead_time_buckets     table       v_journey_lead_time_buckets     both
//   40 · arrivals_next_14d     table       v_journey_arrivals_upcoming     both
//   50 · inhouse_now           table       v_journey_inhouse               both
//   60 · recent_departures     table       v_journey_recent_departures     both
//   70 · prestay_contactability table      v_journey_prestay_contactability namkhan
//   80 · instay_engagement     table       v_journey_instay_engagement     namkhan
//   90 · repeat_monthly        month_table v_journey_repeat_monthly        namkhan
//  100 · repeat_trend          chart       v_journey_repeat_monthly        namkhan
//  110 · event_stage_counts    table       v_journey_event_stage_counts    namkhan (active=false — Mews/CB journey_events pipeline empty)

import { DashboardPage, type DashboardTab } from '@/app/(cockpit)/_design';
import { GUEST_SUBPAGES } from '../_subpages';
import { rewriteSubPagesForProperty } from '@/lib/dept-cfg/rewrite-subpages';
import PageRenderer from '@/app/_components/registry/PageRenderer';
import { PROPERTY_ID } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
  searchParams?: Record<string, string | string[] | undefined>;
  propertyId?: number;
}

export default function GuestJourneyPage({ searchParams, propertyId }: Props = {}) {
  const pid = propertyId ?? PROPERTY_ID;
  const subPages = rewriteSubPagesForProperty(GUEST_SUBPAGES, pid);
  const tabs: DashboardTab[] = subPages.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href.endsWith('/guest/journey'),
  }));

  return (
    <DashboardPage
      title="Contacts · Journey"
      subtitle="pre-stay · in-stay · post-stay funnel · registry-driven"
      tabs={tabs}
    >
      {/* PageRenderer in embedded mode: renders the container/graph body only,
          skipping its own DashboardPage + REVENUE_SUBPAGES tab strip. */}
      <PageRenderer
        pageSlug="journey"
        propertyId={pid}
        searchParams={searchParams}
        embedded
        layout="flat"
      />
    </DashboardPage>
  );
}
