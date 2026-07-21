'use client';

// app/cockpit-v2/team/TeamView.tsx
//
// Modernized 2026-07-21 (bugs #38 · #39) — chrome moved to canonical design
// primitives (Container / MetricRow / KpiTile / SubTabStrip typography) on
// paper-white + hairline background. All features preserved:
//   · scope pills (All / Holding / Namkhan / Donna Portals) + counts
//   · dormant toggle
//   · roster / active / dormant / departments strip
//   · org bands (CEO → HODs → workers) with live-blink dot on 60s activity
//   · agent cards deep-link to /cockpit-v2/agent/[role]
//   · per-agent skill chips (top 8 / top 12 on CEO) with +N overflow
//   · run counters (lifetime + 7d)
//
// Design tokens come from `.cockpit-design` scope: --paper, --ink, --hairline,
// --primary, --ink-soft, --sand. Hardcoded #FFFFFF background per token-ladder
// burn rule (var(--paper-warm) resolves dark on Namkhan).

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import type {
  Agent,
  Skill,
  AgentSkill,
  RoleRunStats,
} from '../_lib/types';
import { PROPERTY_NAMKHAN, PROPERTY_DONNA } from '../_lib/types';

type Props = {
  agents: Agent[];
  skills: Skill[];
  agentSkills: AgentSkill[];
  runStats: Record<string, RoleRunStats>;
};

type ScopeKey = 'all' | 'holding' | typeof PROPERTY_NAMKHAN | typeof PROPERTY_DONNA;

const MONO = 'JetBrains Mono, ui-monospace, monospace';

