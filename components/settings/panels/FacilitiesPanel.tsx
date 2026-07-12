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
  const showSpa   = cat.includes('spa') || cat.includes('wellness') || cat.includes('treatment');
  const showPool  = cat.includes('pool') || cat.includes('spa') || cat.includes('wellness') || draft?.pool_type !== '';
  const showSauna = cat.includes('sauna') || cat.includes('spa') || cat.includes('wellness') || draft?.sauna_type !== '';

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
