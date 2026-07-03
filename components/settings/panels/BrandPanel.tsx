// components/settings/panels/BrandPanel.tsx
// PBS 2026-07-03: full edit — logo · palette · copy · taglines · USPs.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, sectionTitle, fieldLabel, ErrorBanner, LabeledInput, LabeledTextarea, ArrayInput } from './_settings_ui';

type Row = { property_id: number; brand_taglines: string[] | null; short_description: string | null; long_description: string | null; unique_selling_points: string[] | null; logo_url: string | null; hero_image_url: string | null; brand_color_hex: string | null; website_url: string | null; brand_assets_url: string | null; } | null;

interface Draft { brand_taglines: string[]; short_description: string; long_description: string; unique_selling_points: string[]; logo_url: string; hero_image_url: string; brand_color_hex: string; website_url: string; brand_assets_url: string; }

const toDraft = (r: Row): Draft => ({ brand_taglines: r?.brand_taglines ?? [], short_description: r?.short_description ?? '', long_description: r?.long_description ?? '', unique_selling_points: r?.unique_selling_points ?? [], logo_url: r?.logo_url ?? '', hero_image_url: r?.hero_image_url ?? '', brand_color_hex: r?.brand_color_hex ?? '', website_url: r?.website_url ?? '', brand_assets_url: r?.brand_assets_url ?? '' });

export default function BrandPanel({ data, propertyId }: { data: Row; propertyId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_brand', {
        p_property_id: propertyId,
        p_brand_taglines: draft.brand_taglines.length > 0 ? draft.brand_taglines : null,
        p_short_description: draft.short_description.trim() || null,
        p_long_description: draft.long_description.trim() || null,
        p_unique_selling_points: draft.unique_selling_points.length > 0 ? draft.unique_selling_points : null,
        p_logo_url: draft.logo_url.trim() || null,
        p_hero_image_url: draft.hero_image_url.trim() || null,
        p_brand_color_hex: draft.brand_color_hex.trim() || null,
        p_website_url: draft.website_url.trim() || null,
        p_brand_assets_url: draft.brand_assets_url.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setEditing(false); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Brand" subtitle="Logo · palette · copy · taglines"
        action={editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(toDraft(data)); setError(null); }} disabled={busy} style={btnGhost}>Cancel</button>
          </div>
        ) : <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>} />
      <ErrorBanner error={error} />
      {!editing ? (
        <div>
          <Section title="Copy">
            <F label="Short description" value={data?.short_description} span={3} />
            <F label="Long description" value={data?.long_description} span={3} />
            <F label="Taglines" value={(data?.brand_taglines ?? []).join(' · ') || null} span={3} />
            <F label="USPs" value={(data?.unique_selling_points ?? []).join(' · ') || null} span={3} />
          </Section>
          <Section title="Visual">
            <F label="Logo URL" value={data?.logo_url} />
            <F label="Hero image URL" value={data?.hero_image_url} />
            <F label="Brand color hex" value={data?.brand_color_hex} />
            <F label="Website" value={data?.website_url} />
            <F label="Assets URL" value={data?.brand_assets_url} span={2} />
          </Section>
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Copy">
            <LabeledTextarea label="Short description" value={draft.short_description} onChange={(v) => setF('short_description', v)} span={3} rows={2} />
            <LabeledTextarea label="Long description" value={draft.long_description} onChange={(v) => setF('long_description', v)} span={3} rows={5} />
            <ArrayInput label="Taglines (comma-sep)" value={draft.brand_taglines} onChange={(v) => setF('brand_taglines', v)} span={3} />
            <ArrayInput label="USPs (comma-sep)" value={draft.unique_selling_points} onChange={(v) => setF('unique_selling_points', v)} span={3} />
          </FormSection>
          <FormSection title="Visual">
            <LabeledInput label="Logo URL" value={draft.logo_url} onChange={(v) => setF('logo_url', v)} type="url" />
            <LabeledInput label="Hero image URL" value={draft.hero_image_url} onChange={(v) => setF('hero_image_url', v)} type="url" />
            <LabeledInput label="Brand color hex" value={draft.brand_color_hex} onChange={(v) => setF('brand_color_hex', v)} placeholder="#1F3A2E" />
            <LabeledInput label="Website" value={draft.website_url} onChange={(v) => setF('website_url', v)} type="url" />
            <LabeledInput label="Assets URL" value={draft.brand_assets_url} onChange={(v) => setF('brand_assets_url', v)} type="url" span={2} />
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
