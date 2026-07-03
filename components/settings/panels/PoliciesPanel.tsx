// components/settings/panels/PoliciesPanel.tsx
// PBS 2026-07-03: full edit — check-in/out times · cancellation · payment · terms.
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelHeader } from './_shared';
import { supabase } from '@/lib/supabase';
import { btnPrimary, btnGhost, sectionTitle, fieldLabel, ErrorBanner, LabeledInput, LabeledTextarea, ArrayInput } from './_settings_ui';

type Row = { property_id: number; check_in_time: string | null; check_out_time: string | null; cancellation_policy: string | null; no_show_policy: string | null; modification_policy: string | null; early_departure_policy: string | null; fit_payment_terms: string | null; group_payment_terms: string | null; accepted_payment_methods: string[] | null; group_booking_terms: string | null; recommended_min_nights: number | null; selling_approach: string | null; final_note: string | null; } | null;

interface Draft { check_in_time: string; check_out_time: string; cancellation_policy: string; no_show_policy: string; modification_policy: string; early_departure_policy: string; fit_payment_terms: string; group_payment_terms: string; accepted_payment_methods: string[]; group_booking_terms: string; recommended_min_nights: string; selling_approach: string; final_note: string; }

const toDraft = (r: Row): Draft => ({ check_in_time: r?.check_in_time?.slice(0, 5) ?? '', check_out_time: r?.check_out_time?.slice(0, 5) ?? '', cancellation_policy: r?.cancellation_policy ?? '', no_show_policy: r?.no_show_policy ?? '', modification_policy: r?.modification_policy ?? '', early_departure_policy: r?.early_departure_policy ?? '', fit_payment_terms: r?.fit_payment_terms ?? '', group_payment_terms: r?.group_payment_terms ?? '', accepted_payment_methods: r?.accepted_payment_methods ?? [], group_booking_terms: r?.group_booking_terms ?? '', recommended_min_nights: r?.recommended_min_nights?.toString() ?? '', selling_approach: r?.selling_approach ?? '', final_note: r?.final_note ?? '' });

export default function PoliciesPanel({ data, propertyId }: { data: Row; propertyId: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(data));
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const setF = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const { error: e } = await supabase.rpc('fn_upsert_property_policies', {
        p_property_id: propertyId,
        p_check_in_time: draft.check_in_time || null, p_check_out_time: draft.check_out_time || null,
        p_cancellation_policy: draft.cancellation_policy.trim() || null,
        p_no_show_policy: draft.no_show_policy.trim() || null,
        p_modification_policy: draft.modification_policy.trim() || null,
        p_early_departure_policy: draft.early_departure_policy.trim() || null,
        p_fit_payment_terms: draft.fit_payment_terms.trim() || null,
        p_group_payment_terms: draft.group_payment_terms.trim() || null,
        p_accepted_payment_methods: draft.accepted_payment_methods.length > 0 ? draft.accepted_payment_methods : null,
        p_group_booking_terms: draft.group_booking_terms.trim() || null,
        p_recommended_min_nights: draft.recommended_min_nights ? Number(draft.recommended_min_nights) : null,
        p_selling_approach: draft.selling_approach.trim() || null,
        p_final_note: draft.final_note.trim() || null,
      });
      if (e) { setError(e.message); return; }
      setEditing(false); router.refresh();
    });
  }

  return (
    <div>
      <PanelHeader title="Policies" subtitle="Bookings & terms · check-in/out · cancellation · payment"
        action={editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={save} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.5 : 1 }}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={() => { setEditing(false); setDraft(toDraft(data)); setError(null); }} disabled={busy} style={btnGhost}>Cancel</button>
          </div>
        ) : <button type="button" onClick={() => setEditing(true)} style={btnPrimary}>Edit</button>} />
      <ErrorBanner error={error} />
      {!editing ? (
        <div>
          <Section title="Check-in / out">
            <F label="Check-in time" value={data?.check_in_time?.slice(0, 5)} />
            <F label="Check-out time" value={data?.check_out_time?.slice(0, 5)} />
            <F label="Min nights recommended" value={data?.recommended_min_nights?.toString()} />
          </Section>
          <Section title="Cancellation & modification">
            <F label="Cancellation policy" value={data?.cancellation_policy} span={3} />
            <F label="No-show policy" value={data?.no_show_policy} span={3} />
            <F label="Modification policy" value={data?.modification_policy} span={3} />
            <F label="Early departure policy" value={data?.early_departure_policy} span={3} />
          </Section>
          <Section title="Payment">
            <F label="FIT payment terms" value={data?.fit_payment_terms} span={3} />
            <F label="Group payment terms" value={data?.group_payment_terms} span={3} />
            <F label="Accepted payment methods" value={(data?.accepted_payment_methods ?? []).join(', ') || null} span={3} />
          </Section>
          <Section title="Groups & approach">
            <F label="Group booking terms" value={data?.group_booking_terms} span={3} />
            <F label="Selling approach" value={data?.selling_approach} span={3} />
            <F label="Final note" value={data?.final_note} span={3} />
          </Section>
        </div>
      ) : (
        <div style={{ padding: 20, background: '#FAFAF7' }}>
          <FormSection title="Check-in / out">
            <LabeledInput label="Check-in time" value={draft.check_in_time} onChange={(v) => setF('check_in_time', v)} type="time" />
            <LabeledInput label="Check-out time" value={draft.check_out_time} onChange={(v) => setF('check_out_time', v)} type="time" />
            <LabeledInput label="Min nights" value={draft.recommended_min_nights} onChange={(v) => setF('recommended_min_nights', v)} type="number" />
          </FormSection>
          <FormSection title="Cancellation & modification">
            <LabeledTextarea label="Cancellation policy" value={draft.cancellation_policy} onChange={(v) => setF('cancellation_policy', v)} span={3} />
            <LabeledTextarea label="No-show policy" value={draft.no_show_policy} onChange={(v) => setF('no_show_policy', v)} span={3} />
            <LabeledTextarea label="Modification policy" value={draft.modification_policy} onChange={(v) => setF('modification_policy', v)} span={3} />
            <LabeledTextarea label="Early departure policy" value={draft.early_departure_policy} onChange={(v) => setF('early_departure_policy', v)} span={3} />
          </FormSection>
          <FormSection title="Payment">
            <LabeledTextarea label="FIT payment terms" value={draft.fit_payment_terms} onChange={(v) => setF('fit_payment_terms', v)} span={3} />
            <LabeledTextarea label="Group payment terms" value={draft.group_payment_terms} onChange={(v) => setF('group_payment_terms', v)} span={3} />
            <ArrayInput label="Accepted payment methods (comma-sep)" value={draft.accepted_payment_methods} onChange={(v) => setF('accepted_payment_methods', v)} span={3} />
          </FormSection>
          <FormSection title="Groups & approach">
            <LabeledTextarea label="Group booking terms" value={draft.group_booking_terms} onChange={(v) => setF('group_booking_terms', v)} span={3} />
            <LabeledTextarea label="Selling approach" value={draft.selling_approach} onChange={(v) => setF('selling_approach', v)} span={3} />
            <LabeledTextarea label="Final note" value={draft.final_note} onChange={(v) => setF('final_note', v)} span={3} />
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
