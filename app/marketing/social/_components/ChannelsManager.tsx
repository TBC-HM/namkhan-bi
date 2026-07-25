'use client';
// app/marketing/social/_components/ChannelsManager.tsx
// spec-social-media-module (2026-07-25) · A1: channels are DB-backed with
// add / edit / delete UI — nothing hardcoded. Rows live in
// marketing.social_accounts; guardrails in marketing.social_channel_rules;
// weekly content programs in marketing.social_programs.
// Writes reuse the existing settings backend: POST /api/settings/upsert and
// /api/settings/delete with section='social' (service-role, RLS-safe).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialAccountRow, SocialChannelRule, SocialProgram } from '@/lib/marketing';

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const CREAM  = '#F5F0E1';

// Platforms with a real landing page today. google_business has a dedicated
// dashboard; the rest resolve through /marketing/social/[platform].
const LANDING_SLUG: Record<string, string> = {
  google_business: 'google-business',
  instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok',
  pinterest: 'pinterest', linkedin: 'linkedin', x: 'x', twitter: 'twitter',
};

// Platforms that are reputation / owned surfaces, not posting channels.
// A platform counts as a POSTING channel when it has a guardrail row in
// marketing.social_channel_rules — that table defines the roster.
function prettyPlatform(p: string): string {
  const map: Record<string, string> = {
    google_business: 'Google Business Profile', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', pinterest: 'Pinterest',
    linkedin: 'LinkedIn', x: 'X / Twitter', twitter: 'X / Twitter',
    youtube: 'YouTube', tripadvisor: 'Tripadvisor', booking: 'Booking.com',
    expedia: 'Expedia', website: 'Website',
  };
  return map[p] ?? p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface EditState {
  id: number | null; // null = new row
  platform: string;
  handle: string;
  url: string;
  display_name: string;
  active: boolean;
}

const EMPTY_EDIT: EditState = { id: null, platform: '', handle: '', url: '', display_name: '', active: true };

export default function ChannelsManager({ propertyId, accounts, rules, programs }: {
  propertyId: number;
  accounts: SocialAccountRow[];
  rules: SocialChannelRule[];
  programs: SocialProgram[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ruleByPlatform = new Map(rules.map((r) => [r.platform, r]));
  const programsByPlatform = new Map<string, SocialProgram[]>();
  for (const p of programs) {
    const arr = programsByPlatform.get(p.platform) ?? [];
    arr.push(p);
    programsByPlatform.set(p.platform, arr);
  }

  const posting = accounts.filter((a) => ruleByPlatform.has(a.platform));
  const other   = accounts.filter((a) => !ruleByPlatform.has(a.platform));

  async function save(e: EditState) {
    setBusy(true); setErr(null);
    const row: Record<string, unknown> = {
      platform: e.platform.trim().toLowerCase().replace(/\s+/g, '_'),
      handle: e.handle.trim() || null,
      url: e.url.trim() || null,
      display_name: e.display_name.trim() || null,
      active: e.active,
      property_id: propertyId, // section 'social' does not force property_id server-side
    };
    if (e.id != null) row.id = e.id;
    try {
      const res = await fetch('/api/settings/upsert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'social', table: 'social_accounts', pk: 'id', row }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'save failed');
      setEdit(null);
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'save failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, label: string) {
    if (!window.confirm(`Delete channel "${label}"? The guardrail + program rows stay (roster defaults).`)) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/settings/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'social', table: 'social_accounts', pk: 'id', id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'delete failed');
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section
        title="Posting channels"
        note={`${posting.length} channels · DB-backed · roster = guardrail registry`}
        action={
          <button type="button" style={btnPrimary} disabled={busy}
                  onClick={() => setEdit({ ...EMPTY_EDIT })}>
            + Add channel
          </button>
        }
      >
        {err && <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          {posting.map((a) => {
            const rule = ruleByPlatform.get(a.platform)!;
            const progs = programsByPlatform.get(a.platform) ?? [];
            const slug = LANDING_SLUG[a.platform];
            const landingHref = slug ? `/marketing/social/${slug}` : null;
            const isOn = a.active && rule.active;
            return (
              <div key={a.id} style={{ ...cardSt, opacity: isOn ? 1 : 0.65 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{prettyPlatform(a.platform)}</span>
                  <span style={isOn ? livePillSt : parkedPillSt}>{isOn ? 'ACTIVE' : 'PARKED'}</span>
                </div>
                <div style={{ fontSize: 11, color: INK_M }}>
                  {a.url
                    ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: FOREST }}>{a.handle ?? a.url} ↗</a>
                    : (a.handle ?? <span style={{ fontStyle: 'italic' }}>handle not set</span>)}
                  {typeof a.followers === 'number' && a.followers > 0 && (
                    <span style={{ marginLeft: 8 }}>{a.followers.toLocaleString('en-US')} followers</span>
                  )}
                </div>

                <div style={{ background: CREAM, borderLeft: `2px solid ${FOREST}`, padding: '6px 8px' }}>
                  <div style={microLabelSt}>Guardrails</div>
                  <div style={{ fontSize: 10.5, color: INK_S, lineHeight: 1.6 }}>
                    caption ≤ {rule.caption_max_chars ?? '—'} chars
                    {' · '}{rule.hashtags_allowed ? `≤ ${rule.hashtag_max ?? 0} hashtags` : 'no hashtags'}
                    {' · '}{rule.posting_frequency ?? '—'}
                    {' · '}autonomy {rule.autonomy_phase}
                  </div>
                  <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>
                    formats: {(rule.formats ?? []).join(' · ') || '—'}
                  </div>
                  {rule.banned_topics?.length > 0 && (
                    <div style={{ fontSize: 10, color: RED, marginTop: 2 }}>banned: {rule.banned_topics.join(', ')}</div>
                  )}
                </div>

                {progs.length > 0 && (
                  <div>
                    <div style={microLabelSt}>Weekly programs</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {progs.map((p) => (
                        <span key={p.id} title={p.notes ?? p.label} style={progChipSt}>
                          {p.label.split('·')[0].trim()} ×{p.posts_per_week}/wk
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  {landingHref && isOn && <a href={landingHref} style={ctaLinkSt}>Open →</a>}
                  <button type="button" style={btnSecondary} disabled={busy}
                          onClick={() => setEdit({ id: a.id, platform: a.platform, handle: a.handle ?? '', url: a.url ?? '', display_name: a.display_name ?? '', active: a.active })}>
                    Edit
                  </button>
                  <button type="button" style={btnDanger} disabled={busy}
                          onClick={() => remove(a.id, prettyPlatform(a.platform))}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10.5, color: INK_M, marginTop: 10, lineHeight: 1.6 }}>
          Guardrails + programs are edited in{' '}
          <a href="/settings/property/social_rules" style={{ color: FOREST }}>Settings · Channel Guardrails</a>
          {' '}and{' '}
          <a href="/settings/property/social_programs" style={{ color: FOREST }}>Settings · Content Programs</a>.
          A platform joins the posting roster when it has a guardrail row.
        </div>
      </Section>

      {other.length > 0 && (
        <Section title="Reputation & owned surfaces" note={`${other.length} platforms · not in posting roster`}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {other.map((a) => (
              <div key={a.id} style={{ ...cardSt, padding: '8px 10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{prettyPlatform(a.platform)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" style={btnTiny} disabled={busy}
                            onClick={() => setEdit({ id: a.id, platform: a.platform, handle: a.handle ?? '', url: a.url ?? '', display_name: a.display_name ?? '', active: a.active })}>
                      Edit
                    </button>
                    <button type="button" style={{ ...btnTiny, color: RED }} disabled={busy}
                            onClick={() => remove(a.id, prettyPlatform(a.platform))}>
                      Del
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 10.5, color: INK_M }}>
                  {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: FOREST }}>{a.handle ?? 'open ↗'}</a> : (a.handle ?? '—')}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {edit && (
        <div style={overlaySt} onClick={() => !busy && setEdit(null)}>
          <div style={modalSt} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 700, color: INK, marginBottom: 10 }}>
              {edit.id == null ? 'Add channel' : `Edit · ${prettyPlatform(edit.platform)}`}
            </div>
            <Field label="Platform code" hint="e.g. instagram · facebook · tiktok · google_business · pinterest">
              <input style={inputSt} value={edit.platform} disabled={edit.id != null}
                     onChange={(e) => setEdit({ ...edit, platform: e.target.value })} />
            </Field>
            <Field label="Handle">
              <input style={inputSt} value={edit.handle}
                     onChange={(e) => setEdit({ ...edit, handle: e.target.value })} />
            </Field>
            <Field label="URL">
              <input style={inputSt} value={edit.url}
                     onChange={(e) => setEdit({ ...edit, url: e.target.value })} />
            </Field>
            <Field label="Display name">
              <input style={inputSt} value={edit.display_name}
                     onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: INK_S, margin: '8px 0' }}>
              <input type="checkbox" checked={edit.active}
                     onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Active
            </label>
            {err && <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>{err}</div>}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} disabled={busy} onClick={() => setEdit(null)}>Cancel</button>
              <button type="button" style={btnPrimary}
                      disabled={busy || !edit.platform.trim()}
                      onClick={() => save(edit)}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Local layout helpers ──────────────────────────────────────────────────

function Section({ title, note, action, children }: {
  title: string; note?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {note && <div style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{note}</div>}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ ...microLabelSt, marginBottom: 3 }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 9.5, color: INK_M, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const cardSt: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4,
  padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
};
const microLabelSt: React.CSSProperties = { fontSize: 9, color: INK_M, letterSpacing: '0.08em', textTransform: 'uppercase' };
const livePillSt: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', color: '#1F5C2C', background: '#E4F1E0', border: '1px solid #A9CFA0', padding: '1px 6px', borderRadius: 2 };
const parkedPillSt: React.CSSProperties = { fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', color: INK_M, background: CREAM, border: `1px solid ${HAIR}`, padding: '1px 6px', borderRadius: 2 };
const progChipSt: React.CSSProperties = { fontSize: 9.5, color: FOREST, border: `1px solid ${FOREST}`, borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' };
const btnPrimary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: RED, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
const btnTiny: React.CSSProperties = { padding: '2px 6px', fontSize: 10, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
const ctaLinkSt: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: WHITE, background: FOREST, padding: '4px 10px', borderRadius: 3, textDecoration: 'none' };
const overlaySt: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(27,27,27,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 };
const modalSt: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '16px 18px', width: 380, maxWidth: '92vw', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' };
const inputSt: React.CSSProperties = { width: '100%', padding: '5px 8px', fontSize: 12, color: INK, border: `1px solid ${HAIR}`, borderRadius: 3, background: WHITE, boxSizing: 'border-box' };
