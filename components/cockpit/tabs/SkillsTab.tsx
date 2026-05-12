// components/cockpit/tabs/SkillsTab.tsx
// Prompt 7 (cockpit-skills-tab). Two-pane Skills tab: search/filter list on
// the left, detail/edit form on the right. Skills are platform-wide — the
// data is identical regardless of which property you're viewing from.

'use client';

import { useEffect, useMemo, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SkillCatalogRow {
  skill_id: number;
  name: string;
  description: string | null;
  category: string | null;
  authority_level: string | null;
  cost_class: string | null;
  estimated_cost_milli: number | null;
  active: boolean;
  archived_reason: string | null;
  notes: string | null;
  serves_kpis: string[] | null;
  kpi_details: KPIDetail[] | null;
  implementation_type: string | null;
  handler: string | null;
  input_schema: unknown;
  attached_to_agents: number | null;
  calls_7d: number | null;
  cost_usd_7d: number | string | null;
}

interface KPIDetail {
  slug: string;
  name: string;
  category: string | null;
  unit: string | null;
}

interface KPICatalogRow {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  direction: string | null;
  target_value: number | string | null;
  formula: string | null;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORIES = ['all', 'revenue', 'marketing', 'operations', 'finance', 'it', 'guest', 'sales', 'platform'];

const AUTH_BADGE: Record<string, { color: string; bg: string; label: string }> = {
  read_only:           { color: 'var(--text-mute, #9b907a)', bg: 'var(--surf-2, #15110b)', label: 'read' },
  write_with_audit:    { color: 'var(--accent, #a8854a)',    bg: 'var(--surf-2, #15110b)', label: 'write' },
  write_with_approval: { color: '#d68a3a',                   bg: 'var(--surf-2, #15110b)', label: 'gated' },
  forbidden:           { color: '#c0584c',                   bg: 'var(--surf-2, #15110b)', label: 'forbid' },
};

const AUTH_LEVELS = ['read_only', 'write_with_audit', 'write_with_approval', 'forbidden'];
const COST_CLASSES = ['low', 'medium', 'high', 'variable'];

// ─── Hooks ─────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setD(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return d;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function SkillsTab() {
  const [skills, setSkills] = useState<SkillCatalogRow[]>([]);
  const [kpis, setKpis] = useState<KPICatalogRow[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounced = useDebounce(search, 250);

  async function fetchSkills() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cockpit/skills-catalog', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          category: category === 'all' ? null : category,
          search: debounced || null,
          include_archived: showArchived,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'skills_catalog failed');
      setSkills(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchKpis() {
    try {
      const res = await fetch('/api/cockpit/kpi-catalog');
      const data = await res.json();
      if (Array.isArray(data)) setKpis(data);
    } catch { /* silent */ }
  }

  useEffect(() => { fetchSkills(); /* eslint-disable-next-line */ }, [debounced, category, showArchived]);
  useEffect(() => { fetchKpis(); }, []);

  const selected = useMemo(() => skills.find((s) => s.skill_id === selectedId) ?? null, [skills, selectedId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--text-mute, #9b907a)', fontStyle: 'italic' }}>
        Skills are platform-wide. Changes affect all properties.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '40% 60%', gap: 14, minHeight: 480 }}>
        {/* LEFT PANE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {/* Filters */}
          <input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'var(--surf-1, #0f0d0a)',
              color: 'var(--text-0, #e9e1ce)',
              border: '1px solid var(--border-2, #2a261d)',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: "'Inter Tight', system-ui, sans-serif",
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                style={{
                  background: category === c ? 'var(--accent, #a8854a)' : 'transparent',
                  color: category === c ? 'var(--surf-0, #0a0a0a)' : 'var(--text-dim, #7d7565)',
                  border: '1px solid var(--border-2, #2a261d)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-mute, #9b907a)' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>

          {error && <div style={{ color: '#c0584c', fontSize: 11 }}>{error}</div>}

          {/* List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--surf-1, #0f0d0a)',
              border: '1px solid var(--border-1, #1f1c15)',
              borderRadius: 8,
            }}
          >
            {loading && <div style={{ padding: 14, fontSize: 12, color: 'var(--text-mute, #9b907a)' }}>Loading…</div>}
            {!loading && skills.length === 0 && (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--text-dim, #7d7565)' }}>No skills.</div>
            )}
            {!loading && skills.map((s) => {
              const isSel = s.skill_id === selectedId;
              const archived = !s.active;
              const badge = AUTH_BADGE[s.authority_level ?? 'read_only'] ?? AUTH_BADGE.read_only;
              return (
                <button
                  key={s.skill_id}
                  onClick={() => setSelectedId(s.skill_id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: isSel ? 'var(--surf-3, #1c160d)' : 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--border-1, #1f1c15)',
                    color: 'var(--text-0, #e9e1ce)',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    opacity: archived ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{s.name}</span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: badge.bg,
                        color: badge.color,
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 3,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {s.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-dim, #7d7565)',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 10, color: 'var(--text-mute, #9b907a)', fontFamily: "'JetBrains Mono', monospace" }}>
                    {(s.kpi_details && s.kpi_details.length > 0) && (
                      <span>{s.kpi_details.length} KPIs</span>
                    )}
                    {s.attached_to_agents != null && <span>· {s.attached_to_agents} agents</span>}
                    {s.calls_7d != null && <span>· {s.calls_7d}/7d</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE */}
        <div style={{ minHeight: 0 }}>
          {selected ? (
            <SkillDetail
              skill={selected}
              kpis={kpis}
              onUpdated={async () => {
                await fetchSkills();
              }}
            />
          ) : (
            <div style={{ padding: 24, color: 'var(--text-mute, #9b907a)', fontStyle: 'italic' }}>
              Select a skill on the left to inspect or edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detail / edit form ────────────────────────────────────────────────────

interface DraftState {
  description: string;
  category: string;
  serves_kpis: string[];
  notes: string;
  cost_class: string;
  authority_level: string;
  estimated_cost_milli: number;
}

function SkillDetail({
  skill,
  kpis,
  onUpdated,
}: {
  skill: SkillCatalogRow;
  kpis: KPICatalogRow[];
  onUpdated: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftState>(toDraft(skill));
  const [saving, setSaving] = useState(false);
  const [archivePanel, setArchivePanel] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => { setDraft(toDraft(skill)); setEditing(false); setArchivePanel(false); setArchiveReason(''); }, [skill.skill_id]);

  function toDraft(s: SkillCatalogRow): DraftState {
    return {
      description: s.description ?? '',
      category: s.category ?? '',
      serves_kpis: s.serves_kpis ?? [],
      notes: s.notes ?? '',
      cost_class: s.cost_class ?? '',
      authority_level: s.authority_level ?? 'read_only',
      estimated_cost_milli: s.estimated_cost_milli ?? 0,
    };
  }

  function dirtyFields(): Partial<DraftState> {
    const out: Partial<DraftState> = {};
    if (draft.description !== (skill.description ?? '')) out.description = draft.description;
    if (draft.category !== (skill.category ?? '')) out.category = draft.category;
    if (JSON.stringify(draft.serves_kpis) !== JSON.stringify(skill.serves_kpis ?? [])) out.serves_kpis = draft.serves_kpis;
    if (draft.notes !== (skill.notes ?? '')) out.notes = draft.notes;
    if (draft.cost_class !== (skill.cost_class ?? '')) out.cost_class = draft.cost_class;
    if (draft.authority_level !== (skill.authority_level ?? '')) out.authority_level = draft.authority_level;
    if (draft.estimated_cost_milli !== (skill.estimated_cost_milli ?? 0)) out.estimated_cost_milli = draft.estimated_cost_milli;
    return out;
  }

  async function save() {
    setSaving(true);
    setToast(null);
    const dirty = dirtyFields();
    if (Object.keys(dirty).length === 0) {
      setSaving(false);
      setEditing(false);
      return;
    }
    try {
      const res = await fetch('/api/cockpit/skill-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skill_id: skill.skill_id, ...dirty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'skill update failed');
      setToast({ kind: 'ok', msg: 'Saved' });
      setEditing(false);
      await onUpdated();
    } catch (e) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!archiveReason.trim()) {
      setToast({ kind: 'err', msg: 'Archive reason required' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/cockpit/skill-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          skill_id: skill.skill_id,
          active: false,
          archived_reason: archiveReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'archive failed');
      setToast({ kind: 'ok', msg: 'Archived' });
      setArchivePanel(false);
      setArchiveReason('');
      await onUpdated();
    } catch (e) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function restore() {
    setSaving(true);
    try {
      const res = await fetch('/api/cockpit/skill-update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ skill_id: skill.skill_id, active: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'restore failed');
      setToast({ kind: 'ok', msg: 'Restored' });
      await onUpdated();
    } catch (e) {
      setToast({ kind: 'err', msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  const kpisByCat = useMemo(() => {
    const m = new Map<string, KPICatalogRow[]>();
    for (const k of kpis) {
      const c = k.category ?? 'other';
      const arr = m.get(c) ?? [];
      arr.push(k);
      m.set(c, arr);
    }
    return Array.from(m.entries());
  }, [kpis]);

  const badge = AUTH_BADGE[skill.authority_level ?? 'read_only'] ?? AUTH_BADGE.read_only;

  return (
    <div
      style={{
        background: 'var(--surf-1, #0f0d0a)',
        border: '1px solid var(--border-1, #1f1c15)',
        borderRadius: 10,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: 'var(--text-1, #f0e5cb)', margin: 0 }}>
          {skill.name}
        </h3>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setDraft(toDraft(skill)); }} disabled={saving} style={btnGhost}>
                Cancel
              </button>
              <button onClick={save} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {skill.active && (
                <button onClick={() => setEditing(true)} style={btnGhost}>Edit</button>
              )}
              {skill.active && !archivePanel && (
                <button onClick={() => setArchivePanel(true)} style={btnGhostDanger}>Archive</button>
              )}
              {!skill.active && (
                <button onClick={restore} disabled={saving} style={btnGhost}>Restore</button>
              )}
            </>
          )}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace" }}>
        {skill.category ?? '—'} · auth=
        <span style={{ color: badge.color }}>{skill.authority_level ?? '—'}</span>
        {' · cost='}{skill.cost_class ?? '—'}
        {skill.estimated_cost_milli != null && ` · ~$${(skill.estimated_cost_milli / 1000).toFixed(3)}`}
        {!skill.active && ' · ARCHIVED'}
      </div>

      {toast && (
        <div style={{ fontSize: 11, color: toast.kind === 'ok' ? '#3f8a4a' : '#c0584c' }}>
          {toast.msg}
        </div>
      )}

      {/* Archive panel */}
      {archivePanel && skill.active && (
        <section style={panelDanger}>
          <div style={{ fontSize: 11, color: '#c0584c', marginBottom: 6 }}>
            Archive skill — agents currently using it will fail tool calls.
          </div>
          <input
            placeholder="Reason (required)"
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            style={input}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => { setArchivePanel(false); setArchiveReason(''); }} style={btnGhost}>
              Cancel
            </button>
            <button onClick={archive} disabled={saving || !archiveReason.trim()} style={btnDanger}>
              {saving ? '…' : 'Confirm archive'}
            </button>
          </div>
        </section>
      )}

      {/* Section 1: Description */}
      <Section title="What it does">
        {editing ? (
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            rows={3}
            style={textarea}
          />
        ) : (
          <Body>{skill.description || <em style={{ color: 'var(--text-dim, #7d7565)' }}>No description.</em>}</Body>
        )}
      </Section>

      {/* Section 2: KPIs served */}
      <Section title="KPIs served">
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {kpisByCat.map(([cat, items]) => (
              <div key={cat}>
                <div style={{ fontSize: 10, color: 'var(--text-mute, #9b907a)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
                  {cat}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {items.map((k) => {
                    const on = draft.serves_kpis.includes(k.slug);
                    return (
                      <button
                        key={k.slug}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            serves_kpis: on
                              ? draft.serves_kpis.filter((s) => s !== k.slug)
                              : [...draft.serves_kpis, k.slug],
                          });
                        }}
                        style={{
                          background: on ? 'var(--accent, #a8854a)' : 'transparent',
                          color: on ? 'var(--surf-0, #0a0a0a)' : 'var(--text-dim, #7d7565)',
                          border: '1px solid var(--border-2, #2a261d)',
                          borderRadius: 12,
                          padding: '3px 9px',
                          fontSize: 10,
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: 'pointer',
                        }}
                        title={k.name}
                      >
                        {k.slug}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(skill.kpi_details ?? []).map((k) => (
              <span
                key={k.slug}
                style={{
                  background: 'var(--surf-2, #15110b)',
                  color: 'var(--accent, #a8854a)',
                  border: '1px solid var(--border-2, #2a261d)',
                  borderRadius: 12,
                  padding: '3px 9px',
                  fontSize: 10,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                title={k.name}
              >
                {k.slug}
              </span>
            ))}
            {(!skill.kpi_details || skill.kpi_details.length === 0) && (
              <span style={{ fontSize: 11, color: 'var(--text-dim, #7d7565)' }}>None.</span>
            )}
          </div>
        )}
      </Section>

      {/* Section 3: Operational details */}
      <Section title="Operational">
        {editing ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <Field label="Category">
              <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={input}>
                <option value="">—</option>
                {CATEGORIES.filter((c) => c !== 'all').map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Authority">
              <select value={draft.authority_level} onChange={(e) => setDraft({ ...draft, authority_level: e.target.value })} style={input}>
                {AUTH_LEVELS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Cost class">
              <select value={draft.cost_class} onChange={(e) => setDraft({ ...draft, cost_class: e.target.value })} style={input}>
                <option value="">—</option>
                {COST_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Est. cost (milli)">
              <input
                type="number"
                value={draft.estimated_cost_milli}
                min={0}
                onChange={(e) => setDraft({ ...draft, estimated_cost_milli: Number(e.target.value) || 0 })}
                style={input}
              />
            </Field>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, fontSize: 12, color: 'var(--text-0, #e9e1ce)' }}>
            <span><Label>category</Label> {skill.category ?? '—'}</span>
            <span><Label>authority</Label> {skill.authority_level ?? '—'}</span>
            <span><Label>cost class</Label> {skill.cost_class ?? '—'}</span>
            <span><Label>est cost</Label> {skill.estimated_cost_milli != null ? `$${(skill.estimated_cost_milli / 1000).toFixed(3)}` : '—'}</span>
          </div>
        )}
      </Section>

      {/* Section 4: Usage (read-only) */}
      <Section title="Usage (7d)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 12, color: 'var(--text-0, #e9e1ce)' }}>
          <span><Label>attached</Label> {skill.attached_to_agents ?? 0} agents</span>
          <span><Label>calls</Label> {skill.calls_7d ?? 0}</span>
          <span><Label>cost</Label> {skill.cost_usd_7d != null ? `$${Number(skill.cost_usd_7d).toFixed(3)}` : '—'}</span>
        </div>
      </Section>

      {/* Section 5: Notes */}
      <Section title="Notes">
        {editing ? (
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={2}
            style={textarea}
            placeholder="Internal notes (operations, gotchas)…"
          />
        ) : (
          <Body>{skill.notes || <em style={{ color: 'var(--text-dim, #7d7565)' }}>No notes.</em>}</Body>
        )}
      </Section>

      {/* Section 6: Code (read-only) */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text-mute, #9b907a)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Code (read-only)
        </summary>
        <div style={{ marginTop: 8, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim, #7d7565)' }}>
          <div style={{ fontStyle: 'italic', color: 'var(--accent-3, #c2a572)', marginBottom: 6 }}>
            Schema and handler managed via code. Edit in repo.
          </div>
          <Label>impl_type</Label> {skill.implementation_type ?? '—'}
          <div style={{ marginTop: 4 }}><Label>handler</Label> {skill.handler ?? '—'}</div>
          <pre
            style={{
              marginTop: 6,
              padding: 8,
              background: 'var(--surf-2, #15110b)',
              borderRadius: 4,
              border: '1px solid var(--border-1, #1f1c15)',
              overflow: 'auto',
              fontSize: 10,
              maxHeight: 240,
            }}
          >
{JSON.stringify(skill.input_schema ?? null, null, 2)}
          </pre>
        </div>
      </details>

      {!skill.active && skill.archived_reason && (
        <div style={{ fontSize: 11, color: 'var(--text-dim, #7d7565)' }}>
          <Label>archived reason</Label> {skill.archived_reason}
        </div>
      )}
    </div>
  );
}

// ─── Small UI helpers ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-mute, #9b907a)', margin: '0 0 6px' }}>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim, #7d7565)' }}>{label}</span>
      {children}
    </label>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ color: 'var(--text-dim, #7d7565)', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em', marginRight: 4, textTransform: 'uppercase' }}>{children}:</span>;
}

function Body({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, color: 'var(--text-0, #e9e1ce)', lineHeight: 1.5 }}>{children}</div>;
}

// ─── Style constants ───────────────────────────────────────────────────────

const input: React.CSSProperties = {
  background: 'var(--surf-2, #15110b)',
  color: 'var(--text-0, #e9e1ce)',
  border: '1px solid var(--border-2, #2a261d)',
  borderRadius: 4,
  padding: '6px 8px',
  fontSize: 12,
  fontFamily: "'Inter Tight', system-ui, sans-serif",
  outline: 'none',
};
const textarea: React.CSSProperties = { ...input, resize: 'vertical', width: '100%' };
const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text-mute, #9b907a)',
  border: '1px solid var(--border-2, #2a261d)',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 11,
  cursor: 'pointer',
};
const btnGhostDanger: React.CSSProperties = { ...btnGhost, color: '#c0584c' };
const btnPrimary: React.CSSProperties = {
  background: 'var(--accent, #a8854a)',
  color: 'var(--surf-0, #0a0a0a)',
  border: 'none',
  borderRadius: 4,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
};
const btnDanger: React.CSSProperties = { ...btnPrimary, background: '#c0584c', color: '#fff' };
const panelDanger: React.CSSProperties = {
  background: 'rgba(192, 88, 76, 0.08)',
  border: '1px solid rgba(192, 88, 76, 0.4)',
  borderRadius: 6,
  padding: 10,
};
