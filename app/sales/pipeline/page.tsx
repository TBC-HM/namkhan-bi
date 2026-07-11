// app/sales/pipeline/page.tsx
// PBS 2026-07-11 pm (dir 1) — Sales · Pipeline. Slim cockpit: KPIs + filter chips
// + list/board toggle + stage dropdown per row + Advance/Convert actions. Inbound
// queue moved to /sales/new (separation of "create/promote" vs "manage").

import { DashboardPage } from '@/app/(cockpit)/_design';
import { SALES_SUBPAGES } from '../_subpages';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import PipelineCockpit, { type LeadRow, type StageRow } from './_components/PipelineCockpit';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const NAMKHAN = 260955;

async function loadData() {
  const sb = getSupabaseAdmin();
  const [leads, stages] = await Promise.all([
    sb.from('v_leads')
      .select('id,property_id,company_name,type,country,city,decision_maker_name,decision_maker_role,email,icp_score,intent_score,final_priority,status,stage,origin,account_id,prospect_id,icp_segment_id,created_at,updated_at')
      .eq('property_id', NAMKHAN)
      .order('updated_at', { ascending: false })
      .limit(500),
    sb.from('v_pipeline_stages')
      .select('stage_key,stage_order,display_name,is_won,is_lost')
      .order('stage_order'),
  ]);
  return {
    leads:  (leads.data  ?? []) as LeadRow[],
    stages: (stages.data ?? []) as StageRow[],
  };
}

export default async function PipelinePage() {
  const { leads, stages } = await loadData();
  const tabs = SALES_SUBPAGES.map((s) => ({ label: s.label, href: s.href }));
  return (
    <DashboardPage
      title="Pipeline"
      subtitle="Sales pipeline · outbound + promoted-inbound · convert at Negotiation"
      tabs={tabs}
      currentTab="/sales/pipeline"
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <PipelineCockpit leads={leads} stages={stages} propertyId={NAMKHAN} />
      </div>
    </DashboardPage>
  );
}
