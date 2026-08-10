'use client';

// app/holding/it2/fleet/team/AgentWriteCtas.tsx
// Brief agent-team-slice-write-ctas (ADR-268 write wrappers).
// Interactive CTAs for pillars 1-3 of the Agent Team panel. Every write goes
// browser → /api/fleet/team/write → public.fn_* SECURITY DEFINER wrapper
// (service key, audited). Reads for the forms go through
// /api/fleet/team/read (public.* bridges only, claude_md §0.5).
//
// Deliberately still disabled, with the reason shown:
//  - "Set trust"      — no write wrapper exists for trust yet.
//  - "Test-run"       — no dry-run mode on the skill routes; firing a live
//                       agent from this panel is out of slice scope.
//  - Memory "Edit"    — no edit wrapper; the audited path is archive with a
//                       reason, then add the corrected memory.
//
// Known data blocker surfaced honestly: cockpit.cap_skills is EMPTY while
// cap_agent_skills holds 4,274 grants. Grant/bulk-grant wrappers validate
// against the catalog, so they return 'unknown_or_inactive_skill' until the
// skills-registry repair repopulates it. The UI says so instead of hiding it.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

// ── shared plumbing ─────────────────────────────────────────────────────────

type WriteResult = { ok: boolean; error?: string; [k: string]: any };

async function callWrite(payload: Record<string, any>): Promise<WriteResult> {
  try {
    const res = await fetch('/api/fleet/team/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as WriteResult;
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'network error' };
  }
}

type SkillRow = {
  id: number; name: string; category: string | null; description: string | null;
  authority_level: number | null; requires_pbs_approval: boolean | null; active: boolean;
};
type GrantRow = {
  skill_id: number; skill_name: string; category: string | null;
  authority_level: number | null; enabled: boolean; created_at: string;
};
type MemoryRow = {
  id: number; memory_type: string | null; content: string; importance: number;
  topics: string[] | null; created_at: string;
};
type AuditRow = { id: number; created_at: string; action: string; notes: string | null; success: boolean | null };
type AgentDetail = {
  prompt: { role: string; version: number; system_prompt: string; change_note: string | null } | null;
  grants: GrantRow[];
  memories: MemoryRow[];
  audit: AuditRow[];
};

function useAgentDetail(role: string, active: boolean) {
  const [detail, setDetail] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/team/read?kind=agent&role=${encodeURIComponent(role)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'read failed');
      setDetail(json as AgentDetail);
    } catch (e: any) {
      setError(e?.message ?? 'read failed');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (active && !detail && !loading) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return { detail, loading, error, reload };
}

function LiveCta({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} style={{ ...ct.live, ...(active ? ct.liveActive : null) }}>
      {label}
    </button>
  );
}

function BlockedCta({ label, reason }: { label: string; reason: string }) {
  return (
    <button disabled title={reason} style={ct.blocked}>
      {label}
    </button>
  );
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div style={ct.error}>✗ {msg}</div>;
}

function OkLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div style={ct.okline}>✓ {msg}</div>;
}

// ── Pillar 1 · Identity ─────────────────────────────────────────────────────

