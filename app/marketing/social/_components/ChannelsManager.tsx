'use client';
// app/marketing/social/_components/ChannelsManager.tsx  ·  v2 · PBS 2026-08-20
// Per-channel card now shows:
//   1) ACTIVE/PARKED status (rule + account both active)
//   2) ✓ CONNECTED · via Upload Post (if upload_post_profiles row exists)
//   3) Handle · URL · guardrails · weekly programs (unchanged)
//   4) ▶ Quick post button → opens inline modal composer scoped to THIS platform
//   5) Open / Edit / Delete (unchanged)
//
// Modal composer:
//   - Caption textarea + AI Recon button (calls /api/marketing/social/ai-draft)
//   - Media URL (optional)
//   - Hashtags (optional; hidden if platform.hashtags_allowed=false)
//   - Destination picker if platform.requires_dest_pick (Pinterest board / GBP location / FB page / LinkedIn URN)
//   - Platform-specific fields (Instagram first_comment, TikTok post_mode, X long_text_as_post, GBP post_type)
//   - Schedule datetime (blank = post now)
//   - Publish button → POST /api/marketing/social/quick-push
//
// Reads platform specs from v_social_platform_specs (limits + required fields)
// and destinations from v_up_destinations (auto-picks first when only 1).

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
const AMBER  = '#C28F2C';
const CREAM  = '#F5F0E1';

const LANDING_SLUG: Record<string, string> = {
  google_business: 'google-business',
  instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok',
  pinterest: 'pinterest', linkedin: 'linkedin', x: 'x', twitter: 'twitter',
};

