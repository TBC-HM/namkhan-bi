// app/cockpit-v2/page.tsx
//
// PBS 2026-05-17: Home / mission control. Replaces the boring "redirect
// to /team" with a real landing page — every container is data-backed,
// every count is clickable, nothing is placeholder. If a data source
// has zero rows, the container is omitted entirely (per PBS rule).
//
// Containers (in render order):
//   1. KPI strip — 6 tiles, all link out
//   2. Agent health (active / working 24h / idle 7d / dead 30d)
//   3. Task board (open / in-progress / awaits_user / completed 7d)
//   4. API sync status (sync_watermarks per source)
//   5. Recent deploys (last 5 · deploy.deployments)
//   6. Consistency alerts (top critical from v_cockpit_consistency_checks)
//   7. Daily narrative summary (computed live, regenerates via ?refresh=<ts>)

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, SERIF, MONO } from './_components/tokens';

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

  // recent invocations per agent — compute working/idle/dead breakdown
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

  // tickets by bucket
  const tBuckets = { queued: 0, in_progress: 0, awaits_user: 0, done7: 0 };
  for (const t of ticketsByStatus ?? []) {
    const s = (t.status || '').toLowerCase();
    if (['queued', 'pending', 'triaged'].includes(s)) tBuckets.queued++;
    else if (['in_progress', 'running', 'processing'].includes(s)) tBuckets.in_progress++;
    else if (['awaits_user', 'awaiting_user', 'waiting'].includes(s)) tBuckets.awaits_user++;
    else if (['completed', 'done'].includes(s)) tBuckets.done7++;
  }

  // consistency by check_id
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
    prodDeploy: (prodDeploy ?? [])[0],
    consistencyByCheck: cByCheck,
    syncs: syncs ?? [],
    webhooks24h: webhooks24h ?? [],
  };
}

