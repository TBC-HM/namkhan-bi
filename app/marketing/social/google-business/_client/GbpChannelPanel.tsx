'use client';
// GbpChannelPanel — full channel settings + programs for Google Business Profile.
// Mirrors the X channel card in ChannelsManager: guardrails · media · keywords · programs.
// Guardrails saved via /api/settings/upsert (section: 'social_rules').
// Programs via ProgramsPanel (CRUD) + 5 proposed defaults when empty.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import ProgramsPanel from '@/app/marketing/social/[platform]/_programs-panel';
import type { SocialChannelRule, SocialProgram } from '@/lib/marketing';

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_M  = '#5A5A5A';
const INK_S  = '#3A3A3A';
const FOREST = '#084838';
const CREAM  = '#F5F0E1';
const AMBER  = '#C28F2C';
const RED    = '#B03826';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const AUTONOMY_OPTS = [
  { code: 'A', label: 'A — AI publishes automatically' },
  { code: 'B', label: 'B — AI drafts · human approves' },
  { code: 'C', label: 'C — human writes everything' },
];

const GBP_FORMAT_OPTS = [
  { code: 'WHATS_NEW', label: "What's New" },
  { code: 'EVENT',     label: 'Event' },
  { code: 'OFFER',     label: 'Offer / Promotion' },
  { code: 'PHOTO',     label: 'Photo post' },
];

// 5 GBP-specific proposed programs — seeded when the channel has no programs yet.
const PROPOSED: Array<Omit<SocialProgram, 'id' | 'property_id' | 'active'>> = [
  {
    platform: 'google_business',
    category_code: 'whats_new',
    label: "What's New · hotel updates",
    weekday_slots: [1, 4],
    posts_per_week: 2,
    notes: "Fresh updates, seasonal news, facility highlights — 150–200 words. Link to booking page. Use WHATS_NEW post type.",
  },
  {
    platform: 'google_business',
    category_code: 'inspirational',
    label: 'Inspirational · Luang Prabang stories',
    weekday_slots: [2],
    posts_per_week: 1,
    notes: "Monks at dawn, Mekong at dusk, local life. Poetic, place-rooted tone. No hard sell. Strong hero photo.",
  },
  {
    platform: 'google_business',
    category_code: 'wellness',
    label: 'Wellness · retreats & spa',
    weekday_slots: [3],
    posts_per_week: 1,
    notes: "Spa, yoga retreats, mindfulness. Warm restorative tone. Link to retreats page. Use OFFER when a promo applies.",
  },
  {
    platform: 'google_business',
    category_code: 'fnb',
    label: 'F&B · restaurant & dining',
    weekday_slots: [5],
    posts_per_week: 1,
    notes: "Chef's specials, seasonal menus, Lao cuisine. Appetite-inspiring copy. Photo of signature dish or table scene.",
  },
  {
    platform: 'google_business',
    category_code: 'community',
    label: 'Community · events & offers',
    weekday_slots: [6],
    posts_per_week: 1,
    notes: "Local events, seasonal promotions, cultural moments. CTA: book now / explore. Use EVENT or OFFER post type.",
  },
];

interface Props {
  propertyId: number;
  initialRule: SocialChannelRule | null;
  initialPrograms: SocialProgram[];
  topKeywords: string[];
}

type RuleEdit = {
  caption_max_chars: number;
  hashtags_allowed: boolean;
  hashtag_max: number;
  posting_frequency: string;
  autonomy_phase: 'A' | 'B' | 'C';
  banned_topics: string;
  audience_notes: string;
  formats: string[];
};

function defaultEdit(r: SocialChannelRule | null): RuleEdit {
  return {
    caption_max_chars: r?.caption_max_chars ?? 1500,
    hashtags_allowed:  r?.hashtags_allowed  ?? false,
    hashtag_max:       r?.hashtag_max       ?? 0,
    posting_frequency: r?.posting_frequency ?? '6x/week',
    autonomy_phase:    r?.autonomy_phase    ?? 'B',
    banned_topics:     (r?.banned_topics    ?? []).join(', '),
    audience_notes:    r?.audience_notes    ?? '',
    formats:           r?.formats?.length   ? r.formats : ['WHATS_NEW', 'EVENT', 'OFFER', 'PHOTO'],
  };
}

