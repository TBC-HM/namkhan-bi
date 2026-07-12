// components/settings/panels/FacilitiesPanel.tsx
// PBS 2026-07-12 pm v2: parent hierarchy · spa fields · pool/sauna fields · dims + multi-capacity · hours.
// PBS 2026-07-03: full CRUD.
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledSelect, LabeledTextarea, ArrayInput, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = {
  facility_id: number; property_id: number; category: string | null; name: string;
  description: string | null; hours: string | null; is_complimentary: boolean | null;
  is_active: boolean | null; notes: string | null;
  parent_facility_id: number | null;
  treatment_rooms_count: number | null; treatments_offered: string[] | null;
  pool_length_m: number | null; pool_depth_m: number | null; pool_type: string | null;
  is_heated: boolean | null; is_indoor: boolean | null;
  sauna_type: string | null; capacity_pax: number | null;
  opening_time: string | null; closing_time: string | null;
  size_sqm: number | null; length_m: number | null; width_m: number | null;
  capacity_seated: number | null; capacity_standing: number | null;
  capacity_yoga: number | null; capacity_dining: number | null;
  is_meeting_space: boolean | null;
  meeting_ceiling_height_m: number | null;
  meeting_has_daylight: boolean | null; meeting_has_blackout: boolean | null; meeting_has_ac: boolean | null;
  meeting_has_projector: boolean | null; meeting_has_screen: boolean | null;
  meeting_has_sound_system: boolean | null; meeting_has_mic: boolean | null;
  meeting_has_whiteboard: boolean | null; meeting_has_flipchart: boolean | null;
  meeting_has_wifi: boolean | null; meeting_wifi_mbps: number | null; meeting_power_outlets: number | null;
  meeting_capacity_theatre: number | null; meeting_capacity_classroom: number | null;
  meeting_capacity_ushape: number | null; meeting_capacity_boardroom: number | null;
  meeting_capacity_banquet: number | null; meeting_capacity_cabaret: number | null;
  meeting_capacity_reception: number | null;
  meeting_half_day_rate: number | null; meeting_full_day_rate: number | null;
  meeting_setup_fee: number | null; meeting_rate_currency: string | null;
  meeting_catering_options: string[] | null;
  meeting_location_tag: string | null; meeting_notes: string | null;
  treatment_bed_count: number | null;
  treatment_has_double_bed: boolean | null; treatment_has_aircon: boolean | null;
  treatment_has_shower: boolean | null; treatment_has_hot_water: boolean | null;
  treatment_has_music_system: boolean | null; treatment_has_natural_light: boolean | null;
  treatment_has_dimmable_light: boolean | null; treatment_has_wc: boolean | null;
  treatment_has_couples_setup: boolean | null;
  treatment_room_number: string | null; treatment_floor_material: string | null;
  treatment_view: string | null; treatment_ambient_notes: string | null;
};

interface Draft {
  facility_id: number | null;
  category: string; name: string; description: string; hours: string;
  is_complimentary: boolean; is_active: boolean; notes: string;
  parent_facility_id: string;
  treatment_rooms_count: string; treatments_offered: string[];
  pool_length_m: string; pool_depth_m: string; pool_type: string;
  is_heated: boolean; is_indoor: boolean;
  sauna_type: string; capacity_pax: string;
  opening_time: string; closing_time: string;
  size_sqm: string; length_m: string; width_m: string;
  capacity_seated: string; capacity_standing: string;
  capacity_yoga: string; capacity_dining: string;
  is_meeting_space: boolean;
  meeting_ceiling_height_m: string;
  meeting_has_daylight: boolean; meeting_has_blackout: boolean; meeting_has_ac: boolean;
  meeting_has_projector: boolean; meeting_has_screen: boolean;
  meeting_has_sound_system: boolean; meeting_has_mic: boolean;
  meeting_has_whiteboard: boolean; meeting_has_flipchart: boolean;
  meeting_has_wifi: boolean; meeting_wifi_mbps: string; meeting_power_outlets: string;
  meeting_capacity_theatre: string; meeting_capacity_classroom: string;
  meeting_capacity_ushape: string; meeting_capacity_boardroom: string;
  meeting_capacity_banquet: string; meeting_capacity_cabaret: string;
  meeting_capacity_reception: string;
  meeting_half_day_rate: string; meeting_full_day_rate: string;
  meeting_setup_fee: string; meeting_rate_currency: string;
  meeting_catering_options: string[];
  meeting_location_tag: string; meeting_notes: string;
  treatment_bed_count: string;
  treatment_has_double_bed: boolean; treatment_has_aircon: boolean;
  treatment_has_shower: boolean; treatment_has_hot_water: boolean;
  treatment_has_music_system: boolean; treatment_has_natural_light: boolean;
  treatment_has_dimmable_light: boolean; treatment_has_wc: boolean;
  treatment_has_couples_setup: boolean;
  treatment_room_number: string; treatment_floor_material: string;
  treatment_view: string; treatment_ambient_notes: string;
}

