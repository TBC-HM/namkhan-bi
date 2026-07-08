'use client';

// app/operations/qa/proposals/_components/SopProposalList.tsx
// PBS 2026-07-08: AI-proposed SOP catalog. Rows are drafts of SOPs the AI thinks
// this property needs. "Generate" → jumps to /operations/qa/generate?dept=X&purpose=Y&proposal_id=Z
// which pre-fills the form. On accept, save handler flips status via fn_sop_proposal_mark.
//
// Paper-white + hairlines. No var(--paper-warm). No function props from server.

import { useMemo, useState } from 'react';

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
  seedHref: string;           // '/api/sop/proposals/seed'
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
  if (p === 1) return { ...base, color: '#B00020', borderColor: '#B00020' };
  if (p === 2) return { ...base, color: AMBER,     borderColor: AMBER };
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

export default function SopProposalList({ proposals, generateBaseHref, seedHref, propertyId }: Props) {
  const [query, setQuery]         = useState('');
  const [deptFilter, setDeptFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProposalRow['status']>('all');
  const [seeding, setSeeding]     = useState(false);
  const [seedMsg, setSeedMsg]     = useState<string | null>(null);
  const [busyRow, setBusyRow]     = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter((p) => {
      if (deptFilter !== 'all' && p.dept_code !== deptFilter) return false;
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

  async function onSeed() {
    if (seeding) return;
    if (!confirm('Ask Claude to propose ~300 SOPs for this property? This calls the Anthropic API and inserts into knowledge.sop_proposals. Duplicates by (dept, title) are skipped.')) return;
    setSeeding(true); setSeedMsg('Calling Claude — this can take 30-60s…');
    try {
      const res = await fetch(seedHref, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `HTTP ${res.status}`);
      setSeedMsg(`Seeded ${j.inserted ?? 0} proposals (${j.skipped ?? 0} duplicates skipped). Reloading…`);
      setTimeout(() => { window.location.reload(); }, 900);
    } catch (err) {
      setSeedMsg(`Seed failed: ${err instanceof Error ? err.message : String(err)}`);
      setSeeding(false);
    }
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
          { label: 'Proposals',  value: counts.total,     color: INK },
          { label: 'To review',  value: counts.proposed,  color: SLATE },
          { label: 'Generated',  value: counts.generated, color: AMBER },
          { label: 'Accepted',   value: counts.accepted,  color: ACCENT },
          { label: 'Skipped',    value: counts.skipped,   color: INK_L },
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
          {seeding ? 'Seeding…' : (proposals.length === 0 ? '+ Seed 300 proposals (Claude)' : '+ Seed more (Claude)')}
        </button>
      </div>
      {seedMsg && <div style={{ fontSize: 11, color: INK_M, marginBottom: 12 }}>{seedMsg}</div>}

      {/* Empty state */}
      {proposals.length === 0 && !seeding && (
        <div style={{
          background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, padding: 32,
          textAlign: 'center', color: INK_M,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 6 }}>No SOP proposals yet</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}>
            Click the button above and Claude will draft ~300 SOP titles across every department this property operates.
            Each row will be a title + one-line purpose. You click Generate → review the full SOP → accept.
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
                return (
                  <tr key={p.id}>
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
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {p.status !== 'accepted' && (
                          <a
                            href={generateHref(p)}
                            style={btn(true, isBusy)}
                          >
                            {p.status === 'generated' ? 'Re-open' : 'Generate'}
                          </a>
                        )}
                        {p.status === 'proposed' && (
                          <button
                            style={btn(false, isBusy)}
                            disabled={isBusy}
                            onClick={() => onMark(p.id, 'skipped')}
                          >
                            Skip
                          </button>
                        )}
                        {p.status === 'skipped' && (
                          <button
                            style={btn(false, isBusy)}
                            disabled={isBusy}
                            onClick={() => onMark(p.id, 'proposed')}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
