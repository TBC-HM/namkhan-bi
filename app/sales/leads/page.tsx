// app/sales/leads/page.tsx — Leads cockpit v2 (PBS 2026-05-16)
//
// Live data-driven cockpit: sales.scraping_jobs (campaigns) + sales.icp_segments
// (ICPs) + sales.leads (funnel + cost trail). 2 tabs (Campaigns | ICP) + drawer
// on campaign click. Legacy outreach engine kept below for prospect workflow.

import Page from '@/components/page/Page';
import Panel from '@/components/page/Panel';
import { listProspects, getProspectKpis, listIcpSegments, listGuestCohortsWithCounts } from '@/lib/sales-leads';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PROPERTY_ID } from '@/lib/supabase';
import LeadsClient from './_components/LeadsClient';
import LeadsPipelineWorkspace from './_components/LeadsPipelineWorkspace';
import LeadsCockpitV2, {
  type CampaignRow, type IcpRow, type FunnelCount, type LeadDetailRow, type OverallKpis,
} from './_components/LeadsCockpitV2';
import { SALES_SUBPAGES } from '../_subpages';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Re-exported types consumed by LeadsPipelineWorkspace (kept for back-compat).
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
  status: string;
  notes: string | null;
  source: string | null;
  source_ref: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  // Phase 1 schema additions (sales.leads columns):
  deal_type: string | null;
  origin: string | null;
  account_id: number | null;
}

export interface ScrapingJob {
  id: number;
  property_id: number;
  query: string;
  target_category: string | null;
  status: string;
  lead_count: number;
  notes: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface PageProps {
  searchParams?: { tab?: string; drawer?: string; status?: string; q?: string };
}

async function getCockpitData(propertyId: number): Promise<{
  campaigns: CampaignRow[]; icps: IcpRow[]; funnelCounts: FunnelCount[]; kpis: OverallKpis;
}> {
  const sb = getSupabaseAdmin();

  // 1) Campaigns (scraping_jobs) joined to icp_segments
  const { data: rawCampaigns } = await sb.schema('sales').from('scraping_jobs')
    .select('id, query, target_category, status, lead_count, daily_target, icp_segment_id, scrape_tool, enrich_tool, verify_tool, send_tool, cost_per_lead_eur, monthly_budget_eur, spend_7d_eur, notes')
    .eq('property_id', propertyId)
    .order('id', { ascending: true });

  const { data: rawIcps } = await sb.schema('sales').from('icp_segments').select('id, key, name, description, daily_quota, active, criteria');
  const icpMap = new Map<string, { key: string; name: string }>();
  for (const r of (rawIcps ?? []) as any[]) icpMap.set(String(r.id), { key: String(r.key), name: String(r.name) });

  const campaigns: CampaignRow[] = ((rawCampaigns ?? []) as any[]).map((r) => ({
    id: Number(r.id),
    query: String(r.query ?? ''),
    target_category: r.target_category ?? null,
    status: String(r.status ?? 'draft'),
    lead_count: Number(r.lead_count ?? 0),
    daily_target: Number(r.daily_target ?? 0),
    icp_segment_id: r.icp_segment_id ?? null,
    icp_key: r.icp_segment_id ? icpMap.get(String(r.icp_segment_id))?.key ?? null : null,
    icp_name: r.icp_segment_id ? icpMap.get(String(r.icp_segment_id))?.name ?? null : null,
    scrape_tool: r.scrape_tool ?? null,
    enrich_tool: r.enrich_tool ?? null,
    verify_tool: r.verify_tool ?? null,
    send_tool: r.send_tool ?? null,
    cost_per_lead_eur: r.cost_per_lead_eur != null ? Number(r.cost_per_lead_eur) : null,
    monthly_budget_eur: r.monthly_budget_eur != null ? Number(r.monthly_budget_eur) : null,
    spend_7d_eur: r.spend_7d_eur != null ? Number(r.spend_7d_eur) : 0,
    notes: r.notes ?? null,
  }));

  // 2) Per-campaign, per-stage funnel counts
  const { data: rawFunnel } = await sb.schema('sales').from('leads')
    .select('campaign_id, status')
    .eq('property_id', propertyId);
  const funnelMap = new Map<string, number>();
  for (const r of (rawFunnel ?? []) as any[]) {
    if (r.campaign_id == null || !r.status) continue;
    const k = `${r.campaign_id}|${r.status}`;
    funnelMap.set(k, (funnelMap.get(k) ?? 0) + 1);
  }
  const funnelCounts: FunnelCount[] = Array.from(funnelMap.entries()).map(([k, n]) => {
    const [cid, stage] = k.split('|');
    return { campaign_id: Number(cid), stage, n };
  });

  // 3) ICP rows enriched with totals
  const icps: IcpRow[] = ((rawIcps ?? []) as any[]).map((r) => {
    const cnt = campaigns.filter((c) => c.icp_segment_id === r.id && c.status === 'running').length;
    const totalLeads = funnelCounts.filter((f) => {
      const cid = f.campaign_id;
      const cmp = campaigns.find((c) => c.id === cid);
      return cmp?.icp_segment_id === r.id;
    }).reduce((s, f) => s + f.n, 0);
    return {
      id: String(r.id),
      key: String(r.key ?? ''),
      name: String(r.name ?? ''),
      description: String(r.description ?? ''),
      daily_quota: Number(r.daily_quota ?? 0),
      active: Boolean(r.active),
      criteria: r.criteria ?? {},
      total_leads: totalLeads,
      active_campaigns: cnt,
    };
  });

  // 4) Overall KPIs from sales.leads
  const { data: aggRows } = await sb.schema('sales').from('leads')
    .select('total_cost_eur, status, converted_value_eur, replied_at, next_touch_at, sent_at')
    .eq('property_id', propertyId);
  const agg = (aggRows ?? []) as any[];
  const totalLeads = agg.length;
  const totalSpend = agg.reduce((s, l) => s + Number(l.total_cost_eur ?? 0), 0);
  const converted = agg.filter((l) => l.status === 'converted').length;
  const convertedValue = agg.reduce((s, l) => s + Number(l.converted_value_eur ?? 0), 0);
  const sent = agg.filter((l) => l.sent_at != null).length;
  const replied = agg.filter((l) => l.replied_at != null).length;
  const inNurture = agg.filter((l) => l.next_touch_at != null).length;

  const kpis: OverallKpis = {
    total_campaigns: campaigns.length,
    running_campaigns: campaigns.filter((c) => c.status === 'running').length,
    total_leads: totalLeads,
    total_spend_eur: totalSpend,
    converted,
    converted_value_eur: convertedValue,
    cpl_eur: totalLeads > 0 ? totalSpend / totalLeads : 0,
    reply_rate_pct: sent > 0 ? (replied / sent) * 100 : 0,
    in_nurture: inNurture,
  };

  return { campaigns, icps, funnelCounts, kpis };
}

async function getDrawerLeads(propertyId: number, campaignId: number): Promise<LeadDetailRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('leads')
    .select('id, company_name, decision_maker_name, email, country, status, icp_score, total_cost_eur, sent_at, opened_at, replied_at, reply_sentiment, converted_value_eur')
    .eq('property_id', propertyId).eq('campaign_id', campaignId)
    .order('icp_score', { ascending: false, nullsFirst: false })
    .limit(50);
  return ((data ?? []) as any[]).map((r) => ({
    id: Number(r.id),
    company_name: String(r.company_name ?? ''),
    decision_maker_name: r.decision_maker_name ?? null,
    email: r.email ?? null,
    country: r.country ?? null,
    status: String(r.status ?? ''),
    icp_score: r.icp_score != null ? Number(r.icp_score) : null,
    total_cost_eur: r.total_cost_eur != null ? Number(r.total_cost_eur) : null,
    sent_at: r.sent_at ?? null,
    opened_at: r.opened_at ?? null,
    replied_at: r.replied_at ?? null,
    reply_sentiment: r.reply_sentiment ?? null,
    converted_value_eur: r.converted_value_eur != null ? Number(r.converted_value_eur) : null,
  }));
}

