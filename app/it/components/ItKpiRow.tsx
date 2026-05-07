import { KpiBox } from '@/components/kpi/KpiBox'

interface Props {
  activeAgents: number
  ticketsShipped24h: number
  costUsd24h: number
  kitDoneClean: number | null
  kitFailureRate: number | null
}

export default function ItKpiRow({
  activeAgents,
  ticketsShipped24h,
  costUsd24h,
  kitDoneClean,
  kitFailureRate,
}: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <KpiBox
        label="Agents online"
        value={String(activeAgents ?? '—')}
        source="v_agent_health"
      />
      <KpiBox
        label="Tickets shipped 24 h"
        value={String(ticketsShipped24h ?? '—')}
        source="cockpit_tickets"
      />
      <KpiBox
        label="Audit cost 24 h"
        value={`$${costUsd24h.toFixed(2)}`}
        source="cockpit_audit_log"
      />
      <KpiBox
        label="Kit clean runs"
        value={kitDoneClean != null ? String(kitDoneClean) : '—'}
        source="v_kit_performance"
      />
      <KpiBox
        label="Kit failure rate"
        value={kitFailureRate != null ? `${kitFailureRate}%` : '—'}
        source="v_kit_performance"
      />
    </div>
  )
}
