// components/cockpit/CockpitV3Client.tsx
// Prompt 6 — cockpit-v2 rework. Tab controller + Team/Activity/Costs tab UIs.
// Skills tab is delegated to <SkillsTab> (Prompt 7, lazy-loaded).

'use client';

import { useMemo, useState, lazy, Suspense } from 'react';
import Link from 'next/link';

const SkillsTab = lazy(() => import('./tabs/SkillsTab'));

interface RosterAgent {
  role: string;
  display_name: string | null;
  dept: string | null;
  avatar: string | null;
  color: string | null;
  tagline: string | null;
  status: string | null;
  hierarchy_level: string | null;
  reports_to: string | null;
  property_id: number | null;
  scope_label: string | null;
  skill_count?: number | null;
  read_skills?: number | null;
  write_skills?: number | null;
  gated_skills?: number | null;
  last_run_at?: string | null;
  runs_30d?: number | null;
  cost_30d_usd?: number | string | null;
  runs_total?: number | null;
}

interface AgentRun {
  run_id: string;
  agent_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  cost_usd: number | string | null;
  property_id: number | null;
}

type Tab = 'team' | 'skills' | 'activity' | 'costs' | 'schemas' | 'knowledge';

interface Props {
  propertyId: number;
  scope: string;
  roster: RosterAgent[];
  runs: AgentRun[];
}

export default function CockpitV3Client({ propertyId, scope, roster, runs }: Props) {
  const [tab, setTab] = useState<Tab>('team');

  const counts = useMemo(
    () => ({
      team: roster.length,
      skills: roster.reduce((sum, a) => sum + (Number(a.skill_count) || 0), 0),
      activity: runs.length,
      costs: roster.filter((a) => Number(a.cost_30d_usd) > 0).length,
    }),
    [roster, runs],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <TabBar tab={tab} setTab={setTab} counts={counts} />

      {tab === 'team' && <TeamTab roster={roster} propertyId={propertyId} />}
      {tab === 'skills' && (
        <Suspense fallback={<div style={{ color: 'var(--text-mute, #9b907a)', padding: 24 }}>Loading skills…</div>}>
          <SkillsTab />
        </Suspense>
      )}
      {tab === 'activity' && <ActivityTab runs={runs} />}
      {tab === 'costs' && <CostsTab roster={roster} scope={scope} />}
      {tab === 'schemas' && <Placeholder label="Schemas" hint="Schema explorer ports over in a follow-up ticket." />}
      {tab === 'knowledge' && <Placeholder label="Knowledge" hint="Knowledge-base browser ports over in a follow-up ticket." />}
    </div>
  );
}

