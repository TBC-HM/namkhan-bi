// app/holding/it/cockpit/page.tsx
//
// PBS 2026-07-23 (5th pass — canonical): rewritten to use DashboardPage +
// canonical KpiTile + Container primitives. Matches /holding/it aesthetic
// (Image #5 reference).

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DashboardPage, Container, KpiTile, type KpiTileProps } from '@/app/(cockpit)/_design';
import { groupsAsTabs } from './_lib/groups';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchHomeData() {
  const sb = getSupabaseAdmin();
  const sbCockpit = sb.schema('cockpit');

  const [
    { count: activeAgents },
    { count: invok24h },
    { count: activeAgentsForIdle, data: agentsList },
    { count: openTickets },
    { data: ticketsByStatus },
    { data: latestDeploys },
    { data: prodDeploy },
    { data: consistencyTop },
    { data: deploysByState24h },
    { data: syncs },
    { data: webhooks24h },
    { count: docsPub },
    { count: skillsActive },
    { count: memHigh },
    { count: freshness },
  ] = await Promise.all([
    sb.from('cockpit_agent_prompts').select('*', { count: 'exact', head: true }).eq('active', true),
    sb.from('cockpit_audit_log').select('*', { count: 'exact', head: true }).gt('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    sb.from('cockpit_agent_prompts').select('role, updated_at, department', { count: 'exact' }).eq('active', true),
    sb.from('cockpit_tickets').select('*', { count: 'exact', head: true }).not('status', 'in', '("completed","done","archived","closed")'),
    sb.from('cockpit_tickets').select('status').order('created_at', { ascending: false }).limit(2000),
    sb.from('v_deployments').select('vercel_deploy_id, commit_sha, commit_message, state, deployer, build_ready_at, created_at, prod_aliased').order('created_at', { ascending: false }).limit(5),
    sb.from('v_current_prod').select('*'),
    sb.from('v_cockpit_consistency_checks').select('check_id').limit(500),
    sb.from('v_deployments').select('state').gt('created_at', new Date(Date.now() - 86_400_000).toISOString()),
    sbCockpit.from('sync_watermarks').select('*').order('updated_at', { ascending: false }).limit(20),
    sb.from('cockpit_audit_log').select('agent, action, target, created_at').or('action.ilike.%webhook%,target.ilike.%webhook%,agent.ilike.%webhook%').order('created_at', { ascending: false }).limit(5),
    sb.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    sbCockpit.from('cap_skills').select('*', { count: 'exact', head: true }).eq('active', true),
    sb.from('cockpit_agent_memory').select('*', { count: 'exact', head: true }).gte('importance', 9),
    sb.from('v_tenant_data_coverage').select('*', { count: 'exact', head: true }),
  ]);

  const { data: recentByAgent } = await sb
    .from('cockpit_audit_log')
    .select('agent, created_at')
    .gt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);

  const lastSeen = new Map<string, number>();
  for (const r of recentByAgent ?? []) {
    if (!r.agent) continue;
    const t = new Date(r.created_at).getTime();
    if (!lastSeen.has(r.agent) || lastSeen.get(r.agent)! < t) lastSeen.set(r.agent, t);
  }

  let working24 = 0, idle7 = 0, dead30 = 0, neverRun = 0;
  const now = Date.now();
  for (const a of agentsList ?? []) {
    const t = lastSeen.get(a.role);
    if (!t) { neverRun++; continue; }
    const ageH = (now - t) / 3_600_000;
    if (ageH <= 24) working24++;
    else if (ageH <= 24 * 7) idle7++;
    else dead30++;
  }

  const tBuckets = { queued: 0, in_progress: 0, awaits_user: 0, done7: 0 };
  for (const t of ticketsByStatus ?? []) {
    const s = (t.status || '').toLowerCase();
    if (['queued', 'pending', 'triaged'].includes(s)) tBuckets.queued++;
    else if (['in_progress', 'running', 'processing'].includes(s)) tBuckets.in_progress++;
    else if (['awaits_user', 'awaiting_user', 'waiting'].includes(s)) tBuckets.awaits_user++;
    else if (['completed', 'done'].includes(s)) tBuckets.done7++;
  }

  const cByCheck = new Map<string, number>();
  for (const c of consistencyTop ?? []) cByCheck.set(c.check_id, (cByCheck.get(c.check_id) ?? 0) + 1);

  const errors24h = (deploysByState24h ?? []).filter((d) => d.state === 'ERROR').length;
  const builds24h = (deploysByState24h ?? []).length;

  return {
    counts: {
      activeAgents: activeAgents ?? 0,
      invok24h: invok24h ?? 0,
      openTickets: openTickets ?? 0,
      errors24h, builds24h,
      docsPub: docsPub ?? 0,
      skillsActive: skillsActive ?? 0,
      memHigh: memHigh ?? 0,
      freshness: freshness ?? 0,
      consistency: (consistencyTop ?? []).length,
    },
    agentHealth: { working24, idle7, dead30, neverRun, total: activeAgentsForIdle ?? 0 },
    tBuckets,
    latestDeploys: latestDeploys ?? [],
    prodDeploy: (prodDeploy ?? [])[0] as any,
    consistencyByCheck: cByCheck,
    syncs: syncs ?? [],
    webhooks24h: webhooks24h ?? [],
  };
}

