'use client';

// app/holding/it/cockpit/memory/RulesBrowser.tsx
// A3: canon rules browser + consolidation workflow (§8 default (a): batch
// clusters). Merge proposals are rows in cockpit_agent_memory with
// memory_type='merge_proposal' (JSON payload: cluster_title, absorbed_ids[],
// merged_content, rationale — §0.R R1, no new storage). Approve/Reject go
// through the module API → fn_rule_merge_apply / fn_rule_merge_reject
// (SECURITY DEFINER RPCs; holding role only). Never writes tables directly.

import { useMemo, useState } from 'react';
import { Container, MetricRow } from '@/app/(cockpit)/_design';
import type { RuleRow, ProposalRow } from './MemoryView';

const MONO = 'JetBrains Mono, ui-monospace, monospace';

type ProposalPayload = {
  cluster_title?: string;
  absorbed_ids?: number[];
  merged_content?: string;
  rationale?: string;
};

export function RulesBrowser({
  rules, proposals, focusRuleId,
}: {
  rules: RuleRow[]; proposals: ProposalRow[]; focusRuleId: number | null;
}) {
  const activeRules = useMemo(() => rules.filter((r) => r.active !== false), [rules]);
  const archivedRules = useMemo(() => rules.filter((r) => r.active === false), [rules]);
  const activeChars = useMemo(() => activeRules.reduce((s, r) => s + r.content.length, 0), [activeRules]);

  const openProposals = useMemo(
    () => proposals.filter((p) => p.archived_at === null),
    [proposals],
  );
  const decidedProposals = useMemo(
    () => proposals.filter((p) => p.archived_at !== null),
    [proposals],
  );

  const [busyId, setBusyId] = useState<number | null>(null);
  const [errById, setErrById] = useState<Record<number, string>>({});
  const [decided, setDecided] = useState<Record<number, 'applied' | 'rejected'>>({});
  const [filter, setFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  async function decide(id: number, op: 'merge_apply' | 'merge_reject') {
    if (busyId !== null) return;
    setBusyId(id);
    setErrById((e) => ({ ...e, [id]: '' }));
    try {
      const r = await fetch('/api/holding/it/cockpit/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op, proposal_id: id }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setDecided((d) => ({ ...d, [id]: op === 'merge_apply' ? 'applied' : 'rejected' }));
    } catch (e) {
      setErrById((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusyId(null);
    }
  }

  const shownRules = useMemo(() => {
    const base = showArchived ? archivedRules : activeRules;
    const f = filter.trim().toLowerCase();
    if (!f) return base;
    return base.filter(
      (r) =>
        String(r.id).includes(f) ||
        r.content.toLowerCase().includes(f) ||
        (r.topics ?? []).some((t) => t.toLowerCase().includes(f)),
    );
  }, [activeRules, archivedRules, showArchived, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <MetricRow
        tiles={[
          { label: 'Active canon rules (imp ≥ 8)', value: activeRules.length, footnote: 'target ≤ 150 (A3)' },
          { label: 'Canon size', value: `${Math.round(activeChars / 1000)}k chars`, footnote: 'paid on every agent run' },
          { label: 'Open merge proposals', value: openProposals.length, footnote: `${decidedProposals.length + Object.keys(decided).length} decided` },
          { label: 'Archived / superseded', value: archivedRules.length, footnote: 'absorbed ids stay traceable' },
        ]}
      />

      {/* consolidation queue */}
      <Container
        title="Consolidation queue"
        subtitle="Batch-approve merge clusters. Approving inserts one merged rule ending in [absorbs: …] and archives the absorbed rules with superseded_by set — zero canon loss, fully traceable."
      >
        {openProposals.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
            No open proposals. The consolidation agent pass writes clusters here (memory_type=&lsquo;merge_proposal&rsquo;); run it to populate the queue.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {openProposals.map((p) => {
              let payload: ProposalPayload = {};
              try { payload = JSON.parse(p.content) as ProposalPayload; } catch { /* renders raw below */ }
              const done = decided[p.id];
              return (
                <div key={p.id} style={{ border: '1px solid var(--hairline)', borderRadius: 10, background: '#FFFFFF', padding: '12px 14px', opacity: done ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>#{p.id}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', flex: 1 }}>
                      {payload.cluster_title ?? '(unparsed proposal)'}
                    </span>
                    {done && (
                      <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 700, color: done === 'applied' ? 'var(--primary)' : 'var(--status-red)' }}>
                        {done.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, fontFamily: MONO, color: 'var(--ink-soft)', marginBottom: 6 }}>
                    absorbs {payload.absorbed_ids?.length ?? '?'} rules: {(payload.absorbed_ids ?? []).join(', ')}
                  </div>
                  {payload.rationale && (
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 8 }}>{payload.rationale}</div>
                  )}
                  <details style={{ marginBottom: 10 }}>
                    <summary style={{ fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>Merged text preview</summary>
                    <div style={{ fontSize: 12, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 6, maxHeight: 260, overflow: 'auto', background: 'rgba(31,58,46,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                      {payload.merged_content ?? p.content}
                    </div>
                  </details>
                  {!done && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        onClick={() => void decide(p.id, 'merge_apply')}
                        disabled={busyId !== null}
                        style={{
                          padding: '7px 16px', fontSize: 12, fontFamily: MONO, fontWeight: 700, borderRadius: 8,
                          background: 'var(--primary)', color: '#FFFFFF', border: 'none',
                          cursor: busyId !== null ? 'wait' : 'pointer', opacity: busyId !== null ? 0.6 : 1,
                        }}
                      >
                        {busyId === p.id ? 'Applying…' : 'Approve merge'}
                      </button>
                      <button
                        onClick={() => void decide(p.id, 'merge_reject')}
                        disabled={busyId !== null}
                        style={{
                          padding: '7px 16px', fontSize: 12, fontFamily: MONO, fontWeight: 600, borderRadius: 8,
                          background: '#FFFFFF', color: 'var(--status-red)', border: '1px solid var(--hairline)',
                          cursor: busyId !== null ? 'wait' : 'pointer',
                        }}
                      >
                        Reject
                      </button>
                      {errById[p.id] && <span style={{ fontSize: 12, color: 'var(--status-red)' }}>{errById[p.id]}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Container>

      {/* rules list */}
      <Container
        title={showArchived ? 'Archived / superseded rules' : 'Active canon rules'}
        subtitle="importance ≥ 8 — the rules every agent loads at session start"
        action={
          <label style={{ fontSize: 11.5, color: 'var(--ink-soft)', display: 'flex', gap: 5, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            show archived
          </label>
        }
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by id, topic, text…"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: 12.5,
            border: '1px solid var(--hairline)', borderRadius: 8, marginBottom: 10,
            background: '#FFFFFF', color: 'var(--ink)', outline: 'none',
          }}
        />
        <div style={{ maxHeight: 560, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shownRules.map((r) => (
            <details
              key={r.id}
              open={focusRuleId === r.id}
              style={{
                border: focusRuleId === r.id ? '1px solid var(--primary)' : '1px solid var(--hairline)',
                borderRadius: 8, background: '#FFFFFF', padding: '8px 12px',
              }}
            >
              <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>#{r.id}</span>
                <span style={{
                  fontSize: 10, fontFamily: MONO, fontWeight: 700, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
                  background: (r.importance ?? 0) >= 10 ? 'rgba(184,84,42,0.12)' : 'rgba(31,58,46,0.10)',
                  color: (r.importance ?? 0) >= 10 ? 'var(--status-red)' : 'var(--primary)',
                }}>
                  imp {r.importance}
                </span>
                {r.memory_type && <span style={{ fontSize: 10.5, fontFamily: MONO, color: 'var(--ink-soft)', flexShrink: 0 }}>{r.memory_type}</span>}
                <span style={{ fontSize: 12, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {r.content.slice(0, 140)}
                </span>
                {r.superseded_by !== null && (
                  <span style={{ fontSize: 10.5, fontFamily: MONO, color: 'var(--status-red)', flexShrink: 0 }}>→ {r.superseded_by}</span>
                )}
              </summary>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 8 }}>
                {r.content}
              </div>
              <div style={{ fontSize: 11, fontFamily: MONO, color: 'var(--ink-soft)', marginTop: 6 }}>
                {r.agent_handle} {(r.topics ?? []).length > 0 ? `· ${(r.topics ?? []).join(', ')}` : ''}
                {r.archived_reason ? ` · ${r.archived_reason}` : ''}
                {r.updated_at ? ` · ${new Date(r.updated_at).toLocaleDateString()}` : ''}
              </div>
            </details>
          ))}
          {shownRules.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>No rules match.</div>}
        </div>
      </Container>
    </div>
  );
}
