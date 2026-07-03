// components/settings/panels/LocationPanel.tsx
// PBS 2026-07-03: full edit — address · GPS · language · climate.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, sectionTitle, fieldLabel, ErrorBanner, LabeledInput, LabeledTextarea, ArrayInput } from './_settings_ui';

type Row = { property_id: number; street_line_1: string | null; street_line_2: string | null; village: string | null; district: string | null; city: string | null; province: string | null; country: string | null; postal_code: string | null; latitude: number | null; longitude: number | null; google_plus_code: string | null; what3words: string | null; google_maps_url: string | null; primary_language: string | null; languages_spoken: string[] | null; timezone: string | null; airport_distance_km: number | null; airport_drive_time_min: number | null; climate_temp_min_c: number | null; climate_temp_max_c: number | null; climate_summary: string | null; } | null;

interface Draft { street_line_1: string; street_line_2: string; village: string; district: string; city: string; province: string; country: string; postal_code: string; latitude: string; longitude: string; google_plus_code: string; what3words: string; google_maps_url: string; primary_language: string; languages_spoken: string[]; timezone: string; airport_distance_km: string; airport_drive_time_min: string; climate_temp_min_c: string; climate_temp_max_c: string; climate_summary: string; }

const toDraft = (r: Row): Draft => ({ street_line_1: r?.street_line_1 ?? '', street_line_2: r?.street_line_2 ?? '', village: r?.village ?? '', district: r?.district ?? '', city: r?.city ?? '', province: r?.province ?? '', country: r?.country ?? '', postal_code: r?.postal_code ?? '', latitude: r?.latitude?.toString() ?? '', longitude: r?.longitude?.toString() ?? '', google_plus_code: r?.google_plus_code ?? '', what3words: r?.what3words ?? '', google_maps_url: r?.google_maps_url ?? '', primary_language: r?.primary_language ?? '', languages_spoken: r?.languages_spoken ?? [], timezone: r?.timezone ?? '', airport_distance_km: r?.airport_distance_km?.toString() ?? '', airport_drive_time_min: r?.airport_drive_time_min?.toString() ?? '', climate_temp_min_c: r?.climate_temp_min_c?.toString() ?? '', climate_temp_max_c: r?.climate_temp_max_c?.toString() ?? '', climate_summary: r?.climate_summary ?? '' });