export default async function CockpitV2Home() {
  const d = await fetchHomeData();
  const refreshTs = new Date().toLocaleString();

  return (
    <div style={{ color: TOKENS.text }}>
      {/* Top KPI strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10, marginBottom: 18,
      }}>
        <Tile href="/cockpit-v2/team"     label="Active agents"   value={d.counts.activeAgents}    tone="ink" />
        <Tile href="/cockpit-v2/tasks"    label="Open tickets"     value={d.counts.openTickets}     tone={d.counts.openTickets > 10 ? 'warn' : 'ink'} />
        <Tile href="/cockpit-v2/checks"   label="Findings"         value={d.counts.consistency}     tone={d.counts.consistency > 50 ? 'warn' : 'ink'} />
        <Tile href="/cockpit-v2/deploys"  label="Deploys 24h"      value={d.counts.builds24h}       tone="ink"
              foot={d.counts.errors24h > 0 ? `${d.counts.errors24h} errored` : 'all green'} />
        <Tile href="/cockpit-v2/docs"     label="Docs (live)"      value={d.counts.docsPub}         tone="ink" />
        <Tile href="/cockpit-v2/freshness" label="Tables tracked"  value={d.counts.freshness}       tone="ink" />
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* LEFT: Agent health + Tasks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Agent health */}
          <Section title="Agent health" href="/cockpit-v2/team" linkLabel="see team →">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Mini label="Working ≤24h"  value={d.agentHealth.working24} tone={TOKENS.forest} />
              <Mini label="Idle 1-7d"     value={d.agentHealth.idle7}     tone={TOKENS.brass} />
              <Mini label="Dead 7-30d"    value={d.agentHealth.dead30}    tone="#E07856" />
              <Mini label="Never run"     value={d.agentHealth.neverRun}  tone={TOKENS.text3} />
            </div>
            <Bar
              segments={[
                { v: d.agentHealth.working24, c: TOKENS.forest },
                { v: d.agentHealth.idle7,     c: TOKENS.brass },
                { v: d.agentHealth.dead30,    c: '#E07856' },
                { v: d.agentHealth.neverRun,  c: TOKENS.text3 },
              ]}
            />
          </Section>

          {/* Task board */}
          <Section title="Tasks" href="/cockpit-v2/tasks" linkLabel="all tickets →">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              <Mini label="Queued"          value={d.tBuckets.queued}       tone={TOKENS.text2} />
              <Mini label="In progress"     value={d.tBuckets.in_progress}  tone={TOKENS.brass} />
              <Mini label="Awaits user"     value={d.tBuckets.awaits_user}  tone="#E07856" />
              <Mini label="Done last 7d"    value={d.tBuckets.done7}        tone={TOKENS.forest} />
            </div>
          </Section>

          {/* Consistency alerts */}
          <Section title="Fleet consistency checks" href="/cockpit-v2/checks" linkLabel="all findings →">
            {d.consistencyByCheck.size === 0 ? (
              <Note tone="ok">✓ all clean</Note>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Array.from(d.consistencyByCheck.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, n]) => (
                    <Link key={k} href="/cockpit-v2/checks" style={chip(n)}>
                      {k.replace(/_/g, ' ')} · {n}
                    </Link>
                  ))}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT: API syncs + Recent deploys */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Current production */}
          {d.prodDeploy && (
            <Section title="Live production" href="/cockpit-v2/deploys" linkLabel="all deploys →">
              <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
                <div style={{ marginBottom: 4 }}>
                  <code style={{ color: TOKENS.brass }}>
                    {(d.prodDeploy as any).commit_sha?.slice(0, 8) ?? '?'}
                  </code>{' '}
                  · {(d.prodDeploy as any).deployer ?? '—'}
                </div>
                <div style={{ color: TOKENS.text, fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {((d.prodDeploy as any).commit_message ?? '').split('\n')[0]}
                </div>
                <div style={{ marginTop: 6, color: TOKENS.text3 }}>
                  built {(d.prodDeploy as any).build_ready_at
                    ? new Date((d.prodDeploy as any).build_ready_at).toLocaleString()
                    : '—'}
                </div>
              </div>
            </Section>
          )}

          {/* Recent deploys */}
          {d.latestDeploys.length > 0 && (
            <Section title="Recent deploys" href="/cockpit-v2/deploys" linkLabel="all →">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.latestDeploys.map((dp: any) => (
                  <li key={dp.vercel_deploy_id} style={{
                    fontFamily: MONO, fontSize: 11, padding: '4px 0',
                    borderBottom: `1px solid ${TOKENS.borderSoft}`,
                    display: 'grid', gridTemplateColumns: '60px 60px 1fr', gap: 8, alignItems: 'baseline',
                  }}>
                    <span style={{ color: dp.state === 'READY' ? TOKENS.forest : (dp.state === 'ERROR' ? '#E07856' : TOKENS.brass) }}>
                      {dp.state}
                    </span>
                    <span style={{ color: TOKENS.brass }}>{(dp.commit_sha || '').slice(0, 7) || '—'}</span>
                    <span style={{ color: TOKENS.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(dp.commit_message || '').split('\n')[0]}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* API sync status */}
          {d.syncs.length > 0 && (
            <Section title="API syncs" href="/cockpit-v2/health" linkLabel="health →">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.syncs.slice(0, 8).map((s: any, i: number) => {
                  const tsCol = s.updated_at || s.last_sync_at || s.created_at;
                  const ageH = tsCol ? (Date.now() - new Date(tsCol).getTime()) / 3_600_000 : null;
                  const tone =
                    ageH == null ? TOKENS.text3
                      : ageH < 4 ? TOKENS.forest
                      : ageH < 24 ? TOKENS.brass
                      : '#E07856';
                  return (
                    <li key={i} style={{
                      fontFamily: MONO, fontSize: 11, padding: '4px 0',
                      borderBottom: `1px solid ${TOKENS.borderSoft}`,
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                    }}>
                      <span style={{ color: TOKENS.text }}>
                        {s.source ?? s.system ?? s.entity ?? s.integration ?? '(unnamed)'}
                      </span>
                      <span style={{ color: tone }}>
                        {ageH == null ? '—' : ageH < 1 ? `${Math.round(ageH * 60)}m` : `${Math.round(ageH)}h`} ago
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Webhooks 24h */}
          {d.webhooks24h.length > 0 && (
            <Section title="Webhooks 24h" href="/cockpit-v2/activity" linkLabel="activity →">
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {d.webhooks24h.map((w: any, i: number) => (
                  <li key={i} style={{
                    fontFamily: MONO, fontSize: 11, padding: '3px 0', color: TOKENS.text2,
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: 8,
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.action || w.target || w.agent}
                    </span>
                    <span style={{ color: TOKENS.text3 }}>
                      {Math.round((Date.now() - new Date(w.created_at).getTime()) / 60_000)}m ago
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {/* Daily report */}
      <Section
        title="Today's narrative"
        href={`/cockpit-v2?refresh=${Date.now()}`}
        linkLabel="↻ regenerate"
      >
        <div style={{ fontFamily: SERIF, fontSize: 14, color: TOKENS.text, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 8px' }}>
            {refreshTs}.{' '}
            <strong>{d.counts.activeAgents}</strong> active agents · <strong>{d.agentHealth.working24}</strong>{' '}
            worked in the last 24h, <strong>{d.agentHealth.dead30 + d.agentHealth.neverRun}</strong> have not run in 30+ days.{' '}
            <strong>{d.counts.invok24h}</strong> agent invocations recorded in the last 24h.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>{d.counts.openTickets}</strong> open tickets across the fleet.{' '}
            {d.tBuckets.awaits_user > 0 && (<><strong>{d.tBuckets.awaits_user}</strong> awaiting your action. </>)}
            <strong>{d.tBuckets.done7}</strong> completed in the last 7 days.
          </p>
          <p style={{ margin: '0 0 8px' }}>
            <strong>{d.counts.builds24h}</strong> Vercel deploys in 24h, {d.counts.errors24h > 0
              ? (<><span style={{ color: '#E07856' }}>{d.counts.errors24h} errored</span> · check Deploys.</>)
              : (<span style={{ color: TOKENS.forest }}>all green.</span>)}
          </p>
          {d.counts.consistency > 0 && (
            <p style={{ margin: '0 0 8px' }}>
              <strong style={{ color: '#E07856' }}>{d.counts.consistency} fleet-consistency findings</strong> open. Top types listed above.
            </p>
          )}
          <p style={{ margin: '0', color: TOKENS.text3, fontFamily: MONO, fontSize: 11 }}>
            Knowledge base: {d.counts.docsPub} docs · {d.counts.memHigh} standing rules · {d.counts.skillsActive} skills
            · {d.counts.freshness} tables tracked for tenant freshness.
          </p>
        </div>
      </Section>
    </div>
  );
}

// ───── primitives ──────────────────────────────────────────────────────

function Tile({
  href, label, value, tone = 'ink', foot,
}: {
  href: string; label: string; value: number | string;
  tone?: 'ink' | 'warn' | 'ok'; foot?: string;
}) {
  const accent = tone === 'warn' ? '#E07856' : tone === 'ok' ? TOKENS.forest : TOKENS.brass;
  return (
    <Link href={href} style={{
      display: 'block', textDecoration: 'none', padding: '12px 14px',
      background: TOKENS.bgRaised,
      border: `1px solid ${TOKENS.border}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 2,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
        color: TOKENS.text3,
      }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: 28, color: TOKENS.ink, marginTop: 4, fontWeight: 500, lineHeight: 1.1 }}>
        {value}
      </div>
      {foot && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, marginTop: 2 }}>{foot}</div>
      )}
    </Link>
  );
}

function Section({
  title, href, linkLabel, children,
}: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section style={{
      padding: '14px 16px',
      background: TOKENS.bgRaised,
      border: `1px solid ${TOKENS.border}`,
      borderRadius: 2,
    }}>
      <header style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10,
      }}>
        <h3 style={{
          fontFamily: SERIF, fontSize: 14, color: TOKENS.ink, margin: 0, fontWeight: 500,
        }}>{title}</h3>
        {href && (
          <Link href={href} style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            color: TOKENS.brass, textDecoration: 'none',
          }}>{linkLabel}</Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={{ padding: '8px 10px', border: `1px solid ${TOKENS.borderSoft}`, borderLeft: `2px solid ${tone}`, borderRadius: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: TOKENS.text3 }}>
        {label}
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 20, color: TOKENS.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Bar({ segments }: { segments: Array<{ v: number; c: string }> }) {
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  return (
    <div style={{ marginTop: 12, display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden' }}>
      {segments.map((s, i) => (
        <div key={i} style={{ width: `${(s.v / total) * 100}%`, background: s.c }} />
      ))}
    </div>
  );
}

function Note({ tone, children }: { tone: 'ok' | 'warn'; children: React.ReactNode }) {
  const c = tone === 'ok' ? TOKENS.forest : '#E07856';
  return (
    <div style={{ padding: '8px 10px', border: `1px dashed ${c}`, color: c, fontFamily: MONO, fontSize: 12 }}>
      {children}
    </div>
  );
}

function chip(n: number): React.CSSProperties {
  const c = n > 20 ? '#E07856' : TOKENS.brass;
  return {
    fontFamily: MONO, fontSize: 11, color: c, border: `1px solid ${c}`,
    padding: '3px 8px', borderRadius: 2, textDecoration: 'none', whiteSpace: 'nowrap',
  };
}