async function listLeadsForWorkspace(limit = 500) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('leads').select('*')
    .eq('property_id', PROPERTY_ID).order('imported_at', { ascending: false }).limit(limit);
  return (data ?? []) as any[];
}

async function listScrapingJobsForWorkspace(limit = 20) {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('scraping_jobs').select('*')
    .eq('property_id', PROPERTY_ID).order('created_at', { ascending: false }).limit(limit);
  return (data ?? []) as any[];
}

async function listRecentOutreachDrafts() {
  const sb = getSupabaseAdmin();
  const { data } = await sb.schema('sales').from('email_drafts').select('*')
    .eq('property_id', PROPERTY_ID).order('created_at', { ascending: false }).limit(10);
  return (data ?? []) as any[];
}

export default async function LeadsPage({ searchParams }: PageProps) {
  const tab = (searchParams?.tab === 'icp' ? 'icp' : 'campaigns') as 'campaigns' | 'icp';
  const drawerCampaignId = searchParams?.drawer ? Number(searchParams.drawer) : null;

  const [cockpit, drawerLeads, leads, scrapingJobs, prospects, kpis, icp, cohorts, recentDrafts] = await Promise.all([
    getCockpitData(PROPERTY_ID),
    drawerCampaignId ? getDrawerLeads(PROPERTY_ID, drawerCampaignId) : Promise.resolve([] as LeadDetailRow[]),
    listLeadsForWorkspace(500),
    listScrapingJobsForWorkspace(20),
    listProspects({ status: searchParams?.status as never, q: searchParams?.q, limit: 200 }),
    getProspectKpis(),
    listIcpSegments(),
    listGuestCohortsWithCounts(),
    listRecentOutreachDrafts(),
  ]);

  return (
    <Page
      eyebrow="Sales · Leads & Pipeline"
      title={<>AI Lead-Gen <em style={{ color: 'var(--brass)', fontStyle: 'italic' }}>cockpit</em></>}
      subPages={SALES_SUBPAGES}
    >
      <LeadsCockpitV2
        tab={tab}
        drawerCampaignId={drawerCampaignId}
        campaigns={cockpit.campaigns}
        icps={cockpit.icps}
        funnelCounts={cockpit.funnelCounts}
        drawerLeads={drawerLeads}
        kpis={cockpit.kpis}
      />

      <div style={{ height: 18 }} />

      <Panel title="Operational pipeline · raw leads + kanban + CSV upload" eyebrow="sales.leads · sales.scraping_jobs">
        <LeadsPipelineWorkspace leads={leads as any} scrapingJobs={scrapingJobs as any} />
      </Panel>

      <div style={{ height: 18 }} />

      <Panel title="Outreach engine · prospects + guest cohorts" eyebrow="legacy — distinct from sales.leads">
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
