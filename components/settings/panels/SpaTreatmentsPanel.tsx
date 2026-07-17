// components/settings/panels/SpaTreatmentsPanel.tsx
// PBS 2026-07-18 · CRUD for property.spa_treatments via fn_upsert/delete RPCs.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const HAIR = '#E6DFCC';
const INK = '#1B1B1B';
const INK_M = '#5A5A5A';
const FOREST = '#084838';
const AMBER = '#B87F26';

interface Treatment {
  treatment_id: number;
  property_id: number;
  facility_id: number | null;
  name: string;
  short_description: string | null;
  category: string | null;
  duration_min: number | null;
  price_usd: number | null;
  price_lak: number | null;
  price_includes_vat_service: boolean;
  therapist_gender_preference: string | null;
  requires_treatment_room: boolean;
  couples_available: boolean;
  oil_or_dry: string | null;
  contraindications: string | null;
  what_to_bring: string | null;
  is_signature: boolean;
  is_active: boolean;
  display_order: number | null;
  notes: string | null;
}

interface Draft {
  treatment_id: number | null;
  facility_id: string;
  name: string; short_description: string; category: string;
  duration_min: string; price_usd: string; price_lak: string;
  price_includes_vat_service: boolean;
  therapist_gender_preference: string;
  requires_treatment_room: boolean;
  couples_available: boolean;
  oil_or_dry: string;
  contraindications: string; what_to_bring: string;
  is_signature: boolean; is_active: boolean;
  display_order: string; notes: string;
}

const EMPTY: Draft = {
  treatment_id: null, facility_id: '', name: '', short_description: '', category: 'massage',
  duration_min: '60', price_usd: '', price_lak: '',
  price_includes_vat_service: true, therapist_gender_preference: '',
  requires_treatment_room: true, couples_available: false, oil_or_dry: 'oil',
  contraindications: '', what_to_bring: '',
  is_signature: false, is_active: true, display_order: '', notes: '',
};

interface Props { treatments: Treatment[]; facilities: any[]; propertyId: number; }

