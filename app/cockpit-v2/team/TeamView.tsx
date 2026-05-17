'use client';

// app/cockpit-v2/team/TeamView.tsx
// Client interactivity for the Team tab: property-scope filter pills,
// "show dormant" toggle, agent click → archive drawer (cap_skill_calls
// for that role, fetched via /api/cockpit-v2/archive).

import { useMemo, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { Pill, StatusDot } from '../_components/Pill';
import type {
  Agent,
  Skill,
  AgentSkill,
  SkillCall,
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

export function TeamView({ agents, skills, agentSkills, runStats }: Props) {
  const [scope, setScope] = useState<ScopeKey>('all');
  const [showDormant, setShowDormant] = useState(false);
  const [openArchiveRole, setOpenArchiveRole] = useState<string | null>(null);

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

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: agents.length,
      holding: agents.filter((a) => a.property_id === null).length,
      namkhan: agents.filter((a) => a.property_id === PROPERTY_NAMKHAN).length,
      donna: agents.filter((a) => a.property_id === PROPERTY_DONNA).length,
    };
  }, [agents]);

  const groups = useMemo(() => buildGroups(scoped, showDormant), [scoped, showDormant]);

  const stats = useMemo(() => {
    return {
      total: scoped.length,
      active: scoped.filter((a) => a.status === 'active').length,
      dormant: scoped.filter((a) => a.status === 'dormant').length,
      depts: new Set(scoped.map((a) => a.dept).filter(Boolean)).size,
    };
  }, [scoped]);

  return (
    <div>
      {/* Scope pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(
          [
            { v: 'all' as ScopeKey, label: 'All scopes', n: counts.all },
            { v: 'holding' as ScopeKey, label: 'Holding', n: counts.holding },
            { v: PROPERTY_NAMKHAN as ScopeKey, label: 'Namkhan', n: counts.namkhan },
            { v: PROPERTY_DONNA as ScopeKey, label: 'Donna Portals', n: counts.donna },
          ]
        ).map((t) => {
          const active = scope === t.v;
          return (
            <button
              key={String(t.v)}
              onClick={() => setScope(t.v)}
              style={{
                padding: '8px 14px',
                border: `1px solid ${active ? TOKENS.ink : TOKENS.border}`,
                background: active ? TOKENS.ink : 'transparent',
                color: active ? TOKENS.bg : TOKENS.text,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 0.2,
                cursor: 'pointer',
                borderRadius: 2,
                fontFamily: SERIF,
              }}
            >
              {t.label}{' '}
              <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7, marginLeft: 4 }}>{t.n}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowDormant((v) => !v)}
          style={{
            padding: '8px 14px',
            border: `1px solid ${TOKENS.border}`,
            background: 'transparent',
            color: TOKENS.text2,
            fontSize: 12,
            cursor: 'pointer',
            borderRadius: 2,
            fontFamily: MONO,
            letterSpacing: 0.4,
            marginLeft: 'auto',
          }}
        >
          {showDormant ? 'hide dormant' : 'show dormant'}
        </button>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          border: `1px solid ${TOKENS.border}`,
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Roster', v: stats.total, sub: 'agents' },
          { label: 'Active', v: stats.active, sub: 'on shift' },
          { label: 'Dormant', v: stats.dormant, sub: 'awaiting work' },
          { label: 'Departments', v: stats.depts, sub: 'business units' },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              padding: '14px 18px',
              borderRight: i < 3 ? `1px solid ${TOKENS.borderSoft}` : 'none',
              background: TOKENS.bgRaised,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: TOKENS.text3,
                marginBottom: 4,
                fontFamily: MONO,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: 28,
                fontFamily: SERIF,
                fontWeight: 500,
                color: TOKENS.ink,
                lineHeight: 1,
              }}
            >
              {s.v}
            </div>
            <div style={{ fontSize: 11, color: TOKENS.text2, marginTop: 4, fontStyle: 'italic' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Org groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map((g) => (
          <OrgGroup
            key={g.key}
            group={g}
            skillsByRole={skillsByRole}
            runStats={runStats}
            onOpenArchive={(role) => setOpenArchiveRole(role)}
          />
        ))}
        {groups.length === 0 && (
          <div style={{ color: TOKENS.text3, fontSize: 13, padding: 24, textAlign: 'center' }}>
            — no agents in scope —
          </div>
        )}
      </div>

      {openArchiveRole && (
        <ArchiveDrawer
          role={openArchiveRole}
          agent={agents.find((a) => a.role === openArchiveRole) || null}
          onClose={() => setOpenArchiveRole(null)}
        />
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
  // Holding always anchored on Felix (role=lead)
  const holdingAgents = agents.filter((a) => a.property_id === null);
  const namkhanAgents = agents.filter((a) => a.property_id === PROPERTY_NAMKHAN);
  const donnaAgents = agents.filter((a) => a.property_id === PROPERTY_DONNA);

  const out: Group[] = [];
  const groupBuilders: Array<{ key: string; title: string; subtitle: string; pool: Agent[]; ceoRole: string }> = [
    { key: 'holding', title: 'HOLDING', subtitle: 'property_id = NULL · platform-wide', pool: holdingAgents, ceoRole: 'lead' },
    { key: 'namkhan', title: 'NAMKHAN', subtitle: 'property_id = 260955 · Luang Prabang · PMS · LAK', pool: namkhanAgents, ceoRole: 'hotel_ceo_namkhan' },
    { key: 'donna', title: 'DONNA PORTALS', subtitle: 'property_id = 1000001 · Mallorca · Mews · EUR · onboards ~2w', pool: donnaAgents, ceoRole: 'hotel_ceo_donna' },
  ];

  for (const gb of groupBuilders) {
    if (gb.pool.length === 0) continue;
    const ceo = gb.pool.find((a) => a.role === gb.ceoRole) || gb.pool.find((a) => a.hierarchy_level === 'ceo') || null;
    let hods = gb.pool.filter((a) => a.hierarchy_level === 'hod');
    if (!showDormant) hods = hods.filter((h) => h.status === 'active');
    hods.sort((a, b) => DEPT_ORDER.indexOf(a.dept || '') - DEPT_ORDER.indexOf(b.dept || ''));

    const workersByHod: Record<string, Agent[]> = {};
    hods.forEach((h) => {
      let workers = gb.pool.filter((a) => a.hierarchy_level === 'worker' && a.reports_to === h.role);
      if (!showDormant) workers = workers.filter((w) => w.status === 'active');
      workersByHod[h.role] = workers;
    });

    let ceoDirect = gb.pool.filter((a) => a.hierarchy_level === 'worker' && a.reports_to === (ceo?.role ?? ''));
    if (!showDormant) ceoDirect = ceoDirect.filter((w) => w.status === 'active');

    out.push({ key: gb.key, title: gb.title, subtitle: gb.subtitle, ceo, hods, workersByHod, ceoDirectWorkers: ceoDirect });
  }
  return out;
}

const DEPT_ORDER = ['finance', 'revenue', 'operations', 'marketing', 'sales', 'it', 'general', 'executive'];

function OrgGroup({
  group,
  skillsByRole,
  runStats,
  onOpenArchive,
}: {
  group: Group;
  skillsByRole: Record<string, Skill[]>;
  runStats: Record<string, RoleRunStats>;
  onOpenArchive: (role: string) => void;
}) {
  const { title, subtitle, ceo, hods, workersByHod, ceoDirectWorkers } = group;
  return (
    <section style={{ border: `1px solid ${TOKENS.border}`, background: TOKENS.bgRaised }}>
      <header
        style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${TOKENS.borderSoft}`,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontFamily: SERIF, fontWeight: 600, color: TOKENS.ink, letterSpacing: 0.5 }}>{title}</div>
          <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: MONO, marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 11, color: TOKENS.text3, fontFamily: MONO }}>
          {hods.length} HOD{hods.length === 1 ? '' : 's'} · {Object.values(workersByHod).reduce((n, w) => n + w.length, 0)} worker
          {Object.values(workersByHod).reduce((n, w) => n + w.length, 0) === 1 ? '' : 's'}
        </div>
      </header>

      <div style={{ padding: 20 }}>
        {ceo && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ width: 'min(520px, 100%)' }}>
              <AgentCard
                agent={ceo}
                size="ceo"
                skills={skillsByRole[ceo.role] || []}
                runs={runStats[ceo.role] || null}
                onClick={() => onOpenArchive(ceo.role)}
              />
            </div>
          </div>
        )}

        {/* CEO direct workers (e.g. general / generalist) — rendered as a thin row */}
        {ceoDirectWorkers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
            {ceoDirectWorkers.map((w) => (
              <AgentCard
                key={w.role}
                agent={w}
                size="worker"
                skills={skillsByRole[w.role] || []}
                runs={runStats[w.role] || null}
                onClick={() => onOpenArchive(w.role)}
              />
            ))}
          </div>
        )}

        {/* HOD row + workers underneath each */}
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
                  onClick={() => onOpenArchive(h.role)}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `1px dashed ${TOKENS.borderSoft}`, paddingLeft: 10, marginLeft: 6 }}>
                  {(workersByHod[h.role] || []).map((w) => (
                    <AgentCard
                      key={w.role}
                      agent={w}
                      size="worker"
                      skills={skillsByRole[w.role] || []}
                      runs={runStats[w.role] || null}
                      onClick={() => onOpenArchive(w.role)}
                    />
                  ))}
                  {(workersByHod[h.role] || []).length === 0 && (
                    <div style={{ fontSize: 10, color: TOKENS.text3, fontStyle: 'italic', fontFamily: MONO }}>—</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({
  agent,
  size,
  skills,
  runs,
  onClick,
}: {
  agent: Agent;
  size: 'ceo' | 'hod' | 'worker';
  skills: Skill[];
  runs: RoleRunStats | null;
  onClick: () => void;
}) {
  const isCeo = size === 'ceo';
  const isHod = size === 'hod';
  const dormant = agent.status === 'dormant';

  // Blink when last activity was within 60s
  const liveNow = !!runs?.latest && Date.now() - new Date(runs.latest).getTime() < 60_000;

  const avatarSize = isCeo ? 56 : isHod ? 44 : 36;
  const titleSize = isCeo ? 18 : isHod ? 15 : 14;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        display: 'flex',
        gap: 12,
        padding: isCeo ? '16px 18px' : '10px 12px',
        background: TOKENS.bg,
        border: `1px solid ${isCeo ? TOKENS.brass : TOKENS.borderSoft}`,
        borderRadius: 2,
        opacity: dormant ? 0.55 : 1,
        width: '100%',
        cursor: 'pointer',
        color: TOKENS.text,
        position: 'relative',
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: avatarSize * 0.55,
          background: TOKENS.bgDeep,
          borderRadius: '50%',
          flexShrink: 0,
        }}
      >
        {agent.avatar || '🤖'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: titleSize, fontWeight: 600, color: TOKENS.ink, fontFamily: SERIF }}>
            {agent.display_name || agent.role}
          </span>
          <Pill>{isCeo ? (agent.scope === 'holding' ? 'CEO · holding' : 'Hotel CEO') : isHod ? 'HOD' : 'Worker'}</Pill>
          {agent.dept && <Pill color={TOKENS.text3}>{agent.dept}</Pill>}
          {agent.status && <StatusDot status={agent.status} blinking={liveNow} />}
        </div>
        {agent.tagline && (
          <div style={{ fontSize: 12, color: TOKENS.text2, lineHeight: 1.45, marginBottom: 6 }}>{agent.tagline}</div>
        )}

        {/* Skill list */}
        {skills.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {skills.slice(0, isCeo ? 12 : 8).map((s) => (
              <span
                key={s.id}
                title={s.description || s.name}
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  border: `1px solid ${TOKENS.borderSoft}`,
                  borderRadius: 2,
                  color: TOKENS.text2,
                  fontFamily: MONO,
                  background: TOKENS.bgDeep,
                }}
              >
                {s.name}
              </span>
            ))}
            {skills.length > (isCeo ? 12 : 8) && (
              <span style={{ fontSize: 10, color: TOKENS.text3, fontFamily: MONO, alignSelf: 'center' }}>
                +{skills.length - (isCeo ? 12 : 8)} more
              </span>
            )}
          </div>
        )}

        {/* Footer: role + runs */}
        <div
          style={{
            fontSize: 10,
            color: TOKENS.text3,
            fontFamily: MONO,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 8,
            alignItems: 'baseline',
            flexWrap: 'wrap',
          }}
        >
          <span>role={agent.role}</span>
          <span>
            runs · lifetime <span style={{ color: TOKENS.text2 }}>{runs?.lifetime ?? 0}</span> · 7d{' '}
            <span style={{ color: TOKENS.text2 }}>{runs?.last_7d ?? 0}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Archive drawer
