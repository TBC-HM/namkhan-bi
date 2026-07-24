// app/holding/it/page.tsx
// PBS 2026-07-09 pm: Holding · IT — Kit's HoD landing on HodLanding v2.
// PBS 2026-07-23: added Module Documentation panel.
// PBS 2026-07-24: all 12 module doc types wired.

import HodLanding from '@/app/_components/HodLanding';
import { Container } from '@/app/(cockpit)/_design';
import ModuleDocsPanel, { type ModuleDocRow } from '@/app/_components/ModuleDocsPanel';
import { DEPT_CFG } from '@/lib/dept-cfg';
import { supabase } from '@/lib/supabase';
import type { Insight } from '@/app/_components/ConclusionBlock';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const HOLDING_PID = 0;
const MODULE_DOC_TYPES = [
  'bug_agent_module',
  'compiler_module',
  'gbp_module',
  'inventory_module',
  'media_module',
  'newsletter_module',
  'proposals_module',
  'sales_module',
  'socials_module',
  'spec_builder_module',
  'university_module',
  'youtube_module',
];

function insightsFromCfg(): Insight[] {
  const cfg = DEPT_CFG.holding_it;
  const attn = cfg.defaultAttn ?? [];
  return attn.map((a) => ({
    key: a.id,
    priority: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    title: a.label,
    body: a.kind === 'leakage' ? 'Infra / platform risk — Kit to unblock.' : 'Opportunity — ship autonomous fleet output.',
  }));
}

export default async function HoldingItPage() {
  const cfg = DEPT_CFG.holding_it;
  const insights = insightsFromCfg();
  const liveTiles = (cfg.kpiTiles ?? []).map((k) => ({
    label: k.k, value: k.v, size: 'sm' as const, footnote: k.d,
  }));

  const { data: docsData } = await supabase
    .from("v_documents_latest")
    .select("doc_type, title, version, status, last_updated_at, md_length")
    .in("doc_type", MODULE_DOC_TYPES)
    .order("doc_type");

  const docs = (docsData ?? []) as ModuleDocRow[];

  const moduleDocsBlock = (
    <Container
      title="Module Documentation"
      subtitle={`${docs.length} module${docs.length === 1 ? '' : 's'} · latest version only · Preview to open`}
      density="compact"
    >
      <ModuleDocsPanel docs={docs} />
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
