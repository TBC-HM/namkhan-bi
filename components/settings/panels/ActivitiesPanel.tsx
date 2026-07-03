// components/settings/panels/ActivitiesPanel.tsx
// PBS 2026-07-03: full CRUD.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledTextarea, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = { activity_id: number; property_id: number; category: string | null; name: string; description: string | null; duration_min: number | null; group_type: string | null; age_restriction: string | null; bookable_via: string | null; is_complimentary: boolean | null; is_active: boolean | null; display_order: number | null };
interface Draft { activity_id: number | null; category: string; name: string; description: string; duration_min: string; group_type: string; age_restriction: string; bookable_via: string; is_complimentary: boolean; is_active: boolean; display_order: string; }
const EMPTY: Draft = { activity_id: null, category: '', name: '', description: '', duration_min: '', group_type: '', age_restriction: '', bookable_via: '', is_complimentary: false, is_active: true, display_order: '' };
const toDraft = (r: Row): Draft => ({ activity_id: r.activity_id, category: r.category ?? '', name: r.name ?? '', description: r.description ?? '', duration_min: r.duration_min?.toString() ?? '', group_type: r.group_type ?? '', age_restriction: r.age_restriction ?? '', bookable_via: r.bookable_via ?? '', is_complimentary: !!r.is_complimentary, is_active: r.is_active !== false, display_order: r.display_order?.toString() ?? '' });

export default function ActivitiesPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
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
      const { error: e } = await supabase.rpc('fn_upsert_property_activity', {
        p_activity_id: draft.activity_id, p_property_id: propertyId,
        p_category: draft.category.trim() || 'general', p_name: draft.name.trim(),
        p_description: draft.description.trim() || null,
        p_duration_min: draft.duration_min ? Number(draft.duration_min) : null,
        p_group_type: draft.group_type.trim() || null,
        p_age_restriction: draft.age_restriction.trim() || null,
        p_bookable_via: draft.bookable_via.trim() || null,
        p_is_complimentary: draft.is_complimentary,
        p_is_active: draft.is_active,
        p_display_order: draft.display_order ? Number(draft.display_order) : null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }
  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_activity', { p_activity_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Activities" subtitle={`${data.length} activit${data.length === 1 ? 'y' : 'ies'} · wellness · culture · adventure`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.activity_id ? 'Edit activity' : 'New activity'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Category" value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} placeholder="e.g. wellness" />
          <LabeledInput label="Name *" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} span={2} />
          <LabeledInput label="Duration (min)" value={draft.duration_min} onChange={(v) => setDraft({ ...draft, duration_min: v })} type="number" />
          <LabeledInput label="Group type" value={draft.group_type} onChange={(v) => setDraft({ ...draft, group_type: v })} placeholder="private / shared" />
          <LabeledInput label="Age restriction" value={draft.age_restriction} onChange={(v) => setDraft({ ...draft, age_restriction: v })} placeholder="e.g. 12+" />
          <LabeledInput label="Bookable via" value={draft.bookable_via} onChange={(v) => setDraft({ ...draft, bookable_via: v })} placeholder="reception / online" />
          <LabeledInput label="Display order" value={draft.display_order} onChange={(v) => setDraft({ ...draft, display_order: v })} type="number" />
          <LabeledTextarea label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} span={3} />
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16 }}>
            <LabeledCheckbox label="Complimentary" checked={draft.is_complimentary} onChange={(v) => setDraft({ ...draft, is_complimentary: v })} />
            <LabeledCheckbox label="Active" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No activities yet." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.activity_id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</span>
                  {r.category && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.category}</span>}
                  {r.duration_min && <span style={{ fontSize: 11, color: '#5A5A5A' }}>{r.duration_min}m</span>}
                  {r.is_complimentary && <span style={pill('#E4F0E1', '#1F5C2C')}>complimentary</span>}
                  {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                {r.description && <div style={{ fontSize: 12, marginTop: 4 }}>{r.description}</div>}
                {(r.group_type || r.age_restriction || r.bookable_via) && (
                  <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, display: 'flex', gap: 12 }}>
                    {r.group_type && <span>{r.group_type}</span>}
                    {r.age_restriction && <span>age: {r.age_restriction}</span>}
                    {r.bookable_via && <span>via {r.bookable_via}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDel === r.activity_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.activity_id)} onCancel={() => setConfirmDel(null)} /> :
                  <button type="button" onClick={() => setConfirmDel(r.activity_id)} style={btnGhost}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