// ---------------------------------------------------------------------------

function ArchiveDrawer({ role, agent, onClose }: { role: string; agent: Agent | null; onClose: () => void }) {
  const [rows, setRows] = useState<SkillCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lazy load on open
  useMemo(() => {
    fetch(`/api/cockpit-v2/skill-calls?role=${encodeURIComponent(role)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => setRows(j.rows || []))
      .catch((e) => setError(String(e)));
  }, [role]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 96vw)',
          height: '100%',
          background: TOKENS.bgRaised,
          borderLeft: `1px solid ${TOKENS.border}`,
          overflowY: 'auto',
          padding: 24,
          color: TOKENS.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink }}>
              {agent?.display_name || role} <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.text3 }}>· archive</span>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
              cockpit.cap_skill_calls · last 50 rows
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: TOKENS.text2,
              border: `1px solid ${TOKENS.border}`,
              padding: '4px 10px',
              cursor: 'pointer',
              borderRadius: 2,
              fontFamily: MONO,
              fontSize: 12,
            }}
          >
            close
          </button>
        </div>

        {error && (
          <div style={{ color: TOKENS.terracotta, fontSize: 12, marginBottom: 12 }}>archive fetch failed: {error}</div>
        )}
        {!rows && !error && <div style={{ color: TOKENS.text3, fontSize: 12 }}>loading —</div>}
        {rows && rows.length === 0 && (
          <div style={{ color: TOKENS.text3, fontSize: 12, fontStyle: 'italic' }}>no recorded calls for this agent</div>
        )}

        {rows && rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  border: `1px solid ${TOKENS.borderSoft}`,
                  background: TOKENS.bg,
                  padding: 10,
                  borderRadius: 2,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <StatusDot status={r.status || 'normal'} />
                    <span style={{ fontFamily: MONO, fontSize: 12, color: TOKENS.text }}>{r.skill_name || `skill_id=${r.skill_id ?? '?'}`}</span>
                    {r.was_dry_run && <Pill color={TOKENS.ochre}>dry run</Pill>}
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 10, color: TOKENS.text3, fontFamily: MONO, marginTop: 4 }}>
                  <span>duration {r.duration_ms ?? '—'}ms</span>
                  <span>
                    cost ${r.cost_usd_milli != null ? (r.cost_usd_milli / 1000).toFixed(3) : '—'}
                  </span>
                  {r.ticket_id != null && <span>ticket #{r.ticket_id}</span>}
                </div>
                {(r.input || r.output || r.error) && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 10, color: TOKENS.text3, fontFamily: MONO }}>payload</summary>
                    <pre
                      style={{
                        background: TOKENS.bgDeep,
                        border: `1px solid ${TOKENS.borderSoft}`,
                        padding: 8,
                        borderRadius: 2,
                        fontSize: 11,
                        overflowX: 'auto',
                        marginTop: 6,
                        color: TOKENS.text,
                        fontFamily: MONO,
                      }}
                    >
{JSON.stringify({ input: r.input, output: r.output, error: r.error }, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
