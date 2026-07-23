'use client';

// app/holding/it/cockpit/knowledge/KnowledgeView.tsx
// Client interaction for the Knowledge tab. Renders four levels:
//   L1 Holding — memories with property_id IS NULL + holding-level agents
//   L2 Property — Namkhan OR Donna (toggle, never blended)
//   L3 Department — collapsed view of memories + prompts per dept inside a property
//   L4 Agent — drill-in: full active prompt + memories for one agent
//
// "Edit prompt" opens a modal with the current cap_prompts.prompt for the
// role. Save sends to /api/holding/it/cockpit/prompt with dry_run=true first; the
// preview shows the diff; only an explicit Publish button posts dry_run=false.

import { useMemo, useState } from 'react';
import { TOKENS, SERIF, MONO } from '../_components/tokens';
import { Pill, StatusDot } from '../_components/Pill';
import type { Agent, AgentMemory, Prompt } from '../_lib/types';
import { PROPERTY_NAMKHAN, PROPERTY_DONNA } from '../_lib/types';

type Level = 'L1' | 'L2' | 'L3' | 'L4';

export function KnowledgeView({
  agents,
  memories,
  prompts,
}: {
  agents: Agent[];
  memories: AgentMemory[];
  prompts: Prompt[];
}) {
  const [level, setLevel] = useState<Level>('L1');
  const [property, setProperty] = useState<typeof PROPERTY_NAMKHAN | typeof PROPERTY_DONNA>(PROPERTY_NAMKHAN);
  const [dept, setDept] = useState<string | null>(null);
  const [agentRole, setAgentRole] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const promptByRole = useMemo(() => {
    const m: Record<string, Prompt> = {};
    prompts.forEach((p) => {
      if (!m[p.role] || (m[p.role].version ?? 0) < (p.version ?? 0)) m[p.role] = p;
    });
    return m;
  }, [prompts]);

  // L1 — Holding
  const l1Agents = useMemo(() => agents.filter((a) => a.property_id === null), [agents]);
  const l1Memories = useMemo(
    () => memories.filter((m) => m.property_id === null),
    [memories],
  );

  // L2 — Property (strict isolation)
  const l2Agents = useMemo(() => agents.filter((a) => a.property_id === property), [agents, property]);
  const l2Memories = useMemo(
    () => memories.filter((m) => m.property_id === property),
    [memories, property],
  );

  // L3 — Department within property
  const departments = useMemo(() => {
    const set = new Set<string>();
    l2Agents.forEach((a) => a.dept && set.add(a.dept));
    return Array.from(set).sort();
  }, [l2Agents]);

  const l3Agents = useMemo(() => l2Agents.filter((a) => a.dept === dept), [l2Agents, dept]);
  const l3Memories = useMemo(
    () => l2Memories.filter((m) => l3Agents.some((a) => a.role === m.agent_handle)),
    [l2Memories, l3Agents],
  );

  // L4 — Single agent
  const l4Agent = useMemo(() => agents.find((a) => a.role === agentRole) || null, [agents, agentRole]);
  const l4Memories = useMemo(
    () => memories.filter((m) => m.agent_handle === agentRole),
    [memories, agentRole],
  );

  return (
    <div>
      {/* Level switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['L1', 'L2', 'L3', 'L4'] as Level[]).map((lv) => {
          const labels: Record<Level, string> = {
            L1: 'L1 · Holding',
            L2: 'L2 · Property',
            L3: 'L3 · Department',
            L4: 'L4 · Agent',
          };
          const active = level === lv;
          return (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              style={{
                padding: '8px 14px',
                border: `1px solid ${active ? TOKENS.ink : TOKENS.border}`,
                background: active ? TOKENS.ink : 'transparent',
                color: active ? TOKENS.bg : TOKENS.text,
                fontSize: 13,
                cursor: 'pointer',
                borderRadius: 2,
                fontFamily: SERIF,
              }}
            >
              {labels[lv]}
            </button>
          );
        })}

        {(level === 'L2' || level === 'L3' || level === 'L4') && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 14 }}>
            {[
              { v: PROPERTY_NAMKHAN, label: 'Namkhan' },
              { v: PROPERTY_DONNA, label: 'Donna' },
            ].map((p) => {
              const active = property === p.v;
              return (
                <button
                  key={p.v}
                  onClick={() => {
                    setProperty(p.v as typeof PROPERTY_NAMKHAN);
                    setDept(null);
                    setAgentRole(null);
                  }}
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${active ? TOKENS.brass : TOKENS.border}`,
                    background: active ? `${TOKENS.brass}22` : 'transparent',
                    color: active ? TOKENS.ink : TOKENS.text2,
                    fontSize: 12,
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontFamily: MONO,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Body */}
      {level === 'L1' && (
        <Tier
          title="L1 — Holding knowledge"
          subtitle="Cross-property memory · only Felix + IT team contribute · property_id IS NULL"
          agents={l1Agents}
          memories={l1Memories}
          promptByRole={promptByRole}
          onEditPrompt={setEditingRole}
          onDrillAgent={(r) => {
            setAgentRole(r);
            setLevel('L4');
          }}
        />
      )}
      {level === 'L2' && (
        <Tier
          title={`L2 — ${property === PROPERTY_NAMKHAN ? 'Namkhan' : 'Donna Portals'} knowledge`}
          subtitle={`property_id = ${property} · NEVER blended with the other property`}
          agents={l2Agents}
          memories={l2Memories}
          promptByRole={promptByRole}
          onEditPrompt={setEditingRole}
          onDrillAgent={(r) => {
            setAgentRole(r);
            setLevel('L4');
          }}
        />
      )}
      {level === 'L3' && (
        <div>
          {!dept && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setDept(d)}
                  style={{
                    padding: '10px 14px',
                    background: TOKENS.bgRaised,
                    color: TOKENS.text,
                    border: `1px solid ${TOKENS.border}`,
                    fontFamily: SERIF,
                    fontSize: 14,
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  {d}
                </button>
              ))}
              {departments.length === 0 && <div style={{ color: TOKENS.text3 }}>— no departments —</div>}
            </div>
          )}
          {dept && (
            <Tier
              title={`L3 — ${dept} @ ${property === PROPERTY_NAMKHAN ? 'Namkhan' : 'Donna'}`}
              subtitle={`Department-scoped memory and prompts`}
              agents={l3Agents}
              memories={l3Memories}
              promptByRole={promptByRole}
              onEditPrompt={setEditingRole}
              onDrillAgent={(r) => {
                setAgentRole(r);
                setLevel('L4');
              }}
              backLabel="← back to departments"
              onBack={() => setDept(null)}
            />
          )}
        </div>
      )}
      {level === 'L4' && l4Agent && (
        <AgentDrill
          agent={l4Agent}
          memories={l4Memories}
          prompt={promptByRole[l4Agent.role] || null}
          onEditPrompt={() => setEditingRole(l4Agent.role)}
          onBack={() => setAgentRole(null)}
        />
      )}
      {level === 'L4' && !l4Agent && (
        <div style={{ color: TOKENS.text3, fontStyle: 'italic' }}>Pick an agent from L2 or L3 first.</div>
      )}

      {editingRole && (
        <PromptEditor
          role={editingRole}
          currentPrompt={promptByRole[editingRole] || null}
          onClose={() => setEditingRole(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tier renderer (shared by L1/L2/L3)
// ---------------------------------------------------------------------------

function Tier({
  title,
  subtitle,
  agents,
  memories,
  promptByRole,
  onEditPrompt,
  onDrillAgent,
  backLabel,
  onBack,
}: {
  title: string;
  subtitle: string;
  agents: Agent[];
  memories: AgentMemory[];
  promptByRole: Record<string, Prompt>;
  onEditPrompt: (role: string) => void;
  onDrillAgent: (role: string) => void;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        {onBack && backLabel && (
          <button
            onClick={onBack}
            style={{
              background: 'transparent',
              color: TOKENS.text2,
              border: 'none',
              cursor: 'pointer',
              fontFamily: MONO,
              fontSize: 11,
              marginBottom: 6,
              padding: 0,
            }}
          >
            {backLabel}
          </button>
        )}
        <div style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink, fontWeight: 600 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>{subtitle}</div>
      </header>

      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: TOKENS.text3,
            marginBottom: 8,
          }}
        >
          Agents · {agents.length}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
          {agents.map((a) => (
            <div
              key={a.role}
              style={{
                border: `1px solid ${TOKENS.borderSoft}`,
                background: TOKENS.bgRaised,
                padding: 12,
                borderRadius: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{a.avatar || '🤖'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontFamily: SERIF, fontWeight: 600, color: TOKENS.ink }}>{a.display_name}</div>
                  <div style={{ fontSize: 10, color: TOKENS.text3, fontFamily: MONO }}>{a.role}</div>
                </div>
                <StatusDot status={a.status || 'normal'} />
              </div>
              {a.tagline && (
                <div style={{ fontSize: 11, color: TOKENS.text2, lineHeight: 1.45 }}>{a.tagline}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
                {promptByRole[a.role] && (
                  <span style={{ fontSize: 10, color: TOKENS.text3, fontFamily: MONO }}>
                    prompt v{promptByRole[a.role].version}
                  </span>
                )}
                <button
                  onClick={() => onEditPrompt(a.role)}
                  style={{
                    background: 'transparent',
                    color: TOKENS.brass,
                    border: `1px solid ${TOKENS.brass}55`,
                    fontFamily: MONO,
                    fontSize: 10,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  Edit prompt
                </button>
                <button
                  onClick={() => onDrillAgent(a.role)}
                  style={{
                    background: 'transparent',
                    color: TOKENS.text2,
                    border: `1px solid ${TOKENS.borderSoft}`,
                    fontFamily: MONO,
                    fontSize: 10,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    borderRadius: 2,
                  }}
                >
                  Drill → L4
                </button>
              </div>
            </div>
          ))}
          {agents.length === 0 && <div style={{ color: TOKENS.text3, fontSize: 12 }}>— none —</div>}
        </div>
      </section>

      <section>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: TOKENS.text3,
            marginBottom: 8,
          }}
        >
          Memory · {memories.length} active
        </div>
        <MemoryList items={memories} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent drill view (L4)
// ---------------------------------------------------------------------------

function AgentDrill({
  agent,
  memories,
  prompt,
  onEditPrompt,
  onBack,
}: {
  agent: Agent;
  memories: AgentMemory[];
  prompt: Prompt | null;
  onEditPrompt: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'transparent',
          color: TOKENS.text2,
          border: 'none',
          cursor: 'pointer',
          fontFamily: MONO,
          fontSize: 11,
          marginBottom: 8,
          padding: 0,
        }}
      >
        ← back
      </button>
      <header style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            background: TOKENS.bgDeep,
            borderRadius: '50%',
          }}
        >
          {agent.avatar || '🤖'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 26, color: TOKENS.ink, margin: 0 }}>{agent.display_name}</h2>
            <Pill>{agent.hierarchy_level || ''}</Pill>
            <Pill color={TOKENS.text3}>{agent.dept || ''}</Pill>
          </div>
          {agent.tagline && <div style={{ fontSize: 13, color: TOKENS.text2, marginTop: 4 }}>{agent.tagline}</div>}
          <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 4 }}>
            role={agent.role} · property_id={agent.property_id ?? 'NULL'} · status={agent.status}
          </div>
        </div>
      </header>

      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              color: TOKENS.text3,
            }}
          >
            Active prompt {prompt ? `· v${prompt.version}` : ''}
          </div>
          <button
            onClick={onEditPrompt}
            style={{
              background: 'transparent',
              color: TOKENS.brass,
              border: `1px solid ${TOKENS.brass}55`,
              fontFamily: MONO,
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
              borderRadius: 2,
            }}
          >
            Edit prompt
          </button>
        </div>
        <pre
          style={{
            background: TOKENS.bgRaised,
            border: `1px solid ${TOKENS.border}`,
            padding: 14,
            borderRadius: 2,
            fontSize: 12,
            lineHeight: 1.55,
            color: TOKENS.text,
            fontFamily: MONO,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 460,
            overflow: 'auto',
          }}
        >
{prompt ? prompt.prompt : '— no active prompt row for this role —'}
        </pre>
      </section>

      <section>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: TOKENS.text3,
            marginBottom: 8,
          }}
        >
          Agent memory · {memories.length} active
        </div>
        <MemoryList items={memories} />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Memory list
