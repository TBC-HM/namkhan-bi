'use client';
// TripAdvisor channel settings panel — guardrails + weekly programs.
// TripAdvisor has no public management API; replies go via Management Center.
// This panel manages CONTENT PLANNING: posting frequency, program categories,
// audience notes, and banned topics for AI-drafted content that surfaces TA
// review highlights across other channels.

import { useState } from 'react';
import ProgramsPanel from '../../[platform]/_programs-panel';
import type { SocialProgram, SocialChannelRule } from '@/lib/marketing';

const WHITE  = '#FFFFFF';
const CREAM  = '#F5F0E1';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#3A3A3A';
const INK_M  = '#5A5A5A';
const FOREST = '#084838';
const TA_GREEN = '#00AF87';
const RED    = '#B04A2F';

const AUTONOMY_OPTIONS = [
  { value: 'A', label: 'A — Fully autonomous' },
  { value: 'B', label: 'B — Draft + human approve' },
  { value: 'C', label: 'C — Human writes, AI assists' },
];

// 5 proposed programs tailored for TripAdvisor content strategy
const PROPOSED_PROGRAMS: Omit<SocialProgram, 'id' | 'property_id' | 'active' | 'updated_at'>[] = [
  { platform: 'tripadvisor', category_code: 'mystique',      label: 'Review highlights · guest voices',  weekday_slots: [1, 4], posts_per_week: 2, notes: 'Surface top TA reviews as social proof — quote the guest, lead with the experience.' },
  { platform: 'tripadvisor', category_code: 'inspirational', label: 'Inspirational · Luang Prabang life', weekday_slots: [2],    posts_per_week: 1, notes: 'Travel inspiration tied to destination — use TA ranking & location strengths.' },
  { platform: 'tripadvisor', category_code: 'community',     label: 'Community · local experiences',      weekday_slots: [3],    posts_per_week: 1, notes: 'Showcase local guides, markets, temples — content that earns TA Travellers\' Choice mentions.' },
  { platform: 'tripadvisor', category_code: 'wellness',      label: 'Wellness · spa & retreats',          weekday_slots: [5],    posts_per_week: 1, notes: 'TA subcategory: Service score driver — highlight spa & wellness offerings.' },
  { platform: 'tripadvisor', category_code: 'fnb',           label: 'F&B · dining & local cuisine',       weekday_slots: [6],    posts_per_week: 1, notes: 'TA subcategory: Value score driver — dining value and experience.' },
];