function prettyPlatform(p: string): string {
  const map: Record<string, string> = {
    google_business: 'Google Business Profile', instagram: 'Instagram',
    facebook: 'Facebook', tiktok: 'TikTok', pinterest: 'Pinterest',
    linkedin: 'LinkedIn', x: 'X / Twitter', twitter: 'X / Twitter',
    youtube: 'YouTube', tripadvisor: 'Tripadvisor', booking: 'Booking.com',
    expedia: 'Expedia', threads: 'Threads',
  };
  return map[p] ?? p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface EditState {
  id: number | null;
  platform: string;
  handle: string;
  url: string;
  display_name: string;
  active: boolean;
}
const EMPTY_EDIT: EditState = { id: null, platform: '', handle: '', url: '', display_name: '', active: true };

interface ConnectedProfile {
  platform: string;
  up_user_id: string;
  display_name: string | null;
  handle: string | null;
}

interface Destination {
  id: number;
  platform: string;
  dest_type: string;
  dest_id: string;
  dest_label: string | null;
}

interface PlatformSpec {
  platform: string;
  display_name: string;
  caption_max_chars: number | null;
  hashtags_allowed: boolean;
  hashtag_max: number | null;
  requires_dest_pick: boolean;
  dest_type_label: string | null;
  requires_title: boolean;
  first_comment_supported: boolean;
  supports_photo: boolean;
  supports_video: boolean;
  media_max_items: number | null;
  notes: string | null;
}

interface QuickPostState {
  platform: string;
  caption: string;
  media_url: string;
  hashtags: string;
  scheduled_at: string;
  dest_id: string;
  first_comment: string;   // Instagram
  post_mode: string;       // TikTok (DIRECT_POST | MEDIA_UPLOAD)
  long_text_as_post: boolean; // X
  gbp_post_type: string;   // WHATS_NEW | EVENT | OFFER
  youtube_title: string;   // YouTube (required)
  youtube_description: string; // YouTube
  youtube_first_comment: string; // YouTube (like Instagram)
  linkedin_description: string;  // LinkedIn (rich caption)
  linkedin_document_url: string; // LinkedIn (optional PDF/PPT upload URL)
  aiBusy: boolean;
  busy: boolean;
  msg: string | null;
}

export default function ChannelsManager({
  propertyId, accounts, rules, programs,
  connectedProfiles = [], destinations = [], platformSpecs = [],
}: {
  propertyId: number;
  accounts: SocialAccountRow[];
  rules: SocialChannelRule[];
  programs: SocialProgram[];
  connectedProfiles?: ConnectedProfile[];
  destinations?: Destination[];
  platformSpecs?: PlatformSpec[];
}) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [quickPost, setQuickPost] = useState<QuickPostState | null>(null);

  const ruleByPlatform = new Map(rules.map((r) => [r.platform, r]));
  const programsByPlatform = new Map<string, SocialProgram[]>();
  for (const p of programs) {
    const arr = programsByPlatform.get(p.platform) ?? [];
    arr.push(p);
    programsByPlatform.set(p.platform, arr);
  }
  const connectedByPlatform = new Map(connectedProfiles.map((c) => [c.platform, c]));
  const destsByPlatform = new Map<string, Destination[]>();
  for (const d of destinations) {
    const arr = destsByPlatform.get(d.platform) ?? [];
    arr.push(d);
    destsByPlatform.set(d.platform, arr);
  }
  const specByPlatform = new Map(platformSpecs.map((s) => [s.platform, s]));

  const posting = accounts.filter((a) => ruleByPlatform.has(a.platform));
  const other   = accounts.filter((a) => !ruleByPlatform.has(a.platform));

  async function saveEdit(e: EditState) {
    setBusy(true); setErr(null);
    const row: Record<string, unknown> = {
      platform: e.platform.trim().toLowerCase().replace(/\s+/g, '_'),
      handle: e.handle.trim() || null,
      url: e.url.trim() || null,
      display_name: e.display_name.trim() || null,
      active: e.active,
      property_id: propertyId,
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
    } catch (ex) {
      setErr((ex as Error)?.message ?? 'save failed');
    } finally { setBusy(false); }
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
    } catch (ex) {
      setErr((ex as Error)?.message ?? 'delete failed');
    } finally { setBusy(false); }
  }

  function openQuickPost(platform: string) {
    const dests = destsByPlatform.get(platform) ?? [];
    setQuickPost({
      platform,
      caption: '', media_url: '', hashtags: '', scheduled_at: '',
      dest_id: dests.length ? dests[0].dest_id : '',
      first_comment: '', post_mode: 'MEDIA_UPLOAD', long_text_as_post: false,
      gbp_post_type: 'WHATS_NEW',
      youtube_title: '', youtube_description: '', youtube_first_comment: '',
      linkedin_description: '', linkedin_document_url: '',
      aiBusy: false, busy: false, msg: null,
    });
  }

  async function aiRecon() {
    if (!quickPost) return;
    setQuickPost({ ...quickPost, aiBusy: true, msg: null });
    try {
      const res = await fetch('/api/marketing/social/ai-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: quickPost.platform, property_id: propertyId, hint: quickPost.caption || null }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'AI draft failed');
      setQuickPost({
        ...quickPost, aiBusy: false,
        caption: j.caption ?? quickPost.caption,
        hashtags: j.hashtags ?? quickPost.hashtags,
      });
    } catch (ex) {
      setQuickPost({ ...quickPost, aiBusy: false, msg: (ex as Error)?.message ?? 'AI failed' });
    }
  }

  async function submitQuickPost(e: React.FormEvent) {
    e.preventDefault();
    if (!quickPost) return;
    setQuickPost({ ...quickPost, busy: true, msg: null });
    try {
      const fd = new FormData();
      fd.set('property_id', String(propertyId));
      fd.set('return_to', '/marketing/social?view=channels');
      fd.set('caption', quickPost.caption);
      fd.set('hashtags', quickPost.hashtags);
      if (quickPost.media_url) fd.set('media_url', quickPost.media_url);
      if (quickPost.scheduled_at) fd.set('scheduled_at', quickPost.scheduled_at);
      fd.append('platforms', quickPost.platform);
      // Per-platform destination + specific fields
      const spec = specByPlatform.get(quickPost.platform);
      if (spec?.requires_dest_pick && quickPost.dest_id) {
        if (quickPost.platform === 'pinterest') fd.set('pinterest_board_id', quickPost.dest_id);
        if (quickPost.platform === 'google_business') fd.set('google_business_location_id', quickPost.dest_id);
        if (quickPost.platform === 'facebook') fd.set('facebook_page_id', quickPost.dest_id);
        if (quickPost.platform === 'linkedin') fd.set('linkedin_page_urn', quickPost.dest_id);
      }
      if (quickPost.platform === 'instagram' && quickPost.first_comment) fd.set('instagram_first_comment', quickPost.first_comment);
      if (quickPost.platform === 'tiktok' && quickPost.post_mode) fd.set('tiktok_post_mode', quickPost.post_mode);
      if (quickPost.platform === 'x' && quickPost.long_text_as_post) fd.set('x_long_text_as_post', 'true');
      if (quickPost.platform === 'google_business') fd.set('google_business_type', quickPost.gbp_post_type);
      // YouTube — title required + description + first-comment (Upload Post /upload passes these
      // through to YouTube Data API v3; quota-aware handling belongs to the edge fn).
      if (quickPost.platform === 'youtube') {
        if (quickPost.youtube_title) fd.set('youtube_title', quickPost.youtube_title);
        if (quickPost.youtube_description) fd.set('youtube_description', quickPost.youtube_description);
        if (quickPost.youtube_first_comment) fd.set('youtube_first_comment', quickPost.youtube_first_comment);
      }
      // LinkedIn — org URN comes from the destination picker above (linkedin_page_urn).
      // Description + optional document upload passthrough to Upload Post /upload.
      if (quickPost.platform === 'linkedin') {
        if (quickPost.linkedin_description) fd.set('linkedin_description', quickPost.linkedin_description);
        if (quickPost.linkedin_document_url) fd.set('linkedin_document_url', quickPost.linkedin_document_url);
      }

      // Follow redirect naturally — the endpoint returns 303 back to /marketing/social?view=channels
      const res = await fetch('/api/marketing/social/quick-push', { method: 'POST', body: fd });
      if (res.ok || res.redirected) {
        setQuickPost({ ...quickPost, busy: false, msg: '✓ Sent — check Publish or platform for confirmation.' });
        setTimeout(() => { setQuickPost(null); router.refresh(); }, 1400);
      } else {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
    } catch (ex) {
      setQuickPost({ ...quickPost, busy: false, msg: (ex as Error)?.message ?? 'push failed' });
    }
  }

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Section
        title="Posting channels"
        note={`${posting.length} channels · ${connectedProfiles.length} connected via Upload Post · roster = guardrail registry`}
        action={
          <button type="button" style={btnPrimary} disabled={busy} onClick={() => setEdit({ ...EMPTY_EDIT })}>
            + Add channel
          </button>
        }
      >
        {err && <div style={{ color: RED, fontSize: 11, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
          {posting.map((a) => {
            const rule = ruleByPlatform.get(a.platform)!;
            const progs = programsByPlatform.get(a.platform) ?? [];
            const conn = connectedByPlatform.get(a.platform);
            const dests = destsByPlatform.get(a.platform) ?? [];
            const slug = LANDING_SLUG[a.platform];
            const landingHref = slug ? `/marketing/social/${slug}` : null;
            const isOn = a.active && rule.active;
            return (
              <div key={a.id} style={{ ...cardSt, opacity: isOn ? 1 : 0.65 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{prettyPlatform(a.platform)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {conn && <span style={connectedPillSt}>✓ CONNECTED</span>}
                    <span style={isOn ? livePillSt : parkedPillSt}>{isOn ? 'ACTIVE' : 'PARKED'}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: INK_M }}>
                  {a.url
                    ? <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: FOREST }}>{a.handle ?? a.url} ↗</a>
                    : (a.handle ?? <span style={{ fontStyle: 'italic' }}>handle not set</span>)}
                  {typeof a.followers === 'number' && a.followers > 0 && (
                    <span style={{ marginLeft: 8 }}>{a.followers.toLocaleString('en-US')} followers</span>
                  )}
                  {conn && (
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 2 }}>
                      via Upload Post · {conn.display_name ?? conn.handle ?? conn.up_user_id}
                    </div>
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
                  {rule.banned_topics?.length > 0 && (
                    <div style={{ fontSize: 10, color: RED, marginTop: 2 }}>banned: {rule.banned_topics.join(', ')}</div>
                  )}
                  {dests.length > 0 && (
                    <div style={{ fontSize: 10, color: INK_M, marginTop: 3 }}>
                      {dests.length} destination{dests.length === 1 ? '' : 's'} configured
                    </div>
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

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto', flexWrap: 'wrap' as const }}>
                  {conn && isOn && (
                    <button type="button" style={btnPrimarySmall} disabled={busy}
                            onClick={() => openQuickPost(a.platform)}>
                      ▶ Quick post
                    </button>
                  )}
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

      {/* Edit modal */}
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
              <input style={inputSt} value={edit.handle} onChange={(e) => setEdit({ ...edit, handle: e.target.value })} />
            </Field>
            <Field label="URL">
              <input style={inputSt} value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} />
            </Field>
            <Field label="Display name">
              <input style={inputSt} value={edit.display_name} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} />
            </Field>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: INK, marginTop: 6 }}>
              <input type="checkbox" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />
              Active
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} disabled={busy} onClick={() => setEdit(null)}>Cancel</button>
              <button type="button" style={btnPrimary} disabled={busy} onClick={() => saveEdit(edit)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Post modal — per platform */}
      {quickPost && (() => {
        const spec = specByPlatform.get(quickPost.platform);
        const dests = destsByPlatform.get(quickPost.platform) ?? [];
        const maxChars = spec?.caption_max_chars ?? null;
        const overLimit = maxChars != null && quickPost.caption.length > maxChars;
        return (
          <div style={overlaySt} onClick={() => !quickPost.busy && setQuickPost(null)}>
            <div style={{ ...modalSt, width: 620, maxWidth: '90vw' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                  ▶ Post to {prettyPlatform(quickPost.platform)}
                </div>
                <button type="button" style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', color: INK_M }} onClick={() => setQuickPost(null)}>×</button>
              </div>
              {spec?.notes && (
                <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', marginBottom: 8 }}>
                  {spec.notes}
                </div>
              )}
              <form onSubmit={submitQuickPost}>
                {/* Destination picker (if platform requires) */}
                {spec?.requires_dest_pick && (
                  <Field label={`${spec.dest_type_label?.toUpperCase() ?? 'DESTINATION'} · required`}
                         hint={dests.length === 0 ? 'No destinations synced yet — click Sync destinations on the channel card' : `${dests.length} available`}>
                    <select style={inputSt} value={quickPost.dest_id} required
                            onChange={(e) => setQuickPost({ ...quickPost, dest_id: e.target.value })}>
                      <option value="">Pick a {spec.dest_type_label ?? 'destination'}…</option>
                      {dests.map((d) => <option key={d.id} value={d.dest_id}>{d.dest_label ?? d.dest_id}</option>)}
                    </select>
                  </Field>
                )}

                <Field label={`Caption${maxChars ? ` · max ${maxChars} chars` : ''}`}
                       hint={overLimit ? `${quickPost.caption.length}/${maxChars} — over limit` : `${quickPost.caption.length}${maxChars ? '/'+maxChars : ''}`}>
                  <div style={{ position: 'relative' }}>
                    <textarea style={{ ...inputSt, minHeight: 100, resize: 'vertical' as const, fontFamily: 'inherit' }}
                              value={quickPost.caption}
                              onChange={(e) => setQuickPost({ ...quickPost, caption: e.target.value })} />
                    <button type="button" style={aiBtnSt} disabled={quickPost.aiBusy} onClick={aiRecon}>
                      {quickPost.aiBusy ? '⋯' : '✦ AI recon'}
                    </button>
                  </div>
                </Field>

                {spec?.hashtags_allowed && (
                  <Field label={`Hashtags${spec.hashtag_max ? ` · ≤ ${spec.hashtag_max}` : ''}`}>
                    <input style={inputSt} placeholder="#hashtag1 #hashtag2"
                           value={quickPost.hashtags}
                           onChange={(e) => setQuickPost({ ...quickPost, hashtags: e.target.value })} />
                  </Field>
                )}

                <Field label="Media URL (optional · https://…)">
                  <input type="url" style={inputSt}
                         value={quickPost.media_url}
                         onChange={(e) => setQuickPost({ ...quickPost, media_url: e.target.value })} />
                </Field>

                {/* Platform-specific extras */}
                {quickPost.platform === 'instagram' && spec?.first_comment_supported && (
                  <Field label="First comment (optional · e.g. hashtags stack)">
                    <input style={inputSt} value={quickPost.first_comment}
                           onChange={(e) => setQuickPost({ ...quickPost, first_comment: e.target.value })} />
                  </Field>
                )}
                {quickPost.platform === 'tiktok' && (
                  <Field label="Post mode" hint="Draft (recommended) sends to TikTok inbox — user finalizes in app for best organic reach">
                    <select style={inputSt} value={quickPost.post_mode}
                            onChange={(e) => setQuickPost({ ...quickPost, post_mode: e.target.value })}>
                      <option value="MEDIA_UPLOAD">Draft (recommended)</option>
                      <option value="DIRECT_POST">Direct publish</option>
                    </select>
                  </Field>
                )}
                {quickPost.platform === 'google_business' && (
                  <Field label="Post type">
                    <select style={inputSt} value={quickPost.gbp_post_type}
                            onChange={(e) => setQuickPost({ ...quickPost, gbp_post_type: e.target.value })}>
                      <option value="WHATS_NEW">What&apos;s New</option>
                      <option value="EVENT">Event</option>
                      <option value="OFFER">Offer</option>
                    </select>
                  </Field>
                )}
                {quickPost.platform === 'x' && (
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: INK, marginTop: 6 }}>
                    <input type="checkbox" checked={quickPost.long_text_as_post}
                           onChange={(e) => setQuickPost({ ...quickPost, long_text_as_post: e.target.checked })} />
                    Publish long text as single post (X Premium)
                  </label>
                )}
                {quickPost.platform === 'youtube' && (
                  <>
                    <Field label="Video title (required · ≤ 100 chars)">
                      <input style={inputSt} maxLength={100}
                             value={quickPost.youtube_title}
                             onChange={(e) => setQuickPost({ ...quickPost, youtube_title: e.target.value })} />
                    </Field>
                    <Field label="Description (optional · shown under video)">
                      <textarea style={{ ...inputSt, minHeight: 60, fontFamily: 'inherit' }}
                                value={quickPost.youtube_description}
                                onChange={(e) => setQuickPost({ ...quickPost, youtube_description: e.target.value })} />
                    </Field>
                    <Field label="First comment (optional · pinned reply)">
                      <input style={inputSt} value={quickPost.youtube_first_comment}
                             onChange={(e) => setQuickPost({ ...quickPost, youtube_first_comment: e.target.value })} />
                    </Field>
                  </>
                )}
                {quickPost.platform === 'linkedin' && (
                  <>
                    <Field label="Rich description (optional · LinkedIn-specific caption, falls back to caption above)">
                      <textarea style={{ ...inputSt, minHeight: 60, fontFamily: 'inherit' }}
                                value={quickPost.linkedin_description}
                                onChange={(e) => setQuickPost({ ...quickPost, linkedin_description: e.target.value })} />
                    </Field>
                    <Field label="Document URL (optional · PDF/PPT for document post · https://…)">
                      <input type="url" style={inputSt}
                             value={quickPost.linkedin_document_url}
                             onChange={(e) => setQuickPost({ ...quickPost, linkedin_document_url: e.target.value })} />
                    </Field>
                  </>
                )}

                <Field label="Schedule (optional · empty = post now)">
                  <input type="datetime-local" style={inputSt}
                         value={quickPost.scheduled_at}
                         onChange={(e) => setQuickPost({ ...quickPost, scheduled_at: e.target.value })} />
                </Field>

                {quickPost.msg && (
                  <div style={{ fontSize: 11, color: quickPost.msg.startsWith('✓') ? FOREST : RED, margin: '8px 0' }}>{quickPost.msg}</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button type="button" style={btnSecondary} disabled={quickPost.busy} onClick={() => setQuickPost(null)}>Cancel</button>
                  <button type="submit" style={btnPrimary} disabled={quickPost.busy || !quickPost.caption.trim() || overLimit}>
                    {quickPost.busy ? 'Sending…' : (quickPost.scheduled_at ? '🗓 Schedule' : '▶ Publish')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────
function Section({ title, note, action, children }: { title: string; note?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{title}</div>
          {note && <div style={{ fontSize: 10.5, color: INK_M, marginTop: 2 }}>{note}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: INK_M, marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{label}</div>
      {children}
      {hint && <div style={{ fontSize: 10, color: INK_M, marginTop: 2, fontStyle: 'italic' }}>{hint}</div>}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const cardSt: React.CSSProperties = {
  background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 5, padding: '10px 12px',
  display: 'flex', flexDirection: 'column', gap: 6,
};
const livePillSt: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: FOREST, border: `1px solid ${FOREST}`, padding: '1px 6px', borderRadius: 2, fontWeight: 700,
};
const parkedPillSt: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: INK_M, border: `1px solid ${HAIR}`, padding: '1px 6px', borderRadius: 2, fontWeight: 600,
};
const connectedPillSt: React.CSSProperties = {
  fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', color: WHITE, background: FOREST, padding: '1px 6px', borderRadius: 2, fontWeight: 700,
};
const microLabelSt: React.CSSProperties = { fontSize: 9, color: INK_M, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const };
const progChipSt: React.CSSProperties = { fontSize: 10, color: INK, background: '#F9F6F0', border: `1px solid ${HAIR}`, borderRadius: 3, padding: '1px 6px' };
const ctaLinkSt: React.CSSProperties = { fontSize: 11, color: FOREST, textDecoration: 'none', padding: '4px 10px', border: `1px solid ${FOREST}`, borderRadius: 3, fontWeight: 600 };
const btnPrimary: React.CSSProperties = { fontSize: 11, color: WHITE, background: FOREST, border: 'none', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontWeight: 600 };
const btnPrimarySmall: React.CSSProperties = { ...btnPrimary, padding: '4px 10px' };
const btnSecondary: React.CSSProperties = { fontSize: 11, color: INK, background: WHITE, border: `1px solid ${HAIR}`, padding: '5px 10px', borderRadius: 3, cursor: 'pointer', fontWeight: 500 };
const btnDanger: React.CSSProperties = { fontSize: 11, color: RED, background: WHITE, border: `1px solid ${HAIR}`, padding: '5px 10px', borderRadius: 3, cursor: 'pointer', fontWeight: 500 };
const btnTiny: React.CSSProperties = { fontSize: 10, color: INK, background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px' };
const overlaySt: React.CSSProperties = { position: 'fixed' as const, inset: 0, background: 'rgba(27,27,27,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalSt: React.CSSProperties = { background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: 16, width: 420, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' as const };
const inputSt: React.CSSProperties = { width: '100%', fontSize: 12, padding: '6px 8px', border: `1px solid ${HAIR}`, borderRadius: 3, background: '#FAFAF7', color: INK, boxSizing: 'border-box' as const };
const aiBtnSt: React.CSSProperties = { position: 'absolute' as const, top: 6, right: 6, fontSize: 10, color: WHITE, background: FOREST, border: 'none', padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontWeight: 600 };
