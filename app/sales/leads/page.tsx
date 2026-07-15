// app/sales/leads/page.tsx
// PBS 2026-07-14 (Sales CRM upgrade) — replaces the 2026-07-11 redirect stub.
// This is now the Lead CMS: browse, filter, view profile, edit, advance stage,
// and create new. Highlight query param opens a specific lead drawer (used by
// the /sales/mails "Convert to Lead" flow that redirects with ?highlight=<id>).
//
// PBS 2026-07-15: also loads proposal templates + per-lead proposal counts so the
// "Create proposal" flow (template picker modal) and the "→ Proposals" quick link
// on lead rows can render without an extra client fetch.
//
// Server component: fetches leads list + stages, mounts the client cockpit.
// Bridge views:
//   public.v_leads_full              — leads
//   public.v_pipeline_stages         — pipeline stages
//   public.v_sales_proposal_templates — active proposal templates for the property
//   public.v_lead_proposal_counts    — how many proposals each lead has

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import LeadsCMSClient, {
  type LeadRow, type StageRow, type ProposalTemplateRow, type LeadProposalCountRow,
} from './_components/LeadsCMSClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN = 260955;

interface PageProps {
  propertyId?: number;
  searchParams?: { highlight?: string; stage?: string };
}

async function loadData(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [leadsRes, stagesRes, tplRes, propCountsRes] = await Promise.all([
    sb.from('v_leads_full')
      .select('*')
      .eq('property_id', propertyId)
      .neq('status', 'deleted')
      .order('stage_changed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500),
    sb.from('v_pipeline_stages')
      .select('*')
      .order('stage_order', { ascending: true }),
    sb.from('v_sales_proposal_templates')
      .select('id, property_id, kind, name, slug, brand_voice_lang, is_active')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('kind', { ascending: true }),
    sb.from('v_lead_proposal_counts')
      .select('lead_id, proposal_count'),
  ]);
  return {
    leads: (leadsRes.data ?? []) as LeadRow[],
    stages: (stagesRes.data ?? []) as StageRow[],
    templates: (tplRes.data ?? []) as ProposalTemplateRow[],
    proposalCounts: (propCountsRes.data ?? []) as LeadProposalCountRow[],
  };
}

export default async function SalesLeadsPage({ propertyId, searchParams }: PageProps = {}) {
  const pid = propertyId ?? NAMKHAN;
  const { leads, stages, templates, proposalCounts } = await loadData(pid);
  const tabs = SALES_SUBPAGES.map((s) => ({
    key: s.href, label: s.label, href: s.href, active: s.href === '/sales/leads',
  }));
  const highlightId = searchParams?.highlight ? parseInt(searchParams.highlight, 10) : null;
  return (
    <DashboardPage
      title="Leads · CRM"
      subtitle="Manage every lead and pipeline stage in one place."
      tabs={tabs}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <LeadsCMSClient
          initialLeads={leads}
          stages={stages}
          propertyId={pid}
          highlightId={Number.isFinite(highlightId) ? highlightId : null}
          templates={templates}
          proposalCounts={proposalCounts}
        />
      </div>
    </DashboardPage>
  );
}