const EMPTY: Draft = {
  facility_id: null, category: '', name: '', description: '', hours: '',
  is_complimentary: false, is_active: true, notes: '',
  parent_facility_id: '', treatment_rooms_count: '', treatments_offered: [],
  pool_length_m: '', pool_depth_m: '', pool_type: '', is_heated: false, is_indoor: false,
  sauna_type: '', capacity_pax: '',
  opening_time: '', closing_time: '',
  size_sqm: '', length_m: '', width_m: '',
  capacity_seated: '', capacity_standing: '', capacity_yoga: '', capacity_dining: '',
  is_meeting_space: false, meeting_ceiling_height_m: '',
  meeting_has_daylight: false, meeting_has_blackout: false, meeting_has_ac: false,
  meeting_has_projector: false, meeting_has_screen: false,
  meeting_has_sound_system: false, meeting_has_mic: false,
  meeting_has_whiteboard: false, meeting_has_flipchart: false,
  meeting_has_wifi: false, meeting_wifi_mbps: '', meeting_power_outlets: '',
  meeting_capacity_theatre: '', meeting_capacity_classroom: '',
  meeting_capacity_ushape: '', meeting_capacity_boardroom: '',
  meeting_capacity_banquet: '', meeting_capacity_cabaret: '',
  meeting_capacity_reception: '',
  meeting_half_day_rate: '', meeting_full_day_rate: '', meeting_setup_fee: '',
  meeting_rate_currency: 'USD', meeting_catering_options: [],
  meeting_location_tag: '', meeting_notes: '',
  treatment_bed_count: '',
  treatment_has_double_bed: false, treatment_has_aircon: false,
  treatment_has_shower: false, treatment_has_hot_water: false,
  treatment_has_music_system: false, treatment_has_natural_light: false,
  treatment_has_dimmable_light: false, treatment_has_wc: false,
  treatment_has_couples_setup: false,
  treatment_room_number: '', treatment_floor_material: '',
  treatment_view: '', treatment_ambient_notes: '',
};

