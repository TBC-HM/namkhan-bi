// app/h/[property_id]/it/cockpit/page.tsx
// Prompt 6 — cockpit-v2 rework. Property-aware cockpit at
// /h/[property_id]/it/cockpit replacing the legacy /cockpit-v2.
//
// Tabs: Team / Skills / Activity / Costs / Schemas / Knowledge.
// Team is fully wired here. Skills tab is rendered by SkillsTab (Prompt 7).
// Activity + Costs tabs are wired here. Schemas + Knowledge are placeholders.

import { createClient } from '@/lib/supabase/server';
import Page from '@/components/page/Page';
import CockpitV3Client from '@/components/cockpit/CockpitV3Client';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const NAMKHAN_PROPERTY_ID = 260955;
const DONNA_PROPERTY_ID = 1000001;

export default async function PropertyCockpitPage({
  params,
}: {
  params: { property_id: string };
}) {
  const propertyId = Number(params.property_id);
  if (!Number.isFinite(propertyId)) notFound();

  const scope =
    propertyId === NAMKHAN_PROPERTY_ID
      ? 'namkhan'
      : propertyId === DONNA_PROPERTY_ID
        ? 'donna'
        : 'all';

  const supabase = createClient();

  const [{ data: roster }, { data: runs }] = await Promise.all([
    supabase.rpc('cockpit_agent_roster', { p_scope: scope }),
    supabase
      .schema('governance')
      .from('agent_runs')
      .select('run_id, agent_id, started_at, finished_at, status, duration_ms, cost_usd, property_id')
      .or(`property_id.eq.${propertyId},property_id.is.null`)
      .order('started_at', { ascending: false })
      .limit(100),
  ]);

  return (
    <Page
      eyebrow="IT · Cockpit"
      title={
        <>
          {scope === 'namkhan' ? 'Namkhan' : scope === 'donna' ? 'Donna' : 'Holding'}{' '}
          <em style={{ color: 'var(--accent, #a8854a)' }}>cockpit</em>
        </>
      }
    >
      <CockpitV3Client
        propertyId={propertyId}
        scope={scope}
        roster={(roster ?? []) as any[]}
        runs={(runs ?? []) as any[]}
      />
    </Page>
  );
}