export default function TaChannelPanel({
  propertyId,
  initialRule,
  initialPrograms,
}: {
  propertyId: number;
  initialRule: SocialChannelRule | null;
  initialPrograms: SocialProgram[];
}) {
  const [rule, setRule] = useState<SocialChannelRule | null>(initialRule);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [programs, setPrograms] = useState<SocialProgram[]>(initialPrograms);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // Form state (edit mode)
  const [form, setForm] = useState({
    posting_frequency:  rule?.posting_frequency  ?? '6x/week',
    autonomy_phase:     rule?.autonomy_phase      ?? 'B',
    caption_max_chars:  rule?.caption_max_chars   ?? 2200,
    audience_notes:     rule?.audience_notes      ?? '',
    banned_topics:      (rule?.banned_topics ?? []).join(', '),
  });

  function openEdit() {
    setForm({
      posting_frequency:  rule?.posting_frequency  ?? '6x/week',
      autonomy_phase:     rule?.autonomy_phase      ?? 'B',
      caption_max_chars:  rule?.caption_max_chars   ?? 2200,
      audience_notes:     rule?.audience_notes      ?? '',
      banned_topics:      (rule?.banned_topics ?? []).join(', '),
    });
    setSaveErr(null);
    setEditing(true);
  }

  async function saveRule() {
    setSaving(true); setSaveErr(null);
    try {
      const res = await fetch('/api/settings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          section: 'social_rules',
          pk: 'id',
          row: {
            property_id:      propertyId,
            platform:         'tripadvisor',
            caption_max_chars: Number(form.caption_max_chars),
            hashtag_max:      0,
            hashtags_allowed: false,
            formats:          ['REVIEW_HIGHLIGHT', 'TESTIMONIAL', 'DESTINATION'],
            posting_frequency: form.posting_frequency,
            audience_notes:   form.audience_notes,
            banned_topics:    form.banned_topics.split(',').map((s) => s.trim()).filter(Boolean),
            autonomy_phase:   form.autonomy_phase,
            active:           true,
          },
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'save failed');
      setRule((prev) => ({ ...prev!, ...j.row } as SocialChannelRule));
      setEditing(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }

  async function seedPrograms() {
    setSeeding(true); setSeedMsg(null);
    try {
      await Promise.all(PROPOSED_PROGRAMS.map((p) =>
        fetch('/api/marketing/social/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ property_id: propertyId, ...p }),
        })
      ));
      setSeedMsg('5 programs saved — edit them below.');
      const res = await fetch(`/api/marketing/social/programs?property_id=${propertyId}&platform=tripadvisor`);
      const j = await res.json();
      if (Array.isArray(j.programs)) setPrograms(j.programs);
    } catch (e) {
      setSeedMsg('Seed failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSeeding(false); }
  }

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Guardrails ─────────────────────────────────────────────── */}
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
            Content guardrails
            <span style={{ fontSize: 11, fontWeight: 400, color: INK_M, marginLeft: 8 }}>
              posting rules · AI autonomy · audience
            </span>
          </div>
          {!editing && (
            <button onClick={openEdit} style={{ padding: '3px 10px', fontSize: 11, fontWeight: 600, background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', color: INK_M }}>
              Edit guardrails
            </button>
          )}
        </div>

        {!editing ? (
          rule ? (
            <div style={{ fontSize: 12, color: INK_S, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>Frequency:</strong> {rule.posting_frequency ?? '—'}</div>
              <div><strong>Autonomy:</strong> Phase {rule.autonomy_phase ?? '—'} · {AUTONOMY_OPTIONS.find((o) => o.value === rule.autonomy_phase)?.label.split('—')[1]?.trim() ?? ''}</div>
              <div><strong>Caption limit:</strong> {rule.caption_max_chars ? rule.caption_max_chars.toLocaleString() + ' chars' : '—'}</div>
              <div><strong>Hashtags:</strong> not allowed (TripAdvisor)</div>
              {rule.audience_notes && <div><strong>Audience:</strong> {rule.audience_notes}</div>}
              {rule.banned_topics && rule.banned_topics.length > 0 && (
                <div><strong>Banned topics:</strong> {rule.banned_topics.join(' · ')}</div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: INK_M }}>No guardrail row yet — click "Edit guardrails" to set one.</div>
          )
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: INK_M }}>
              Posting frequency
              <input value={form.posting_frequency} onChange={(e) => setForm((f) => ({ ...f, posting_frequency: e.target.value }))}
                style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${HAIR}`, borderRadius: 3, fontFamily: 'inherit', color: INK }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: INK_M }}>
              Autonomy phase
              <select value={form.autonomy_phase} onChange={(e) => setForm((f) => ({ ...f, autonomy_phase: e.target.value as 'A' | 'B' | 'C' }))}
                style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${HAIR}`, borderRadius: 3, fontFamily: 'inherit', color: INK }}>
                {AUTONOMY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: INK_M }}>
              Caption max chars
              <input type="number" value={form.caption_max_chars} onChange={(e) => setForm((f) => ({ ...f, caption_max_chars: Number(e.target.value) }))}
                style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${HAIR}`, borderRadius: 3, fontFamily: 'inherit', color: INK }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: INK_M }}>
              Banned topics (comma-separated)
              <input value={form.banned_topics} onChange={(e) => setForm((f) => ({ ...f, banned_topics: e.target.value }))}
                style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${HAIR}`, borderRadius: 3, fontFamily: 'inherit', color: INK }} />
            </label>
            <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: INK_M }}>
              Audience notes
              <textarea value={form.audience_notes} onChange={(e) => setForm((f) => ({ ...f, audience_notes: e.target.value }))} rows={2}
                style={{ padding: '6px 8px', fontSize: 12, border: `1px solid ${HAIR}`, borderRadius: 3, fontFamily: 'inherit', color: INK, resize: 'vertical' }} />
            </label>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={saveRule} disabled={saving}
                style={{ padding: '5px 14px', fontSize: 11, fontWeight: 600, background: saving ? INK_M : FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Saving…' : 'Save guardrails'}
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', color: INK_M }}>
                Cancel
              </button>
              {saveErr && <span style={{ fontSize: 11, color: RED }}>{saveErr}</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── API notice ──────────────────────────────────────────────── */}
      <div style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '10px 14px', fontSize: 11, color: INK_M, lineHeight: 1.6 }}>
        <strong style={{ color: INK }}>TripAdvisor has no public management API.</strong>{' '}
        Review replies open the Management Center. Content planned here is drafted for distribution across other channels (Instagram, Facebook, GBP) as review-highlight posts. DataForSEO enrichment wires subcategory scores.
      </div>

      {/* ── Weekly programs ─────────────────────────────────────────── */}
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>
          Weekly content programs
          <span style={{ fontSize: 11, fontWeight: 400, color: INK_M, marginLeft: 8 }}>
            review-highlight · destination · testimonial
          </span>
        </div>

        {/* Proposed seeds when empty */}
        {programs.length === 0 && !seedMsg && (
          <div style={{ marginBottom: 12, padding: '12px 14px', background: CREAM, borderRadius: 4, border: `1px solid ${HAIR}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 8 }}>5 proposed programs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {PROPOSED_PROGRAMS.map((p, i) => (
                <div key={i} style={{ fontSize: 11, color: INK_S, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600, color: TA_GREEN, minWidth: 24 }}>{p.posts_per_week}x</span>
                  <span><strong>{p.label}</strong> — {DAYS.filter((_, d) => p.weekday_slots.includes(d + 1)).join(', ')}</span>
                </div>
              ))}
            </div>
            <button onClick={seedPrograms} disabled={seeding}
              style={{ marginTop: 10, padding: '5px 14px', fontSize: 11, fontWeight: 600, background: seeding ? INK_M : TA_GREEN, color: WHITE, border: 'none', borderRadius: 3, cursor: seeding ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
              {seeding ? 'Saving…' : '✓ Save all 5 proposed programs'}
            </button>
          </div>
        )}
        {seedMsg && <div style={{ marginBottom: 10, fontSize: 11, color: FOREST }}>{seedMsg}</div>}

        <ProgramsPanel propertyId={propertyId} platform="tripadvisor" initial={programs} />
      </div>
    </div>
  );
}