const toDraft = (r: Row): Draft => ({
  facility_id: r.facility_id,
  category: r.category ?? '', name: r.name ?? '', description: r.description ?? '',
  hours: r.hours ?? '', is_complimentary: !!r.is_complimentary,
  is_active: r.is_active !== false, notes: r.notes ?? '',
  parent_facility_id: r.parent_facility_id?.toString() ?? '',
  treatment_rooms_count: r.treatment_rooms_count?.toString() ?? '',
  treatments_offered: r.treatments_offered ?? [],
  pool_length_m: r.pool_length_m?.toString() ?? '',
  pool_depth_m: r.pool_depth_m?.toString() ?? '',
  pool_type: r.pool_type ?? '',
  is_heated: !!r.is_heated, is_indoor: !!r.is_indoor,
  sauna_type: r.sauna_type ?? '', capacity_pax: r.capacity_pax?.toString() ?? '',
  opening_time: r.opening_time ? String(r.opening_time).slice(0, 5) : '',
  closing_time: r.closing_time ? String(r.closing_time).slice(0, 5) : '',
  size_sqm: r.size_sqm?.toString() ?? '',
  length_m: r.length_m?.toString() ?? '',
  width_m: r.width_m?.toString() ?? '',
  capacity_seated: r.capacity_seated?.toString() ?? '',
  capacity_standing: r.capacity_standing?.toString() ?? '',
  capacity_yoga: r.capacity_yoga?.toString() ?? '',
  capacity_dining: r.capacity_dining?.toString() ?? '',
  is_meeting_space: !!r.is_meeting_space,
  meeting_ceiling_height_m: r.meeting_ceiling_height_m?.toString() ?? '',
  meeting_has_daylight: !!r.meeting_has_daylight, meeting_has_blackout: !!r.meeting_has_blackout, meeting_has_ac: !!r.meeting_has_ac,
  meeting_has_projector: !!r.meeting_has_projector, meeting_has_screen: !!r.meeting_has_screen,
  meeting_has_sound_system: !!r.meeting_has_sound_system, meeting_has_mic: !!r.meeting_has_mic,
  meeting_has_whiteboard: !!r.meeting_has_whiteboard, meeting_has_flipchart: !!r.meeting_has_flipchart,
  meeting_has_wifi: !!r.meeting_has_wifi,
  meeting_wifi_mbps: r.meeting_wifi_mbps?.toString() ?? '',
  meeting_power_outlets: r.meeting_power_outlets?.toString() ?? '',
  meeting_capacity_theatre: r.meeting_capacity_theatre?.toString() ?? '',
  meeting_capacity_classroom: r.meeting_capacity_classroom?.toString() ?? '',
  meeting_capacity_ushape: r.meeting_capacity_ushape?.toString() ?? '',
  meeting_capacity_boardroom: r.meeting_capacity_boardroom?.toString() ?? '',
  meeting_capacity_banquet: r.meeting_capacity_banquet?.toString() ?? '',
  meeting_capacity_cabaret: r.meeting_capacity_cabaret?.toString() ?? '',
  meeting_capacity_reception: r.meeting_capacity_reception?.toString() ?? '',
  meeting_half_day_rate: r.meeting_half_day_rate?.toString() ?? '',
  meeting_full_day_rate: r.meeting_full_day_rate?.toString() ?? '',
  meeting_setup_fee: r.meeting_setup_fee?.toString() ?? '',
  meeting_rate_currency: r.meeting_rate_currency ?? 'USD',
  meeting_catering_options: r.meeting_catering_options ?? [],
  meeting_location_tag: r.meeting_location_tag ?? '',
  meeting_notes: r.meeting_notes ?? '',
  treatment_bed_count: r.treatment_bed_count?.toString() ?? '',
  treatment_has_double_bed: !!r.treatment_has_double_bed,
  treatment_has_aircon: !!r.treatment_has_aircon,
  treatment_has_shower: !!r.treatment_has_shower,
  treatment_has_hot_water: !!r.treatment_has_hot_water,
  treatment_has_music_system: !!r.treatment_has_music_system,
  treatment_has_natural_light: !!r.treatment_has_natural_light,
  treatment_has_dimmable_light: !!r.treatment_has_dimmable_light,
  treatment_has_wc: !!r.treatment_has_wc,
  treatment_has_couples_setup: !!r.treatment_has_couples_setup,
  treatment_room_number: r.treatment_room_number ?? '',
  treatment_floor_material: r.treatment_floor_material ?? '',
  treatment_view: r.treatment_view ?? '',
  treatment_ambient_notes: r.treatment_ambient_notes ?? '',
});

const POOL_TYPE_OPTS = ['', 'rock', 'infinity', 'lap', 'plunge', 'natural'];
const SAUNA_TYPE_OPTS = ['', 'traditional', 'infrared', 'steam'];

