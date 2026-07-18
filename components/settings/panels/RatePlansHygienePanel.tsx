// components/settings/panels/RatePlansHygienePanel.tsx
// PBS 2026-07-18 · Rate plan hygiene · toggle which plans appear in the composer picker.
// Reads public.v_rate_plans_grouped (97 unique plans from 484 Cloudbeds rows deduped).
// Writes via public.fn_upsert_rate_plan_hygiene RPC.
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const AMBER = '#B87F26';
const CREAM = '#F5F0E1';
const WHITE = '#FFFFFF';

interface Row {
  rate_plan_id: string;
  effective_label: string;
  name: string | null;
  name_public: string | null;
  parent_name: string | null;
  room_type_names: string[] | null;
  featured_for_proposals: boolean;
  hidden_from_ui: boolean;
  category: string | null;
  min_los: number | null;
  max_los: number | null;
  deposit_pct: number | null;
  deposit_due_days_before_arrival: number | null;
  cancel_free_until_days_before_arrival: number | null;
  cancel_penalty_pct: number | null;
  payment_terms_text: string | null;
  cancel_terms_text: string | null;
  bookings_total: number;
  bookings_12m: number;
  last_booked_at: string | null;
  hygiene_updated_at: string | null;
}

const CATEGORIES = ['', 'BAR', 'Advance Purchase', 'Group', 'Corporate', 'Wholesale', 'Retreat', 'Package', 'Long Stay', 'Complimentary', 'Other'];

