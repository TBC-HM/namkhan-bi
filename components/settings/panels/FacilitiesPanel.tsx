// components/settings/panels/FacilitiesPanel.tsx
// PBS 2026-07-03: full CRUD.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledTextarea, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = { facility_id: number; property_id: number; category: string; name: string; description: string | null; hours: string | null; is_complimentary: boolean | null; is_active: boolean | null; notes: string | null };
interface Draft { facility_id: number | null; category: string; name: string; description: string; hours: string; is_complimentary: boolean; is_active: boolean; notes: string; }
const EMPTY: Draft = { facility_id: null, category: '', name: '', description: '', hours: '', is_complimentary: false, is_active: true, notes: '' };
const toDraft = (r: Row): Draft => ({ facility_id: r.facility_id, category: r.category ?? '', name: r.name ?? '', description: r.description ?? '', hours: r.hours ?? '', is_complimentary: !!r.is_complimentary, is_active: r.is_active !== false, notes: r.notes ?? '' });

export default function FacilitiesPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setError('Name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_facility', {
        p_facility_id: draft.facility_id, p_property_id: propertyId,
        p_category: draft.category.trim() || 'general',
        p_name: draft.name.trim(),
        p_description: draft.description.trim() || null,
        p_hours: draft.hours.trim() || null,
        p_is_complimentary: draft.is_complimentary,
        p_is_active: draft.is_active,
        p_notes: draft.notes.trim() || null,
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

  return (
    <div>
      <PanelHeader title="Facilities" subtitle={`${data.length} facilit${data.length === 1 ? 'y' : 'ies'} · pool · spa · dining`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.facility_id ? 'Edit facility' : 'New facility'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="e.g. Wellness / Dining" />
          <LabeledInput label="Name *" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} span={2} />
          <LabeledInput label="Hours" value={draft.hours} onChange={(v) => setDraft({ ...draft, hours: v })} placeholder="e.g. 07:00-22:00" />
          <LabeledTextarea label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} span={2} />
          <LabeledTextarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <LabeledCheckbox label="Complimentary" checked={draft.is_complimentary} onChange={(v) => setDraft({ ...draft, is_complimentary: v })} />
            <LabeledCheckbox label="Active" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No facilities yet." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.facility_id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</span>
                  {r.category && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.category}</span>}
                  {r.is_complimentary && <span style={pill('#E4F0E1', '#1F5C2C')}>complimentary</span>}
                  {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                {r.hours && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 2 }}>Hours: {r.hours}</div>}
                {r.description && <div style={{ fontSize: 12, color: '#1B1B1B', marginTop: 4 }}>{r.description}</div>}
                {r.notes && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDel === r.facility_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.facility_id)} onCancel={() => setConfirmDel(null)} /> :
                  <button type="button" onClick={() => setConfirmDel(r.facility_id)} style={btnGhost}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