export default function FacilitiesPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  // Group by parent for display
  const { topLevel, childrenByParent, byId } = useMemo(() => {
    const byId = new Map<number, Row>();
    for (const r of data) byId.set(r.facility_id, r);
    const topLevel: Row[] = [];
    const childrenByParent = new Map<number, Row[]>();
    for (const r of data) {
      if (r.parent_facility_id == null || !byId.has(r.parent_facility_id)) topLevel.push(r);
      else {
        const arr = childrenByParent.get(r.parent_facility_id) ?? [];
        arr.push(r); childrenByParent.set(r.parent_facility_id, arr);
      }
    }
    return { topLevel, childrenByParent, byId };
  }, [data]);

  // Parent options for the dropdown — exclude the currently-editing facility (can't be own parent)
  const parentOptions = useMemo(() => {
    const opts = data
      .filter(r => draft?.facility_id !== r.facility_id)
      .map(r => ({ id: r.facility_id, label: r.name + (r.category ? ` (${r.category})` : '') }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return opts;
  }, [data, draft?.facility_id]);

  // Category hint booleans for conditional field visibility
  const cat = (draft?.category ?? '').toLowerCase();
  const nm = (draft?.name ?? '').toLowerCase();
  const hasSpaKw   = cat.includes('spa') || cat.includes('treatment') || nm.includes('spa') || Boolean(draft?.treatment_rooms_count && Number(draft.treatment_rooms_count) > 0);
  const hasPoolKw  = cat.includes('pool') || nm.includes('pool') || nm.includes('plunge') || Boolean(draft?.pool_type);
  const hasSaunaKw = cat.includes('sauna') || nm.includes('sauna') || Boolean(draft?.sauna_type);
  const hasTreatmentKw = cat.includes('treatment') || nm.includes('treatment') || Boolean(draft?.treatment_room_number) || Boolean(draft?.treatment_bed_count && Number(draft.treatment_bed_count) > 0);
  const showSpa   = hasSpaKw && !hasTreatmentKw;
  const showPool  = hasPoolKw;
  const showSauna = hasSaunaKw;
  const showTreatment = hasTreatmentKw;

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_facility', {
        p_facility_id: draft.facility_id, p_property_id: propertyId,
        p_category: draft.category.trim() || 'general', p_name: draft.name.trim(),
        p_description: draft.description.trim() || null,
        p_hours: draft.hours.trim() || null,
        p_is_complimentary: draft.is_complimentary,
        p_is_active: draft.is_active,
        p_notes: draft.notes.trim() || null,
        p_parent_facility_id: draft.parent_facility_id ? Number(draft.parent_facility_id) : null,
        p_treatment_rooms_count: draft.treatment_rooms_count ? Number(draft.treatment_rooms_count) : null,
        p_treatments_offered: draft.treatments_offered.length > 0 ? draft.treatments_offered : null,
        p_pool_length_m: draft.pool_length_m ? Number(draft.pool_length_m) : null,
        p_pool_depth_m:  draft.pool_depth_m  ? Number(draft.pool_depth_m)  : null,
        p_pool_type:     draft.pool_type || null,
        p_is_heated:     draft.is_heated,
        p_is_indoor:     draft.is_indoor,
        p_sauna_type:    draft.sauna_type || null,
        p_capacity_pax:  draft.capacity_pax ? Number(draft.capacity_pax) : null,
        p_opening_time:  draft.opening_time || null,
        p_closing_time:  draft.closing_time || null,
        p_size_sqm:      draft.size_sqm ? Number(draft.size_sqm) : null,
        p_length_m:      draft.length_m ? Number(draft.length_m) : null,
        p_width_m:       draft.width_m  ? Number(draft.width_m)  : null,
        p_capacity_seated:   draft.capacity_seated   ? Number(draft.capacity_seated)   : null,
        p_capacity_standing: draft.capacity_standing ? Number(draft.capacity_standing) : null,
        p_capacity_yoga:     draft.capacity_yoga     ? Number(draft.capacity_yoga)     : null,
        p_capacity_dining:   draft.capacity_dining   ? Number(draft.capacity_dining)   : null,
        p_is_meeting_space: draft.is_meeting_space,
        p_meeting_ceiling_height_m: draft.meeting_ceiling_height_m ? Number(draft.meeting_ceiling_height_m) : null,
        p_meeting_has_daylight: draft.meeting_has_daylight, p_meeting_has_blackout: draft.meeting_has_blackout, p_meeting_has_ac: draft.meeting_has_ac,
        p_meeting_has_projector: draft.meeting_has_projector, p_meeting_has_screen: draft.meeting_has_screen,
        p_meeting_has_sound_system: draft.meeting_has_sound_system, p_meeting_has_mic: draft.meeting_has_mic,
        p_meeting_has_whiteboard: draft.meeting_has_whiteboard, p_meeting_has_flipchart: draft.meeting_has_flipchart,
        p_meeting_has_wifi: draft.meeting_has_wifi,
        p_meeting_wifi_mbps: draft.meeting_wifi_mbps ? Number(draft.meeting_wifi_mbps) : null,
        p_meeting_power_outlets: draft.meeting_power_outlets ? Number(draft.meeting_power_outlets) : null,
        p_meeting_capacity_theatre: draft.meeting_capacity_theatre ? Number(draft.meeting_capacity_theatre) : null,
        p_meeting_capacity_classroom: draft.meeting_capacity_classroom ? Number(draft.meeting_capacity_classroom) : null,
        p_meeting_capacity_ushape: draft.meeting_capacity_ushape ? Number(draft.meeting_capacity_ushape) : null,
        p_meeting_capacity_boardroom: draft.meeting_capacity_boardroom ? Number(draft.meeting_capacity_boardroom) : null,
        p_meeting_capacity_banquet: draft.meeting_capacity_banquet ? Number(draft.meeting_capacity_banquet) : null,
        p_meeting_capacity_cabaret: draft.meeting_capacity_cabaret ? Number(draft.meeting_capacity_cabaret) : null,
        p_meeting_capacity_reception: draft.meeting_capacity_reception ? Number(draft.meeting_capacity_reception) : null,
        p_meeting_half_day_rate: draft.meeting_half_day_rate ? Number(draft.meeting_half_day_rate) : null,
        p_meeting_full_day_rate: draft.meeting_full_day_rate ? Number(draft.meeting_full_day_rate) : null,
        p_meeting_setup_fee: draft.meeting_setup_fee ? Number(draft.meeting_setup_fee) : null,
        p_meeting_rate_currency: draft.meeting_rate_currency || 'USD',
        p_meeting_catering_options: draft.meeting_catering_options.length > 0 ? draft.meeting_catering_options : null,
        p_meeting_location_tag: draft.meeting_location_tag.trim() || null,
        p_meeting_notes: draft.meeting_notes.trim() || null,
        p_treatment_bed_count: draft.treatment_bed_count ? Number(draft.treatment_bed_count) : null,
        p_treatment_has_double_bed: draft.treatment_has_double_bed,
        p_treatment_has_aircon: draft.treatment_has_aircon,
        p_treatment_has_shower: draft.treatment_has_shower,
        p_treatment_has_hot_water: draft.treatment_has_hot_water,
        p_treatment_has_music_system: draft.treatment_has_music_system,
        p_treatment_has_natural_light: draft.treatment_has_natural_light,
        p_treatment_has_dimmable_light: draft.treatment_has_dimmable_light,
        p_treatment_has_wc: draft.treatment_has_wc,
        p_treatment_has_couples_setup: draft.treatment_has_couples_setup,
        p_treatment_room_number: draft.treatment_room_number.trim() || null,
        p_treatment_floor_material: draft.treatment_floor_material.trim() || null,
        p_treatment_view: draft.treatment_view.trim() || null,
        p_treatment_ambient_notes: draft.treatment_ambient_notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }

  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_facility', { p_facility_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  function renderRow(r: Row, indent = 0) {
    const parent = r.parent_facility_id != null ? byId.get(r.parent_facility_id) : null;
    return (
      <div key={r.facility_id} style={{ ...rowStyle, marginLeft: indent * 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            {indent > 0 && <span style={{ color: '#5A5A5A' }}>↳</span>}
            <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</span>
            {r.category && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.category}</span>}
            {parent && <span style={pill('#EAE1F0', '#4A2C7A')}>child of {parent.name}</span>}
            {r.size_sqm && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{r.size_sqm} m²</span>}
            {r.is_complimentary && <span style={pill('#E4F0E1', '#1F5C2C')}>complimentary</span>}
            {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
          </div>
          {r.description && <div style={{ fontSize: 12, marginTop: 4 }}>{r.description}</div>}
          {(r.treatment_rooms_count || (r.treatments_offered ?? []).length > 0) && (
            <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>
              {r.treatment_rooms_count && <span>{r.treatment_rooms_count} treatment rooms · </span>}
              {(r.treatments_offered ?? []).length > 0 && <span>{(r.treatments_offered ?? []).join(', ')}</span>}
            </div>
          )}
          {(r.pool_length_m || r.pool_depth_m || r.pool_type) && (
            <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>
              🏊 {r.pool_type ?? 'pool'} · {r.pool_length_m ?? '?'} × {r.pool_depth_m ?? '?'} m
              {r.is_heated ? ' · heated' : ''}{r.is_indoor ? ' · indoor' : ''}
            </div>
          )}
          {(r.sauna_type) && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>♨ {r.sauna_type} sauna</div>}
          {(r.capacity_seated || r.capacity_standing || r.capacity_yoga || r.capacity_dining) && (
            <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {r.capacity_seated   && <span>{r.capacity_seated} seated</span>}
              {r.capacity_standing && <span>{r.capacity_standing} standing</span>}
              {r.capacity_yoga     && <span>{r.capacity_yoga} yoga</span>}
              {r.capacity_dining   && <span>{r.capacity_dining} dining</span>}
            </div>
          )}
          {r.hours && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3 }}>{r.hours}</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
          {confirmDel === r.facility_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.facility_id)} onCancel={() => setConfirmDel(null)} /> :
            <button type="button" onClick={() => setConfirmDel(r.facility_id)} style={btnGhost}>Delete</button>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="Facilities" subtitle={`${data.length} facilities · Pool · spa · dining · setup catalog`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.facility_id ? 'Edit facility' : 'New facility'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Name *" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} span={2} />
          <LabeledInput label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="e.g. wellness / pool / dining" />
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 4 }}>Parent facility (leave empty for top-level)</div>
            <select value={draft.parent_facility_id} onChange={(e) => setDraft({ ...draft, parent_facility_id: e.target.value })} style={{ padding: '6px 10px', fontSize: 13, border: '1px solid #E6DFCC', borderRadius: 3, background: '#FFFFFF', color: '#1B1B1B', width: '100%' }}>
              <option value="">— top-level —</option>
              {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <LabeledTextarea label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} span={3} rows={2} />
          <LabeledInput label="Hours" value={draft.hours} onChange={(v) => setDraft({ ...draft, hours: v })} placeholder="e.g. 06:00-22:00 or 24h" />
          <LabeledInput label="Opens" value={draft.opening_time} onChange={(v) => setDraft({ ...draft, opening_time: v })} placeholder="HH:MM" />
          <LabeledInput label="Closes" value={draft.closing_time} onChange={(v) => setDraft({ ...draft, closing_time: v })} placeholder="HH:MM" />
          {/* GENERIC DIMS + CAPACITY */}
          <LabeledInput label="Size (m²)" value={draft.size_sqm} onChange={(v) => setDraft({ ...draft, size_sqm: v })} type="number" />
          <LabeledInput label="Length (m)" value={draft.length_m} onChange={(v) => setDraft({ ...draft, length_m: v })} type="number" />
          <LabeledInput label="Width (m)" value={draft.width_m} onChange={(v) => setDraft({ ...draft, width_m: v })} type="number" />
          <LabeledInput label="Capacity · seated" value={draft.capacity_seated} onChange={(v) => setDraft({ ...draft, capacity_seated: v })} type="number" />
          <LabeledInput label="Capacity · standing" value={draft.capacity_standing} onChange={(v) => setDraft({ ...draft, capacity_standing: v })} type="number" />
          <LabeledInput label="Capacity · yoga" value={draft.capacity_yoga} onChange={(v) => setDraft({ ...draft, capacity_yoga: v })} type="number" />
          <LabeledInput label="Capacity · dining" value={draft.capacity_dining} onChange={(v) => setDraft({ ...draft, capacity_dining: v })} type="number" />
          <LabeledInput label="Capacity · pax (total)" value={draft.capacity_pax} onChange={(v) => setDraft({ ...draft, capacity_pax: v })} type="number" />
          {/* SPA-SPECIFIC */}
          {showSpa && (
            <>
              <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid #E6DFCC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>Spa specifics</div>
              <LabeledInput label="Treatment rooms (count)" value={draft.treatment_rooms_count} onChange={(v) => setDraft({ ...draft, treatment_rooms_count: v })} type="number" />
              <ArrayInput label="Treatments offered (comma-sep)" value={draft.treatments_offered} onChange={(v) => setDraft({ ...draft, treatments_offered: v })} placeholder="massage, facial, body scrub, ice bath" span={2} />
            </>
          )}
          {/* POOL-SPECIFIC */}
          {showPool && (
            <>
              <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid #E6DFCC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>Pool specifics</div>
              <LabeledSelect label="Pool type" value={draft.pool_type} onChange={(v) => setDraft({ ...draft, pool_type: v })} options={POOL_TYPE_OPTS} />
              <LabeledInput label="Pool length (m)" value={draft.pool_length_m} onChange={(v) => setDraft({ ...draft, pool_length_m: v })} type="number" />
              <LabeledInput label="Pool depth (m)" value={draft.pool_depth_m} onChange={(v) => setDraft({ ...draft, pool_depth_m: v })} type="number" />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
                <LabeledCheckbox label="Heated" checked={draft.is_heated} onChange={(v) => setDraft({ ...draft, is_heated: v })} />
                <LabeledCheckbox label="Indoor" checked={draft.is_indoor} onChange={(v) => setDraft({ ...draft, is_indoor: v })} />
              </div>
            </>
          )}
          {/* SAUNA-SPECIFIC */}
          {showSauna && (
            <>
              <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid #E6DFCC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>Sauna specifics</div>
              <LabeledSelect label="Sauna type" value={draft.sauna_type} onChange={(v) => setDraft({ ...draft, sauna_type: v })} options={SAUNA_TYPE_OPTS} />
            </>
          )}
          {/* TREATMENT ROOM SPECIFICS */}
          {showTreatment && (
            <>
              <div style={{ gridColumn: '1 / -1', paddingTop: 6, borderTop: '1px solid #E6DFCC', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>Treatment room specifics</div>
              <LabeledInput label="Room number" value={draft.treatment_room_number} onChange={(v) => setDraft({ ...draft, treatment_room_number: v })} placeholder="1" />
              <LabeledInput label="Bed count" value={draft.treatment_bed_count} onChange={(v) => setDraft({ ...draft, treatment_bed_count: v })} type="number" />
              <LabeledInput label="Floor material" value={draft.treatment_floor_material} onChange={(v) => setDraft({ ...draft, treatment_floor_material: v })} placeholder="teak / stone" />
              <LabeledInput label="View" value={draft.treatment_view} onChange={(v) => setDraft({ ...draft, treatment_view: v })} span={3} placeholder="jungle / river" />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <LabeledCheckbox label="Aircon" checked={draft.treatment_has_aircon} onChange={(v) => setDraft({ ...draft, treatment_has_aircon: v })} />
                <LabeledCheckbox label="Shower" checked={draft.treatment_has_shower} onChange={(v) => setDraft({ ...draft, treatment_has_shower: v })} />
                <LabeledCheckbox label="Hot water" checked={draft.treatment_has_hot_water} onChange={(v) => setDraft({ ...draft, treatment_has_hot_water: v })} />
                <LabeledCheckbox label="WC" checked={draft.treatment_has_wc} onChange={(v) => setDraft({ ...draft, treatment_has_wc: v })} />
                <LabeledCheckbox label="Music system" checked={draft.treatment_has_music_system} onChange={(v) => setDraft({ ...draft, treatment_has_music_system: v })} />
                <LabeledCheckbox label="Natural light" checked={draft.treatment_has_natural_light} onChange={(v) => setDraft({ ...draft, treatment_has_natural_light: v })} />
                <LabeledCheckbox label="Dimmable light" checked={draft.treatment_has_dimmable_light} onChange={(v) => setDraft({ ...draft, treatment_has_dimmable_light: v })} />
                <LabeledCheckbox label="Double bed" checked={draft.treatment_has_double_bed} onChange={(v) => setDraft({ ...draft, treatment_has_double_bed: v })} />
                <LabeledCheckbox label="Couples setup" checked={draft.treatment_has_couples_setup} onChange={(v) => setDraft({ ...draft, treatment_has_couples_setup: v })} />
              </div>
              <LabeledTextarea label="Ambient notes (candles · aromatherapy · sound bath...)" value={draft.treatment_ambient_notes} onChange={(v) => setDraft({ ...draft, treatment_ambient_notes: v })} span={3} rows={2} />
            </>
          )}
          {/* MEETING SPACE OVERLAY */}
          <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid #E6DFCC' }}>
            <LabeledCheckbox label="Usable as meeting space" checked={draft.is_meeting_space} onChange={(v) => setDraft({ ...draft, is_meeting_space: v })} />
          </div>
          {draft.is_meeting_space && (
            <>
              <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5A5A5A' }}>Meeting space specs</div>
              <LabeledInput label="Ceiling height (m)" value={draft.meeting_ceiling_height_m} onChange={(v) => setDraft({ ...draft, meeting_ceiling_height_m: v })} type="number" />
              <LabeledInput label="Location tag" value={draft.meeting_location_tag} onChange={(v) => setDraft({ ...draft, meeting_location_tag: v })} placeholder="e.g. Riverside · Ground floor" span={2} />
              <LabeledInput label="Theatre" value={draft.meeting_capacity_theatre} onChange={(v) => setDraft({ ...draft, meeting_capacity_theatre: v })} type="number" />
              <LabeledInput label="Classroom" value={draft.meeting_capacity_classroom} onChange={(v) => setDraft({ ...draft, meeting_capacity_classroom: v })} type="number" />
              <LabeledInput label="U-shape" value={draft.meeting_capacity_ushape} onChange={(v) => setDraft({ ...draft, meeting_capacity_ushape: v })} type="number" />
              <LabeledInput label="Boardroom" value={draft.meeting_capacity_boardroom} onChange={(v) => setDraft({ ...draft, meeting_capacity_boardroom: v })} type="number" />
              <LabeledInput label="Banquet" value={draft.meeting_capacity_banquet} onChange={(v) => setDraft({ ...draft, meeting_capacity_banquet: v })} type="number" />
              <LabeledInput label="Cabaret" value={draft.meeting_capacity_cabaret} onChange={(v) => setDraft({ ...draft, meeting_capacity_cabaret: v })} type="number" />
              <LabeledInput label="Reception" value={draft.meeting_capacity_reception} onChange={(v) => setDraft({ ...draft, meeting_capacity_reception: v })} type="number" />
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <LabeledCheckbox label="AC" checked={draft.meeting_has_ac} onChange={(v) => setDraft({ ...draft, meeting_has_ac: v })} />
                <LabeledCheckbox label="Natural daylight" checked={draft.meeting_has_daylight} onChange={(v) => setDraft({ ...draft, meeting_has_daylight: v })} />
                <LabeledCheckbox label="Blackout" checked={draft.meeting_has_blackout} onChange={(v) => setDraft({ ...draft, meeting_has_blackout: v })} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <LabeledCheckbox label="Projector" checked={draft.meeting_has_projector} onChange={(v) => setDraft({ ...draft, meeting_has_projector: v })} />
                <LabeledCheckbox label="Screen" checked={draft.meeting_has_screen} onChange={(v) => setDraft({ ...draft, meeting_has_screen: v })} />
                <LabeledCheckbox label="Sound system" checked={draft.meeting_has_sound_system} onChange={(v) => setDraft({ ...draft, meeting_has_sound_system: v })} />
                <LabeledCheckbox label="Microphone" checked={draft.meeting_has_mic} onChange={(v) => setDraft({ ...draft, meeting_has_mic: v })} />
                <LabeledCheckbox label="Whiteboard" checked={draft.meeting_has_whiteboard} onChange={(v) => setDraft({ ...draft, meeting_has_whiteboard: v })} />
                <LabeledCheckbox label="Flipchart" checked={draft.meeting_has_flipchart} onChange={(v) => setDraft({ ...draft, meeting_has_flipchart: v })} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <LabeledCheckbox label="Wi-Fi" checked={draft.meeting_has_wifi} onChange={(v) => setDraft({ ...draft, meeting_has_wifi: v })} />
                <div style={{ minWidth: 120 }}><LabeledInput label="Wi-Fi Mbps" value={draft.meeting_wifi_mbps} onChange={(v) => setDraft({ ...draft, meeting_wifi_mbps: v })} type="number" /></div>
                <div style={{ minWidth: 120 }}><LabeledInput label="Power outlets" value={draft.meeting_power_outlets} onChange={(v) => setDraft({ ...draft, meeting_power_outlets: v })} type="number" /></div>
              </div>
              <LabeledInput label="Half-day rate" value={draft.meeting_half_day_rate} onChange={(v) => setDraft({ ...draft, meeting_half_day_rate: v })} type="number" />
              <LabeledInput label="Full-day rate" value={draft.meeting_full_day_rate} onChange={(v) => setDraft({ ...draft, meeting_full_day_rate: v })} type="number" />
              <LabeledInput label="Setup fee" value={draft.meeting_setup_fee} onChange={(v) => setDraft({ ...draft, meeting_setup_fee: v })} type="number" />
              <LabeledInput label="Rate currency" value={draft.meeting_rate_currency} onChange={(v) => setDraft({ ...draft, meeting_rate_currency: v })} />
              <ArrayInput label="Catering options" value={draft.meeting_catering_options} onChange={(v) => setDraft({ ...draft, meeting_catering_options: v })} placeholder="coffee break, buffet lunch, cocktail" span={2} />
              <LabeledTextarea label="Meeting notes" value={draft.meeting_notes} onChange={(v) => setDraft({ ...draft, meeting_notes: v })} span={3} />
            </>
          )}
          <LabeledTextarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <LabeledCheckbox label="Complimentary" checked={draft.is_complimentary} onChange={(v) => setDraft({ ...draft, is_complimentary: v })} />
            <LabeledCheckbox label="Active" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No facilities defined." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {topLevel.map(r => (
            <div key={r.facility_id}>
              {renderRow(r)}
              {(childrenByParent.get(r.facility_id) ?? []).map(child => renderRow(child, 1))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