export default async function CockpitV2Home() {
  const d = await fetchHomeData();

  const headlineTiles: KpiTileProps[] = [
    { label: 'Active agents', value: d.counts.activeAgents, size: 'sm', footnote: 'identities', status: 'grey' },
    { label: 'Open tickets',  value: d.counts.openTickets,  size: 'sm', footnote: 'lifetime', status: d.counts.openTickets > 10 ? 'amber' : 'grey' },
    { label: 'Findings',      value: d.counts.consistency,  size: 'sm', footnote: 'fleet checks', status: d.counts.consistency > 50 ? 'red' : 'green' },
    { label: 'Deploys 24h',   value: d.counts.builds24h,    size: 'sm', footnote: d.counts.errors24h > 0 ? `${d.counts.errors24h} errored` : 'all green', status: d.counts.errors24h > 0 ? 'red' : 'green' },
    { label: 'Docs (live)',   value: d.counts.docsPub,      size: 'sm', footnote: 'published', status: 'grey' },
    { label: 'Tables tracked', value: d.counts.freshness,   size: 'sm', footnote: 'coverage', status: 'grey' },
  ];

  const agentHealthTiles: KpiTileProps[] = [
    { label: 'Working ≤24h', value: d.agentHealth.working24, size: 'sm', footnote: 'active', status: 'green' },
    { label: 'Idle 1-7d',    value: d.agentHealth.idle7,     size: 'sm', footnote: 'quiet',  status: 'amber' },
    { label: 'Dead 7-30d',   value: d.agentHealth.dead30,    size: 'sm', footnote: 'stale',  status: 'red' },
    { label: 'Never run',    value: d.agentHealth.neverRun,  size: 'sm', footnote: 'unused', status: 'grey' },
  ];

  const taskTiles: KpiTileProps[] = [
    { label: 'Queued',       value: d.tBuckets.queued,      size: 'sm', footnote: 'awaiting triage', status: 'grey' },
    { label: 'In progress',  value: d.tBuckets.in_progress, size: 'sm', footnote: 'working', status: 'amber' },
    { label: 'Awaits user',  value: d.tBuckets.awaits_user, size: 'sm', footnote: 'blocked on you', status: d.tBuckets.awaits_user > 0 ? 'red' : 'green' },
    { label: 'Done last 7d', value: d.tBuckets.done7,       size: 'sm', footnote: 'shipped', status: 'green' },
  ];

  return (
    <DashboardPage
      title="Cockpit · Home"
      tabs={groupsAsTabs('home')}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Headline" subtitle="fleet at a glance · last refresh just now" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {headlineTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Container title="Agent health" subtitle="see team →" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {agentHealthTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>

        <Container title="Tasks" subtitle="all tickets →" density="compact">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            {taskTiles.map((t, i) => <KpiTile key={i} {...t} />)}
          </div>
        </Container>
      </div>

      {d.prodDeploy && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Live production" subtitle="all deploys →" density="compact">
            <div style={{ fontSize: 12, color: '#5A5A5A', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>
                <code style={{ background: '#F4EFE2', padding: '2px 6px', borderRadius: 3, color: '#1F3A2E', fontSize: 11 }}>
                  {d.prodDeploy.commit_sha?.slice(0, 8) ?? '?'}
                </code>{' '}
                · {d.prodDeploy.deployer ?? '—'}
              </div>
              <div style={{ color: '#1B1B1B', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {(d.prodDeploy.commit_message ?? '').split('\n')[0]}
              </div>
              <div style={{ marginTop: 6, color: '#8A8A8A', fontSize: 11 }}>
                built {d.prodDeploy.build_ready_at ? new Date(d.prodDeploy.build_ready_at).toLocaleString() : '—'}
              </div>
            </div>
          </Container>
        </div>
      )}

      {d.latestDeploys.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title="Recent deploys" subtitle={`${d.latestDeploys.length} in the last window`} density="compact">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {d.latestDeploys.map((dp: any) => (
                <li key={dp.vercel_deploy_id} style={{
                  fontSize: 12, padding: '6px 0',
                  borderBottom: '1px solid #E6DFCC',
                  display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: 8, alignItems: 'baseline',
                }}>
                  <span style={{ color: dp.state === 'READY' ? '#2E7D32' : dp.state === 'ERROR' ? '#B8542A' : '#B8A878', fontWeight: 600, fontSize: 11 }}>
                    {dp.state}
                  </span>
                  <code style={{ color: '#5A5A5A', fontSize: 11 }}>{(dp.commit_sha || '').slice(0, 7) || '—'}</code>
                  <span style={{ color: '#1B1B1B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(dp.commit_message || '').split('\n')[0]}
                  </span>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      )}
    </DashboardPage>
  );
}
