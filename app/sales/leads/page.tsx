// app/sales/leads/page.tsx
// PBS 2026-07-11 pm — Sales CRM UI (ADR-147). Namkhan Leads cockpit.
// Reads public.v_leads + v_pipeline_stages + v_sales_inbound_b2b for property 260955.
// Interactive parts live in <LeadsCockpit/> client component.

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import LeadsCockpit, { type LeadRow, type StageRow, type InboundRow } from './_components/LeadsCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

async function loadData() {
  const sb = getSupabaseAdmin();
  const [leads, stages, inbound] = await Promise.all([
    sb.from('v_leads')
      .select('id,property_id,company_name,type,country,city,decision_maker_name,decision_maker_role,email,icp_score,intent_score,final_priority,status,stage,origin,account_id,prospect_id,icp_segment_id,created_at,updated_at')
      .eq('property_id', NAMKHAN)
      .order('updated_at', { ascending: false })
      .limit(500),
    sb.from('v_pipeline_stages').select('stage_key,stage_order,display_name,is_won,is_lost').order('stage_order'),
    sb.from('v_sales_inbound_b2b')
      .select('id,property_id,company,contact,email,phone,country,source,created_at')
      .eq('property_id', NAMKHAN)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  return {
    leads:   (leads.data   ?? []) as LeadRow[],
    stages:  (stages.data  ?? []) as StageRow[],
    inbound: (inbound.data ?? []) as InboundRow[],
  };
}

export default async function LeadsPage() {
  const { leads, stages, inbound } = await loadData();
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));
  return (
    <DashboardPage
      title="Leads"
      subtitle="Sales pipeline · outbound + inbound · convert at Negotiation"
      tabs={tabs}
      currentTab="/sales/leads"
    >
      <LeadsCockpit leads={leads} stages={stages} inbound={inbound} propertyId={NAMKHAN} />
    </DashboardPage>
  );
}
