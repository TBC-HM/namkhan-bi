import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import ItHeroStrip from './components/ItHeroStrip';
import ItKpiRow from './components/ItKpiRow';
import ItAttentionPanel from './components/ItAttentionPanel';
import ItTeamGrid from './components/ItTeamGrid';
import ItAskBox from './components/ItAskBox';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export default async function ItPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── agent health ─────────────────────────────────────────────────────────
  const { data: agentRows } = await supabase
    .from('v_agent_health')
    .select('*')
    .limit(100);
  const agents = agentRows ?? [];
  const activeAgents = agents.filter(
    (a: Record<string, unknown>) => a['health_state'] === 'healthy',
  ).length;
  const allAgents = agents.length;

  // ── tickets in-flight ────────────────────────────────────────────────────
  const { data: ticketRows } = await supabase
    .from('cockpit_tickets')
    .select('status')
    .in('status', ['triaged', 'in_progress', 'awaits_user'])
    .limit(200);
  const ticketsInFlight = ticketRows?.length ?? 0;

  // ── weekly digest (cost + shipped) ───────────────────────────────────────
  const { data: digestRows } = await supabase
    .from('v_it_weekly_digest')
    .select('*')
    .limit(1);
  const digest = digestRows?.[0] ?? null;
  const costUsd24h =
    typeof digest?.cost_usd === 'number' ? (digest.cost_usd as number) : 0;
  const ticketsShipped24h =
    typeof digest?.tickets_closed === 'number'
      ? (digest.tickets_closed as number)
      : 0;

  // ── KIT performance ──────────────────────────────────────────────────────
  const { data: kitRows } = await supabase
    .from('v_kit_performance')
    .select('*')
    .limit(1);
  const kit = kitRows?.[0] ?? null;
  const kitDoneClean: number | null =
    typeof kit?.done_clean === 'number' ? (kit.done_clean as number) : null;
  const kitFailureRate: number | null =
    typeof kit?.failure_rate_pct === 'number'
      ? (kit.failure_rate_pct as number)
      : null;

  // ── tactical alerts ──────────────────────────────────────────────────────
  // v_tactical_alerts_top may return permission denied — silently fallback to [].
  const { data: alertRows } = await supabase
    .from('v_tactical_alerts_top')
    .select('*')
    .limit(10);
  const alerts = alertRows ?? [];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        color: 'var(--text-primary)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <PageHeader pillar="IT" tab="Overview" title="IT Overview" />

      <ItHeroStrip
        activeAgents={activeAgents}
        allAgents={allAgents}
        ticketsInFlight={ticketsInFlight}
        costUsd24h={costUsd24h}
      />

      <ItKpiRow
        ticketsShipped={ticketsShipped24h}
        kitDoneClean={kitDoneClean}
        kitFailureRate={kitFailureRate}
        agentCount={allAgents}
        activeCount={activeAgents}
      />

      <ItAttentionPanel alerts={alerts} />

      <ItTeamGrid agents={agents} />

      <ItAskBox />
    </main>
  );
}
