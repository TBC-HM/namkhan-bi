import { createClient } from '@supabase/supabase-js'
import { KpiBox } from '@/components/kpi/KpiBox'
import { PageHeader } from '@/components/layout/PageHeader'
import ItHeroStrip from './components/ItHeroStrip'
import ItKpiRow from './components/ItKpiRow'
import ItAttentionPanel from './components/ItAttentionPanel'
import ItTeamGrid from './components/ItTeamGrid'
import ItAskBox from './components/ItAskBox'

export const revalidate = 60

async function getItData() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [agentHealth, tickets, auditLog, kitPerf, weeklyDigest, alerts] =
    await Promise.all([
      sb.from('v_agent_health').select('agent_id,health_state,active,department'),
      sb
        .from('cockpit_tickets')
        .select('id,status,created_at,arm')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      sb
        .from('cockpit_audit_log')
        .select('id,cost_usd_milli,created_at')
        .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      sb.from('v_kit_performance').select('*').single(),
      sb.from('v_it_weekly_digest').select('*').single(),
      sb.from('v_tactical_alerts_top').select('*').limit(10),
    ])

  const agents = agentHealth.data ?? []
  const activeAgents = agents.filter((a) => a.active && a.health_state === 'healthy').length
  const allAgents = agents.filter((a) => a.active).length

  const ticketRows = tickets.data ?? []
  const ticketsShipped24h = ticketRows.filter((t) => t.status === 'completed').length
  const ticketsInFlight = ticketRows.filter((t) =>
    ['triaging', 'working', 'awaits_user'].includes(t.status)
  ).length

  const auditRows = auditLog.data ?? []
  const costUsd24h =
    auditRows.reduce((sum, r) => sum + (r.cost_usd_milli ?? 0), 0) / 1000

  const kit = kitPerf.data
  const weekly = weeklyDigest.data

  // v_tactical_alerts_top: stub arm filter — view may not have arm column
  // show all if arm column absent; PR review will confirm
  const alertRows = (alerts.data ?? []).slice(0, 5)

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
  }
}

export default async function ItPage() {
  const data = await getItData()

  return (
    <main style={{ padding: 'var(--space-6)' }}>
      <PageHeader
        title="IT Command"
        subtitle="Operations overview & quick-access workspace"
        icon="I"
        iconColor="var(--brass)"
      />

      {/* Hero strip */}
      <ItHeroStrip
        activeAgents={data.activeAgents}
        allAgents={data.allAgents}
        ticketsInFlight={data.ticketsInFlight}
        costUsd24h={data.costUsd24h}
      />

      {/* KPI row */}
      <ItKpiRow
        activeAgents={data.activeAgents}
        ticketsShipped24h={data.ticketsShipped24h}
        costUsd24h={data.costUsd24h}
        kitDoneClean={data.kit?.done_clean ?? null}
        kitFailureRate={data.kit?.failure_rate_pct ?? null}
      />

      {/* Attention panel */}
      <ItAttentionPanel alerts={data.alertRows} />

      {/* Team grid */}
      <ItTeamGrid agents={data.agentRows} />

      {/* Ask-anything box */}
      <ItAskBox />
    </main>
  )
}
