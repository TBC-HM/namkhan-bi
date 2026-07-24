// app/holding/it/page.tsx
// PBS 2026-07-24: module status via public.v_module_status bridge view.

import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import ModuleDocsPanel, { type ModuleDocRow, type ModuleStatusRow } from '@/app/_components/ModuleDocsPanel';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;
const MODULE_DOC_TYPES = [
  'bug_agent_module', 'compiler_module', 'gbp_module', 'inventory_module',
  'media_module', 'newsletter_module', 'proposals_module', 'sales_module',
  'socials_module', 'spec_builder_module', 'university_module', 'youtube_module',
];

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_it;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Infra / platform risk — Kit to unblock.' : 'Opportunity.',
  }));
}

export default async function HoldingItPage() {
  const cfg = DEPT_CFG.holding_it;
  const insights = insightsFromCfg();
  const liveTiles = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm' as const, footnote: k.d,
  }));

  // v_documents_latest is a public bridge view — safe for public supabase client
  const { data: docsData } = await supabase
    .from('v_documents_latest')
    .select('doc_type, title, version, status, last_updated_at, md_length')
    .in('doc_type', MODULE_DOC_TYPES)
    .order('doc_type');

  // v_module_status is also public but new — cast to any to avoid stale generated types
  const sb = getSupabaseAdmin();
  const { data: statusData } = await (sb as any)
    .from('v_module_status')
    .select('doc_type, goal_precise, completion_pct, is_live, claude_integrated, signed_off_at, signed_off_by')
    .in('doc_type', MODULE_DOC_TYPES);

  const docs = (docsData ?? []) as ModuleDocRow[];
  const statuses = ((statusData ?? []) as unknown[]) as ModuleStatusRow[];

  const moduleDocsBlock = (
    <Container
      title="Module Documentation"
      subtitle={`${docs.length} modules · Live · Goal · Sign-off status per card`}
      density="compact"
    >
      <ModuleDocsPanel docs={docs} statuses={statuses} />
    </Container>
  );

  return (
    <HodLanding
      slug="holding_it"
      propertyId={HOLDING_PID}
      liveTiles={liveTiles}
      settingsHref="/holding/settings"
      secondRow={moduleDocsBlock}
      conclusions={{
        insights,
        title: 'CONCLUSIONS · platform · agent fleet · deploys',
        subtitle: 'IT scope · infrastructure, deploys, autonomous PRs',
        emptyText: 'Nothing waiting for IT.',
      }}
    />
  );
}
