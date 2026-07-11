'use client';

// app/operations/qa/proposals/_components/SopProposalList.tsx
// PBS 2026-07-08: AI-proposed SOP catalog. Rows are drafts of SOPs the AI thinks
// this property needs. "Generate" → jumps to /operations/qa/generate?dept=X&purpose=Y&proposal_id=Z
// which pre-fills the form. On accept, save handler flips status via fn_sop_proposal_mark.
//
// Paper-white + hairlines. No var(--paper-warm). No function props from server.
//
// 2026-07-08 (bug-1): seed operation loops 6× client-side hitting
// /api/sop/proposals/seed-batch with { batch_index, batch_size } so max_tokens
// stays comfortable. Progress inline.
//
// 2026-07-11 pm (dir 3): bulk-select + Generate-all + Accept-all + Delete-all.
//   - Row checkbox + header checkbox (indeterminate on partial).
//   - Sticky action bar when selectedIds.size > 0.
//   - Per-status eligibility gating so we don't call generate on a row that's
//     already accepted, etc. Buttons show "N of M eligible" when the mix
//     doesn't line up.

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
  generateBaseHref: string;
  seedBatchHref: string;
  propertyId: number;
}

const DEPT_LABEL: Record<string, string> = {
  housekeeping: 'Housekeeping', kitchen: 'F&B', front_office: 'Front Office',
  maintenance: 'Engineering', governance: 'Governance', procurement: 'Procurement',
  hr: 'HR', spa: 'Spa', marketing: 'Marketing', revenue: 'Revenue',
  sales: 'Sales', finance: 'Finance', it: 'IT', activities: 'Activities',
  retail: 'Retail', transport: 'Transport', reception: 'Reception',
  security: 'Security', wellness: 'Wellness', sustainability: 'Sustainability',
  safety: 'Safety', laundry: 'Laundry', purchasing: 'Purchasing',
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
  return { ...base, background: WHITE, color: SLATE, borderColor: HAIR };
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

// PBS 2026-07-11 pm (dir 3) — per-item bulk result surfacing.
interface BulkFailure { id: number; title: string; error: string }

export default function SopProposalList({ proposals, generateBaseHref, seedBatchHref, propertyId }: Props) {
  const [query, setQuery]           = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalRow['status']>('all');
  const [seeding, setSeeding]       = useState(false);
  const [seedMsg, setSeedMsg]       = useState<string | null>(null);
  const [seedErr, setSeedErr]       = useState<string | null>(null);
  const [seedBatches, setSeedBatches] = useState<BatchResult[]>([]);
  const [busyRow, setBusyRow]       = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [editingRow, setEditingRow]   = useState<number | null>(null);

  // PBS 2026-07-11 pm (dir 3) — bulk state.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy]       = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [bulkFailures, setBulkFailures] = useState<BulkFailure[]>([]);
  const [bulkOkMsg, setBulkOkMsg]     = useState<string | null>(null);

  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter((p) => {
      if (deptFilter !== 'all' && p.dept_code !== deptFilter) return false;
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

  // -- Bulk selection helpers ------------------------------------------------

  const filteredIds = useMemo(() => new Set(filtered.map((p) => p.id)), [filtered]);
  const selectedInFilter = useMemo(() => {
    let n = 0;
    for (const id of selectedIds) if (filteredIds.has(id)) n++;
    return n;
  }, [selectedIds, filteredIds]);
  const allFilteredChecked = filtered.length > 0 && selectedInFilter === filtered.length;
  const someFilteredChecked = selectedInFilter > 0 && !allFilteredChecked;

  function toggleRow(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); }

  // Eligibility rules per bulk action:
  //   Generate → only status='proposed' rows have a generate step (the existing
  //     per-row link goes to /operations/qa/generate?…&proposal_id=X). For bulk
  //     we call the same URL server-side. Rows already 'generated' or 'accepted'
  //     are skipped from eligibility count.
  //   Accept   → status in ('proposed','generated') — Accept API tolerates both
  //     (it stubs the SOP + flips status='accepted'). Accepted rows skipped.
  //   Delete   → any non-accepted row (accepted rows can't be deleted from here).
  const selectedProposals = useMemo(
    () => proposals.filter((p) => selectedIds.has(p.id)),
    [proposals, selectedIds]
  );
  const genEligible    = selectedProposals.filter((p) => p.status === 'proposed');
  const acceptEligible = selectedProposals.filter((p) => p.status === 'proposed' || p.status === 'generated');
  const deleteEligible = selectedProposals.filter((p) => p.status !== 'accepted');

  // -- Bulk action runners ---------------------------------------------------

  async function runBulk(
    items: ProposalRow[],
    verb: 'generate' | 'accept' | 'delete',
    call: (p: ProposalRow) => Promise<Response>,
  ) {
    if (bulkBusy || items.length === 0) return;
    setBulkBusy(true);
    setBulkFailures([]);
    setBulkOkMsg(null);
    const failures: BulkFailure[] = [];
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      setBulkProgress(verb.charAt(0).toUpperCase() + verb.slice(1) + 'ing ' + (i + 1) + ' / ' + items.length + '…');
      try {
        const res = await call(p);
        const j = await res.json().catch(() => ({}));
        if (!res.ok || j.ok === false) {
          failures.push({ id: p.id, title: p.title, error: j.error ?? ('HTTP ' + res.status) });
        } else {
          ok++;
        }
      } catch (err) {
        failures.push({ id: p.id, title: p.title, error: err instanceof Error ? err.message : String(err) });
      }
    }
    setBulkProgress(null);
    setBulkFailures(failures);
    setBulkOkMsg(ok + ' ' + verb + 'd · ' + failures.length + ' failed');
    setBulkBusy(false);
    // clear selection + refresh so status pills / KPIs reflect reality
    setSelectedIds(new Set());
    router.refresh();
    // window.location.reload() is heavier; refresh() is enough because parent is a Server Component.
  }

  async function onBulkGenerate() {
    if (genEligible.length === 0) return;
    if (!confirm('Kick off Generate on ' + genEligible.length + ' proposal(s)? Each item calls the generator sequentially.')) return;
    await runBulk(genEligible, 'generate', (p) => fetch('/api/sop/proposals/generate-one', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, dept: p.dept_code, purpose: p.purpose_short || p.title }),
    }));
  }

  async function onBulkAccept() {
    if (acceptEligible.length === 0) return;
    if (!confirm('Accept ' + acceptEligible.length + ' proposal(s) into the SOP registry as stubs?')) return;
    await runBulk(acceptEligible, 'accept', (p) => fetch('/api/sop/proposals/accept', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    }));
  }

  async function onBulkDelete() {
    if (deleteEligible.length === 0) return;
    if (!confirm('Delete ' + deleteEligible.length + ' proposal(s) permanently? This cannot be undone.')) return;
    await runBulk(deleteEligible, 'delete', (p) => fetch('/api/sop/proposals/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id }),
    }));
  }

  // -- Seed batch loop (unchanged) ------------------------------------------

  async function onSeed() {
    if (seeding) return;
    if (!confirm('Ask Claude to propose ' + (TOTAL_BATCHES * BATCH_SIZE) + ' SOPs for this property in ' + TOTAL_BATCHES + ' batches of ' + BATCH_SIZE + '? Duplicates by (dept, title) are skipped.')) return;

    setSeeding(true);
    setSeedErr(null);
    setSeedBatches([]);
    setSeedMsg('Seeding batch 1 / ' + TOTAL_BATCHES + ' (0 / ' + (TOTAL_BATCHES * BATCH_SIZE) + ')…');

    for (let i = 0; i < TOTAL_BATCHES; i++) {
      setSeedMsg('Seeding batch ' + (i + 1) + ' / ' + TOTAL_BATCHES + ' (' + seedBatches.reduce((s, b) => s + b.inserted, 0) + ' inserted so far)…');
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
        const raw = await res.text();
        let j: { error?: string; inserted?: number; skipped?: number; generated?: number };
        try { j = JSON.parse(raw); }
        catch { j = { error: 'Non-JSON ' + res.status + ' response: ' + raw.slice(0, 240) }; }
        if (!res.ok) {
          const errMsg = j.error ?? ('HTTP ' + res.status + ': ' + raw.slice(0, 200));
          const failed: BatchResult = {
            batch_index: i, inserted: 0, skipped: 0, generated: 0, error: errMsg,
          };
          setSeedBatches((prev) => [...prev, failed]);
          setSeedErr('Failed at batch ' + (i + 1) + ' / ' + TOTAL_BATCHES + ': ' + errMsg);
          setSeedMsg('Stopped after batch ' + (i + 1) + ' of ' + TOTAL_BATCHES + '. See error above.');
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
        setSeedErr('Failed at batch ' + (i + 1) + ' / ' + TOTAL_BATCHES + ': ' + errMsg);
        setSeedMsg('Stopped after batch ' + (i + 1) + ' of ' + TOTAL_BATCHES + '. See error above.');
        setSeeding(false);
        return;
      }
    }

    setSeedMsg('Done · ' + TOTAL_BATCHES + ' batches complete. Reloading…');
    setTimeout(() => { window.location.reload(); }, 900);
  }

  async function onAccept(p: ProposalRow) {
    if (busyRow) return;
    if (!confirm('Accept "' + p.title + '" into the SOP registry as a stub? You can add the full body later.')) return;
    setBusyRow(p.id);
    try {
      const res = await fetch('/api/sop/proposals/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? ('HTTP ' + res.status));
      const registryHref = propertyId === 260955 ? '/operations/qa/registry' : '/h/' + propertyId + '/operations/qa/registry';
      router.push(registryHref);
    } catch (err) {
      alert('Accept failed: ' + (err instanceof Error ? err.message : String(err)));
      setBusyRow(null);
    }
  }

  async function onDelete(p: ProposalRow) {
    if (busyRow) return;
    if (!confirm('Delete "' + p.title + '" permanently? This cannot be undone.')) return;
    setBusyRow(p.id);
    try {
      const res = await fetch('/api/sop/proposals/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? ('HTTP ' + res.status));
      window.location.reload();
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : String(err)));
      setBusyRow(null);
    }
  }

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
    return generateBaseHref + '?' + qs.toString();
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

      {/* PBS 2026-07-11 pm (dir 3): sticky bulk action bar. Renders only when at least one selected. */}
      {selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, background: '#FFF8E1',
          border: '1px solid ' + AMBER, borderRadius: 6, padding: '10px 14px', marginBottom: 12,
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>
            {selectedIds.size} selected
          </div>
          <button
            onClick={onBulkGenerate}
            disabled={bulkBusy || genEligible.length === 0}
            style={{
              padding: '6px 12px', background: ACCENT, color: WHITE, border: '1px solid ' + ACCENT,
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              cursor: bulkBusy || genEligible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: bulkBusy || genEligible.length === 0 ? 0.55 : 1,
            }}
          >
            Generate all
          </button>
          {genEligible.length < selectedIds.size && (
            <span style={{ fontSize: 10, color: INK_M }}>
              {genEligible.length} of {selectedIds.size} eligible (proposed only)
            </span>
          )}

          <button
            onClick={onBulkAccept}
            disabled={bulkBusy || acceptEligible.length === 0}
            style={{
              padding: '6px 12px', background: AMBER, color: WHITE, border: '1px solid ' + AMBER,
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              cursor: bulkBusy || acceptEligible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: bulkBusy || acceptEligible.length === 0 ? 0.55 : 1,
            }}
          >
            Accept all
          </button>
          {acceptEligible.length < selectedIds.size && (
            <span style={{ fontSize: 10, color: INK_M }}>
              {acceptEligible.length} of {selectedIds.size} eligible
            </span>
          )}

          <button
            onClick={onBulkDelete}
            disabled={bulkBusy || deleteEligible.length === 0}
            style={{
              padding: '6px 12px', background: WHITE, color: RED, border: '1px solid ' + RED,
              borderRadius: 4, fontSize: 11, fontWeight: 600,
              cursor: bulkBusy || deleteEligible.length === 0 ? 'not-allowed' : 'pointer',
              opacity: bulkBusy || deleteEligible.length === 0 ? 0.55 : 1,
            }}
          >
            Delete all
          </button>

          <button
            onClick={clearSelection}
            disabled={bulkBusy}
            style={{
              background: 'transparent', border: 'none', color: INK_M, cursor: bulkBusy ? 'not-allowed' : 'pointer',
              fontSize: 11, textDecoration: 'underline', marginLeft: 'auto',
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Bulk in-flight / result banner */}
      {(bulkBusy || bulkOkMsg || bulkFailures.length > 0) && (
        <div style={{
          background: WHITE, border: '1px solid ' + (bulkFailures.length > 0 ? RED : HAIR),
          borderLeft: '3px solid ' + (bulkFailures.length > 0 ? RED : (bulkBusy ? AMBER : ACCENT)),
          borderRadius: 6, padding: 12, marginBottom: 12,
        }}>
          {bulkProgress && (
            <div style={{ fontSize: 12, color: INK, marginBottom: 6 }}>{bulkProgress}</div>
          )}
          {bulkOkMsg && !bulkBusy && (
            <div style={{ fontSize: 12, color: bulkFailures.length > 0 ? RED : ACCENT, fontWeight: 600, marginBottom: 6 }}>
              {bulkOkMsg}
            </div>
          )}
          {bulkFailures.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: RED }}>
              {bulkFailures.map((f) => (
                <li key={f.id}>#{f.id} · {f.title} · {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

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
            ? 'Seeding ' + seedBatches.length + ' / ' + TOTAL_BATCHES + '…'
            : (proposals.length === 0
                ? '+ Seed ' + (TOTAL_BATCHES * BATCH_SIZE) + ' proposals (' + TOTAL_BATCHES + '×' + BATCH_SIZE + ')'
                : '+ Seed more (' + TOTAL_BATCHES + '×' + BATCH_SIZE + ')')}
        </button>
      </div>

      {(seeding || seedBatches.length > 0 || seedErr || seedMsg) && (
        <div style={{
          background: WHITE,
          border: '1px solid ' + (seedErr ? RED : HAIR),
          borderLeft: '3px solid ' + (seedErr ? RED : (seeding ? AMBER : ACCENT)),
          borderRadius: 6, padding: 12, marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: INK_S, marginBottom: 6 }}>
            Seed status
          </div>
          {seedMsg && (
            <div style={{ fontSize: 12, color: INK, marginBottom: 6 }}>{seedMsg}</div>
          )}
          {seedErr && (
            <div style={{ fontSize: 12, color: RED, marginBottom: 6, fontWeight: 600 }}>{seedErr}</div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(' + TOTAL_BATCHES + ', 1fr)',
            gap: 6, marginTop: 6,
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
                    {b?.error ? '×' : b ? '+' + b.inserted : isCurrent ? '…' : '·'}
                  </div>
                  {b && !b.error && (
                    <div style={{ fontSize: 9, color: INK_L, marginTop: 2 }}>
                      {b.skipped > 0 ? b.skipped + ' dup' : ''}
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
                {/* PBS 2026-07-11 pm (dir 3) — master checkbox controls "select all currently-filtered". */}
                <th style={{ ...th, width: 32 }}>
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    ref={(el) => { if (el) el.indeterminate = someFilteredChecked; }}
                    onChange={toggleAllFiltered}
                    aria-label="Select all filtered"
                  />
                </th>
                <th style={{ ...th, width: 40 }}>P</th>
                <th style={th}>Title &amp; purpose</th>
                <th style={{ ...th, width: 100 }}>Status</th>
                <th style={{ ...th, width: 210, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isBusy = busyRow === p.id || bulkBusy;
                const isExpanded = expandedRow === p.id;
                const isEditing = editingRow === p.id;
                const isSelected = selectedIds.has(p.id);
                return (
                  <Fragment key={p.id}>
                  <tr style={ isSelected ? { background: '#FFFCF0' } : undefined }>
                    <td style={{ ...td, verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(p.id)}
                        aria-label={'select ' + p.title}
                      />
                    </td>
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
                      <td colSpan={5} style={{ padding: '10px 14px', background: '#FAFAF7', borderBottom: '1px solid ' + HAIR }}>
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
      if (!res.ok || !j.ok) throw new Error(j.error ?? ('HTTP ' + res.status));
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
