'use client';
// app/sales/leads/_components/LeadsCockpit.tsx
// PBS 2026-07-11 pm — ADR-147 Sales CRM. Leads cockpit client.
// Renders KPIs · inbound queue · filters · List/Board toggle · advance/convert actions.

import { Fragment, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface LeadRow {
  id: number; property_id: number; company_name: string | null; type: string | null;
  country: string | null; city: string | null; decision_maker_name: string | null;
  decision_maker_role: string | null; email: string | null;
  icp_score: number | null; intent_score: number | null; final_priority: string | null;
  status: string | null; stage: string | null; origin: string | null;
  account_id: string | null; prospect_id: string | null; icp_segment_id: string | null;
  created_at: string | null; updated_at: string | null;
}
export interface StageRow { stage_key: string; stage_order: number; display_name: string; is_won: boolean; is_lost: boolean }
export interface InboundRow { id: string; property_id: number; company: string | null; contact: string | null; email: string | null; phone: string | null; country: string | null; source: string | null; created_at: string | null }

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#1F3A2E';
const SAND  = '#B8A878';
const TERRA = '#B8542A';
const CREAM = '#F5F0E1';
const BG    = '#F4EFE2';

type ViewMode = 'list' | 'board';
type Filter = 'all' | 'inbound' | 'outbound' | 'hot' | 'wholesale' | 'dmc' | 'agent' | 'corp' | 'retreat';

function bar(pct: number | null | undefined, color: string) {
  const p = Math.max(0, Math.min(100, Number(pct ?? 0)));
  return (
    <div style={{ position: 'relative', height: 6, background: HAIR, borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ position: 'absolute', inset: 0, width: p + '%', background: color, borderRadius: 999 }} />
    </div>
  );
}

function originBadge(origin: string | null | undefined) {
  const isIn = origin === 'inbound';
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600,
    padding: '2px 6px', borderRadius: 2, letterSpacing: '.04em',
    background: isIn ? '#E8F0EC' : '#FBF3E0',
    color: isIn ? FOREST : TERRA,
  };
  return <span style={style}>{isIn ? '↙ IN' : '↗ OUT'}</span>;
}

function stagePill(stage: string | null | undefined, stages: StageRow[]) {
  const s = stages.find((x) => x.stage_key === stage);
  const bg = s?.is_won ? '#E8F0EC' : s?.is_lost ? '#FBE7E4' : CREAM;
  const fg = s?.is_won ? FOREST : s?.is_lost ? TERRA : INK_S;
  return (
    <span style={{ display: 'inline-block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', padding: '2px 6px', borderRadius: 2, fontWeight: 600, background: bg, color: fg }}>
      {s?.display_name ?? stage ?? '—'}
    </span>
  );
}

