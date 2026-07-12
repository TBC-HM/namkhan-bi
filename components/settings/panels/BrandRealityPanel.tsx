// components/settings/panels/BrandRealityPanel.tsx
// PBS 2026-07-13: property-wide AI/reality grounding — single source of truth.
// Replaces the RealityPanel that used to live in the media Settings tab
// (which wrote to media.reality_profile). All fields now live in
// property.brand_reality and are edited here. Media area consumes via
// v_reality_profile which now points at this table.
//
// Fields deliberately dropped from the old RealityPanel:
//   • materials — per-facility (Facilities tab)
//   • season_calendar — property.seasons (Seasons tab)
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, sectionTitle, fieldLabel, ErrorBanner, LabeledInput, LabeledTextarea, ArrayInput } from './_settings_ui';

type Row = {
  property_id: number;
  location: string | null;
  region: string | null;
  architecture: string[] | null;
  palette: string[] | null;
  landscape: string[] | null;
  forbidden: string[] | null;
  vibe: string | null;
  brand_voice: string | null;
  positioning: string | null;
  allowed_taxonomy_note: string | null;
} | null;

interface Draft {
  location: string;
  region: string;
  architecture: string[];
  palette: string[];
  landscape: string[];
  forbidden: string[];
  vibe: string;
  brand_voice: string;
  positioning: string;
  allowed_taxonomy_note: string;
}

const toDraft = (r: Row): Draft => ({
  location: r?.location ?? '',
  region: r?.region ?? '',
  architecture: r?.architecture ?? [],
  palette: r?.palette ?? [],
  landscape: r?.landscape ?? [],
  forbidden: r?.forbidden ?? [],
  vibe: r?.vibe ?? '',
  brand_voice: r?.brand_voice ?? '',
  positioning: r?.positioning ?? '',
  allowed_taxonomy_note: r?.allowed_taxonomy_note ?? '',
});

export default function BrandRealityPanel({ data, propertyId }: { data: Row; propertyId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_brand_reality', {
        p_property_id: propertyId,
        p_location: draft.location.trim() || null,
        p_region: draft.region.trim() || null,
        p_architecture: draft.architecture.length > 0 ? draft.architecture : null,
        p_materials: null,             // dropped — now per-facility
        p_palette: draft.palette.length > 0 ? draft.palette : null,
        p_landscape: draft.landscape.length > 0 ? draft.landscape : null,
        p_forbidden: draft.forbidden.length > 0 ? draft.forbidden : null,
        p_season_calendar: null,       // dropped — Seasons tab is truth
        p_vibe: draft.vibe.trim() || null,
        p_brand_voice: draft.brand_voice.trim() || null,
        p_positioning: draft.positioning.trim() || null,
        p_allowed_taxonomy_note: draft.allowed_taxonomy_note.trim() || null,
        p_updated_by: 'settings-ui',
      });
      if (e) { setError(e.message); return; }
      setEditing(false); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader
        title="Brand & Reality"
        subtitle="Property-wide grounding for AI photo/video generation — location, palette, vibe, forbidden terms"
        action={editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(toDraft(data)); setError(null); }} disabled={busy} style={btnGhost}>Cancel</button>
          </div>
        ) : <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>}
      />
      <ErrorBanner error={error} />
      {!editing ? (
        <div>
          <Section title="Positioning">
            <F label="Vibe" value={data?.vibe} />
            <F label="Brand voice" value={data?.brand_voice} />
            <F label="Positioning" value={data?.positioning} />
          </Section>
          <Section title="Physical world (Laos-wide grounding)">
            <F label="Location" value={data?.location} />
            <F label="Region" value={data?.region} />
            <F label="Architecture" value={(data?.architecture ?? []).join(' · ') || null} span={3} />
            <F label="Palette" value={(data?.palette ?? []).join(' · ') || null} span={3} />
            <F label="Landscape" value={(data?.landscape ?? []).join(' · ') || null} span={3} />
          </Section>
          <Section title="AI reality-check">
            <F label="Forbidden terms" value={(data?.forbidden ?? []).join(' · ') || null} span={3} />
            <F label="Allowed taxonomy note" value={data?.allowed_taxonomy_note} span={3} />
          </Section>
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Positioning">
            <LabeledInput label="Vibe (short)" value={draft.vibe} onChange={(v) => setF('vibe', v)} placeholder="calm, tactile, jungle-side" />
            <LabeledInput label="Brand voice" value={draft.brand_voice} onChange={(v) => setF('brand_voice', v)} placeholder="warm, quiet, precise" />
            <LabeledInput label="Positioning" value={draft.positioning} onChange={(v) => setF('positioning', v)} placeholder="luxury eco-retreat" />
          </FormSection>
          <FormSection title="Physical world (Laos-wide)">
            <LabeledInput label="Location" value={draft.location} onChange={(v) => setF('location', v)} placeholder="Luang Prabang, Laos" />
            <LabeledInput label="Region" value={draft.region} onChange={(v) => setF('region', v)} placeholder="Namkhan river valley" />
            <ArrayInput label="Architecture (comma-sep)" value={draft.architecture} onChange={(v) => setF('architecture', v)} span={3} />
            <ArrayInput label="Palette (comma-sep — hex or names)" value={draft.palette} onChange={(v) => setF('palette', v)} span={3} />
            <ArrayInput label="Landscape (comma-sep)" value={draft.landscape} onChange={(v) => setF('landscape', v)} span={3} />
          </FormSection>
          <FormSection title="AI reality-check">
            <ArrayInput label="Forbidden terms (comma-sep)" value={draft.forbidden} onChange={(v) => setF('forbidden', v)} span={3} />
            <LabeledTextarea label="Allowed taxonomy note" value={draft.allowed_taxonomy_note} onChange={(v) => setF('allowed_taxonomy_note', v)} span={3} rows={2} />
          </FormSection>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '16px 20px', borderBottom: '1px solid #E6DFCC' }}>
      <h3 style={sectionTitle}>{title}</h3>
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px 24px', margin: 0 }}>{children}</dl>
    </section>
  );
}
function F({ label, value, span = 1 }: { label: string; value: string | null | undefined; span?: 1 | 2 | 3 }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <dt style={fieldLabel}>{label}</dt>
      <dd style={{ fontSize: 13, margin: 0, color: empty ? '#8A8A8A' : '#1B1B1B', fontStyle: empty ? 'italic' : 'normal', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{empty ? '—' : value}</dd>
    </div>
  );
}
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={sectionTitle}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>{children}</div>
    </div>
  );
}
