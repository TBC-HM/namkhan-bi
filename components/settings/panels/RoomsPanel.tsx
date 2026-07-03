// components/settings/panels/RoomsPanel.tsx
// PBS 2026-07-03: full CRUD · edit / add / delete room types.
// Bookable inventory count per type comes from public.v_room_type_units.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader, EmptyState } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, rowStyle, ErrorBanner, LabeledInput, LabeledCheckbox, LabeledSelect, LabeledTextarea, ArrayInput, FormShell, DeleteConfirm, pill } from './_settings_ui';

type Row = { room_type_id: number; property_id: number; display_name: string; positioning_tier: string | null; positioning_label: string | null; short_pitch: string | null; long_description: string | null; size_sqm: number | null; garden_sqm: number | null; max_occupancy: number | null; max_adults: number | null; max_children: number | null; extra_bed_allowed: boolean | null; bed_config: string[] | null; view_type: string[] | null; ideal_for: string[] | null; hero_image_url: string | null; fact_sheet_url: string | null; internal_notes: string | null };

interface Draft { room_type_id: number | null; display_name: string; positioning_tier: string; positioning_label: string; short_pitch: string; long_description: string; size_sqm: string; garden_sqm: string; max_occupancy: string; max_adults: string; max_children: string; extra_bed_allowed: boolean; bed_config: string[]; view_type: string[]; ideal_for: string[]; hero_image_url: string; fact_sheet_url: string; internal_notes: string; }
const EMPTY: Draft = { room_type_id: null, display_name: '', positioning_tier: '', positioning_label: '', short_pitch: '', long_description: '', size_sqm: '', garden_sqm: '', max_occupancy: '', max_adults: '', max_children: '', extra_bed_allowed: false, bed_config: [], view_type: [], ideal_for: [], hero_image_url: '', fact_sheet_url: '', internal_notes: '' };
const toDraft = (r: Row): Draft => ({ room_type_id: r.room_type_id, display_name: r.display_name ?? '', positioning_tier: r.positioning_tier ?? '', positioning_label: r.positioning_label ?? '', short_pitch: r.short_pitch ?? '', long_description: r.long_description ?? '', size_sqm: r.size_sqm?.toString() ?? '', garden_sqm: r.garden_sqm?.toString() ?? '', max_occupancy: r.max_occupancy?.toString() ?? '', max_adults: r.max_adults?.toString() ?? '', max_children: r.max_children?.toString() ?? '', extra_bed_allowed: !!r.extra_bed_allowed, bed_config: r.bed_config ?? [], view_type: r.view_type ?? [], ideal_for: r.ideal_for ?? [], hero_image_url: r.hero_image_url ?? '', fact_sheet_url: r.fact_sheet_url ?? '', internal_notes: r.internal_notes ?? '' });

const TIER_OPTIONS = ['', 'entry', 'premium', 'signature'];
const tierColor: Record<string, string> = { signature: '#1F5C2C', premium: '#8B5A1C', entry: '#5A5A5A' };

