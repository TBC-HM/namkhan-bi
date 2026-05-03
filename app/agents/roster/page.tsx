// app/agents/roster/page.tsx
import Link from 'next/link';
import { AGENTS, agentsByCategory, CATEGORY_LABELS, type AgentDefinition } from '@/lib/agents';

const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  draft: 'Draft',
  paused: 'Paused',
  error: 'Error',
};

const TRIGGER_LABEL: Record<string, string> = {
  manual: 'Manual',
  scheduled: 'Scheduled',
  event: 'Event-driven',
};

function AgentCard({ agent }: { agent: AgentDefinition }) {
  return (
    <div className={`agent-card status-${agent.status}`}>
      <div className="agent-card-head">
        <div className="agent-emoji">{agent.emoji}</div>
        <div className="agent-status-row">
          <span className={`badge agent-status-${agent.status}`}>
            {STATUS_LABEL[agent.status]}
          </span>
        </div>
      </div>

      <div className="agent-name">{agent.name}</div>
      <div className="agent-oneliner">{agent.oneLiner}</div>

      <div className="agent-meta">
        <div className="agent-meta-row">
          <span className="agent-meta-label">Trigger</span>
          <span className="agent-meta-val">{TRIGGER_LABEL[agent.trigger]}{agent.schedule ? ` · ${agent.schedule}` : ''}</span>
        </div>
        <div className="agent-meta-row">
          <span className="agent-meta-label">Model</span>
          <span className="agent-meta-val mono">{agent.model}</span>
        </div>
        {agent.runs30d != null && (
          <div className="agent-meta-row">
            <span className="agent-meta-label">Runs 30d</span>
            <span className="agent-meta-val">{agent.runs30d}</span>
          </div>
        )}
        {agent.accuracy != null && (
          <div className="agent-meta-row">
            <span className="agent-meta-label">Accuracy</span>
            <span className="agent-meta-val">{agent.accuracy}%</span>
          </div>
        )}
      </div>

      <div className="agent-actions">
        <Link href={`/agents/run/${agent.id}`} className="agent-btn agent-btn-primary">
          Fire ▶
        </Link>
        <Link href={`/agents/settings/${agent.id}`} className="agent-btn">
          Edit
        </Link>
      </div>
    </div>
  );
}

export default function RosterPage() {
  const groups = agentsByCategory();
  const totals = {
    total: AGENTS.length,
    live: AGENTS.filter(a => a.status === 'live').length,
    draft: AGENTS.filter(a => a.status === 'draft').length,
    scheduled: AGENTS.filter(a => a.trigger === 'scheduled').length,
  };

  return (
    <>
      <div className="kpi-strip cols-4">
        <div className="kpi-box">
          <div className="kpi-label">Total Agents</div>
          <div className="kpi-value">{totals.total}</div>
          <div className="kpi-deltas">configured</div>
        </div>
        <div className="kpi-tile good">
          <div className="kpi-label">Live</div>
          <div className="kpi-value">{totals.live}</div>
          <div className="kpi-deltas">production</div>
        </div>
        <div className="kpi-tile warn">
          <div className="kpi-label">Draft</div>
          <div className="kpi-value">{totals.draft}</div>
          <div className="kpi-deltas">awaiting deployment</div>
        </div>
        <div className="kpi-box">
          <div className="kpi-label">Scheduled</div>
          <div className="kpi-value">{totals.scheduled}</div>
          <div className="kpi-deltas">cron-triggered</div>
        </div>
      </div>

      {/* Hero banner explaining what this is */}
      <div className="agents-hero">
        <div className="agents-hero-eyebrow">Vertex AI · Anthropic · Custom</div>
        <div className="agents-hero-title">Operator Intelligence Crew</div>
        <div className="agents-hero-body">
          Every agent reads from your live Cloudbeds + Supabase data.
          Fire manually for ad-hoc analysis, or let scheduled agents drop briefs in your inbox.
          Each agent is configurable — edit the prompt, swap models, change triggers.
        </div>
      </div>

      {/* Category groups */}
      {Object.entries(groups).map(([cat, agents]) => (
        <div key={cat} className="section">
          <div className="section-head">
            <div className="section-title">{CATEGORY_LABELS[cat] ?? cat}</div>
            <div className="section-tag">{agents.length} {agents.length === 1 ? 'agent' : 'agents'}</div>
          </div>
          <div className="agents-grid">
            {agents.map(a => <AgentCard key={a.id} agent={a} />)}
          </div>
        </div>
      ))}
    </>
  );
}
