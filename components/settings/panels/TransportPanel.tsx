// components/settings/panels/TransportPanel.tsx
// PBS 2026-07-12 pm — Transport section (shuttle · private car · tuktuk · boat).
'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledSelect, LabeledTextarea, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = {
  transport_id: number; property_id: number; name: string; transport_type: string | null;
  route_from: string | null; route_to: string | null;
  distance_km: number | null; duration_min: number | null; capacity_pax: number | null;
  price_amount: number | null; price_currency: string | null;
  price_includes_vat_service: boolean | null;
  dmc_price_amount: number | null; dmc_discount_pct: number | null;
  price_notes: string | null; service_time_from: string | null; service_time_to: string | null;
  available_season_codes: string[] | null;
  is_complimentary: boolean | null; is_active: boolean | null;
  bookable_via: string | null; age_restriction: string | null;
  description: string | null; notes: string | null; display_order: number | null;
};

interface Draft {
  transport_id: number | null;
  name: string; transport_type: string;
  route_from: string; route_to: string; distance_km: string; duration_min: string;
  capacity_pax: string; price_amount: string; price_currency: string;
  price_includes_vat_service: boolean;
  dmc_price_amount: string; dmc_discount_pct: string; price_notes: string;
  service_time_from: string; service_time_to: string; available_season_codes: string[];
  is_complimentary: boolean; is_active: boolean;
  bookable_via: string; age_restriction: string;
  description: string; notes: string; display_order: string;
}

const EMPTY: Draft = {
  transport_id: null, name: '', transport_type: '',
  route_from: '', route_to: '', distance_km: '', duration_min: '',
  capacity_pax: '', price_amount: '', price_currency: 'USD',
  price_includes_vat_service: true,
  dmc_price_amount: '', dmc_discount_pct: '', price_notes: '',
  service_time_from: '', service_time_to: '', available_season_codes: [],
  is_complimentary: false, is_active: true,
  bookable_via: '', age_restriction: '',
  description: '', notes: '', display_order: '',
};

const toDraft = (r: Row): Draft => ({
  transport_id: r.transport_id, name: r.name ?? '',
  transport_type: r.transport_type ?? '',
  route_from: r.route_from ?? '', route_to: r.route_to ?? '',
  distance_km: r.distance_km?.toString() ?? '',
  duration_min: r.duration_min?.toString() ?? '',
  capacity_pax: r.capacity_pax?.toString() ?? '',
  price_amount: r.price_amount?.toString() ?? '',
  price_currency: r.price_currency ?? 'USD',
  price_includes_vat_service: r.price_includes_vat_service !== false,
  dmc_price_amount: r.dmc_price_amount?.toString() ?? '',
  dmc_discount_pct: r.dmc_discount_pct?.toString() ?? '',
  price_notes: r.price_notes ?? '',
  service_time_from: r.service_time_from ? String(r.service_time_from).slice(0, 5) : '',
  service_time_to:   r.service_time_to   ? String(r.service_time_to).slice(0, 5)   : '',
  available_season_codes: r.available_season_codes ?? [],
  is_complimentary: !!r.is_complimentary, is_active: r.is_active !== false,
  bookable_via: r.bookable_via ?? '', age_restriction: r.age_restriction ?? '',
  description: r.description ?? '', notes: r.notes ?? '',
  display_order: r.display_order?.toString() ?? '',
});

const TYPE_OPTS = ['', 'shuttle', 'private_car', 'tuktuk', 'boat', 'bike', 'other'];

interface Season { season_id: number; season_code: string; display_name: string | null; }