export default function RoomsPanel({ data, roomUnits, propertyId }: { data: Row[]; roomUnits?: Array<{ room_type_name: string; units: number }>; propertyId: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  const unitMap = new Map<string, number>();
  for (const u of roomUnits ?? []) unitMap.set(u.room_type_name, Number(u.units ?? 0));
  const totalUnits = Array.from(unitMap.values()).reduce((s, n) => s + n, 0);

  function save() {
    if (!draft) return;
    if (!draft.display_name.trim()) { setError('Display name is required'); return; }
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_room', {
        p_room_type_id: draft.room_type_id, p_property_id: propertyId,
        p_display_name: draft.display_name.trim(),
        p_positioning_tier: draft.positioning_tier || null,
        p_positioning_label: draft.positioning_label.trim() || null,
        p_short_pitch: draft.short_pitch.trim() || null,
        p_long_description: draft.long_description.trim() || null,
        p_size_sqm: draft.size_sqm ? Number(draft.size_sqm) : null,
        p_garden_sqm: draft.garden_sqm ? Number(draft.garden_sqm) : null,
        p_max_occupancy: draft.max_occupancy ? Number(draft.max_occupancy) : null,
        p_max_adults: draft.max_adults ? Number(draft.max_adults) : null,
        p_max_children: draft.max_children ? Number(draft.max_children) : null,
        p_extra_bed_allowed: draft.extra_bed_allowed,
        p_bed_config: draft.bed_config.length > 0 ? draft.bed_config : null,
        p_view_type: draft.view_type.length > 0 ? draft.view_type : null,
        p_ideal_for: draft.ideal_for.length > 0 ? draft.ideal_for : null,
        p_hero_image_url: draft.hero_image_url.trim() || null,
        p_fact_sheet_url: draft.fact_sheet_url.trim() || null,
        p_internal_notes: draft.internal_notes.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setDraft(null); router.refresh();
    });
  }
  function del(id: number) {
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_delete_property_room', { p_room_type_id: id, p_property_id: propertyId });
      if (e) { setError(e.message); return; }
      setConfirmDel(null); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Rooms" subtitle={`${data.length} room types${totalUnits > 0 ? ` · ${totalUnits} total units` : ''} · setup catalog (live inventory from PMS silver)`}
        action={<button type="button" onClick={() => setDraft({ ...EMPTY })} style={btnPrimary}>+ Add</button>} />
      <ErrorBanner error={error} />
      {draft && (
        <FormShell title={draft.room_type_id ? 'Edit room type' : 'New room type'} onSave={save} onCancel={() => { setDraft(null); setError(null); }} busy={busy}>
          <LabeledInput label="Display name *" value={draft.display_name} onChange={(v) => setDraft({ ...draft, display_name: v })} span={2} />
          <LabeledSelect label="Tier" value={draft.positioning_tier} onChange={(v) => setDraft({ ...draft, positioning_tier: v })} options={TIER_OPTIONS} />
          <LabeledInput label="Positioning label" value={draft.positioning_label} onChange={(v) => setDraft({ ...draft, positioning_label: v })} span={3} />
          <LabeledTextarea label="Short pitch" value={draft.short_pitch} onChange={(v) => setDraft({ ...draft, short_pitch: v })} span={3} rows={2} />
          <LabeledTextarea label="Long description" value={draft.long_description} onChange={(v) => setDraft({ ...draft, long_description: v })} span={3} rows={5} />
          <LabeledInput label="Size (m²)" value={draft.size_sqm} onChange={(v) => setDraft({ ...draft, size_sqm: v })} type="number" />
          <LabeledInput label="Garden (m²)" value={draft.garden_sqm} onChange={(v) => setDraft({ ...draft, garden_sqm: v })} type="number" />
          <div />
          <LabeledInput label="Max occupancy" value={draft.max_occupancy} onChange={(v) => setDraft({ ...draft, max_occupancy: v })} type="number" />
          <LabeledInput label="Max adults" value={draft.max_adults} onChange={(v) => setDraft({ ...draft, max_adults: v })} type="number" />
          <LabeledInput label="Max children" value={draft.max_children} onChange={(v) => setDraft({ ...draft, max_children: v })} type="number" />
          <ArrayInput label="Bed config (comma-sep)" value={draft.bed_config} onChange={(v) => setDraft({ ...draft, bed_config: v })} placeholder="king, twin" span={3} />
          <ArrayInput label="View type (comma-sep)" value={draft.view_type} onChange={(v) => setDraft({ ...draft, view_type: v })} placeholder="river, mountain" span={3} />
          <ArrayInput label="Ideal for (comma-sep)" value={draft.ideal_for} onChange={(v) => setDraft({ ...draft, ideal_for: v })} placeholder="couples, families" span={3} />
          <LabeledInput label="Hero image URL" value={draft.hero_image_url} onChange={(v) => setDraft({ ...draft, hero_image_url: v })} type="url" />
          <LabeledInput label="Fact sheet URL" value={draft.fact_sheet_url} onChange={(v) => setDraft({ ...draft, fact_sheet_url: v })} type="url" />
          <div />
          <LabeledTextarea label="Internal notes" value={draft.internal_notes} onChange={(v) => setDraft({ ...draft, internal_notes: v })} span={3} />
          <div style={{ gridColumn: '1 / -1' }}>
            <LabeledCheckbox label="Extra bed allowed" checked={draft.extra_bed_allowed} onChange={(v) => setDraft({ ...draft, extra_bed_allowed: v })} />
          </div>
        </FormShell>
      )}
      {data.length === 0 && !draft ? <EmptyState message="No room types defined." /> : (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((r) => (
            <div key={r.room_type_id} style={{ ...rowStyle, flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', width: '100%', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--serif, ui-serif, Georgia, serif)', fontSize: 18, fontWeight: 500 }}>{r.display_name}</span>
                    {unitMap.get(r.display_name) != null && unitMap.get(r.display_name)! > 0 && <span style={pill('#F5F0E1', '#1B1B1B')}>×{unitMap.get(r.display_name)}</span>}
                    {r.positioning_tier && <span style={pill('#F5F0E1', tierColor[r.positioning_tier] ?? '#5A5A5A')}>{r.positioning_tier}</span>}
                  </div>
                  {r.short_pitch && <div style={{ fontSize: 12, color: '#5A5A5A', marginTop: 3 }}>{r.short_pitch}</div>}
                  {r.positioning_label && <div style={{ fontSize: 11, color: '#1F3A2E', fontStyle: 'italic', marginTop: 2 }}>{r.positioning_label}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setDraft(toDraft(r))} style={btnGhost}>Edit</button>
                  {confirmDel === r.room_type_id ? <DeleteConfirm show busy={busy} onConfirm={() => del(r.room_type_id)} onCancel={() => setConfirmDel(null)} /> :
                    <button type="button" onClick={() => setConfirmDel(r.room_type_id)} style={btnGhost}>Delete</button>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, fontSize: 12, color: '#1B1B1B' }}>
                <MetaCell label="Size">{r.size_sqm ? `${r.size_sqm} m²` : '—'}{r.garden_sqm ? ` + ${r.garden_sqm} m² garden` : ''}</MetaCell>
                <MetaCell label="Max occupancy">{r.max_occupancy ?? '—'} ({r.max_adults ?? '?'}A + {r.max_children ?? '?'}C)</MetaCell>
                <MetaCell label="Extra bed">{r.extra_bed_allowed ? 'Yes' : 'No'}</MetaCell>
                <MetaCell label="View">{(r.view_type ?? []).join(', ') || '—'}</MetaCell>
                <MetaCell label="Bed config">{(r.bed_config ?? []).join(', ') || '—'}</MetaCell>
                <MetaCell label="Ideal for">{(r.ideal_for ?? []).join(', ') || '—'}</MetaCell>
              </div>
              {r.long_description && (
                <details style={{ cursor: 'pointer', fontSize: 12 }}>
                  <summary style={{ color: '#1F3A2E', fontSize: 11 }}>Show full description</summary>
                  <p style={{ marginTop: 6, color: '#3A3A3A', whiteSpace: 'pre-wrap' }}>{r.long_description}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A5A5A', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