export default function SpaTreatmentsPanel({ treatments, facilities, propertyId }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function openAdd() { setDraft(EMPTY); setError(null); }
  function openEdit(t: Treatment) {
    setDraft({
      treatment_id: t.treatment_id, facility_id: t.facility_id?.toString() ?? '',
      name: t.name ?? '', short_description: t.short_description ?? '',
      category: t.category ?? 'massage',
      duration_min: t.duration_min?.toString() ?? '', price_usd: t.price_usd?.toString() ?? '',
      price_lak: t.price_lak?.toString() ?? '',
      price_includes_vat_service: t.price_includes_vat_service ?? true,
      therapist_gender_preference: t.therapist_gender_preference ?? '',
      requires_treatment_room: t.requires_treatment_room ?? true,
      couples_available: t.couples_available ?? false,
      oil_or_dry: t.oil_or_dry ?? 'oil',
      contraindications: t.contraindications ?? '', what_to_bring: t.what_to_bring ?? '',
      is_signature: t.is_signature ?? false, is_active: t.is_active ?? true,
      display_order: t.display_order?.toString() ?? '', notes: t.notes ?? '',
    });
    setError(null);
  }

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_spa_treatment', {
        p_treatment_id: draft.treatment_id, p_property_id: propertyId,
        p_facility_id: draft.facility_id ? Number(draft.facility_id) : null,
        p_name: draft.name.trim(), p_short_description: draft.short_description.trim() || null,
        p_category: draft.category || null,
        p_duration_min: draft.duration_min ? Number(draft.duration_min) : null,
        p_price_usd: draft.price_usd ? Number(draft.price_usd) : null,
        p_price_lak: draft.price_lak ? Number(draft.price_lak) : null,
        p_price_includes_vat_service: draft.price_includes_vat_service,
        p_therapist_gender_preference: draft.therapist_gender_preference || null,
        p_requires_treatment_room: draft.requires_treatment_room,
        p_couples_available: draft.couples_available,
        p_oil_or_dry: draft.oil_or_dry || null,
        p_contraindications: draft.contraindications.trim() || null,
        p_what_to_bring: draft.what_to_bring.trim() || null,
        p_is_signature: draft.is_signature, p_is_active: draft.is_active,
        p_display_order: draft.display_order ? Number(draft.display_order) : null,
        p_notes: draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }

  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_spa_treatment', { p_treatment_id: id });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  const facilityById = new Map<number, string>(facilities.map(f => [f.facility_id, f.name]));

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: INK }}>Treatments</div>
          <div style={{ fontSize: 11, color: INK_M, marginTop: 2 }}>{treatments.length} treatment{treatments.length===1?'':'s'} · individual bookable services</div>
        </div>
        {!draft && (
          <button onClick={openAdd} style={btnPrimary}>+ Add treatment</button>
        )}
      </div>

      {error && (
        <div style={{ background: '#FEECEA', border: '1px solid #E7A69A', borderRadius: 4, padding: 10, color: '#8A2820', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {draft && (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 6, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 12 }}>
            {draft.treatment_id ? 'Edit treatment' : 'New treatment'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <L label="Name *"><input style={inp} value={draft.name} onChange={e=>setDraft({...draft, name:e.target.value})} /></L>
            <L label="Category">
              <select style={inp} value={draft.category} onChange={e=>setDraft({...draft, category:e.target.value})}>
                {['massage','facial','body treatment','signature ritual','wellness experience','sauna','steam','ice bath','yoga','meditation','other'].map(c => <option key={c}>{c}</option>)}
              </select>
            </L>
            <L label="Duration (min)"><input type="number" style={inp} value={draft.duration_min} onChange={e=>setDraft({...draft, duration_min:e.target.value})} /></L>
            <L label="Facility">
              <select style={inp} value={draft.facility_id} onChange={e=>setDraft({...draft, facility_id:e.target.value})}>
                <option value="">— none —</option>
                {facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.name}</option>)}
              </select>
            </L>
            <L label="Price USD"><input type="number" style={inp} value={draft.price_usd} onChange={e=>setDraft({...draft, price_usd:e.target.value})} /></L>
            <L label="Price LAK"><input type="number" style={inp} value={draft.price_lak} onChange={e=>setDraft({...draft, price_lak:e.target.value})} /></L>
            <L label="Oil / dry">
              <select style={inp} value={draft.oil_or_dry} onChange={e=>setDraft({...draft, oil_or_dry:e.target.value})}>
                <option value="oil">oil</option><option value="dry">dry</option><option value="hybrid">hybrid</option>
              </select>
            </L>
            <L label="Therapist preference">
              <select style={inp} value={draft.therapist_gender_preference} onChange={e=>setDraft({...draft, therapist_gender_preference:e.target.value})}>
                <option value="">— any —</option><option value="female">female</option><option value="male">male</option><option value="either">either</option>
              </select>
            </L>
            <L label="Short description" span={2}><textarea style={{...inp,minHeight:52}} value={draft.short_description} onChange={e=>setDraft({...draft, short_description:e.target.value})} /></L>
            <L label="Contraindications" span={2}><textarea style={{...inp,minHeight:52}} value={draft.contraindications} onChange={e=>setDraft({...draft, contraindications:e.target.value})} /></L>
            <L label="What to bring" span={2}><input style={inp} value={draft.what_to_bring} onChange={e=>setDraft({...draft, what_to_bring:e.target.value})} /></L>
            <L label="Display order"><input type="number" style={inp} value={draft.display_order} onChange={e=>setDraft({...draft, display_order:e.target.value})} /></L>
            <L label="Flags">
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
                <label><input type="checkbox" checked={draft.price_includes_vat_service} onChange={e=>setDraft({...draft, price_includes_vat_service:e.target.checked})} /> VAT/svc incl</label>
                <label><input type="checkbox" checked={draft.requires_treatment_room} onChange={e=>setDraft({...draft, requires_treatment_room:e.target.checked})} /> needs room</label>
                <label><input type="checkbox" checked={draft.couples_available} onChange={e=>setDraft({...draft, couples_available:e.target.checked})} /> couples</label>
                <label><input type="checkbox" checked={draft.is_signature} onChange={e=>setDraft({...draft, is_signature:e.target.checked})} /> signature</label>
                <label><input type="checkbox" checked={draft.is_active} onChange={e=>setDraft({...draft, is_active:e.target.checked})} /> active</label>
              </div>
            </L>
            <L label="Notes" span={2}><textarea style={{...inp,minHeight:52}} value={draft.notes} onChange={e=>setDraft({...draft, notes:e.target.value})} /></L>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={()=>setDraft(null)} disabled={busy} style={btnGhost}>Cancel</button>
            <button onClick={save} disabled={busy} style={btnPrimary}>{busy?'Saving…':'Save'}</button>
          </div>
        </div>
      )}

      {treatments.length === 0 && !draft ? (
        <div style={{ background: '#F5F0E1', border: '1px solid ' + HAIR, borderRadius: 4, padding: 24, textAlign: 'center', color: INK_M, fontSize: 12 }}>
          No treatments yet. Click <strong>+ Add treatment</strong> to create one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {treatments.map(t => (
            <div key={t.treatment_id} style={{ background: '#FFFFFF', border: '1px solid ' + HAIR, borderRadius: 4, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{t.name}</span>
                  {t.is_signature && <span style={{ fontSize: 10, background: '#F5E6C8', color: AMBER, padding: '2px 6px', borderRadius: 3 }}>SIGNATURE</span>}
                  {!t.is_active && <span style={{ fontSize: 10, background: '#EDEDED', color: '#8A8A8A', padding: '2px 6px', borderRadius: 3 }}>INACTIVE</span>}
                  {t.category && <span style={{ fontSize: 11, color: INK_M }}>{t.category}</span>}
                  {t.duration_min && <span style={{ fontSize: 11, color: INK_M }}>· {t.duration_min} min</span>}
                  {t.price_usd != null && <span style={{ fontSize: 11, color: INK_M }}>· USD {t.price_usd}</span>}
                  {t.facility_id && facilityById.get(t.facility_id) && <span style={{ fontSize: 11, color: FOREST }}>· {facilityById.get(t.facility_id)}</span>}
                </div>
                {t.short_description && <div style={{ fontSize: 12, color: INK_M, marginTop: 4 }}>{t.short_description}</div>}
              </div>
              <button onClick={()=>openEdit(t)} style={btnGhost}>Edit</button>
              {confirmDel === t.treatment_id ? (
                <>
                  <button onClick={()=>del(t.treatment_id)} disabled={busy} style={btnDanger}>Confirm delete</button>
                  <button onClick={()=>setConfirmDel(null)} style={btnGhost}>×</button>
                </>
              ) : (
                <button onClick={()=>setConfirmDel(t.treatment_id)} style={btnGhost}>Delete</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function L({ label, children, span=1 }: { label: string; children: React.ReactNode; span?: number }) {
  return <div style={{ gridColumn: span===2 ? '1 / -1' : undefined }}>
    <div style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M, marginBottom: 4 }}>{label}</div>
    {children}
  </div>;
}
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid ' + HAIR, borderRadius: 3, background: '#FFF', fontSize: 12, fontFamily: 'inherit' };
const btnPrimary: React.CSSProperties = { padding: '6px 14px', background: FOREST, color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: INK_M, border: '1px solid ' + HAIR, borderRadius: 3, fontSize: 11, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '6px 12px', background: '#C0584C', color: '#FFF', border: 'none', borderRadius: 3, fontSize: 11, cursor: 'pointer' };