// ---------------------------------------------------------------------------

function MemoryList({ items }: { items: AgentMemory[] }) {
  if (items.length === 0)
    return <div style={{ color: TOKENS.text3, fontSize: 12, fontStyle: 'italic' }}>— no memory rows —</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.slice(0, 80).map((m) => (
        <div
          key={m.id}
          style={{
            border: `1px solid ${TOKENS.borderSoft}`,
            background: TOKENS.bgRaised,
            padding: 10,
            borderRadius: 2,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <Pill color={TOKENS.brass}>imp {m.importance ?? '—'}</Pill>
            {m.memory_type && <Pill>{m.memory_type}</Pill>}
            <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3 }}>@{m.agent_handle}</span>
            {m.updated_at && (
              <span style={{ fontFamily: MONO, fontSize: 10, color: TOKENS.text3, marginLeft: 'auto' }}>
                {new Date(m.updated_at).toLocaleString()}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: TOKENS.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.content}</div>
        </div>
      ))}
      {items.length > 80 && (
        <div style={{ color: TOKENS.text3, fontSize: 11, fontFamily: MONO, fontStyle: 'italic' }}>
          + {items.length - 80} more (cap at 80 for performance)
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prompt editor (dry-run preview required before publish)
// ---------------------------------------------------------------------------

function PromptEditor({
  role,
  currentPrompt,
  onClose,
}: {
  role: string;
  currentPrompt: Prompt | null;
  onClose: () => void;
}) {
  const [text, setText] = useState(currentPrompt?.prompt ?? '');
  const [notes, setNotes] = useState('');
  const [phase, setPhase] = useState<'edit' | 'preview' | 'published' | 'error'>('edit');
  const [previewMsg, setPreviewMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function preview() {
    setErr(null);
    setPreviewMsg(null);
    try {
      const r = await fetch('/api/holding/it/cockpit/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, prompt: text, notes, dry_run: true }),
      });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      const j = await r.json();
      setPreviewMsg(j.message || 'Dry run OK');
      setPhase('preview');
    } catch (e) {
      setErr(String(e));
      setPhase('error');
    }
  }
  async function publish() {
    setErr(null);
    try {
      const r = await fetch('/api/holding/it/cockpit/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, prompt: text, notes, dry_run: false }),
      });
      if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
      setPhase('published');
    } catch (e) {
      setErr(String(e));
      setPhase('error');
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(820px, 96vw)', background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, color: TOKENS.text, padding: 24, borderRadius: 2 }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 22, color: TOKENS.ink }}>Edit prompt — {role}</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, marginTop: 2 }}>
              cap_prompts · current v{currentPrompt?.version ?? '—'} · saving creates v{(currentPrompt?.version ?? 0) + 1}, marks old row inactive
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', color: TOKENS.text2, border: `1px solid ${TOKENS.border}`, padding: '4px 10px', cursor: 'pointer', borderRadius: 2, fontFamily: MONO, fontSize: 12 }}
          >
            close
          </button>
        </div>

        <label style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, display: 'block', marginBottom: 4 }}>Prompt body</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={16}
          style={{
            width: '100%',
            background: TOKENS.bg,
            color: TOKENS.text,
            border: `1px solid ${TOKENS.borderSoft}`,
            padding: 12,
            fontFamily: MONO,
            fontSize: 12,
            lineHeight: 1.55,
            borderRadius: 2,
            resize: 'vertical',
          }}
        />

        <label style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text3, display: 'block', marginTop: 12, marginBottom: 4 }}>
          Notes (optional · audit trail)
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="why this change?"
          style={{
            width: '100%',
            background: TOKENS.bg,
            color: TOKENS.text,
            border: `1px solid ${TOKENS.borderSoft}`,
            padding: 10,
            fontFamily: MONO,
            fontSize: 12,
            borderRadius: 2,
          }}
        />

        {err && <div style={{ color: TOKENS.terracotta, marginTop: 10, fontSize: 12 }}>{err}</div>}
        {previewMsg && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              background: TOKENS.bgDeep,
              border: `1px solid ${TOKENS.borderSoft}`,
              borderRadius: 2,
              fontSize: 12,
              color: TOKENS.text2,
              fontFamily: MONO,
              whiteSpace: 'pre-wrap',
            }}
          >
            {previewMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
          {phase !== 'published' && (
            <>
              <button
                onClick={preview}
                style={{
                  background: 'transparent',
                  color: TOKENS.brass,
                  border: `1px solid ${TOKENS.brass}`,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  borderRadius: 2,
                  fontFamily: MONO,
                  fontSize: 12,
                }}
              >
                Dry-run preview
              </button>
              <button
                onClick={publish}
                disabled={phase !== 'preview'}
                style={{
                  background: phase === 'preview' ? TOKENS.brass : 'transparent',
                  color: phase === 'preview' ? TOKENS.bg : TOKENS.text3,
                  border: `1px solid ${TOKENS.brass}`,
                  padding: '8px 14px',
                  cursor: phase === 'preview' ? 'pointer' : 'not-allowed',
                  borderRadius: 2,
                  fontFamily: MONO,
                  fontSize: 12,
                }}
              >
                Publish new version
              </button>
            </>
          )}
          {phase === 'published' && (
            <div style={{ color: TOKENS.moss, fontSize: 12, fontFamily: MONO }}>
              Published. Reload the page to see the new version active.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
