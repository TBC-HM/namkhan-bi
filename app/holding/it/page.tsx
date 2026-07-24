// app/holding/it/page.tsx
// PBS 2026-07-24: module docs panel — try/catch so page never 500.

import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import ModuleDocsPanel, { type ModuleDocRow, type ModuleStatusRow } from '@/app/_components/ModuleDocsPanel';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { supabase } from '@/lib/supabase';
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

  let docs: ModuleDocRow[] = [];
  let statuses: ModuleStatusRow[] = [];
  let fetchError: string | null = null;

  try {
    const [docsRes, statusRes] = await Promise.all([
      supabase
        .from('v_documents_latest')
        .select('doc_type, title, version, status, last_updated_at, md_length')
        .in('doc_type', MODULE_DOC_TYPES)
        .order('doc_type'),
      supabase
        .from('v_module_status' as any)
        .select('doc_type, goal_precise, completion_pct, is_live, claude_integrated, signed_off_at, signed_off_by')
        .in('doc_type', MODULE_DOC_TYPES),
    ]);
    docs = (docsRes.data ?? []) as ModuleDocRow[];
    statuses = ((statusRes.data ?? []) as unknown[]) as ModuleStatusRow[];
  } catch (e: unknown) {
    fetchError = e instanceof Error ? e.message : 'Unknown error';
  }

  const moduleDocsBlock = (
    <Container
      title="Module Documentation"
      subtitle={`${docs.length} modules · Live · Goal · Sign-off`}
      density="compact"
    >
      {fetchError ? (
        <div style={{ fontSize: 11, color: '#B8542A', padding: '8px 0' }}>
          Load error: {fetchError} — refresh to retry
        </div>
      ) : (
        <ModuleDocsPanel docs={docs} statuses={statuses} />
      )}
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
