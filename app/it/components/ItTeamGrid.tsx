// NOTE: Using v_agent_health (confirmed in allowlist).
// v_team_member_live_status is NOT in the current allowlist — sub-ticket recommended for richer name/avatar data.

interface Agent {
  agent_id: number;
  role?: string;
  department?: string;
  health_state?: string;
  active?: boolean;
  recent_calls?: number;
  recent_failures?: number;
  minutes_since_last_call?: number | null;
}

interface Props {
  agents: Agent[];
}

const HEALTH_COLOR: Record<string, string> = {
  healthy: 'var(--green)',
  stale: 'var(--amber)',
  never_run_stale: 'var(--text-muted)',
  archived: 'var(--text-muted)',
  degraded: 'var(--red)',
};

export default function ItTeamGrid({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <section
        style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          padding: 'var(--space-5)',
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--t-sm)', margin: 0 }}>
          No agent data available.
        </p>
      </section>
    );
  }

  return (
    <section
      style={{
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border)',
        padding: 'var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}
    >
      <h2
        style={{
          fontSize: 'var(--t-sm)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 'var(--ls-extra)',
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        Team Status
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {agents.map((agent) => {
          const state = agent.health_state ?? 'unknown';
          const color = HEALTH_COLOR[state] ?? 'var(--text-muted)';
          const lastSeen =
            agent.minutes_since_last_call !== null &&
            agent.minutes_since_last_call !== undefined
              ? `${Math.round(agent.minutes_since_last_call)}m ago`
              : 'never';

          return (
            <div
              key={agent.agent_id}
              style={{
                background: 'var(--surface-1)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                padding: 'var(--space-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 'var(--t-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {agent.role ?? '—'}
                </span>
              </div>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-muted)' }}>
                {state} · last: {lastSeen}
              </span>
              <span style={{ fontSize: 'var(--t-xs)', color: 'var(--text-muted)' }}>
                calls: {agent.recent_calls ?? 0} · fails: {agent.recent_failures ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
