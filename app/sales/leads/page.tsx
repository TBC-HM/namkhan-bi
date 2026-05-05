// /sales/leads — outreach hub.
// Three blocks:
//   1. Guest cohorts (warm) — clickable cards with member count → "Compose for cohort"
//   2. Prospects (cold) — table + manual add + CSV import + "Draft outreach" per row
//   3. Recent outreach drafts — last 20 from sales.email_drafts (intent='outreach')

import PageHeader from '@/components/layout/PageHeader';
import { listProspects, getProspectKpis, listIcpSegments, listGuestCohortsWithCounts } from '@/lib/sales-leads';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import LeadsClient from './_components/LeadsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function listRecentOutreachDrafts() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_drafts')
    .select('id,subject,body_md,status,generator,prospect_id,cohort_id,created_at,intent')
    .eq('property_id', PROPERTY_ID).eq('intent', 'outreach')
    .neq('status', 'discarded').order('created_at', { ascending: false }).limit(20);
  return data ?? [];
}

export default async function LeadsPage({ searchParams }: { searchParams?: { status?: string; q?: string } }) {
  const [prospects, kpis, icp, cohorts, recentDrafts] = await Promise.all([
    listProspects({ status: searchParams?.status as never, q: searchParams?.q, limit: 200 }),
    getProspectKpis(),
    listIcpSegments(),
    listGuestCohortsWithCounts(),
    listRecentOutreachDrafts(),
  ]);

  return (
    <>
      <PageHeader
        pillar="Sales"
        tab="Leads"
        title={<>Lead engine · cold <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>and</em> warm</>}
        lede="Cold prospects (B2B partners, retreat organisers, DMCs) and warm cohorts (past guests). One composer feeds both."
      />

      <LeadsClient
        prospects={prospects}
        kpis={kpis}
        icp={icp}
        cohorts={cohorts}
        recentDrafts={recentDrafts}
        currentStatus={searchParams?.status ?? 'all'}
        currentQuery={searchParams?.q ?? ''}
      />
    </>
  );
}