export default function TransportPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from('v_seasons')
        .select('season_id, season_code, display_name').eq('property_id', propertyId)
        .order('date_start', { ascending: true });
      if (s) setSeasons(s as any);
    })();
  }, [propertyId]);

  const seasonCodes = Array.from(new Set(seasons.map(s => s.season_code))).filter(Boolean);

  function toggleSeason(code: string) {
    if (!draft) return;
    const has = draft.available_season_codes.includes(code);
    setDraft({
      ...draft,
      available_season_codes: has
        ? draft.available_season_codes.filter(c => c !== code)
        : [...draft.available_season_codes, code],
    });
  }

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_transport', {
        p_transport_id: draft.transport_id, p_property_id: propertyId,
        p_name: draft.name.trim(),
        p_transport_type: draft.transport_type || null,
        p_route_from: draft.route_from.trim() || null,
        p_route_to:   draft.route_to.trim()   || null,
        p_distance_km:  draft.distance_km  ? Number(draft.distance_km)  : null,
        p_duration_min: draft.duration_min ? Number(draft.duration_min) : null,
        p_capacity_pax: draft.capacity_pax ? Number(draft.capacity_pax) : null,
        p_price_amount: draft.price_amount ? Number(draft.price_amount) : null,
        p_price_currency: draft.price_currency || 'USD',
        p_price_includes_vat_service: draft.price_includes_vat_service,
        p_dmc_price_amount: draft.dmc_price_amount ? Number(draft.dmc_price_amount) : null,
        p_dmc_discount_pct: draft.dmc_discount_pct ? Number(draft.dmc_discount_pct) : null,
        p_price_notes: draft.price_notes.trim() || null,
        p_service_time_from: draft.service_time_from || null,
        p_service_time_to:   draft.service_time_to   || null,
        p_available_season_codes: draft.available_season_codes.length > 0 ? draft.available_season_codes : null,
        p_is_complimentary: draft.is_complimentary,
        p_is_active: draft.is_active,
        p_bookable_via: draft.bookable_via.trim() || null,
        p_age_restriction: draft.age_restriction.trim() || null,
        p_description: draft.description.trim() || null,
        p_notes: draft.notes.trim() || null,
        p_display_order: draft.display_order ? Number(draft.display_order) : null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }

  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_transport', { p_transport_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Transport" subtitle={`${data.length} option${data.length === 1 ? '' : 's'} · shuttle · private car · tuktuk · boat`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.transport_id ? 'Edit transport option' : 'New transport option'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Name *" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} span={2} placeholder="e.g. Airport shuttle" />
          <LabeledSelect label="Type" value={draft.transport_type} onChange={(v) => setDraft({ ...draft, transport_type: v })} options={TYPE_OPTS} />
          <LabeledInput label="Route from" value={draft.route_from} onChange={(v) => setDraft({ ...draft, route_from: v })} placeholder="e.g. Luang Prabang Airport" />
          <LabeledInput label="Route to"   value={draft.route_to}   onChange={(v) => setDraft({ ...draft, route_to: v })}   placeholder="e.g. The Namkhan" />
          <LabeledInput label="Distance (km)" value={draft.distance_km} onChange={(v) => setDraft({ ...draft, distance_km: v })} type="number" />
          <LabeledInput label="Duration (min)" value={draft.duration_min} onChange={(v) => setDraft({ ...draft, duration_min: v })} type="number" />
          <LabeledInput label="Capacity (pax)" value={draft.capacity_pax} onChange={(v) => setDraft({ ...draft, capacity_pax: v })} type="number" />
          <LabeledInput label="Service from" value={draft.service_time_from} onChange={(v) => setDraft({ ...draft, service_time_from: v })} placeholder="HH:MM" />
          <LabeledInput label="Service to"   value={draft.service_time_to}   onChange={(v) => setDraft({ ...draft, service_time_to: v })}   placeholder="HH:MM" />
          <LabeledInput label="Bookable via" value={draft.bookable_via} onChange={(v) => setDraft({ ...draft, bookable_via: v })} placeholder="reception / online" />
          <LabeledInput label="Age restriction" value={draft.age_restriction} onChange={(v) => setDraft({ ...draft, age_restriction: v })} placeholder="e.g. 3+" />
          <LabeledInput label="Display order" value={draft.display_order} onChange={(v) => setDraft({ ...draft, display_order: v })} type="number" />
          {/* PRICE */}
          <LabeledInput label="Price (all-in)" value={draft.price_amount} onChange={(v) => setDraft({ ...draft, price_amount: v })} type="number" />
          <LabeledInput label="Currency" value={draft.price_currency} onChange={(v) => setDraft({ ...draft, price_currency: v })} />
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6 }}>
            <LabeledCheckbox label="Price incl VAT + service" checked={draft.price_includes_vat_service} onChange={(v) => setDraft({ ...draft, price_includes_vat_service: v })} />
          </div>
          <LabeledInput label="DMC price (net)" value={draft.dmc_price_amount} onChange={(v) => {
            const guest = Number(draft.price_amount || 0); const dmc = Number(v || 0);
            const pct = guest > 0 && dmc > 0 ? ((1 - dmc/guest) * 100).toFixed(2) : draft.dmc_discount_pct;
            setDraft({ ...draft, dmc_price_amount: v, dmc_discount_pct: v ? pct : '' });
          }} type="number" />
          <LabeledInput label="DMC discount %" value={draft.dmc_discount_pct} onChange={(v) => {
            const guest = Number(draft.price_amount || 0); const pct = Number(v || 0);
            const dmc = guest > 0 && pct >= 0 ? (guest * (1 - pct/100)).toFixed(2) : draft.dmc_price_amount;
            setDraft({ ...draft, dmc_discount_pct: v, dmc_price_amount: v ? dmc : '' });
          }} type="number" />
          <div style={{ fontSize: 11, color: '#5A5A5A', alignSelf: 'flex-end', paddingBottom: 8 }}>
            {draft.price_amount && draft.dmc_price_amount ? `Guest ${draft.price_currency} ${draft.price_amount} → DMC ${draft.price_currency} ${draft.dmc_price_amount}${draft.dmc_discount_pct ? ` (–${draft.dmc_discount_pct}%)` : ''}` : 'Auto-computes'}
          </div>
          {/* SEASONS */}
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 6 }}>Available in seasons</div>
            {seasonCodes.length === 0 ? (
              <div style={{ fontSize: 11, color: '#5A5A5A' }}>No seasons defined. Leave empty = year-round.</div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {seasonCodes.map(code => {
                  const on = draft.available_season_codes.includes(code);
                  return (
                    <button key={code} type="button" onClick={() => toggleSeason(code)} style={{
                      padding: '5px 12px', fontSize: 12, borderRadius: 14, cursor: 'pointer',
                      border: '1px solid ' + (on ? '#1F3A2E' : '#E6DFCC'),
                      background: on ? '#1F3A2E' : '#FFFFFF', color: on ? '#FFFFFF' : '#1B1B1B',
                      fontWeight: on ? 600 : 400,
                    }}>{on ? '✓ ' : ''}{code}</button>
                  );
                })}
              </div>
            )}
          </div>
          <LabeledTextarea label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} span={3} />
          <LabeledTextarea label="Price notes" value={draft.price_notes} onChange={(v) => setDraft({ ...draft, price_notes: v })} span={3} rows={2} />
          <LabeledTextarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <LabeledCheckbox label="Complimentary" checked={draft.is_complimentary} onChange={(v) => setDraft({ ...draft, is_complimentary: v })} />
            <LabeledCheckbox label="Active" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No transport options yet." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map(r => (
            <div key={r.transport_id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</span>
                  {r.transport_type && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.transport_type}</span>}
                  {(r.route_from || r.route_to) && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{r.route_from ?? '?'} → {r.route_to ?? '?'}</span>}
                  {r.duration_min && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{r.duration_min}m</span>}
                  {r.price_amount != null && <span style={pill('#E4F0E1', '#1F5C2C')}>{r.price_currency ?? 'USD'} {r.price_amount}{r.price_includes_vat_service ? ' (incl)' : ' (net)'}</span>}
                  {r.dmc_price_amount != null && <span style={pill('#EAE1F0', '#4A2C7A')}>DMC {r.price_currency ?? 'USD'} {r.dmc_price_amount}{r.dmc_discount_pct != null ? ` –${r.dmc_discount_pct}%` : ''}</span>}
                  {r.is_complimentary && <span style={pill('#E4F0E1', '#1F5C2C')}>complimentary</span>}
                  {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                {r.description && <div style={{ fontSize: 12, marginTop: 4 }}>{r.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDel === r.transport_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.transport_id)} onCancel={() => setConfirmDel(null)} /> :
                  <button type="button" onClick={() => setConfirmDel(r.transport_id)} style={btnGhost}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
