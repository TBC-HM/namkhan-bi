'use client';
// app/sales/pipeline/_components/PipelineCockpit.tsx
// PBS 2026-07-11 pm — Design System rebuild.
// Primitives used:
//   MetricRow (4 KpiTile)  ·  Container (filters, list, board columns)
//   Chart variant="cards" for the list rows and the board cards.
// Actions untouched: /api/sales/leads/advance-stage + /api/sales/leads/promote.

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  MetricRow,
  Chart,
  type KpiTileProps,
} from '@/app/(cockpit)/_design';

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

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#1F3A2E';
const SAND  = '#B8A878';
const TERRA = '#B8542A';
const BG    = '#FBF6E9';

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

export default function PipelineCockpit({ leads: leadsInit, stages }: {
  leads: LeadRow[]; stages: StageRow[]; propertyId: number;
}) {
  const [view, setView] = useState<ViewMode>('board');
  const [filter, setFilter] = useState<Filter>('all');
  const [leads, setLeads] = useState<LeadRow[]>(leadsInit);
  const [banner, setBanner] = useState<string | null>(null);
  const router = useRouter();
  const [pending, start] = useTransition();

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

  const nextStage = (cur: string | null): string | null => {
    const idx = stages.findIndex((s) => s.stage_key === cur);
    if (idx < 0 || idx >= stages.length - 2) return null;
    return stages[idx + 1]?.stage_key ?? null;
  };

  const kpiTiles: KpiTileProps[] = [
    { label: 'Open',           value: kpis.open,          size: 'sm', footnote: 'all not-terminal' },
    { label: 'Qualified+',     value: kpis.qualifiedPlus, size: 'sm', footnote: 'qualified/proposal/negot.' },
    { label: 'Hot (ICP≥75)',   value: kpis.hot,           size: 'sm', footnote: 'scoring-model driven', status: kpis.hot > 0 ? 'green' : 'grey' },
    { label: 'Contracted',     value: kpis.contracted,    size: 'sm', footnote: 'reached Won', status: 'green' },
  ];

  // Cards data for list rows
  const listCards = filtered.map((l) => ({ id: String(l.id), _l: l }));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {banner ? (
        <div style={{ gridColumn: '1 / -1', background: FOREST, color: WHITE, padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          {banner} <button onClick={() => setBanner(null)} style={{ marginLeft: 12, background: 'transparent', color: WHITE, border: 'none', cursor: 'pointer', fontWeight: 600 }}>×</button>
        </div>
      ) : null}

      <div style={{ gridColumn: '1 / -1' }}>
        <MetricRow tiles={kpiTiles} size="sm" />
      </div>

      <div style={{ gridColumn: '1 / -1' }}>
        <Container title="Filters" density="compact" expandable={false} action={
          <div style={{ display: 'flex', gap: 4, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: 3 }}>
            <button onClick={() => setView('list')}  style={{ ...MODE, ...(view === 'list'  ? MODE_ACTIVE : {}) }}>List</button>
            <button onClick={() => setView('board')} style={{ ...MODE, ...(view === 'board' ? MODE_ACTIVE : {}) }}>Pipeline board</button>
          </div>
        }>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['all','inbound','outbound','hot','wholesale','dmc','agent','corp','retreat'] as Filter[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ ...CHIP, ...(filter === f ? CHIP_ACTIVE : {}) }}>{f}</button>
            ))}
          </div>
        </Container>
      </div>

      {view === 'list' ? (
        <div style={{ gridColumn: '1 / -1' }}>
          <Container title={filter === 'all' ? 'All leads' : filter[0].toUpperCase() + filter.slice(1) + ' leads'} subtitle={filtered.length + ' rows'}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 12, color: INK_M, textAlign: 'center', padding: 16 }}>No leads match this filter.</div>
            ) : (
              <Chart
                variant="cards"
                data={listCards}
                renderItem={(row) => {
                  const l = (row as { _l: LeadRow })._l;
                  const ns = nextStage(l.stage);
                  const canConvert = l.stage === 'negotiation';
                  return (
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: INK }}>{l.company_name ?? '—'}</span>
                        {originBadge(l.origin)}
                      </div>
                      <div style={{ fontSize: 11, color: INK_M }}>{l.decision_maker_name ?? '—'}{l.decision_maker_role ? ' · ' + l.decision_maker_role : ''}</div>
                      <div style={{ fontSize: 10, color: INK_M }}>{l.type ?? '—'} · {l.country ?? ''}{l.city ? ' · ' + l.city : ''}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                        <div><div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>ICP {l.icp_score ?? '—'}</div>{bar(l.icp_score, FOREST)}</div>
                        <div><div style={{ fontSize: 9, color: INK_M, marginBottom: 2 }}>Intent {l.intent_score ?? '—'}</div>{bar(l.intent_score, SAND)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                        <select
                          value={l.stage ?? 'new'}
                          onChange={(e) => advance(l.id, e.target.value)}
                          style={{ fontSize: 11, padding: '3px 6px', background: WHITE, border: '1px solid ' + HAIR, borderRadius: 2, color: INK, flex: 1 }}
                        >
                          {stages.map((s) => <option key={s.stage_key} value={s.stage_key}>{s.display_name}</option>)}
                        </select>
                        {canConvert ? (
                          <button onClick={() => convert(l.id)} style={BTN_PRIMARY}>Convert →</button>
                        ) : ns ? (
                          <button onClick={() => advance(l.id, ns)} style={BTN_SECONDARY}>Advance →</button>
                        ) : null}
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </Container>
        </div>
      ) : (
        <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(' + stages.length + ', minmax(240px, 1fr))', gap: 10, overflowX: 'auto' }}>
          {stages.map((s) => {
            const list = byStage.get(s.stage_key) ?? [];
            const stageColor = s.is_won ? FOREST : s.is_lost ? TERRA : INK;
            return (
              <Container
                key={s.stage_key}
                title={s.display_name}
                subtitle={list.length + ' leads'}
                density="compact"
                expandable={false}
                status={s.is_won ? 'green' : s.is_lost ? 'red' : undefined}
              >
                <div style={{ display: 'grid', gap: 8 }}>
                  {list.length === 0 ? (
                    <div style={{ fontSize: 10, color: INK_M, textAlign: 'center', padding: 8 }}>empty</div>
                  ) : list.map((l) => {
                    const ns = nextStage(l.stage);
                    return (
                      <div key={l.id} style={{ background: BG, border: '1px solid ' + HAIR, borderRadius: 4, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: stageColor }}>{l.company_name ?? '—'}</div>
                          {originBadge(l.origin)}
                        </div>
                        <div style={{ fontSize: 11, color: INK_M, marginTop: 3 }}>{l.decision_maker_name ?? '—'}</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
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
                </div>
              </Container>
            );
          })}
        </div>
      )}

      {pending ? <div style={{ gridColumn: '1 / -1', fontSize: 11, color: INK_M }}>Refreshing…</div> : null}
    </div>
  );
}

const MODE: React.CSSProperties = { padding: '5px 12px', fontSize: 11, background: 'transparent', border: 'none', color: INK_M, cursor: 'pointer', borderRadius: 2 };
const MODE_ACTIVE: React.CSSProperties = { background: FOREST, color: WHITE, fontWeight: 600 };
const CHIP: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 2, cursor: 'pointer', color: INK_M, textTransform: 'capitalize' };
const CHIP_ACTIVE: React.CSSProperties = { background: FOREST, color: WHITE, borderColor: FOREST };
const BTN_PRIMARY: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: FOREST, color: WHITE, border: 'none', borderRadius: 2, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
const BTN_SECONDARY: React.CSSProperties = { padding: '4px 10px', fontSize: 11, background: WHITE, color: FOREST, border: '1px solid ' + FOREST, borderRadius: 2, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
