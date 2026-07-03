// components/settings/panels/SeasonsPanel.tsx
// PBS 2026-07-03: full CRUD.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledTextarea, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = { season_id: number; property_id: number; season_code: string | null; display_name: string | null; date_start: string; date_end: string; is_active: boolean | null; notes: string | null };
interface Draft { season_id: number | null; season_code: string; display_name: string; date_start: string; date_end: string; is_active: boolean; notes: string; }
const EMPTY: Draft = { season_id: null, season_code: '', display_name: '', date_start: '', date_end: '', is_active: true, notes: '' };
const toDraft = (r: Row): Draft => ({ season_id: r.season_id, season_code: r.season_code ?? '', display_name: r.display_name ?? '', date_start: r.date_start?.slice(0, 10) ?? '', date_end: r.date_end?.slice(0, 10) ?? '', is_active: r.is_active !== false, notes: r.notes ?? '' });

export default function SeasonsPanel({ data, propertyId }: { data: Row[]; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function save() {
    if (!draft) return;
    if (!draft.display_name.trim()) { setError('Display name is required'); return; }
    if (!draft.date_start || !draft.date_end) { setError('Start and end dates are required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_season', {
        p_season_id: draft.season_id, p_property_id: propertyId,
        p_season_code: draft.season_code.trim() || null,
        p_display_name: draft.display_name.trim(),
        p_date_start: draft.date_start, p_date_end: draft.date_end,
        p_is_active: draft.is_active, p_notes: draft.notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }
  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_season', { p_season_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Seasons" subtitle={`${data.length} season${data.length === 1 ? '' : 's'} · high / low calendar`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.season_id ? 'Edit season' : 'New season'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Code" value={draft.season_code} onChange={(v) => setDraft({ ...draft, season_code: v })} placeholder="e.g. HIGH / LOW" />
          <LabeledInput label="Display name *" value={draft.display_name} onChange={(v) => setDraft({ ...draft, display_name: v })} span={2} />
          <LabeledInput label="Start date *" value={draft.date_start} onChange={(v) => setDraft({ ...draft, date_start: v })} type="date" />
          <LabeledInput label="End date *" value={draft.date_end} onChange={(v) => setDraft({ ...draft, date_end: v })} type="date" />
          <LabeledTextarea label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1' }}>
            <LabeledCheckbox label="Active" checked={draft.is_active} onChange={(v) => setDraft({ ...draft, is_active: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No seasons yet." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((r) => (
            <div key={r.season_id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{r.display_name}</span>
                  {r.season_code && <span style={pill('#F5F0E1', '#5A5A5A')}>{r.season_code}</span>}
                  {r.is_active === false && <span style={pill('#F5F0E1', '#8A8A8A')}>inactive</span>}
                </div>
                <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 3 }}>{r.date_start?.slice(0, 10)} → {r.date_end?.slice(0, 10)}</div>
                {r.notes && <div style={{ fontSize: 11, color: '#5A5A5A', marginTop: 3, fontStyle: 'italic' }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                {confirmDel === r.season_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.season_id)} onCancel={() => setConfirmDel(null)} /> :
                  <button type="button" onClick={() => setConfirmDel(r.season_id)} style={btnGhost}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