export default function GbpChannelPanel({ propertyId, initialRule, initialPrograms, topKeywords }: Props) {
  const router = useRouter();
  const [rule, setRule] = useState<SocialChannelRule | null>(initialRule);
  const [editingRule, setEditingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleEdit>(defaultEdit(initialRule));
  const [ruleBusy, setRuleBusy] = useState(false);
  const [ruleErr, setRuleErr] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [programs, setPrograms] = useState<SocialProgram[]>(initialPrograms);
  const [, startTransition] = useTransition();

  // ── Save guardrail rule ─────────────────────────────────────────────
  async function saveRule(e: React.FormEvent) {
    e.preventDefault();
    setRuleBusy(true);
    setRuleErr(null);
    const banned = ruleForm.banned_topics.split(',').map(s => s.trim()).filter(Boolean);
    const row: Record<string, unknown> = {
      property_id: propertyId,
      platform: 'google_business',
      caption_max_chars: ruleForm.caption_max_chars,
      hashtags_allowed: ruleForm.hashtags_allowed,
      hashtag_max: ruleForm.hashtag_max,
      posting_frequency: ruleForm.posting_frequency,
      autonomy_phase: ruleForm.autonomy_phase,
      banned_topics: banned,
      audience_notes: ruleForm.audience_notes || null,
      formats: ruleForm.formats,
      active: true,
    };
    if (rule?.id) row.id = rule.id;

    try {
      const res = await fetch('/api/settings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'social_rules', table: 'social_channel_rules', pk: 'id', row }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'save failed');
      setRule({ ...row, id: j.id ?? rule?.id ?? 0, updated_at: new Date().toISOString() } as SocialChannelRule);
      setEditingRule(false);
      startTransition(() => router.refresh());
    } catch (ex) {
      setRuleErr((ex as Error).message ?? 'save failed');
    } finally {
      setRuleBusy(false);
    }
  }

  // ── Seed 5 proposed programs ────────────────────────────────────────
  async function seedProposals() {
    setSeedBusy(true);
    setSeedMsg(null);
    try {
      const results = await Promise.all(
        PROPOSED.map((p) =>
          fetch('/api/marketing/social/programs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...p, property_id: propertyId, active: true }),
          }).then((r) => r.json())
        )
      );
      const failed = results.filter((r) => r.error != null);
      if (failed.length) {
        setSeedMsg(`Saved ${results.length - failed.length}/5 — ${failed[0]?.error ?? 'partial failure'}`);
      } else {
        setSeedMsg('✓ All 5 programs saved — generate a content plan below.');
        startTransition(() => router.refresh());
      }
    } catch (ex) {
      setSeedMsg((ex as Error).message ?? 'seed failed');
    } finally {
      setSeedBusy(false);
    }
  }

  function toggleFormat(code: string) {
    setRuleForm((f) => ({
      ...f,
      formats: f.formats.includes(code)
        ? f.formats.filter((c) => c !== code)
        : [...f.formats, code],
    }));
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ─ Guardrails ─────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={microLabel}>Guardrails</span>
          {!editingRule && (
            <button onClick={() => { setRuleErr(null); setRuleForm(defaultEdit(rule)); setEditingRule(true); }}
              style={btnXs}>
              {rule ? 'Edit guardrails' : '+ Set guardrails'}
            </button>
          )}
        </div>

        {!editingRule ? (
          rule ? (
            <div style={{ background: CREAM, borderLeft: `2px solid ${FOREST}`, padding: '8px 10px', borderRadius: '0 4px 4px 0' }}>
              <div style={{ fontSize: 10.5, color: INK_S, lineHeight: 1.7 }}>
                caption ≤ <strong>{rule.caption_max_chars ?? '—'}</strong> chars
                {' · '}{rule.hashtags_allowed ? `≤ ${rule.hashtag_max ?? 0} hashtags` : 'no hashtags'}
                {' · '}<strong>{rule.posting_frequency ?? '—'}</strong>
                {' · '}autonomy <strong>{rule.autonomy_phase}</strong>
              </div>
              {rule.formats?.length > 0 && (
                <div style={{ fontSize: 10, color: INK_M, marginTop: 3 }}>
                  post types: {rule.formats.join(' · ')}
                </div>
              )}
              {rule.banned_topics?.length > 0 && (
                <div style={{ fontSize: 10, color: RED, marginTop: 2 }}>
                  banned: {rule.banned_topics.join(', ')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: CREAM, borderLeft: `2px solid ${AMBER}`, padding: '8px 10px', fontSize: 10.5, color: INK_M, fontStyle: 'italic', borderRadius: '0 4px 4px 0' }}>
              No guardrails set — click "+ Set guardrails" to configure caption limits, post frequency, autonomy, and banned topics.
            </div>
          )
        ) : (
          <form onSubmit={saveRule} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <label style={labelSt}>
                Caption max chars
                <input type="number" min={1} max={4000} value={ruleForm.caption_max_chars} required style={inputSt}
                  onChange={(e) => setRuleForm({ ...ruleForm, caption_max_chars: Number(e.target.value) })} />
              </label>
              <label style={labelSt}>
                Posting frequency
                <input value={ruleForm.posting_frequency} placeholder="e.g. 6x/week" style={inputSt}
                  onChange={(e) => setRuleForm({ ...ruleForm, posting_frequency: e.target.value })} />
              </label>
              <label style={labelSt}>
                Autonomy phase
                <select value={ruleForm.autonomy_phase} style={inputSt}
                  onChange={(e) => setRuleForm({ ...ruleForm, autonomy_phase: e.target.value as 'A' | 'B' | 'C' })}>
                  {AUTONOMY_OPTS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
                </select>
              </label>
              <label style={labelSt}>
                Hashtags
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
                  <label style={{ display: 'flex', gap: 6, fontSize: 12, cursor: 'pointer', color: INK }}>
                    <input type="checkbox" checked={ruleForm.hashtags_allowed}
                      onChange={(e) => setRuleForm({ ...ruleForm, hashtags_allowed: e.target.checked })} />
                    Allowed
                  </label>
                  {ruleForm.hashtags_allowed && (
                    <input type="number" min={0} max={30} value={ruleForm.hashtag_max} style={{ ...inputSt, width: 60 }}
                      onChange={(e) => setRuleForm({ ...ruleForm, hashtag_max: Number(e.target.value) })} />
                  )}
                </div>
              </label>
            </div>

            {/* Media / post type formats */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: INK_M, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Allowed post types
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {GBP_FORMAT_OPTS.map((f) => (
                  <label key={f.code} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', color: INK }}>
                    <input type="checkbox" checked={ruleForm.formats.includes(f.code)}
                      onChange={() => toggleFormat(f.code)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Banned topics */}
            <label style={{ ...labelSt, marginBottom: 10 }}>
              Banned topics (comma-separated)
              <input value={ruleForm.banned_topics} placeholder="politics, competitor names, pricing…" style={inputSt}
                onChange={(e) => setRuleForm({ ...ruleForm, banned_topics: e.target.value })} />
            </label>

            {/* Audience / AI direction notes */}
            <label style={labelSt}>
              AI direction & audience notes
              <textarea value={ruleForm.audience_notes} rows={2} placeholder="Brand voice notes, tone direction, target audience…" style={{ ...inputSt, resize: 'vertical', fontFamily: 'inherit' }}
                onChange={(e) => setRuleForm({ ...ruleForm, audience_notes: e.target.value })} />
            </label>

            {ruleErr && (
              <div style={{ marginTop: 8, fontSize: 11, color: RED, padding: '4px 8px', background: '#FBE8E4', borderRadius: 3 }}>
                {ruleErr}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" disabled={ruleBusy}
                style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                {ruleBusy ? 'Saving…' : 'Save guardrails'}
              </button>
              <button type="button" onClick={() => { setEditingRule(false); setRuleErr(null); }}
                style={{ padding: '5px 12px', fontSize: 12, background: WHITE, color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ─ Keywords & audience notes ───────────────────────────────── */}
      {topKeywords.length > 0 && (
        <div>
          <div style={microLabel}>Discovery keywords</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {topKeywords.map((kw) => (
              <span key={kw} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: CREAM, border: `1px solid ${HAIR}`, color: INK_S }}>
                {kw}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 10, color: INK_M, marginTop: 4, fontStyle: 'italic' }}>
            Top search terms driving GBP discovery — feed into post topics and AI direction notes above.
          </div>
        </div>
      )}

      {/* ─ Weekly programs ─────────────────────────────────────────── */}
      <div>
        <div style={microLabel}>Weekly programs</div>

        {/* Proposed defaults — shown when no programs exist */}
        {programs.length === 0 && !seedMsg && (
          <div style={{ marginBottom: 14, border: `1px dashed ${AMBER}`, borderRadius: 6, padding: '12px 14px', background: '#FFFBF2' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 8 }}>
              Proposed content programs for Google Business Profile
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {PROPOSED.map((p) => (
                <div key={p.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: INK }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>
                      {WEEKDAY_LABELS.filter((_, i) => (p.weekday_slots ?? []).includes(i + 1)).join(', ')}
                      {' · '}{p.posts_per_week}x/week
                    </div>
                    <div style={{ fontSize: 10, color: INK_S, marginTop: 3, lineHeight: 1.5 }}>{p.notes}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 8px', background: CREAM, borderRadius: 10, color: FOREST, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {p.category_code}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={seedProposals} disabled={seedBusy}
              style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 4, cursor: seedBusy ? 'wait' : 'pointer' }}>
              {seedBusy ? 'Saving 5 programs…' : '✓ Save all 5 proposed programs'}
            </button>
          </div>
        )}

        {seedMsg && (
          <div style={{ marginBottom: 10, fontSize: 12, color: seedMsg.startsWith('✓') ? FOREST : RED, padding: '6px 10px', background: seedMsg.startsWith('✓') ? '#E4F1E0' : '#FBE8E4', borderRadius: 4 }}>
            {seedMsg}
          </div>
        )}

        <ProgramsPanel propertyId={propertyId} platform="google_business" initial={programs} />
      </div>
    </div>
  );
}

// ── Micro styles ─────────────────────────────────────────────────────────────
const microLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: INK_M, marginBottom: 4,
};
const labelSt: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: INK_M,
};
const inputSt: React.CSSProperties = {
  padding: '5px 8px', fontSize: 13, border: `1px solid ${HAIR}`, borderRadius: 4,
  background: WHITE, color: INK,
};
const btnXs: React.CSSProperties = {
  padding: '2px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: FOREST,
  border: `1px solid ${FOREST}`, borderRadius: 3, cursor: 'pointer',
};
