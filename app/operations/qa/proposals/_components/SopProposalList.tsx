'use client';

// app/operations/qa/proposals/_components/SopProposalList.tsx
// PBS 2026-07-08: AI-proposed SOP catalog. Rows are drafts of SOPs the AI thinks
// this property needs. "Generate" → jumps to /operations/qa/generate?dept=X&purpose=Y&proposal_id=Z
// which pre-fills the form. On accept, save handler flips status via fn_sop_proposal_mark.
//
// Paper-white + hairlines. No var(--paper-warm). No function props from server.
//
// 2026-07-08 (bug-1): seed operation now loops 6× client-side hitting
// /api/sop/proposals/seed-batch with { batch_index, batch_size: 50 } so the
// user gets 300 proposals total in visible increments and the LLM never has
// to squeeze 300 items into one JSON response (previous root cause of "nothing
// happens" — max_tokens was truncating the JSON and the catch swallowed a
// parse error). Progress is shown inline as "Seeding batch N/6 (X / 300)".

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

// Design tokens (hardcoded per feedback_namkhan_token_ladder_paper_warm_dark)
const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const CREAM = '#F5F0E1';
const INK   = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const INK_L = '#8A8A8A';
const ACCENT = '#0F5B4A';
const AMBER = '#B8860B';
const SLATE = '#3A5568';
const RED   = '#B00020';

// PBS 2026-07-11: batch_size 50→25 after batch 1 F&B was hitting FUNCTION_INVOCATION_TIMEOUT
// (Vercel 60s) AND browser "Failed to fetch" (browser fetch ~90s). 25-item Anthropic calls
// return in ~10-15s reliably. 6 batches × 25 = 150 items total (was 300).
const TOTAL_BATCHES = 6;
const BATCH_SIZE    = 25;

export interface ProposalRow {
  id: number;
  dept_code: string;
  title: string;
  purpose_short: string;
  priority: number;
  tags: string[];
  status: 'proposed' | 'generated' | 'accepted' | 'skipped';
  property_scope: 'all' | 'namkhan' | 'donna';
  linked_sop_code: string | null;
  created_at: string;
}

interface Props {
  proposals: ProposalRow[];
  generateBaseHref: string;   // '/operations/qa/generate' or '/h/1000001/operations/qa/generate'
  seedBatchHref: string;      // '/api/sop/proposals/seed-batch'
  propertyId: number;
}

const DEPT_LABEL: Record<string, string> = {
  housekeeping: 'Housekeeping',
  kitchen: 'F&B',
  front_office: 'Front Office',
  maintenance: 'Engineering',
  governance: 'Governance',
  procurement: 'Procurement',
  hr: 'HR',
  spa: 'Spa',
  marketing: 'Marketing',
  revenue: 'Revenue',
  sales: 'Sales',
  finance: 'Finance',
  it: 'IT',
  activities: 'Activities',
  retail: 'Retail',
  transport: 'Transport',
  reception: 'Reception',
  security: 'Security',
  wellness: 'Wellness',
  sustainability: 'Sustainability',
  safety: 'Safety',
  laundry: 'Laundry',
  purchasing: 'Purchasing',
  guest_relations: 'Guest Relations',
};

function deptLabel(code: string): string {
  return DEPT_LABEL[code] ?? code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusPill(status: ProposalRow['status']): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.04em', textTransform: 'uppercase', border: '1px solid ' + HAIR,
    display: 'inline-block', whiteSpace: 'nowrap',
  };
  if (status === 'accepted')  return { ...base, background: '#EAF3EE', color: ACCENT, borderColor: ACCENT };
  if (status === 'generated') return { ...base, background: '#FFF7E5', color: AMBER,  borderColor: AMBER };
  if (status === 'skipped')   return { ...base, background: CREAM,    color: INK_L,  borderColor: HAIR };
  return { ...base, background: WHITE, color: SLATE, borderColor: HAIR }; // proposed
}

function priorityBadge(p: number): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700,
    letterSpacing: '0.04em', border: '1px solid ' + HAIR, background: WHITE,
  };
  if (p === 1) return { ...base, color: RED,   borderColor: RED };
  if (p === 2) return { ...base, color: AMBER, borderColor: AMBER };
  return { ...base, color: INK_L, borderColor: HAIR };
}

const btn = (primary: boolean, disabled: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  border: '1px solid ' + (primary ? ACCENT : HAIR),
  background: primary ? ACCENT : WHITE,
  color: primary ? WHITE : INK,
  borderRadius: 4, fontSize: 10, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  fontFamily: 'inherit', letterSpacing: '0.02em',
  textDecoration: 'none', display: 'inline-block', whiteSpace: 'nowrap',
});