export default function LocationPanel({ data, propertyId }: { data: Row; propertyId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_location', {
        p_property_id: propertyId,
        p_street_line_1: draft.street_line_1.trim() || null, p_street_line_2: draft.street_line_2.trim() || null,
        p_village: draft.village.trim() || null, p_district: draft.district.trim() || null,
        p_city: draft.city.trim() || null, p_province: draft.province.trim() || null,
        p_country: draft.country.trim() || null, p_postal_code: draft.postal_code.trim() || null,
        p_latitude: draft.latitude ? Number(draft.latitude) : null,
        p_longitude: draft.longitude ? Number(draft.longitude) : null,
        p_google_plus_code: draft.google_plus_code.trim() || null,
        p_what3words: draft.what3words.trim() || null,
        p_google_maps_url: draft.google_maps_url.trim() || null,
        p_primary_language: draft.primary_language.trim() || null,
        p_languages_spoken: draft.languages_spoken.length > 0 ? draft.languages_spoken : null,
        p_timezone: draft.timezone.trim() || null,
        p_airport_distance_km: draft.airport_distance_km ? Number(draft.airport_distance_km) : null,
        p_airport_drive_time_min: draft.airport_drive_time_min ? Number(draft.airport_drive_time_min) : null,
        p_climate_temp_min_c: draft.climate_temp_min_c ? Number(draft.climate_temp_min_c) : null,
        p_climate_temp_max_c: draft.climate_temp_max_c ? Number(draft.climate_temp_max_c) : null,
        p_climate_summary: draft.climate_summary.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setEditing(false); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Location" subtitle="Address · GPS · language · climate"
        action={editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(toDraft(data)); setError(null); }} disabled={busy} style={btnGhost}>Cancel</button>
          </div>
        ) : <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>} />
      <ErrorBanner error={error} />
      {!editing ? (
        <div>
          <Section title="Address">
            <F label="Street 1" value={data?.street_line_1} span={2} />
            <F label="Street 2" value={data?.street_line_2} />
            <F label="Village" value={data?.village} />
            <F label="District" value={data?.district} />
            <F label="City" value={data?.city} />
            <F label="Province" value={data?.province} />
            <F label="Country" value={data?.country} />
            <F label="Postal code" value={data?.postal_code} />
          </Section>
          <Section title="Coordinates">
            <F label="Latitude" value={data?.latitude?.toString()} />
            <F label="Longitude" value={data?.longitude?.toString()} />
            <F label="Timezone" value={data?.timezone} />
            <F label="+Code (Plus Code)" value={data?.google_plus_code} />
            <F label="What3Words" value={data?.what3words} />
            <F label="Maps URL" value={data?.google_maps_url ? '↗ open' : '—'} />
          </Section>
          <Section title="Languages">
            <F label="Primary" value={data?.primary_language} />
            <F label="Spoken" value={(data?.languages_spoken ?? []).join(', ') || null} span={2} />
          </Section>
          <Section title="Access & climate">
            <F label="Airport distance (km)" value={data?.airport_distance_km?.toString()} />
            <F label="Airport drive (min)" value={data?.airport_drive_time_min?.toString()} />
            <F label="Climate min (°C)" value={data?.climate_temp_min_c?.toString()} />
            <F label="Climate max (°C)" value={data?.climate_temp_max_c?.toString()} />
            <F label="Climate summary" value={data?.climate_summary} span={2} />
          </Section>
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Address">
            <LabeledInput label="Street 1" value={draft.street_line_1} onChange={(v) => setF('street_line_1', v)} span={2} />
            <LabeledInput label="Street 2" value={draft.street_line_2} onChange={(v) => setF('street_line_2', v)} />
            <LabeledInput label="Village" value={draft.village} onChange={(v) => setF('village', v)} />
            <LabeledInput label="District" value={draft.district} onChange={(v) => setF('district', v)} />
            <LabeledInput label="City" value={draft.city} onChange={(v) => setF('city', v)} />
            <LabeledInput label="Province" value={draft.province} onChange={(v) => setF('province', v)} />
            <LabeledInput label="Country" value={draft.country} onChange={(v) => setF('country', v)} />
            <LabeledInput label="Postal code" value={draft.postal_code} onChange={(v) => setF('postal_code', v)} />
          </FormSection>
          <FormSection title="Coordinates">
            <LabeledInput label="Latitude" value={draft.latitude} onChange={(v) => setF('latitude', v)} type="number" />
            <LabeledInput label="Longitude" value={draft.longitude} onChange={(v) => setF('longitude', v)} type="number" />
            <LabeledInput label="Timezone" value={draft.timezone} onChange={(v) => setF('timezone', v)} placeholder="Asia/Vientiane" />
            <LabeledInput label="+Code" value={draft.google_plus_code} onChange={(v) => setF('google_plus_code', v)} />
            <LabeledInput label="What3Words" value={draft.what3words} onChange={(v) => setF('what3words', v)} />
            <LabeledInput label="Maps URL" value={draft.google_maps_url} onChange={(v) => setF('google_maps_url', v)} type="url" />
          </FormSection>
          <FormSection title="Languages">
            <LabeledInput label="Primary" value={draft.primary_language} onChange={(v) => setF('primary_language', v)} />
            <ArrayInput label="Spoken (comma-sep)" value={draft.languages_spoken} onChange={(v) => setF('languages_spoken', v)} span={2} />
          </FormSection>
          <FormSection title="Access & climate">
            <LabeledInput label="Airport distance (km)" value={draft.airport_distance_km} onChange={(v) => setF('airport_distance_km', v)} type="number" />
            <LabeledInput label="Airport drive (min)" value={draft.airport_drive_time_min} onChange={(v) => setF('airport_drive_time_min', v)} type="number" />
            <div />
            <LabeledInput label="Climate min °C" value={draft.climate_temp_min_c} onChange={(v) => setF('climate_temp_min_c', v)} type="number" />
            <LabeledInput label="Climate max °C" value={draft.climate_temp_max_c} onChange={(v) => setF('climate_temp_max_c', v)} type="number" />
            <LabeledTextarea label="Climate summary" value={draft.climate_summary} onChange={(v) => setF('climate_summary', v)} span={3} />
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
      <dd style={{ fontSize: 13, margin: 0, color: empty ? '#8A8A8A' : '#1B1B1B', fontStyle: empty ? 'italic' : 'normal', wordBreak: 'break-word' }}>{empty ? '—' : value}</dd>
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
