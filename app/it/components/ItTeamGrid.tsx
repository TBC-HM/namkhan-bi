// NOTE: v_team_member_live_status is NOT in the current allowlist.
// Using v_agent_health as the data source instead. PBS: sub-ticket to add
// v_team_member_live_status to allowlist for richer name/avatar data.

interface Agent {
  agent_id: number
  role?: string
  department?: string
  health_state?: string
  active?: boolean
  recent_calls?: number
  recent_failures?: number
  minutes_since_last_call?: number | null
}

interface Props {
  agents: Agent[]
}

const STATE_COLOR: Record<string, string> = {
  healthy: 'var(--green)',
  stale: 'var(--amber)',
  never_run_stale: 'var(--text-muted)',
  archived: 'var(--text-muted)',
  failing: 'var(--red)',
}

export default function ItTeamGrid({ agents }: Props) {
  const active = agents.filter((a) => a.active)

  return (
    <section style={{ marginBottom: 'var(--space-6)' }}>
      <h2
        style={{
          fontSize: 'var(--t-lg)',
          fontWeight: 600,
          letterSpacing: 'var(--ls-extra)',
          textTransform: 'uppercase',
          color: 'var(--brass)',
          marginBottom: 'var(--space-3)',
        }}
      >
        Live team status
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {active.map((agent) => {
          const state = agent.health_state ?? 'unknown'
          const color = STATE_COLOR[state] ?? 'var(--text-muted)'
          const lastSeen =
            agent.minutes_since_last_call != null
              ? `${Math.round(agent.minutes_since_last_call)} min ago`
              : '—'

          return (
            <div
              key={agent.agent_id}
              style={{
                padding: 'var(--space-3)',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius-sm)',
                borderTop: `2px solid ${color}`,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 'var(--t-sm)',
                  color: 'var(--text-primary)',
                  textTransform: 'capitalize',
                }}
              >
                {(agent.role ?? 'agent').replace(/_/g, ' ')}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--t-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {agent.department ?? '—'}
              </p>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 'var(--t-xs)',
                  color,
                  fontWeight: 500,
                }}
              >
                {state.replace(/_/g, ' ')} · {lastSeen}
              </p>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: 'var(--t-xs)',
                  color: 'var(--text-muted)',
                }}
              >
                {agent.recent_calls ?? 0} calls · {agent.recent_failures ?? 0} fail
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
