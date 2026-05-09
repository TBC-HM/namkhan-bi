// /sales/leads — UNIFIED Leads + Pipeline workspace.
//
// PBS 2026-05-09: "SHOULD LEADS AND PIPELINE BE BETTER ON ONE PAGE? IF SO
// PLEASE MAKE A SENSEFUL REDESIGN" — yes. cold prospect → outreach → quote →
// booking is one funnel, not two pages. /sales/pipeline already redirects
// here.
//
// Page anatomy (top-to-bottom):
//   1. KPI strip (raw / qualified / in-pipeline / won-30d / lost-30d)
//   2. CSV upload zone (drag-drop or click) → /api/sales/leads/upload
//   3. Two-column body:
//      ├─ left:  leads queue (sales.leads, sortable list, status flips)
//      └─ right: pipeline kanban (qualified → contacted → pipeline → won/lost)
//   4. Scraping queue panel (sales.scraping_jobs + Run scrape CTA)
//   5. Existing prospects + cohorts pane (legacy outreach engine)

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { listProspects, getProspectKpis, listIcpSegments, listGuestCohortsWithCounts } from '@/lib/sales-leads';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import LeadsClient from './_components/LeadsClient';
import LeadsPipelineWorkspace from './_components/LeadsPipelineWorkspace';
import { SALES_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface LeadRow {
  id: number;
  lead_id: string | null;
  company_name: string;
  category: string | null;
  subcategory: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  website: string | null;
  instagram_url: string | null;
  decision_maker_name: string | null;
  decision_maker_role: string | null;
  email: string | null;
  phone_whatsapp: string | null;
  retreat_history: string | null;
  upcoming_retreat_signal: string | null;
  audience_size_proxy: string | null;
  price_level: string | null;
  icp_score: number | null;
  intent_score: number | null;
  final_priority: string | null;
  status: 'raw' | 'qualified' | 'contacted' | 'pipeline' | 'won' | 'lost' | 'dropped';
  notes: string | null;
  source: 'csv' | 'scrape' | 'manual';
  imported_at: string;
  created_at: string;
  updated_at: string | null;
}

export interface ScrapingJob {
  id: number;
  query: string;
  target_category: string | null;
  status: 'queued' | 'running' | 'done' | 'failed';
  lead_count: number;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface DraftRow {
  id: string; subject: string | null; body_md: string | null; status: string;
  generator: string; prospect_id: string | null; cohort_id: string | null;
  created_at: string; intent: string;
}

async function listRecentOutreachDrafts(): Promise<DraftRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_drafts')
    .select('id,subject,body_md,status,generator,prospect_id,cohort_id,created_at,intent')
    .eq('property_id', PROPERTY_ID).eq('intent', 'outreach')
    .neq('status', 'discarded').order('created_at', { ascending: false }).limit(20);
  return (data ?? []) as DraftRow[];
}

async function listLeads(limit = 500): Promise<LeadRow[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('leads')
    .select('*').eq('property_id', PROPERTY_ID)
    .order('imported_at', { ascending: false }).limit(limit);
  if (error) { console.error('[listLeads]', error.message); return []; }
  return (data ?? []) as LeadRow[];
}

async function listScrapingJobs(limit = 20): Promise<ScrapingJob[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('sales').from('scraping_jobs')
    .select('*').eq('property_id', PROPERTY_ID)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[listScrapingJobs]', error.message); return []; }
  return (data ?? []) as ScrapingJob[];
}

export default async function LeadsPage({ searchParams }: { searchParams?: { status?: string; q?: string } }) {
  const [leads, scrapingJobs, prospects, kpis, icp, cohorts, recentDrafts] = await Promise.all([
    listLeads(500),
    listScrapingJobs(20),
    listProspects({ status: searchParams?.status as never, q: searchParams?.q, limit: 200 }),
    getProspectKpis(),
    listIcpSegments(),
    listGuestCohortsWithCounts(),
    listRecentOutreachDrafts(),
  ]);

  return (
    <Page
      eyebrow="Sales · Leads & Pipeline"
      title={<>Lead engine · <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>raw</em> to <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>won</em></>}
      subPages={SALES_SUBPAGES}
    >
      {/* PRIMARY: leads + pipeline workspace */}
      <LeadsPipelineWorkspace leads={leads} scrapingJobs={scrapingJobs} />

      <div style={{ height: 18 }} />

      {/* SECONDARY: legacy outreach engine (prospects + cohorts + drafts) */}
      <Panel
        title="Outreach engine · prospects + guest cohorts"
        eyebrow="legacy — distinct from sales.leads"
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
      </Panel>
    </Page>
  );
}
