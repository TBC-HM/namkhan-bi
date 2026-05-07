'use server';
import { createClient } from '@supabase/supabase-js';
import PageHeader from '@/components/layout/PageHeader';
import KpiBox from '@/components/kpi/KpiBox';
import ItHeroStrip from './components/ItHeroStrip';
import ItKpiRow from './components/ItKpiRow';
import ItAttentionPanel from './components/ItAttentionPanel';
import ItTeamGrid from './components/ItTeamGrid';
import ItAskBox from './components/ItAskBox';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

async function getItData() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [agentHealth, tickets, auditLog, kitPerf, weeklyDigest, alerts] =
    await Promise.all([
      sb.from('v_agent_health').select('agent_id,health_state,active,department'),
      sb
        .from('cockpit_tickets')
        .select('id,status,created_at,arm')
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
      sb
        .from('cockpit_audit_log')
        .select('id,cost_usd_milli,created_at')
        .gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
      sb.from('v_kit_performance').select('*').limit(1).single(),
      sb.from('v_it_weekly_digest').select('*').limit(1).single(),
      sb.from('v_tactical_alerts_top').select('*').limit(10),
    ]);

  const agents = agentHealth.data ?? [];
  const activeAgents = agents.filter(
    (a) => a.active && a.health_state === 'healthy'
  ).length;
  const allAgents = agents.filter((a) => a.active).length;

  const ticketRows = tickets.data ?? [];
  const ticketsShipped24h = ticketRows.filter((t) => t.status === 'completed').length;
  const ticketsInFlight = ticketRows.filter((t) =>
    ['triaging', 'working', 'awaits_user'].includes(t.status)
  ).length;

  const auditRows = auditLog.data ?? [];
  const costUsd24h =
    auditRows.reduce((sum, r) => sum + ((r.cost_usd_milli as number) ?? 0), 0) / 1000;

  const kit = kitPerf.data as Record<string, unknown> | null;
  const weekly = weeklyDigest.data as Record<string, unknown> | null;
  const alertRows = (alerts.data ?? []).slice(0, 5);

  return {
    activeAgents,
    allAgents,
    ticketsShipped24h,
    ticketsInFlight,
    costUsd24h,
    kit,
    weekly,
    alertRows,
    agentRows: agents,
  };
}

export default async function ItPage() {
  const data = await getItData();

  return (
    <main style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader pillar="IT" tab="Overview" title="IT Dashboard" />

      <ItHeroStrip
        activeAgents={data.activeAgents}
        allAgents={data.allAgents}
        ticketsInFlight={data.ticketsInFlight}
        costUsd24h={data.costUsd24h}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, margin: '24px 0' }}>
        <KpiBox label="Agents Online" value={`${data.activeAgents} / ${data.allAgents}`} />
        <KpiBox label="Tickets Shipped (24h)" value={String(data.ticketsShipped24h)} />
        <KpiBox label="In Flight" value={String(data.ticketsInFlight)} />
        <KpiBox label="Kit Done Clean" value={data.kit ? String((data.kit as Record<string,unknown>)['done_clean'] ?? '—') : '—'} />
        <KpiBox
          label="Kit Failure Rate"
          value={data.kit ? `${(data.kit as Record<string,unknown>)['failure_rate_pct'] ?? '—'}%` : '—'}
        />
      </div>

      <ItKpiRow
        activeAgents={data.activeAgents}
        ticketsShipped24h={data.ticketsShipped24h}
        costUsd24h={data.costUsd24h}
        kitDoneClean={
          data.kit ? Number((data.kit as Record<string,unknown>)['done_clean'] ?? 0) : null
        }
        kitFailureRate={
          data.kit ? Number((data.kit as Record<string,unknown>)['failure_rate_pct'] ?? 0) : null
        }
      />

      <ItAttentionPanel alerts={data.alertRows} />

      <ItTeamGrid agents={data.agentRows} />

      <ItAskBox />
    </main>
  );
}