export function TeamView({ agents, skills, agentSkills, runStats }: Props) {
  const [scope, setScope] = useState<ScopeKey>('all');
  const [showDormant, setShowDormant] = useState(false);

  // role -> Skill[]
  const skillsByRole = useMemo(() => {
    const map: Record<string, Skill[]> = {};
    const skillById: Record<number, Skill> = {};
    skills.forEach((s) => (skillById[s.id] = s));
    agentSkills.forEach((as) => {
      if (as.enabled === false) return;
      const sk = skillById[as.skill_id];
      if (!sk) return;
      (map[as.role] = map[as.role] || []).push(sk);
    });
    return map;
  }, [skills, agentSkills]);

  const scoped = useMemo(() => {
    if (scope === 'all') return agents;
    if (scope === 'holding') return agents.filter((a) => a.property_id === null);
    return agents.filter((a) => a.property_id === scope);
  }, [agents, scope]);

  const counts = useMemo(() => ({
    all: agents.length,
    holding: agents.filter((a) => a.property_id === null).length,
    namkhan: agents.filter((a) => a.property_id === PROPERTY_NAMKHAN).length,
    donna: agents.filter((a) => a.property_id === PROPERTY_DONNA).length,
  }), [agents]);

  const groups = useMemo(() => buildGroups(scoped, showDormant), [scoped, showDormant]);

  const stats = useMemo(() => ({
    total: scoped.length,
    active: scoped.filter((a) => a.status === 'active').length,
    dormant: scoped.filter((a) => a.status === 'dormant').length,
    depts: new Set(scoped.map((a) => a.dept).filter(Boolean)).size,
  }), [scoped]);

  const SCOPE_TABS: Array<{ v: ScopeKey; label: string; n: number }> = [
    { v: 'all',              label: 'All scopes',    n: counts.all },
    { v: 'holding',          label: 'Holding',       n: counts.holding },
    { v: PROPERTY_NAMKHAN,   label: 'Namkhan',       n: counts.namkhan },
    { v: PROPERTY_DONNA,     label: 'Donna Portals', n: counts.donna },
  ];

  return (
    <div className="cockpit-design" style={S.shell}>
      {/* Scope sub-strip — SubTabStrip typography (4/8 padding · 12px · 2px underline). */}
      <nav style={S.subTabStrip} role="tablist" aria-label="Roster scope">
        {SCOPE_TABS.map((t) => {
          const active = scope === t.v;
          const style: CSSProperties = { ...S.subTab, ...(active ? S.subTabActive : null) };
          return (
            <button
              key={String(t.v)}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setScope(t.v)}
              style={style}
            >
              {t.label}
              <span style={S.subTabCount}>{t.n}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowDormant((v) => !v)}
          style={S.dormantToggle}
        >
          {showDormant ? 'hide dormant' : 'show dormant'}
        </button>
      </nav>

      {/* Stats strip — canonical MetricRow of 4 KpiTiles. */}
      <MetricRow
        size="sm"
        tiles={[
          { label: 'Roster',      value: stats.total,   footnote: 'agents' },
          { label: 'Active',      value: stats.active,  footnote: 'on shift',        status: 'green' },
          { label: 'Dormant',     value: stats.dormant, footnote: 'awaiting work',   status: stats.dormant > 0 ? 'amber' : 'grey' },
          { label: 'Departments', value: stats.depts,   footnote: 'business units' },
        ]}
      />

      {/* Click hint */}
      <div style={S.hint}>
        click any agent → prompt · skills · memory · audit · deliveries (full debug surface)
      </div>

      {/* Org bands — each band = one Container. */}
      {groups.map((g) => (
        <OrgGroupCard
          key={g.key}
          group={g}
          skillsByRole={skillsByRole}
          runStats={runStats}
        />
      ))}
      {groups.length === 0 && (
        <div style={S.emptyGroups}>— no agents in scope —</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group / org chart layout
// ---------------------------------------------------------------------------

type Group = {
  key: string;
  title: string;
  subtitle: string;
  ceo: Agent | null;
  hods: Agent[];
  workersByHod: Record<string, Agent[]>;
  /** Workers that report directly to the CEO (e.g. general / generalist). */
  ceoDirectWorkers: Agent[];
};

function buildGroups(agents: Agent[], showDormant: boolean): Group[] {
  const holdingAgents = agents.filter((a) => a.property_id === null);
  const namkhanAgents = agents.filter((a) => a.property_id === PROPERTY_NAMKHAN);
  const donnaAgents   = agents.filter((a) => a.property_id === PROPERTY_DONNA);

  const out: Group[] = [];
  const groupBuilders: Array<{
    key: string; title: string; subtitle: string; pool: Agent[]; ceoRole: string;
  }> = [
    { key: 'holding', title: 'Holding',
      subtitle: 'property_id = NULL · platform-wide · Felix · Carla · Vera · Kit',
      pool: holdingAgents, ceoRole: 'lead' },
    { key: 'namkhan', title: 'Namkhan',
      subtitle: 'property_id = 260955 · Luang Prabang · PMS · LAK',
      pool: namkhanAgents, ceoRole: 'hotel_ceo_namkhan' },
    { key: 'donna',   title: 'Donna Portals',
      subtitle: 'property_id = 1000001 · Mallorca · Mews · EUR · onboards ~2w',
      pool: donnaAgents, ceoRole: 'hotel_ceo_donna' },
  ];

  for (const gb of groupBuilders) {
    if (gb.pool.length === 0) continue;
    const ceo =
      gb.pool.find((a) => a.role === gb.ceoRole) ||
      gb.pool.find((a) => a.hierarchy_level === 'ceo') ||
      null;
    let hods = gb.pool.filter((a) => a.hierarchy_level === 'hod');
    if (!showDormant) hods = hods.filter((h) => h.status === 'active');
    hods.sort((a, b) => DEPT_ORDER.indexOf(a.dept || '') - DEPT_ORDER.indexOf(b.dept || ''));

    const workersByHod: Record<string, Agent[]> = {};
    hods.forEach((h) => {
      let workers = gb.pool.filter(
        (a) => a.hierarchy_level === 'worker' && a.reports_to === h.role,
      );
      if (!showDormant) workers = workers.filter((w) => w.status === 'active');
      workersByHod[h.role] = workers;
    });

    let ceoDirect = gb.pool.filter(
      (a) => a.hierarchy_level === 'worker' && a.reports_to === (ceo?.role ?? ''),
    );
    if (!showDormant) ceoDirect = ceoDirect.filter((w) => w.status === 'active');

    out.push({ key: gb.key, title: gb.title, subtitle: gb.subtitle, ceo, hods, workersByHod, ceoDirectWorkers: ceoDirect });
  }
  return out;
}

const DEPT_ORDER = [
  'finance', 'revenue', 'operations', 'marketing',
  'sales', 'it', 'legal', 'general', 'executive', 'system',
];

function OrgGroupCard({
  group,
  skillsByRole,
  runStats,
}: {
  group: Group;
  skillsByRole: Record<string, Skill[]>;
  runStats: Record<string, RoleRunStats>;
}) {
  const { title, subtitle, ceo, hods, workersByHod, ceoDirectWorkers } = group;
  const workerCount = Object.values(workersByHod).reduce((n, w) => n + w.length, 0);
  const summary = `${hods.length} HOD${hods.length === 1 ? '' : 's'} · ${workerCount} worker${workerCount === 1 ? '' : 's'}`;

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Container
        title={title}
        subtitle={subtitle}
        action={<span style={S.groupSummary}>{summary}</span>}
        expandable={false}
      >
        {ceo && (
          <div style={S.ceoRow}>
            <div style={{ width: 'min(560px, 100%)' }}>
              <AgentCard
                agent={ceo}
                size="ceo"
                skills={skillsByRole[ceo.role] || []}
                runs={runStats[ceo.role] || null}
              />
            </div>
          </div>
        )}

        {ceoDirectWorkers.length > 0 && (
          <div style={S.ceoDirectGrid}>
            {ceoDirectWorkers.map((w) => (
              <AgentCard
                key={w.role}
                agent={w}
                size="worker"
                skills={skillsByRole[w.role] || []}
                runs={runStats[w.role] || null}
              />
            ))}
          </div>
        )}

        {hods.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(hods.length, 5)}, minmax(0, 1fr))`,
              gap: 16,
            }}
          >
            {hods.map((h) => (
              <div key={h.role} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <AgentCard
                  agent={h}
                  size="hod"
                  skills={skillsByRole[h.role] || []}
                  runs={runStats[h.role] || null}
                />
                <div style={S.workerStack}>
                  {(workersByHod[h.role] || []).map((w) => (
                    <AgentCard
                      key={w.role}
                      agent={w}
                      size="worker"
                      skills={skillsByRole[w.role] || []}
                      runs={runStats[w.role] || null}
                    />
                  ))}
                  {(workersByHod[h.role] || []).length === 0 && (
                    <div style={S.workerEmpty}>—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent card — clickable Link to /cockpit-v2/agent/[role]
// ---------------------------------------------------------------------------

function AgentCard({
  agent, size, skills, runs,
}: {
  agent: Agent;
  size: 'ceo' | 'hod' | 'worker';
  skills: Skill[];
  runs: RoleRunStats | null;
}) {
  const isCeo = size === 'ceo';
  const isHod = size === 'hod';
  const dormant = agent.status === 'dormant';
  const liveNow = !!runs?.latest && Date.now() - new Date(runs.latest).getTime() < 60_000;

  const avatarSize = isCeo ? 56 : isHod ? 44 : 36;
  const titleSize  = isCeo ? 18 : isHod ? 15 : 14;
  const cardStyle: CSSProperties = {
    ...S.card,
    padding: isCeo ? '16px 18px' : '10px 12px',
    borderColor: isCeo ? 'var(--primary, #1F3A2E)' : 'var(--hairline, #E6DFCC)',
    opacity: dormant ? 0.55 : 1,
  };

  return (
    <Link
      href={`/cockpit-v2/agent/${encodeURIComponent(agent.role)}`}
      style={cardStyle}
    >
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: avatarSize * 0.55,
          background: '#F4EFE2',
          borderRadius: '50%',
          flexShrink: 0,
        }}
      >
        {agent.avatar || '🤖'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.cardTitleRow}>
          <span style={{ fontSize: titleSize, fontWeight: 600, color: 'var(--ink, #1B1B1B)' }}>
            {agent.display_name || agent.role}
          </span>
          <RolePill>
            {isCeo ? (agent.scope === 'holding' ? 'CEO · holding' : 'Hotel CEO') : isHod ? 'HOD' : 'Worker'}
          </RolePill>
          {agent.dept && <RolePill muted>{agent.dept}</RolePill>}
          {agent.status && <StatusDot status={agent.status} blinking={liveNow} />}
        </div>
        {agent.tagline && (
          <div style={S.cardTagline}>{agent.tagline}</div>
        )}

        {skills.length > 0 && (
          <div style={S.skillChipRow}>
            {skills.slice(0, isCeo ? 12 : 8).map((s) => (
              <span key={s.id} title={s.description || s.name} style={S.skillChip}>
                {s.name}
              </span>
            ))}
            {skills.length > (isCeo ? 12 : 8) && (
              <span style={S.skillOverflow}>
                +{skills.length - (isCeo ? 12 : 8)} more
              </span>
            )}
          </div>
        )}

        <div style={S.cardMeta}>
          <span>role={agent.role}</span>
          <span>
            runs · lifetime <span style={S.metaAccent}>{runs?.lifetime ?? 0}</span>
            {' · '}7d <span style={S.metaAccent}>{runs?.last_7d ?? 0}</span>
          </span>
        </div>
      </div>

      <span style={S.deepLink}>debug →</span>
    </Link>
  );
}

function RolePill({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        fontFamily: MONO,
        color: muted ? 'var(--ink-soft, #5A5A5A)' : 'var(--primary, #1F3A2E)',
        background: '#F4EFE2',
        border: '1px solid var(--hairline, #E6DFCC)',
      }}
    >
      {children}
    </span>
  );
}

function StatusDot({ status, blinking = false }: { status: string; blinking?: boolean }) {
  const map: Record<string, string> = {
    active: '#2E7D32', dormant: '#B8A878', disabled: '#8A8A8A',
    new: '#B8542A', triaged: '#B8A878', working: '#1F3A2E',
    staged: '#B8A878', deployed: '#2E7D32', completed: '#2E7D32',
    error: '#B8542A', critical: '#B8542A',
  };
  const color = map[status] || '#8A8A8A';
  return (
    <>
      <style>{`@keyframes cockpitv2blink{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
      <span
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          marginLeft: 4,
          boxShadow: blinking || status === 'active' ? `0 0 0 3px ${color}22` : 'none',
          animation: blinking ? 'cockpitv2blink 1.4s ease-in-out infinite' : undefined,
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S: Record<string, CSSProperties> = {
  shell: {
    background: '#FFFFFF',
    color: 'var(--ink, #1B1B1B)',
    padding: 16,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    fontFamily: 'var(--sans, "Inter Tight", system-ui, sans-serif)',
  },
  // SubTabStrip typography (canonical: 4/8 pad · 12px · gap 8 · 2px underline)
  subTabStrip: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid #E6DFCC',
    paddingBottom: 0,
  },
  subTab: {
    background: 'transparent',
    border: 'none',
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  subTabActive: {
    color: 'var(--ink, #1B1B1B)',
    borderBottomColor: 'var(--primary, #1F3A2E)',
    fontWeight: 600,
  },
  subTabCount: {
    fontSize: 11,
    color: 'var(--ink-soft, #5A5A5A)',
    background: '#F4EFE2',
    borderRadius: 99,
    padding: '0 6px',
    fontWeight: 500,
  },
  dormantToggle: {
    marginLeft: 'auto',
    background: 'transparent',
    border: '1px solid #E6DFCC',
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 11,
    fontFamily: MONO,
    letterSpacing: 0.4,
    color: 'var(--ink-soft, #5A5A5A)',
    cursor: 'pointer',
  },
  hint: {
    fontFamily: MONO,
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    letterSpacing: '0.06em',
    marginTop: -4,
  },
  emptyGroups: {
    color: 'var(--ink-soft, #5A5A5A)',
    fontSize: 13,
    padding: 24,
    textAlign: 'center',
    border: '1px dashed #E6DFCC',
    borderRadius: 6,
  },
  groupSummary: {
    fontSize: 11,
    color: 'var(--ink-soft, #5A5A5A)',
    fontFamily: MONO,
  },
  ceoRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ceoDirectGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12,
    marginBottom: 20,
  },
  workerStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    borderLeft: '1px dashed #E6DFCC',
    paddingLeft: 10,
    marginLeft: 6,
  },
  workerEmpty: {
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    fontStyle: 'italic',
    fontFamily: MONO,
  },
  card: {
    textDecoration: 'none',
    display: 'flex',
    gap: 12,
    background: '#FFFFFF',
    border: '1px solid #E6DFCC',
    borderRadius: 6,
    width: '100%',
    cursor: 'pointer',
    color: 'var(--ink, #1B1B1B)',
    position: 'relative',
    alignItems: 'flex-start',
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
  },
  cardTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  cardTagline: {
    fontSize: 12,
    color: 'var(--ink-soft, #5A5A5A)',
    lineHeight: 1.45,
    marginBottom: 6,
  },
  skillChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  skillChip: {
    fontSize: 10,
    padding: '2px 6px',
    border: '1px solid #E6DFCC',
    borderRadius: 3,
    color: 'var(--ink-soft, #5A5A5A)',
    fontFamily: MONO,
    background: '#FBF8EF',
  },
  skillOverflow: {
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    fontFamily: MONO,
    alignSelf: 'center',
  },
  cardMeta: {
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    fontFamily: MONO,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  metaAccent: { color: 'var(--ink, #1B1B1B)' },
  deepLink: {
    position: 'absolute',
    top: 6,
    right: 10,
    fontFamily: MONO,
    fontSize: 10,
    color: 'var(--ink-soft, #5A5A5A)',
    letterSpacing: '0.08em',
  },
};
