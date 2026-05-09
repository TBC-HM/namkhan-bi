// /sales/leads — outreach hub.
// Three blocks:
//   1. Guest cohorts (warm) — clickable cards with member count → "Compose for cohort"
//   2. Prospects (cold) — table + manual add + CSV import + "Draft outreach" per row
//   3. Recent outreach drafts — last 20 from sales.email_drafts (intent='outreach')

import Page from '@/components/page/Page';
import { listProspects, getProspectKpis, listIcpSegments, listGuestCohortsWithCounts } from '@/lib/sales-leads';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import LeadsClient from './_components/LeadsClient';
import { SALES_SUBPAGES } from '../_subpages';

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
    <Page
      eyebrow="Sales · Leads"
      title={<>Lead engine · cold <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>and</em> warm</>}
      subPages={SALES_SUBPAGES}
    >
      <LeadsClient
        prospects={prospects}
        kpis={kpis}
        icp={icp}
        cohorts={cohorts}
        recentDrafts={recentDrafts}
        currentStatus={searchParams?.status ?? 'all'}
        currentQuery={searchParams?.q ?? ''}
      />
    </Page>
  );
}