function StageDropdown({ leadId, stage, stages, onChange }: { leadId: number; stage: string | null; stages: StageRow[]; onChange: (id: number, s: string) => void }) {
  return (
    <select value={stage ?? 'new'} onChange={(e) => onChange(leadId, e.target.value)}
            style={{ fontSize: 12, padding: '4px 6px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 2, color: INK }}>
      {stages.map((s) => (
        <option key={s.stage_key} value={s.stage_key}>{s.display_name}</option>
      ))}
    </select>
  );
}

export default function LeadsCockpit({ leads: leadsInit, stages, inbound, propertyId }: {
  leads: LeadRow[]; stages: StageRow[]; inbound: InboundRow[]; propertyId: number;
}) {
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<Filter>('all');
  const [leads, setLeads] = useState<LeadRow[]>(leadsInit);
  const [banner, setBanner] = useState<string | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

  // KPIs derived from leads array
  const kpis = useMemo(() => {
    const open = leads.filter((l) => !(l.stage === 'won' || l.stage === 'lost' || l.status === 'converted' || l.status === 'lost')).length;
    const qualifiedPlus = leads.filter((l) => ['qualified','proposal','negotiation'].includes(l.stage ?? '')).length;
    const hot = leads.filter((l) => (l.icp_score ?? 0) >= 75).length;
    const contracted = leads.filter((l) => l.stage === 'won').length;
    return { open, qualifiedPlus, hot, contracted };
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filter === 'all') return true;
      if (filter === 'inbound')  return l.origin === 'inbound';
      if (filter === 'outbound') return l.origin !== 'inbound';
      if (filter === 'hot')      return (l.icp_score ?? 0) >= 75;
      return (l.type ?? '').toLowerCase().includes(filter);
    });
  }, [leads, filter]);

  const byStage = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const s of stages) map.set(s.stage_key, []);
    for (const l of filtered) {
      const k = l.stage ?? 'new';
      map.get(k)?.push(l);
    }
    return map;
  }, [filtered, stages]);

  async function advance(id: number, nextStage: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage: nextStage } : l)));
    try {
      const r = await fetch('/api/sales/leads/advance-stage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id, stage: nextStage }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'advance failed');
      setBanner('Lead #' + id + ' → ' + nextStage);
    } catch (err) {
      setBanner('Advance failed: ' + (err as Error).message);
      start(() => router.refresh());
    }
  }

  async function convert(id: number) {
    if (!confirm('Convert lead #' + id + ' to an Account + Contact + Deal?')) return;
    try {
      const r = await fetch('/api/sales/leads/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'convert failed');
      setBanner('Converted lead #' + id + ' — account/contact/deal created.');
      start(() => router.refresh());
    } catch (err) {
      setBanner('Convert failed: ' + (err as Error).message);
    }
  }

  async function promoteInquiry(inquiryId: string) {
    try {
      const r = await fetch('/api/sales/inquiries/promote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inquiry_id: inquiryId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'promote failed');
      setBanner('Inbound inquiry added to pipeline (lead #' + j.lead_id + ' at Engaged).');
      start(() => router.refresh());
    } catch (err) {
      setBanner('Promote failed: ' + (err as Error).message);
    }
  }

  const nextStage = (cur: string | null): string | null => {
    const idx = stages.findIndex((s) => s.stage_key === cur);
    if (idx < 0 || idx >= stages.length - 2) return null;
    return stages[idx + 1]?.stage_key ?? null;
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {banner ? (
        <div style={{ background: FOREST, color: WHITE, padding: '10px 14px', borderRadius: 4, fontSize: 13 }}>
          {banner} <button onClick={() => setBanner(null)} style={{ marginLeft: 12, background: 'transparent', color: WHITE, border: 'none', cursor: 'pointer', fontWeight: 600 }}>×</button>
        </div>
      ) : null}

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Open" value={String(kpis.open)} hint="all not-terminal" />
        <Kpi label="Qualified+" value={String(kpis.qualifiedPlus)} hint="qualified/proposal/negotiation" />
        <Kpi label="Hot (ICP≥75)" value={String(kpis.hot)} hint="scoring model driven" />
        <Kpi label="Contracted" value={String(kpis.contracted)} hint="reached Won" />
      </div>

      {/* Inbound queue */}
      {inbound.length > 0 ? (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: INK_M, fontWeight: 500 }}>Inbound queue · Wholesale/B2B</div>
            <div style={{ fontSize: 11, color: INK_M }}>{inbound.length} awaiting</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Source</th><th style={TH}>Company / Contact</th>
                <th style={TH}>Email</th><th style={TH}>Country</th>
                <th style={TH}>Received</th><th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {inbound.map((q) => (
                <tr key={q.id}>
                  <td style={TD}>{q.source ?? '—'}</td>
                  <td style={TD}>{q.company ?? '—'} <span style={{ color: INK_M, fontSize: 11 }}>· {q.contact ?? ''}</span></td>
                  <td style={{ ...TD, color: INK_M }}>{q.email ?? '—'}</td>
                  <td style={{ ...TD, color: INK_M }}>{q.country ?? '—'}</td>
                  <td style={{ ...TD, color: INK_M }}>{fmtDate(q.created_at)}</td>
                  <td style={TD}><button onClick={() => promoteInquiry(q.id)} style={BTN_PRIMARY}>Add to pipeline →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 4, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 4 }}>
          <button onClick={() => setView('list')}  style={{ ...MODE, ...(view === 'list'  ? MODE_ACTIVE : {}) }}>List</button>
          <button onClick={() => setView('board')} style={{ ...MODE, ...(view === 'board' ? MODE_ACTIVE : {}) }}>Pipeline board</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all','inbound','outbound','hot','wholesale','dmc','agent','corp','retreat'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ ...CHIP, ...(filter === f ? CHIP_ACTIVE : {}) }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Body — list or board */}
      {view === 'list' ? (
        <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Origin</th>
                <th style={TH}>Company</th>
                <th style={TH}>Contact</th>
                <th style={TH}>Type</th>
                <th style={TH}>ICP</th>
                <th style={TH}>Intent</th>
                <th style={TH}>Stage</th>
                <th style={TH}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => {
                const ns = nextStage(l.stage);
                const canConvert = l.stage === 'negotiation';
                return (
                  <tr key={l.id}>
                    <td style={TD}>{originBadge(l.origin)}</td>
                    <td style={TD}>{l.company_name ?? '—'} <div style={{ color: INK_M, fontSize: 11 }}>{l.country ?? ''}{l.city ? ' · ' + l.city : ''}</div></td>
                    <td style={{ ...TD, color: INK_M }}>{l.decision_maker_name ?? '—'}<div style={{ fontSize: 11 }}>{l.decision_maker_role ?? ''}</div></td>
                    <td style={{ ...TD, color: INK_M }}>{l.type ?? '—'}</td>
                    <td style={{ ...TD, minWidth: 100 }}>{bar(l.icp_score, FOREST)}<div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{l.icp_score ?? '—'}</div></td>
                    <td style={{ ...TD, minWidth: 100 }}>{bar(l.intent_score, SAND)}<div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>{l.intent_score ?? '—'}</div></td>
                    <td style={TD}><StageDropdown leadId={l.id} stage={l.stage} stages={stages} onChange={advance} /></td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      {canConvert ? (
                        <button onClick={() => convert(l.id)} style={BTN_PRIMARY}>Convert to client →</button>
                      ) : ns ? (
                        <button onClick={() => advance(l.id, ns)} style={BTN_SECONDARY}>Advance →</button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', color: INK_M }}>No leads match this filter.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + stages.length + ', minmax(220px, 1fr))', gap: 8, overflowX: 'auto' }}>
          {stages.map((s) => {
            const list = byStage.get(s.stage_key) ?? [];
            const stageColor = s.is_won ? FOREST : s.is_lost ? TERRA : INK_S;
            return (
              <div key={s.stage_key} style={{ background: BG, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600, color: stageColor }}>{s.display_name}</div>
                  <div style={{ fontSize: 11, color: INK_M }}>{list.length}</div>
                </div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {list.map((l) => {
                    const ns = nextStage(l.stage);
                    return (
                      <div key={l.id} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: INK }}>{l.company_name ?? '—'}</div>
                          {originBadge(l.origin)}
                        </div>
                        <div style={{ fontSize: 11, color: INK_M, marginTop: 3 }}>{l.decision_maker_name ?? '—'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                          <div><div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>ICP</div>{bar(l.icp_score, FOREST)}</div>
                          <div><div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>Intent</div>{bar(l.intent_score, SAND)}</div>
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                          {s.stage_key === 'negotiation' ? (
                            <button onClick={() => convert(l.id)} style={{ ...BTN_PRIMARY, fontSize: 10 }}>Convert →</button>
                          ) : ns ? (
                            <button onClick={() => advance(l.id, ns)} style={{ ...BTN_SECONDARY, fontSize: 10 }}>Advance →</button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {list.length === 0 ? <div style={{ fontSize: 10, color: INK_M, textAlign: 'center', padding: 8 }}>empty</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pending ? <div style={{ fontSize: 11, color: INK_M }}>Refreshing…</div> : null}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 16 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: INK_M, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, color: INK, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {hint ? <div style={{ marginTop: 6, fontSize: 11, color: INK_M }}>{hint}</div> : null}
    </div>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return String(d); }
}

const TH: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: INK_S, padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontWeight: 500 };
const TD: React.CSSProperties = { padding: '10px 8px', borderBottom: '1px solid ' + HAIR, fontSize: 13, color: INK, verticalAlign: 'top' };
const MODE: React.CSSProperties = { padding: '6px 14px', fontSize: 12, background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', borderRadius: 2 };
const MODE_ACTIVE: React.CSSProperties = { background: BG, color: FOREST, fontWeight: 600 };
const CHIP: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 2, cursor: 'pointer', color: INK_M, textTransform: 'capitalize' };
const CHIP_ACTIVE: React.CSSProperties = { background: FOREST, color: WHITE, borderColor: FOREST };
const BTN_PRIMARY: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: FOREST, color: WHITE, border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
const BTN_SECONDARY: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: WHITE, color: FOREST, border: '1px solid ' + FOREST, borderRadius: 2, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