export function IdentityCtas({ role, status, hot, hotReason }: {
  role: string; status: string | null; hot: boolean; hotReason: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'prompt'>('none');
  const { detail, loading, error: readError, reload } = useAgentDetail(role, mode === 'prompt');
  const [draft, setDraft] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const promptText = draft ?? detail?.prompt?.system_prompt ?? '';
  const disabled = status === 'disabled';

  async function savePrompt() {
    if (hot) { setErr(hotReason); return; }
    setBusy(true); setErr(null); setOk(null);
    const res = await callWrite({ action: 'set_prompt', role, system_prompt: promptText, note: note || null });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'save failed'); return; }
    setOk(`saved as v${res.version} — prior version kept`);
    setNote('');
    setDraft(null);
    await reload();
    router.refresh();
  }

  async function toggleStatus() {
    if (hot) { setErr(hotReason); return; }
    const next = disabled ? 'active' : 'disabled';
    if (!window.confirm(`Set ${role} → ${next}?`)) return;
    setBusy(true); setErr(null); setOk(null);
    const res = await callWrite({ action: 'set_status', role, status: next });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'status change failed'); return; }
    setOk(`status → ${next}`);
    router.refresh();
  }

  return (
    <div>
      <div style={ct.row}>
        <LiveCta label="Edit prompt" active={mode === 'prompt'}
          onClick={() => setMode(mode === 'prompt' ? 'none' : 'prompt')} />
        <BlockedCta label="Set trust" reason="No trust write wrapper exists yet — out of this slice." />
        <LiveCta label={disabled ? 'Enable' : 'Disable'} onClick={() => void toggleStatus()} />
      </div>
      {hot && <div style={ct.hotNote}>{hotReason}</div>}
      {mode === 'prompt' && (
        <div style={ct.form}>
          {loading && <div style={ct.muted}>loading current prompt…</div>}
          <ErrorLine msg={readError} />
          {!loading && !readError && (
            <>
              <div style={ct.muted}>
                {detail?.prompt
                  ? `current v${detail.prompt.version} — saving creates v${detail.prompt.version + 1}, prior stays readable`
                  : 'no current prompt — saving creates v1'}
              </div>
              <textarea
                value={promptText}
                onChange={(e) => setDraft(e.target.value)}
                rows={10}
                style={ct.textarea}
                placeholder="System prompt…"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Change note (why)…"
                style={ct.input}
              />
              <div style={ct.row}>
                <button onClick={() => void savePrompt()} disabled={busy || hot} style={ct.primary}>
                  {busy ? 'Saving…' : 'Save new version'}
                </button>
                <button onClick={() => { setMode('none'); setDraft(null); }} style={ct.ghost}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
      <ErrorLine msg={err} />
      <OkLine msg={ok} />
      {mode === 'prompt' && detail && detail.audit.length > 0 && (
        <div style={ct.auditBox}>
          <div style={ct.auditTitle}>Recent writes (audit)</div>
          {detail.audit.map((a) => (
            <div key={a.id} style={ct.auditRow}>
              <span style={{ fontFamily: MONO }}>{a.action}</span>
              <span>{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pillar 2 · Skills ───────────────────────────────────────────────────────

export function SkillCtas({ role }: { role: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'add' | 'revoke' | 'propose'>('none');
  const { detail, loading, error: readError, reload } = useAgentDetail(role, mode !== 'none');
  const [q, setQ] = useState('');
  const [catalog, setCatalog] = useState<SkillRow[] | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [propName, setPropName] = useState('');
  const [propWhy, setPropWhy] = useState('');
  const [propDesc, setPropDesc] = useState('');

  const searchCatalog = useCallback(async (needle: string) => {
    setCatalogLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/fleet/team/read?kind=skills&q=${encodeURIComponent(needle)}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'catalog read failed');
      setCatalog(json.skills as SkillRow[]);
    } catch (e: any) {
      setErr(e?.message ?? 'catalog read failed');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'add' && catalog === null && !catalogLoading) void searchCatalog('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const grantedIds = useMemo(() => new Set((detail?.grants ?? []).map((g) => g.skill_id)), [detail]);
  const grantable = (catalog ?? []).filter((s) => !grantedIds.has(s.id));

  async function grant(skillId: number) {
    setBusyId(skillId); setErr(null); setOk(null);
    const res = await callWrite({ action: 'grant_skill', role, skill_id: skillId });
    setBusyId(null);
    if (!res.ok) { setErr(res.error ?? 'grant failed'); return; }
    setOk(`granted skill #${skillId}`);
    await reload();
    router.refresh();
  }

  async function revoke(skillId: number) {
    if (!window.confirm(`Revoke skill #${skillId} from ${role}?`)) return;
    setBusyId(skillId); setErr(null); setOk(null);
    const res = await callWrite({ action: 'revoke_skill', role, skill_id: skillId });
    setBusyId(null);
    if (!res.ok) { setErr(res.error ?? 'revoke failed'); return; }
    setOk(`revoked skill #${skillId}`);
    await reload();
    router.refresh();
  }

  async function propose() {
    if (!propName.trim() || !propWhy.trim()) { setErr('skill name and justification required'); return; }
    setBusyId(-1); setErr(null); setOk(null);
    const res = await callWrite({
      action: 'propose_skill', role,
      skill_name: propName, justification: propWhy, description: propDesc || null,
    });
    setBusyId(null);
    if (!res.ok) { setErr(res.error ?? 'proposal failed'); return; }
    setOk('proposal filed — status pending');
    setPropName(''); setPropWhy(''); setPropDesc('');
  }

  return (
    <div>
      <div style={ct.row}>
        <LiveCta label="Add skill" active={mode === 'add'} onClick={() => setMode(mode === 'add' ? 'none' : 'add')} />
        <LiveCta label="Revoke" active={mode === 'revoke'} onClick={() => setMode(mode === 'revoke' ? 'none' : 'revoke')} />
        <LiveCta label="Propose new" active={mode === 'propose'} onClick={() => setMode(mode === 'propose' ? 'none' : 'propose')} />
        <BlockedCta label="Test-run" reason="No dry-run mode on skill routes — firing a live agent from here is out of slice scope." />
      </div>

      {mode === 'add' && (
        <div style={ct.form}>
          <div style={ct.row}>
            <input value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void searchCatalog(q)}
              placeholder="Search skill catalog…" style={ct.input} />
            <button onClick={() => void searchCatalog(q)} style={ct.ghost}>Search</button>
          </div>
          {catalogLoading && <div style={ct.muted}>searching…</div>}
          {catalog !== null && catalog.length === 0 && (
            <div style={ct.warnBox}>
              Skill catalog is empty (0 active rows in cap_skills) while 4,274 grants exist.
              Grants are rejected with &lsquo;unknown_or_inactive_skill&rsquo; until the
              skills-registry repair repopulates the catalog.
            </div>
          )}
          {grantable.map((s) => (
            <div key={s.id} style={ct.listRow}>
              <span>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span style={ct.muted}> · {s.category ?? '—'} · auth {s.authority_level ?? '—'}
                  {s.requires_pbs_approval ? ' · PBS approval' : ''}</span>
              </span>
              <button onClick={() => void grant(s.id)} disabled={busyId === s.id} style={ct.smallBtn}>
                {busyId === s.id ? '…' : 'Grant'}
              </button>
            </div>
          ))}
        </div>
      )}

      {mode === 'revoke' && (
        <div style={ct.form}>
          {loading && <div style={ct.muted}>loading grants…</div>}
          <ErrorLine msg={readError} />
          {(detail?.grants ?? []).map((g) => (
            <div key={g.skill_id} style={ct.listRow}>
              <span>{g.skill_name}<span style={ct.muted}> · {g.category ?? '—'}</span></span>
              <button onClick={() => void revoke(g.skill_id)} disabled={busyId === g.skill_id} style={ct.smallBtnDanger}>
                {busyId === g.skill_id ? '…' : 'Revoke'}
              </button>
            </div>
          ))}
          {detail && detail.grants.length === 0 && <div style={ct.muted}>no enabled grants</div>}
        </div>
      )}

      {mode === 'propose' && (
        <div style={ct.form}>
          <input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="Skill name…" style={ct.input} />
          <input value={propDesc} onChange={(e) => setPropDesc(e.target.value)} placeholder="Description (optional)…" style={ct.input} />
          <textarea value={propWhy} onChange={(e) => setPropWhy(e.target.value)} rows={3}
            placeholder="Justification — why does this agent need it?" style={ct.textarea} />
          <div style={ct.row}>
            <button onClick={() => void propose()} disabled={busyId === -1} style={ct.primary}>
              {busyId === -1 ? 'Filing…' : 'File proposal'}
            </button>
            <button onClick={() => setMode('none')} style={ct.ghost}>Cancel</button>
          </div>
        </div>
      )}

      <ErrorLine msg={err} />
      <OkLine msg={ok} />
    </div>
  );
}

// ── Pillar 3 · Memory ───────────────────────────────────────────────────────

export function MemoryCtas({ role }: { role: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'add' | 'archive'>('none');
  const { detail, loading, error: readError, reload } = useAgentDetail(role, mode === 'archive');
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(5);
  const [topics, setTopics] = useState('');
  const [hardOnly, setHardOnly] = useState(false);
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const memories = (detail?.memories ?? []).filter((m) => !hardOnly || m.importance >= 8);

  async function addMemory() {
    if (!content.trim()) { setErr('memory content required'); return; }
    setBusy(true); setErr(null); setOk(null);
    const res = await callWrite({
      action: 'add_memory', role, content, importance,
      topics: topics.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'add failed'); return; }
    setOk('memory added');
    setContent(''); setTopics('');
    router.refresh();
  }

  async function archive(memoryId: number) {
    if (!reason.trim()) { setErr('archive reason required — memories are never deleted'); return; }
    setBusy(true); setErr(null); setOk(null);
    const res = await callWrite({ action: 'archive_memory', memory_id: memoryId, reason });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'archive failed'); return; }
    setOk(`memory #${memoryId} archived`);
    setArchiveId(null); setReason('');
    await reload();
    router.refresh();
  }

  return (
    <div>
      <div style={ct.row}>
        <LiveCta label="Add memory" active={mode === 'add'} onClick={() => setMode(mode === 'add' ? 'none' : 'add')} />
        <BlockedCta label="Edit" reason="No edit wrapper — archive the memory with a reason, then add the corrected one." />
        <LiveCta label="Archive" active={mode === 'archive'} onClick={() => setMode(mode === 'archive' ? 'none' : 'archive')} />
      </div>

      {mode === 'add' && (
        <div style={ct.form}>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
            placeholder="What should this agent remember?" style={ct.textarea} />
          <div style={ct.row}>
            <label style={ct.muted}>importance
              <input type="number" min={1} max={10} value={importance}
                onChange={(e) => setImportance(Number(e.target.value))} style={{ ...ct.input, width: 60, marginLeft: 6 }} />
            </label>
            <input value={topics} onChange={(e) => setTopics(e.target.value)}
              placeholder="topics, comma-separated" style={ct.input} />
          </div>
          {importance >= 8 && <div style={ct.warnBox}>importance ≥ 8 = hard rule every agent run must honor</div>}
          <div style={ct.row}>
            <button onClick={() => void addMemory()} disabled={busy} style={ct.primary}>{busy ? 'Saving…' : 'Add'}</button>
            <button onClick={() => setMode('none')} style={ct.ghost}>Cancel</button>
          </div>
        </div>
      )}

      {mode === 'archive' && (
        <div style={ct.form}>
          <label style={{ ...ct.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={hardOnly} onChange={(e) => setHardOnly(e.target.checked)} />
            hard rules only (importance ≥ 8)
          </label>
          {loading && <div style={ct.muted}>loading memories…</div>}
          <ErrorLine msg={readError} />
          {memories.map((m) => (
            <div key={m.id} style={ct.memRow}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: MONO, fontSize: 10 }}>#{m.id} · imp {m.importance}</span>{' '}
                <span style={{ fontSize: 12 }}>{m.content.length > 160 ? m.content.slice(0, 160) + '…' : m.content}</span>
              </div>
              {archiveId === m.id ? (
                <span style={{ display: 'flex', gap: 4 }}>
                  <input value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason…" style={{ ...ct.input, width: 160 }} autoFocus />
                  <button onClick={() => void archive(m.id)} disabled={busy} style={ct.smallBtnDanger}>
                    {busy ? '…' : 'Confirm'}
                  </button>
                  <button onClick={() => { setArchiveId(null); setReason(''); }} style={ct.smallBtn}>×</button>
                </span>
              ) : (
                <button onClick={() => { setArchiveId(m.id); setErr(null); }} style={ct.smallBtn}>Archive</button>
              )}
            </div>
          ))}
          {detail && memories.length === 0 && <div style={ct.muted}>no active memories{hardOnly ? ' at imp ≥ 8' : ''}</div>}
        </div>
      )}

      <ErrorLine msg={err} />
      <OkLine msg={ok} />
    </div>
  );
}

// ── Bulk grant bar (zero-skill repair) ──────────────────────────────────────

export function BulkGrantBar({ zeroSkillRoles }: { zeroSkillRoles: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(zeroSkillRoles));
  const [catalog, setCatalog] = useState<SkillRow[] | null>(null);
  const [pickedSkills, setPickedSkills] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (open && catalog === null) {
      void (async () => {
        try {
          const res = await fetch('/api/fleet/team/read?kind=skills&q=');
          const json = await res.json();
          setCatalog(json.ok ? (json.skills as SkillRow[]) : []);
        } catch {
          setCatalog([]);
        }
      })();
    }
  }, [open, catalog]);

  if (zeroSkillRoles.length === 0) return null;

  // Preset resolved from live catalog data, not hardcoded ids: the read-only
  // baseline is every active skill at authority level ≤ 1 with no PBS
  // approval requirement (capped at 10).
  const baseline = (catalog ?? [])
    .filter((s) => (s.authority_level ?? 99) <= 1 && !s.requires_pbs_approval)
    .slice(0, 10);

  function toggleRole(r: string) {
    const next = new Set(selected);
    if (next.has(r)) next.delete(r); else next.add(r);
    setSelected(next);
  }

  function toggleSkill(id: number) {
    const next = new Set(pickedSkills);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPickedSkills(next);
  }

  async function run() {
    const roles = Array.from(selected);
    const skillIds = Array.from(pickedSkills);
    if (!roles.length || !skillIds.length) { setErr('select at least one agent and one skill'); return; }
    if (!window.confirm(`Grant ${skillIds.length} skill(s) to ${roles.length} agent(s) — ${roles.length * skillIds.length} operations?`)) return;
    setBusy(true); setErr(null); setResult(null);
    const res = await callWrite({ action: 'bulk_grant_skills', roles, skill_ids: skillIds });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'bulk grant failed'); return; }
    setResult(`granted ${res.granted} · skipped ${res.skipped} · failed ${res.failed}`);
    router.refresh();
  }

  return (
    <div style={ct.bulkBar}>
      <button onClick={() => setOpen(!open)} style={ct.bulkToggle}>
        {open ? '▾' : '▸'} Fix zero-skill agents ({zeroSkillRoles.length})
      </button>
      {open && (
        <div style={ct.form}>
          {catalog !== null && catalog.length === 0 && (
            <div style={ct.warnBox}>
              Bulk grant is data-blocked: cap_skills catalog is empty, so every grant is
              rejected as &lsquo;unknown_or_inactive_skill&rsquo;. Repopulate the catalog
              (skills-registry repair) first — this panel then works unchanged.
            </div>
          )}
          <div style={ct.muted}>Agents holding zero skills — untick any to exclude:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {zeroSkillRoles.map((r) => (
              <label key={r} style={ct.roleChip}>
                <input type="checkbox" checked={selected.has(r)} onChange={() => toggleRole(r)} /> {r}
              </label>
            ))}
          </div>
          {baseline.length > 0 && (
            <div style={ct.row}>
              <button style={ct.ghost}
                onClick={() => setPickedSkills(new Set(baseline.map((s) => s.id)))}>
                Preset: read-only baseline ({baseline.length} skills, auth ≤ 1, no PBS approval)
              </button>
            </div>
          )}
          {(catalog ?? []).length > 0 && (
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {(catalog ?? []).map((s) => (
                <label key={s.id} style={{ ...ct.listRow, cursor: 'pointer' }}>
                  <span>
                    <input type="checkbox" checked={pickedSkills.has(s.id)} onChange={() => toggleSkill(s.id)} />{' '}
                    {s.name}<span style={ct.muted}> · auth {s.authority_level ?? '—'}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          <div style={ct.row}>
            <span style={ct.muted}>
              preview: {selected.size} agent(s) × {pickedSkills.size} skill(s) = {selected.size * pickedSkills.size} grants
            </span>
            <button onClick={() => void run()} disabled={busy || selected.size === 0 || pickedSkills.size === 0} style={ct.primary}>
              {busy ? 'Granting…' : 'Confirm bulk grant'}
            </button>
          </div>
          <ErrorLine msg={err} />
          <OkLine msg={result} />
        </div>
      )}
    </div>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────

const ct: Record<string, CSSProperties> = {
  row: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' },
  live: { border: '1px solid var(--primary, #1F3A2E)', background: '#FFFFFF', borderRadius: 4,
    padding: '3px 10px', fontSize: 11, fontFamily: 'inherit', color: 'var(--primary, #1F3A2E)',
    cursor: 'pointer' },
  liveActive: { background: '#1F3A2E', color: '#FFFFFF' },
  blocked: { border: '1px solid #E6DFCC', background: '#F4EFE2', borderRadius: 4, padding: '3px 10px',
    fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-soft, #5A5A5A)', cursor: 'not-allowed' },
  primary: { border: '1px solid var(--primary, #1F3A2E)', background: '#1F3A2E', color: '#FFF',
    borderRadius: 4, padding: '4px 12px', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' },
  ghost: { border: '1px solid #E6DFCC', background: 'transparent', borderRadius: 4, padding: '4px 10px',
    fontSize: 11, fontFamily: 'inherit', color: 'var(--ink-soft, #5A5A5A)', cursor: 'pointer' },
  smallBtn: { border: '1px solid #E6DFCC', background: '#FFF', borderRadius: 4, padding: '2px 8px',
    fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--ink, #1B1B1B)' },
  smallBtnDanger: { border: '1px solid #B4231F', background: '#FFF', borderRadius: 4, padding: '2px 8px',
    fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', color: '#B4231F' },
  form: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, padding: 8,
    background: '#FBF8F0', border: '1px solid #E6DFCC', borderRadius: 4 },
  textarea: { width: '100%', border: '1px solid #E6DFCC', borderRadius: 4, padding: 6, fontSize: 12,
    fontFamily: MONO, boxSizing: 'border-box' as const },
  input: { border: '1px solid #E6DFCC', borderRadius: 4, padding: '4px 8px', fontSize: 12,
    fontFamily: 'inherit', flex: 1, minWidth: 120 },
  muted: { fontSize: 11, color: 'var(--ink-soft, #5A5A5A)' },
  error: { fontSize: 11, color: '#B4231F', marginTop: 6, fontWeight: 600 },
  okline: { fontSize: 11, color: '#1F3A2E', marginTop: 6, fontWeight: 600 },
  warnBox: { fontSize: 11, color: '#8A6D1D', background: '#FBF4DD', border: '1px solid #EADFB8',
    borderRadius: 4, padding: '6px 8px' },
  hotNote: { fontSize: 11, color: '#8A6D1D', marginTop: 6 },
  listRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
    fontSize: 12, padding: '3px 0', borderBottom: '1px dashed #F0EADC' },
  memRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
    padding: '4px 0', borderBottom: '1px dashed #F0EADC' },
  roleChip: { fontSize: 11, fontFamily: MONO, border: '1px solid #E6DFCC', borderRadius: 999,
    padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' },
  auditBox: { marginTop: 8, padding: 8, background: '#F4EFE2', border: '1px solid #E6DFCC',
    borderRadius: 4 },
  auditTitle: { fontSize: 10, fontFamily: MONO, letterSpacing: 0.5, textTransform: 'uppercase' as const,
    color: 'var(--ink-soft, #5A5A5A)', marginBottom: 4 },
  auditRow: { display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' },
  bulkBar: { border: '1px solid #E6DFCC', borderRadius: 6, padding: 8, background: '#FFFFFF' },
  bulkToggle: { border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600,
    color: 'var(--primary, #1F3A2E)', cursor: 'pointer', fontFamily: 'inherit', padding: 0 },
};