const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: INK_S, borderBottom: '1px solid ' + HAIR, background: WHITE,
};
const td: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, color: INK, borderBottom: '1px solid ' + CREAM,
  verticalAlign: 'top',
};

interface BatchResult {
  batch_index: number;
  inserted:    number;
  skipped:     number;
  generated:   number;
  error?:      string;
}

export default function SopProposalList({ proposals, generateBaseHref, seedBatchHref, propertyId }: Props) {
  const [query, setQuery]         = useState('');
  const [deptFilter, setDeptFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalRow['status']>('all');
  const [seeding, setSeeding]     = useState(false);
  const [seedMsg, setSeedMsg]     = useState<string | null>(null);
  const [seedErr, setSeedErr]     = useState<string | null>(null);
  const [seedBatches, setSeedBatches] = useState<BatchResult[]>([]);
  const [busyRow, setBusyRow]     = useState<number | null>(null);
  // PBS 2026-07-11: expandable Preview + Edit
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingRow, setEditingRow]   = useState<number | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter((p) => {
      if (deptFilter !== 'all' && p.dept_code !== deptFilter) return false;
      // PBS 2026-07-11: hide accepted rows from every filter EXCEPT the "Accepted" tab.
      // Accepted proposals now live in the QA registry — no reason to clutter this page.
      if (statusFilter === 'all' && p.status === 'accepted') return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.purpose_short.toLowerCase().includes(q) ||
        deptLabel(p.dept_code).toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [proposals, query, deptFilter, statusFilter]);

  const byDept = useMemo(() => {
    const m = new Map<string, ProposalRow[]>();
    for (const p of filtered) {
      if (!m.has(p.dept_code)) m.set(p.dept_code, []);
      m.get(p.dept_code)!.push(p);
    }
    // priority asc within a dept
    for (const list of m.values()) list.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const allDepts = useMemo(() => {
    const s = new Set<string>();
    for (const p of proposals) s.add(p.dept_code);
    return Array.from(s).sort();
  }, [proposals]);

  const counts = useMemo(() => ({
    total:     proposals.length,
    proposed:  proposals.filter((p) => p.status === 'proposed').length,
    generated: proposals.filter((p) => p.status === 'generated').length,
    accepted:  proposals.filter((p) => p.status === 'accepted').length,
    skipped:   proposals.filter((p) => p.status === 'skipped').length,
  }), [proposals]);

  const seededTotalInserted = seedBatches.reduce((s, b) => s + b.inserted, 0);
  const seededTotalSkipped  = seedBatches.reduce((s, b) => s + b.skipped, 0);

  async function onSeed() {
    if (seeding) return;
    if (!confirm(`Ask Claude to propose ${TOTAL_BATCHES * BATCH_SIZE} SOPs for this property in ${TOTAL_BATCHES} batches of ${BATCH_SIZE}? Duplicates by (dept, title) are skipped.`)) return;

    setSeeding(true);
    setSeedErr(null);
    setSeedBatches([]);
    setSeedMsg(`Seeding batch 1 / ${TOTAL_BATCHES} (0 / ${TOTAL_BATCHES * BATCH_SIZE})…`);

    for (let i = 0; i < TOTAL_BATCHES; i++) {
      setSeedMsg(`Seeding batch ${i + 1} / ${TOTAL_BATCHES} (${seedBatches.reduce((s, b) => s + b.inserted, 0)} inserted so far)…`);
      try {
        const res = await fetch(seedBatchHref, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            batch_index: i,
            batch_size:  BATCH_SIZE,
          }),
        });
        // PBS 2026-07-11: read raw text FIRST — if server returns HTML (Vercel
        // runtime error page), .json() throws with "Unexpected token 'A'…" and
        // we lose the real error. Text-first + defensive parse surfaces the actual message.
        const raw = await res.text();
        let j: { error?: string; inserted?: number; skipped?: number; generated?: number };
        try { j = JSON.parse(raw); }
        catch { j = { error: `Non-JSON ${res.status} response: ${raw.slice(0, 240)}` }; }
        if (!res.ok) {
          const errMsg = j.error ?? `HTTP ${res.status}: ${raw.slice(0, 200)}`;
          const failed: BatchResult = {
            batch_index: i, inserted: 0, skipped: 0, generated: 0, error: errMsg,
          };
          setSeedBatches((prev) => [...prev, failed]);
          setSeedErr(`Failed at batch ${i + 1} / ${TOTAL_BATCHES}: ${errMsg}`);
          setSeedMsg(`Stopped after batch ${i + 1} of ${TOTAL_BATCHES}. See error above.`);
          setSeeding(false);
          return;
        }
        const done: BatchResult = {
          batch_index: i,
          inserted:  j.inserted  ?? 0,
          skipped:   j.skipped   ?? 0,
          generated: j.generated ?? 0,
        };
        setSeedBatches((prev) => [...prev, done]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const failed: BatchResult = {
          batch_index: i, inserted: 0, skipped: 0, generated: 0, error: errMsg,
        };
        setSeedBatches((prev) => [...prev, failed]);
        setSeedErr(`Failed at batch ${i + 1} / ${TOTAL_BATCHES}: ${errMsg}`);
        setSeedMsg(`Stopped after batch ${i + 1} of ${TOTAL_BATCHES}. See error above.`);
        setSeeding(false);
        return;
      }
    }

    // Compute final totals from state (setState is async, so read from a
    // fresh sum after the loop).
    setSeedMsg(`Done · ${TOTAL_BATCHES} batches complete. Reloading…`);
    setTimeout(() => { window.location.reload(); }, 900);
  }

  async function onMark(id: number, status: ProposalRow['status']) {
    if (busyRow) return;
    setBusyRow(id);
    try {
      const res = await fetch('/api/sop/proposals/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      window.location.reload();
    } catch (err) {
      alert(`Mark failed: ${err instanceof Error ? err.message : String(err)}`);
      setBusyRow(null);
    }
  }

  // PBS 2026-07-11: Accept-to-Registry — creates a stub SOP in knowledge.sop_meta
  // + flips proposal status='accepted' + navigates to /operations/qa/registry.
  async function onAccept(p: ProposalRow) {
    if (busyRow) return;
    if (!confirm(`Accept "${p.title}" into the SOP registry as a stub? You can add the full body later.`)) return;
    setBusyRow(p.id);
    try {
      const res = await fetch('/api/sop/proposals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      const registryHref = propertyId === 260955 ? '/operations/qa/registry' : `/h/${propertyId}/operations/qa/registry`;
      router.push(registryHref);
    } catch (err) {
      alert(`Accept failed: ${err instanceof Error ? err.message : String(err)}`);
      setBusyRow(null);
    }
  }

  // PBS 2026-07-11: hard delete a proposal from knowledge.sop_proposals.
  // Renamed from "Skip" because Skip was soft-delete (just flagged status='skipped') and PBS wants
  // one-click permanent removal instead.
  async function onDelete(p: ProposalRow) {
    if (busyRow) return;
    if (!confirm(`Delete "${p.title}" permanently? This cannot be undone.`)) return;
    setBusyRow(p.id);
    try {
      const res = await fetch('/api/sop/proposals/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      window.location.reload();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
      setBusyRow(null);
    }
  }

  // PBS 2026-07-11: called by EditForm on successful save so the row re-renders with new values.
  function onEdited() {
    setEditingRow(null);
    setExpandedRow(null);
    window.location.reload();
  }

  function generateHref(p: ProposalRow): string {
    const qs = new URLSearchParams({
      dept: p.dept_code,
      purpose: p.purpose_short || p.title,
      proposal_id: String(p.id),
    });
    return `${generateBaseHref}?${qs.toString()}`;
  }

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Total',                    value: counts.total,     color: INK },
          { label: 'Open · to review',         value: counts.proposed,  color: SLATE },
          { label: 'Generated · body drafted', value: counts.generated, color: AMBER },
          { label: 'Accepted · in registry',   value: counts.accepted,  color: ACCENT },
        ].map((k) => (
          <div key={k.label} style={{
            background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 12,
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: k.color, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: 420 }}>
          <span aria-hidden style={{ position: 'absolute', left: 10, top: 8, fontSize: 12, color: INK_M }}>⌕</span>
          <input
            type="search"
            placeholder="Search title, purpose, dept, tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '6px 10px 6px 26px',
              border: '1px solid ' + HAIR, borderRadius: 4,
              fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE,
            }}
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          style={{
            padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 4,
            fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE, cursor: 'pointer',
          }}
        >
          <option value="all">All departments</option>
          {allDepts.map((d) => <option key={d} value={d}>{deptLabel(d)}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | ProposalRow['status'])}
          style={{
            padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 4,
            fontSize: 12, fontFamily: 'inherit', color: INK, background: WHITE, cursor: 'pointer',
          }}
        >
          <option value="all">All statuses</option>
          <option value="proposed">Proposed</option>
          <option value="generated">Generated</option>
          <option value="accepted">Accepted</option>
          <option value="skipped">Skipped</option>
        </select>
        <span style={{ fontSize: 11, color: INK_M }}>
          {filtered.length} of {proposals.length}
        </span>
        <button
          onClick={onSeed}
          disabled={seeding}
          style={{
            marginLeft: 'auto', padding: '6px 12px',
            background: seeding ? INK_L : ACCENT, color: WHITE, border: '1px solid ' + (seeding ? INK_L : ACCENT),
            borderRadius: 4, fontSize: 11, fontWeight: 600,
            cursor: seeding ? 'not-allowed' : 'pointer', letterSpacing: '0.02em',
          }}
        >
          {seeding
            ? `Seeding ${seedBatches.length} / ${TOTAL_BATCHES}…`
            : (proposals.length === 0
                ? `+ Seed ${TOTAL_BATCHES * BATCH_SIZE} proposals (${TOTAL_BATCHES}×${BATCH_SIZE})`
                : `+ Seed more (${TOTAL_BATCHES}×${BATCH_SIZE})`)}
        </button>
      </div>

      {/* Live progress panel */}
      {(seeding || seedBatches.length > 0 || seedErr || seedMsg) && (
        <div style={{
          background: WHITE,
          border: '1px solid ' + (seedErr ? RED : HAIR),
          borderLeft: '3px solid ' + (seedErr ? RED : (seeding ? AMBER : ACCENT)),
          borderRadius: 6,
          padding: 12,
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: INK_S, marginBottom: 6 }}>
            Seed status
          </div>
          {seedMsg && (
            <div style={{ fontSize: 12, color: INK, marginBottom: 6 }}>
              {seedMsg}
            </div>
          )}
          {seedErr && (
            <div style={{ fontSize: 12, color: RED, marginBottom: 6, fontWeight: 600 }}>
              {seedErr}
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${TOTAL_BATCHES}, 1fr)`,
            gap: 6,
            marginTop: 6,
          }}>
            {Array.from({ length: TOTAL_BATCHES }, (_, i) => {
              const b = seedBatches.find((x) => x.batch_index === i);
              const isCurrent = seeding && !b && seedBatches.length === i;
              const bg = b?.error ? '#FDECEC' : b ? '#EAF3EE' : isCurrent ? '#FFF7E5' : WHITE;
              const border = b?.error ? RED : b ? ACCENT : isCurrent ? AMBER : HAIR;
              const col = b?.error ? RED : b ? ACCENT : INK_M;
              return (
                <div key={i} style={{
                  padding: '6px 8px', background: bg, border: '1px solid ' + border,
                  borderRadius: 4, textAlign: 'center', fontSize: 11, color: col,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Batch {i + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>
                    {b?.error ? '×' : b ? `+${b.inserted}` : isCurrent ? '…' : '·'}
                  </div>
                  {b && !b.error && (
                    <div style={{ fontSize: 9, color: INK_L, marginTop: 2 }}>
                      {b.skipped > 0 ? `${b.skipped} dup` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {(seededTotalInserted > 0 || seededTotalSkipped > 0) && (
            <div style={{ fontSize: 11, color: INK_M, marginTop: 8 }}>
              Total: <b style={{ color: ACCENT }}>{seededTotalInserted}</b> inserted · <b style={{ color: INK_L }}>{seededTotalSkipped}</b> duplicates skipped.
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {proposals.length === 0 && !seeding && (
        <div style={{
          background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 32,
          textAlign: 'center', color: INK_M,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>No SOP proposals yet</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>
            Click the button above and Claude will draft ~{TOTAL_BATCHES * BATCH_SIZE} SOP titles across every department this property operates,
            in {TOTAL_BATCHES} batches of {BATCH_SIZE}. Each row will be a title + one-line purpose. Click Generate → review the full SOP → accept.
          </div>
        </div>
      )}

      {/* Grouped list per dept */}
      {byDept.map(([dept, list]) => (
        <div key={dept} style={{
          background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden', marginBottom: 12,
        }}>
          <div style={{
            padding: '10px 14px', background: CREAM, borderBottom: '1px solid ' + HAIR,
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: INK }}>
              {deptLabel(dept)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: INK_M }}>
              {list.length} SOP{list.length === 1 ? '' : 's'}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 40 }}>P</th>
                <th style={th}>Title &amp; purpose</th>
                <th style={{ ...th, width: 100 }}>Status</th>
                <th style={{ ...th, width: 210, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isBusy = busyRow === p.id;
                const isExpanded = expandedRow === p.id;
                const isEditing = editingRow === p.id;
                return (
                  <Fragment key={p.id}>
                  <tr>
                    <td style={{ ...td, verticalAlign: 'middle' }}>
                      <span style={priorityBadge(p.priority)}>P{p.priority}</span>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: INK, marginBottom: 2 }}>{p.title}</div>
                      {p.purpose_short && (
                        <div style={{ fontSize: 11, color: INK_M, lineHeight: 1.4 }}>{p.purpose_short}</div>
                      )}
                      {p.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {p.tags.slice(0, 5).map((t) => (
                            <span key={t} style={{
                              fontSize: 9, padding: '1px 5px', background: CREAM,
                              border: '1px solid ' + HAIR, borderRadius: 3, color: INK_M,
                            }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {p.linked_sop_code && (
                        <div style={{ fontSize: 10, color: ACCENT, marginTop: 4, fontWeight: 600 }}>
                          → {p.linked_sop_code}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, verticalAlign: 'middle' }}>
                      <span style={statusPill(p.status)}>{p.status}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {/* PBS 2026-07-11: 3 new row buttons — Preview / Edit / Accept-to-Registry */}
                        <button
                          style={btn(false, false)}
                          onClick={() => setExpandedRow(isExpanded ? null : p.id)}
                        >
                          {isExpanded ? 'Hide' : 'Preview'}
                        </button>
                        {p.status !== 'accepted' && (
                          <button
                            style={btn(false, false)}
                            onClick={() => { setEditingRow(isEditing ? null : p.id); setExpandedRow(p.id); }}
                          >
                            {isEditing ? 'Cancel' : 'Edit'}
                          </button>
                        )}
                        {p.status !== 'accepted' && (
                          <button
                            style={btn(true, isBusy)}
                            disabled={isBusy}
                            onClick={() => onAccept(p)}
                          >
                            Accept →
                          </button>
                        )}
                        {p.status !== 'accepted' && (
                          <a href={generateHref(p)} style={btn(false, isBusy)}>
                            {p.status === 'generated' ? 'Re-open' : 'Generate'}
                          </a>
                        )}
                        {p.status !== 'accepted' && (
                          <button
                            style={{ ...btn(false, isBusy), color: RED, borderColor: RED }}
                            disabled={isBusy}
                            onClick={() => onDelete(p)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} style={{ padding: '10px 14px', background: '#FAFAF7', borderBottom: '1px solid ' + HAIR }}>
                        {isEditing ? (
                          <EditForm proposal={p} onCancel={() => { setEditingRow(null); setExpandedRow(null); }} onSaved={onEdited} />
                        ) : (
                          <div style={{ fontSize: 12, color: INK, lineHeight: 1.6 }}>
                            <div style={{ marginBottom: 6 }}><strong>Dept:</strong> {deptLabel(p.dept_code)} · <strong>Priority:</strong> P{p.priority} · <strong>Status:</strong> {p.status} · <strong>Scope:</strong> {p.property_scope}</div>
                            <div style={{ marginBottom: 6 }}><strong>Title:</strong> {p.title}</div>
                            <div style={{ marginBottom: 6 }}><strong>Purpose:</strong> {p.purpose_short || <em style={{ color: INK_L }}>(empty)</em>}</div>
                            {p.tags.length > 0 && (
                              <div style={{ marginBottom: 6 }}>
                                <strong>Tags:</strong>{' '}
                                {p.tags.map((t) => (
                                  <span key={t} style={{ fontSize: 10, padding: '1px 6px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 3, marginRight: 4 }}>{t}</span>
                                ))}
                              </div>
                            )}
                            {p.linked_sop_code && (
                              <div style={{ color: ACCENT, fontWeight: 600 }}>Registered as: {p.linked_sop_code}</div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// PBS 2026-07-11: inline Edit form for a single proposal row.
function EditForm({ proposal, onCancel, onSaved }: { proposal: ProposalRow; onCancel: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(proposal.title);
  const [purpose, setPurpose] = useState(proposal.purpose_short);
  const [priority, setPriority] = useState(proposal.priority);
  const [tags, setTags] = useState(proposal.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSave() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/sop/proposals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: proposal.id,
          title: title.trim(),
          purpose_short: purpose.trim(),
          priority: Math.max(1, Math.min(3, Number(priority) || 2)),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const input: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 12, fontFamily: 'inherit' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: INK_S, marginBottom: 3 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <label style={lbl}>Title</label>
        <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label style={lbl}>Purpose (one line)</label>
        <input style={input} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="short description of what this SOP covers" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
        <div>
          <label style={lbl}>Priority</label>
          <select style={input} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            <option value={1}>P1</option>
            <option value={2}>P2</option>
            <option value={3}>P3</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Tags (comma-separated)</label>
          <input style={input} value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
      </div>
      {err && <div style={{ color: RED, fontSize: 11 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button style={btn(true, busy)} disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button style={btn(false, busy)} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