export default function RatePlansHygienePanel({ rows, propertyId }: { rows: Row[]; propertyId: number }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterFeatured, setFilterFeatured] = useState<'all'|'featured'|'unfeatured'|'hidden'>('all');
  const [searchText, setSearchText] = useState('');

  const filtered = useMemo(() => {
    let out = [...rows];
    if (filterFeatured === 'featured') out = out.filter(r => r.featured_for_proposals);
    if (filterFeatured === 'unfeatured') out = out.filter(r => !r.featured_for_proposals && !r.hidden_from_ui);
    if (filterFeatured === 'hidden') out = out.filter(r => r.hidden_from_ui);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      out = out.filter(r => (r.effective_label ?? '').toLowerCase().includes(q) || (r.category ?? '').toLowerCase().includes(q));
    }
    // Sort: featured first, then by usage, then by name
    return out.sort((a, b) => {
      if (a.featured_for_proposals !== b.featured_for_proposals) return a.featured_for_proposals ? -1 : 1;
      if ((b.bookings_12m ?? 0) !== (a.bookings_12m ?? 0)) return (b.bookings_12m ?? 0) - (a.bookings_12m ?? 0);
      return (a.effective_label ?? '').localeCompare(b.effective_label ?? '');
    });
  }, [rows, filterFeatured, searchText]);

  const stats = useMemo(() => ({
    total: rows.length,
    featured: rows.filter(r => r.featured_for_proposals).length,
    hidden: rows.filter(r => r.hidden_from_ui).length,
    used_12m: rows.filter(r => (r.bookings_12m ?? 0) > 0).length,
    never_used: rows.filter(r => (r.bookings_total ?? 0) === 0).length,
  }), [rows]);

  function toggle(row: Row, field: 'featured_for_proposals' | 'hidden_from_ui', value: boolean) {
    setError(null);
    startTransition(async () => {
      const patch: Record<string, unknown> = { p_property_id: propertyId, p_rate_plan_id: row.rate_plan_id };
      patch['p_' + field] = value;
      // If turning ON hidden, also un-feature
      if (field === 'hidden_from_ui' && value) patch['p_featured_for_proposals'] = false;
      const { error: e } = await supabase.rpc('fn_upsert_rate_plan_hygiene', patch as any);
      if (e) { setError(e.message); return; }
      router.refresh();
    });
  }

  function saveDetails(row: Row, patch: Partial<Row>) {
    setError(null);
    startTransition(async () => {
      const rpcArgs: Record<string, unknown> = { p_property_id: propertyId, p_rate_plan_id: row.rate_plan_id };
      for (const [k, v] of Object.entries(patch)) rpcArgs['p_' + k] = v;
      const { error: e } = await supabase.rpc('fn_upsert_rate_plan_hygiene', rpcArgs as any);
      if (e) { setError(e.message); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Rate Plans</div>
        <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>
          {rows.length} unique rate plans (from Cloudbeds sync). Toggle which appear in the proposal composer + set terms.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total plans', value: stats.total,      tone: INK },
          { label: 'Featured',    value: stats.featured,   tone: FOREST },
          { label: 'Used in 12m', value: stats.used_12m,   tone: INK },
          { label: 'Never used',  value: stats.never_used, tone: AMBER },
          { label: 'Hidden',      value: stats.hidden,     tone: INK_M },
        ].map(t => (
          <div key={t.label} style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 3 }}>{t.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.tone, fontVariantNumeric: 'tabular-nums' }}>{t.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FEECEA', border: '1px solid #E7A69A', borderRadius: 4, padding: 10, color: '#8A2820', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Search name / category" value={searchText} onChange={e=>setSearchText(e.target.value)} style={{ flex: '1 1 260px', padding: '6px 10px', border: '1px solid '+HAIR, borderRadius: 3, fontSize: 12, background: WHITE, color: INK }} />
        {(['all','featured','unfeatured','hidden'] as const).map(k => (
          <button key={k} onClick={()=>setFilterFeatured(k)} style={{
            padding: '5px 12px', fontSize: 11, borderRadius: 12, cursor: 'pointer',
            border: '1px solid ' + (filterFeatured === k ? FOREST : HAIR),
            background: filterFeatured === k ? FOREST : WHITE,
            color: filterFeatured === k ? WHITE : INK,
            fontWeight: filterFeatured === k ? 600 : 400,
          }}>{k === 'all' ? `All (${stats.total})` : k === 'featured' ? `Featured (${stats.featured})` : k === 'unfeatured' ? 'Not featured' : `Hidden (${stats.hidden})`}</button>
        ))}
      </div>

      <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderRadius: 6, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ background: CREAM }}>
            <tr>
              <Th w="52%">Rate plan</Th>
              <Th w="80px" right>12m</Th>
              <Th w="80px" right>Total</Th>
              <Th w="120px">Category</Th>
              <Th w="90px" center>Feature</Th>
              <Th w="90px" center>Hide</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: INK_M, fontSize: 12 }}>No rate plans match.</td></tr>
            )}
            {filtered.map(r => {
              const isOpen = expanded === r.rate_plan_id;
              return (
                <>
                  <tr key={r.rate_plan_id} style={{ borderBottom: '1px solid ' + HAIR, background: r.hidden_from_ui ? '#F5F5F5' : WHITE }}>
                    <td style={{ padding: '8px 12px' }}>
                      <button onClick={()=>setExpanded(isOpen ? null : r.rate_plan_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>
                          <span style={{ color: INK_M, marginRight: 6, fontSize: 10 }}>{isOpen ? '▾' : '▸'}</span>
                          {r.effective_label}
                          {r.hidden_from_ui && <span style={{ marginLeft: 6, fontSize: 9, background: '#EDEDED', color: INK_M, padding: '1px 5px', borderRadius: 3 }}>HIDDEN</span>}
                        </div>
                        {r.room_type_names && r.room_type_names.length > 0 && (
                          <div style={{ fontSize: 10, color: INK_M, marginTop: 2, marginLeft: 14 }}>
                            {r.room_type_names.filter(Boolean).slice(0, 4).join(' · ')}
                            {r.room_type_names.length > 4 && ` +${r.room_type_names.length - 4}`}
                          </div>
                        )}
                      </button>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.bookings_12m > 0 ? INK : INK_M, fontWeight: r.bookings_12m > 0 ? 600 : 400 }}>{r.bookings_12m || '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK_M }}>{r.bookings_total || '—'}</td>
                    <td style={{ padding: '8px 12px', color: INK_M }}>{r.category ?? '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Toggle checked={r.featured_for_proposals} disabled={busy || r.hidden_from_ui} onChange={v=>toggle(r,'featured_for_proposals',v)} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Toggle checked={r.hidden_from_ui} disabled={busy} onChange={v=>toggle(r,'hidden_from_ui',v)} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ padding: 16, background: '#FBFAF6', borderBottom: '1px solid ' + HAIR }}>
                        <DetailForm row={r} onSave={patch => saveDetails(r, patch)} busy={busy} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, w, right, center }: { children: React.ReactNode; w?: string; right?: boolean; center?: boolean }) {
  return <th style={{ padding: '8px 12px', textAlign: right ? 'right' : center ? 'center' : 'left', color: INK_M, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, borderBottom: '1px solid ' + HAIR, width: w }}>{children}</th>;
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" disabled={disabled} onClick={()=>onChange(!checked)} style={{
      width: 40, height: 22, borderRadius: 11, border: '1px solid ' + (checked ? FOREST : HAIR),
      background: checked ? FOREST : WHITE, position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1, padding: 0,
    }}>
      <span style={{ position: 'absolute', top: 1, left: checked ? 19 : 1, width: 18, height: 18, borderRadius: '50%', background: WHITE, border: '1px solid ' + HAIR, transition: 'left 100ms' }} />
    </button>
  );
}

function DetailForm({ row, onSave, busy }: { row: any; onSave: (patch: any) => void; busy: boolean }) {
  const [draft, setDraft] = useState({
    display_label: row.effective_label !== row.name ? row.effective_label : (row.display_label ?? ''),
    category: row.category ?? '',
    min_los: row.min_los?.toString() ?? '',
    max_los: row.max_los?.toString() ?? '',
    deposit_pct: row.deposit_pct?.toString() ?? '',
    deposit_due_days_before_arrival: row.deposit_due_days_before_arrival?.toString() ?? '',
    cancel_free_until_days_before_arrival: row.cancel_free_until_days_before_arrival?.toString() ?? '',
    cancel_penalty_pct: row.cancel_penalty_pct?.toString() ?? '',
    payment_terms_text: row.payment_terms_text ?? '',
    cancel_terms_text: row.cancel_terms_text ?? '',
    notes: row.notes ?? '',
  });

  function save() {
    const num = (v: string) => v.trim() === '' ? null : Number(v);
    onSave({
      display_label: draft.display_label.trim() || null,
      category: draft.category.trim() || null,
      min_los: num(draft.min_los),
      max_los: num(draft.max_los),
      deposit_pct: num(draft.deposit_pct),
      deposit_due_days_before_arrival: num(draft.deposit_due_days_before_arrival),
      cancel_free_until_days_before_arrival: num(draft.cancel_free_until_days_before_arrival),
      cancel_penalty_pct: num(draft.cancel_penalty_pct),
      payment_terms_text: draft.payment_terms_text.trim() || null,
      cancel_terms_text: draft.cancel_terms_text.trim() || null,
      notes: draft.notes.trim() || null,
    });
  }
  const set = (k: string, v: any) => setDraft({ ...draft, [k]: v });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
      <L label="Display label (override)">
        <input value={draft.display_label} onChange={e=>set('display_label', e.target.value)} style={inp} placeholder={row.name ?? 'plan name'} />
      </L>
      <L label="Category">
        <select value={draft.category} onChange={e=>set('category', e.target.value)} style={inp}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c || '— none —'}</option>)}
        </select>
      </L>
      <L label="Min LoS (nights)"><input type="number" min={1} value={draft.min_los} onChange={e=>set('min_los', e.target.value)} style={inp} /></L>
      <L label="Max LoS (nights)"><input type="number" min={1} value={draft.max_los} onChange={e=>set('max_los', e.target.value)} style={inp} /></L>
      <L label="Deposit %"><input type="number" min={0} max={100} step={5} value={draft.deposit_pct} onChange={e=>set('deposit_pct', e.target.value)} style={inp} /></L>
      <L label="Deposit due (days before arrival)"><input type="number" min={0} value={draft.deposit_due_days_before_arrival} onChange={e=>set('deposit_due_days_before_arrival', e.target.value)} style={inp} /></L>
      <L label="Free cancel until (days before)"><input type="number" min={0} value={draft.cancel_free_until_days_before_arrival} onChange={e=>set('cancel_free_until_days_before_arrival', e.target.value)} style={inp} /></L>
      <L label="Cancel penalty %"><input type="number" min={0} max={100} step={5} value={draft.cancel_penalty_pct} onChange={e=>set('cancel_penalty_pct', e.target.value)} style={inp} /></L>
      <L label="Payment terms (rendered on offer card)" span={2}>
        <textarea value={draft.payment_terms_text} onChange={e=>set('payment_terms_text', e.target.value)} style={{...inp, minHeight: 56}} placeholder="e.g. 50% deposit within 7 days, balance on arrival" />
      </L>
      <L label="Cancellation terms (rendered on offer card)" span={2}>
        <textarea value={draft.cancel_terms_text} onChange={e=>set('cancel_terms_text', e.target.value)} style={{...inp, minHeight: 56}} placeholder="e.g. Free cancellation until 14 days before arrival, then 50% penalty" />
      </L>
      <L label="Internal notes" span={4}>
        <input value={draft.notes} onChange={e=>set('notes', e.target.value)} style={inp} placeholder="Any operator memo — not shown to guests" />
      </L>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={save} disabled={busy} style={{ padding: '6px 14px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' }}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </div>
  );
}

function L({ label, children, span=1 }: { label: string; children: React.ReactNode; span?: number }) {
  return <div style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}>
    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid ' + HAIR, borderRadius: 3, background: WHITE, fontSize: 12, fontFamily: 'inherit' };