function TabBar({ tab, setTab, counts }: { tab: Tab; setTab: (t: Tab) => void; counts: Record<string, number> }) {
  const items: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'team', label: 'Team', count: counts.team },
    { key: 'skills', label: 'Skills', count: counts.skills },
    { key: 'activity', label: 'Activity', count: counts.activity },
    { key: 'costs', label: 'Costs', count: counts.costs },
    { key: 'schemas', label: 'Schemas' },
    { key: 'knowledge', label: 'Knowledge' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--border-1, #1f1c15)',
        paddingBottom: 0,
      }}
    >
      {items.map((it) => {
        const active = it.key === tab;
        return (
          <button
            key={it.key}
            onClick={() => setTab(it.key)}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 4px 10px',
              borderBottom: active ? '2px solid var(--accent, #a8854a)' : '2px solid transparent',
              color: active ? 'var(--text-1, #f0e5cb)' : 'var(--text-dim, #7d7565)',
              cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            {it.label}
            {typeof it.count === 'number' && (
              <span style={{ marginLeft: 6, color: 'var(--text-mute, #9b907a)' }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TeamTab({ roster, propertyId }: { roster: RosterAgent[]; propertyId: number }) {
  if (roster.length === 0) {
    return <Placeholder label="No agents" hint="Roster is empty for this scope." />;
  }

  // Group by hierarchy_level if present
  const grouped = new Map<string, RosterAgent[]>();
  for (const a of roster) {
    const key = a.hierarchy_level ?? 'other';
    const arr = grouped.get(key) ?? [];
    arr.push(a);
    grouped.set(key, arr);
  }

  const LEVEL_ORDER = ['lead', 'ceo', 'hod', 'manager', 'worker', 'agent', 'other'];
  const levels = Array.from(grouped.keys()).sort(
    (a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {levels.map((level) => (
        <section key={level}>
          <h2
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-mute, #9b907a)',
              marginBottom: 10,
            }}
          >
            {level === 'lead' ? 'Lead' : level === 'hod' ? 'Heads of Department' : level === 'worker' ? 'Workers' : level.charAt(0).toUpperCase() + level.slice(1)}
            <span style={{ marginLeft: 8, color: 'var(--text-dim, #7d7565)' }}>· {grouped.get(level)!.length}</span>
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 10,
            }}
          >
            {grouped.get(level)!.map((a) => (
              <AgentCard key={a.role} agent={a} propertyId={propertyId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AgentCard({ agent, propertyId }: { agent: RosterAgent; propertyId: number }) {
  const swatch = agent.color ?? 'var(--accent, #a8854a)';
  const skillCount = Number(agent.skill_count ?? 0);
  const cost30d = Number(agent.cost_30d_usd ?? 0);
  const lastRun = agent.last_run_at ? humanTime(agent.last_run_at) : null;

  return (
    <Link
      href={`/h/${propertyId}/it/cockpit/chat/${agent.role}`}
      style={{
        textDecoration: 'none',
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px solid var(--border-1, #1f1c15)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: swatch,
            color: 'var(--surf-0, #0a0a0a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {agent.avatar ?? initials(agent.display_name ?? agent.role)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--text-0, #e9e1ce)', fontFamily: "'Fraunces', Georgia, serif", fontSize: 15 }}>
            {agent.display_name ?? agent.role}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)', letterSpacing: '0.04em' }}>
            {agent.dept ? `${agent.dept} · ` : ''}{agent.scope_label ?? ''}
          </div>
        </div>
      </div>
      {agent.tagline && (
        <div style={{ fontSize: 11, color: 'var(--text-mute, #9b907a)', fontStyle: 'italic', lineHeight: 1.4 }}>
          {agent.tagline}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace" }}>
        {`role=${agent.role}${agent.reports_to ? ` · reports_to=${agent.reports_to}` : ''}`}
      </div>
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-mute, #9b907a)',
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span>{skillCount} skills</span>
        <span>·</span>
        <span>{lastRun ? `last ${lastRun}` : 'never run'}</span>
        <span>·</span>
        <span>${cost30d.toFixed(2)}/30d</span>
      </div>
    </Link>
  );
}

function ActivityTab({ runs }: { runs: AgentRun[] }) {
  if (runs.length === 0) {
    return <Placeholder label="No recent runs" hint="Activity will populate as agents execute tasks." />;
  }
  return (
    <div
      style={{
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px solid var(--border-1, #1f1c15)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '120px 100px 80px 100px 80px 80px 1fr',
          gap: 12,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-1, #1f1c15)',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-mute, #9b907a)',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <span>When</span>
        <span>Agent</span>
        <span>Property</span>
        <span>Status</span>
        <span>Duration</span>
        <span>Cost</span>
        <span></span>
      </div>
      {runs.map((r) => (
        <div
          key={r.run_id}
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 100px 80px 100px 80px 80px 1fr',
            gap: 12,
            padding: '8px 14px',
            borderBottom: '1px solid var(--border-1, #1f1c15)',
            fontSize: 11,
            color: 'var(--text-0, #e9e1ce)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: 'var(--text-mute, #9b907a)' }}>{humanTime(r.started_at)}</span>
          <span title={r.agent_id} style={{ color: 'var(--text-dim, #7d7565)' }}>
            {r.agent_id.slice(0, 8)}
          </span>
          <span style={{ color: 'var(--text-dim, #7d7565)' }}>{r.property_id ?? '—'}</span>
          <span
            style={{
              color:
                r.status === 'succeeded' ? '#3f8a4a' :
                r.status === 'failed' ? '#c0584c' :
                r.status === 'queued' ? 'var(--accent, #a8854a)' :
                'var(--text-mute, #9b907a)',
            }}
          >
            {r.status}
          </span>
          <span>{r.duration_ms != null ? `${Math.round(r.duration_ms / 100) / 10}s` : '—'}</span>
          <span>{r.cost_usd != null ? `$${Number(r.cost_usd).toFixed(3)}` : '—'}</span>
          <span></span>
        </div>
      ))}
    </div>
  );
}

function CostsTab({ roster, scope }: { roster: RosterAgent[]; scope: string }) {
  // Aggregate per scope
  const byScope = new Map<string, number>();
  for (const a of roster) {
    const k = a.scope_label ?? 'Unknown';
    byScope.set(k, (byScope.get(k) ?? 0) + Number(a.cost_30d_usd ?? 0));
  }
  const total = Array.from(byScope.values()).reduce((s, v) => s + v, 0);

  // Sort agents by cost desc
  const ranked = [...roster]
    .map((a) => ({ ...a, _cost: Number(a.cost_30d_usd ?? 0) }))
    .sort((a, b) => b._cost - a._cost);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Array.from(byScope.entries()).map(([label, cost]) => (
          <CostTile key={label} label={label} value={`$${cost.toFixed(2)}`} hint="30-day" />
        ))}
        <CostTile label="All-in" value={`$${total.toFixed(2)}`} hint="30-day total" accent />
      </div>

      <section>
        <h2
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-mute, #9b907a)',
            marginBottom: 10,
          }}
        >
          By agent · {scope}
        </h2>
        <div
          style={{
            background: 'var(--surf-1, #0f0d0a)',
            border: '1px solid var(--border-1, #1f1c15)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {ranked.map((a) => (
            <div
              key={a.role}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 100px 80px 80px 1fr',
                gap: 12,
                padding: '8px 14px',
                borderBottom: '1px solid var(--border-1, #1f1c15)',
                fontSize: 12,
                color: 'var(--text-0, #e9e1ce)',
              }}
            >
              <span>{a.display_name ?? a.role}</span>
              <span style={{ color: 'var(--text-mute, #9b907a)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>
                {a.scope_label ?? '—'}
              </span>
              <span style={{ color: 'var(--text-dim, #7d7565)' }}>{a.runs_30d ?? 0} runs</span>
              <span style={{ color: a._cost > 0 ? 'var(--accent, #a8854a)' : 'var(--text-dim, #7d7565)' }}>
                ${a._cost.toFixed(3)}
              </span>
              <span></span>
            </div>
          ))}
        </div>
        {total === 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim, #7d7565)', fontStyle: 'italic' }}>
            No spend in the last 30 days. (Tech-debt #31: agent_runs.agent_id ↔ id_agents.role bridge not built — some costs may not map back to roles.)
          </div>
        )}
      </section>
    </div>
  );
}

function CostTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px solid var(--border-1, #1f1c15)',
        borderRadius: 8,
        padding: '14px 16px',
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-mute, #9b907a)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          marginTop: 4,
          fontFamily: "'Fraunces', Georgia, serif",
          color: accent ? 'var(--accent, #a8854a)' : 'var(--text-0, #e9e1ce)',
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)', marginTop: 2 }}>{hint}</div>
      )}
    </div>
  );
}

function Placeholder({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        padding: 36,
        textAlign: 'center',
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px dashed var(--border-2, #2a261d)',
        borderRadius: 10,
      }}
    >
      <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, color: 'var(--text-0, #e9e1ce)' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-mute, #9b907a)', marginTop: 6 }}>{hint}</div>
    </div>
  );
}

function initials(s: string): string {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
}

function humanTime(iso: string): string {
  const t = new Date(iso).getTime();
  const dt = Date.now() - t;
  if (dt < 60_000) return 'just now';
  if (dt < 3_600_000) return `${Math.round(dt / 60_000)}m ago`;
  if (dt < 86_400_000) return `${Math.round(dt / 3_600_000)}h ago`;
  return `${Math.round(dt / 86_400_000)}d ago`;
}
