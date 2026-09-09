'use client';
// app/marketing/social/_components/SocialInbox.tsx
// spec-social-media-module (2026-07-25, run 2) · A6 — DB-backed approval inbox.
// 2026-09-03: add media picker (from media library) and inline caption editing
// via POST /api/marketing/social/update-post.

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { SocialChannelRule } from '@/lib/marketing';
import type { SocialPostRow } from '@/lib/marketing-social';

interface MediaAsset {
  asset_id: string;
  asset_type: string;
  filename: string;
  caption: string | null;
  alt_text: string | null;
  property_area: string | null;
  width_px: number | null;
  height_px: number | null;
  thumbnail_url: string | null;
  raw_path_url: string | null;
  full_url: string | null;
}

const WHITE = '#FFFFFF';
const HAIR  = '#E6DFCC';
const INK   = '#1B1B1B';
const INK_M = '#5A5A5A';
const INK_S = '#3A3A3A';
const FOREST = '#084838';
const RED    = '#B03826';
const AMBER  = '#C28F2C';
const CREAM  = '#F5F0E1';

const PRETTY: Record<string, string> = {
  google_business: 'Google Business Profile', instagram: 'Instagram',
  facebook: 'Facebook', tiktok: 'TikTok', pinterest: 'Pinterest',
  linkedin: 'LinkedIn', x: 'X',
};

function statusColor(s: SocialPostRow['status']): string {
  switch (s) {
    case 'ready':     return '#3E8DBE';
    case 'scheduled': return FOREST;
    case 'pushed':    return '#5DA46B';
    case 'failed':    return RED;
    case 'cancelled': return INK_M;
    default:          return AMBER; // draft
  }
}

export default function SocialInbox({ posts, rules }: {
  posts: SocialPostRow[];
  rules: SocialChannelRule[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [mediaPicker, setMediaPicker] = useState<{ postId: string; propertyId: number } | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [pinterestBoards, setPinterestBoards] = useState<Array<{ board_id: string; board_name: string }>>([]);
  const [boardPick, setBoardPick] = useState<Record<string, string>>({});
  const [captionEdit, setCaptionEdit] = useState<Record<string, string>>({}); // postId -> edited text
  const [captionSaving, setCaptionSaving] = useState<Record<string, boolean>>({});

  // Load Pinterest boards once if any Pinterest posts exist
  useEffect(() => {
    const pinPost = posts.find(p => p.platform === 'pinterest');
    if (!pinPost) return;
    fetch(`/api/marketing/social/pinterest-boards?property_id=${pinPost.property_id}`)
      .then(r => r.json())
      .then(j => { if (j.ok) setPinterestBoards(j.boards ?? []); })
      .catch(() => {});
  }, [posts]);

  async function assignBoard(postId: string, boardId: string) {
    setBoardPick(prev => ({ ...prev, [postId]: boardId }));
    try {
      await fetch('/api/marketing/social/update-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: postId, pinterest_board_id: boardId }),
      });
    } catch { /* best effort */ }
  }

  const openMediaPicker = useCallback(async (post: SocialPostRow) => {
    setMediaPicker({ postId: post.post_id, propertyId: post.property_id });
    setMediaLoading(true);
    setMediaAssets([]);
    try {
      const res = await fetch(`/api/marketing/social/media-library?property_id=${post.property_id}&type=photo&limit=40`);
      const j = await res.json();
      setMediaAssets(j.assets ?? []);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  async function pickMedia(asset: MediaAsset) {
    if (!mediaPicker || !asset.full_url) return;
    const key = `media:${mediaPicker.postId}`;
    setBusy(key); setErr(null);
    try {
      const res = await fetch('/api/marketing/social/update-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: mediaPicker.postId, media_urls: [asset.full_url] }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'update failed');
      setMediaPicker(null);
      setNote(`Media set — ${asset.filename}`);
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'media update failed');
    } finally {
      setBusy(null);
    }
  }

  async function saveCaption(post: SocialPostRow, text: string) {
    setCaptionSaving((s) => ({ ...s, [post.post_id]: true }));
    try {
      const res = await fetch('/api/marketing/social/update-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.post_id, caption: text }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'save failed');
      setCaptionEdit((e) => { const n = { ...e }; delete n[post.post_id]; return n; });
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'save failed');
    } finally {
      setCaptionSaving((s) => { const n = { ...s }; delete n[post.post_id]; return n; });
    }
  }

  async function rewritePost(post: SocialPostRow) {
    const key = `rewrite:${post.post_id}`;
    setBusy(key); setErr(null);
    try {
      const draftRes = await fetch('/api/marketing/social/ai-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: post.platform, property_id: post.property_id, hint: post.title ?? null }),
      });
      const draft = await draftRes.json();
      if (!draft.ok) throw new Error(draft.error ?? 'AI draft failed');

      const updateBody: Record<string, unknown> = { post_id: post.post_id, caption: draft.caption };
      if (draft.title)    updateBody.title = draft.title;
      if (draft.hashtags) updateBody.hashtags = draft.hashtags.split(/\s+/).filter(Boolean);
      if (draft.media_url) updateBody.media_urls = [draft.media_url];
      if (draft.link_url) updateBody.link_url = draft.link_url;

      const updRes = await fetch('/api/marketing/social/update-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody),
      });
      const upd = await updRes.json();
      if (!upd.ok) throw new Error(upd.error ?? 'update failed');

      if (post.status === 'proposed') {
        await fetch('/api/marketing/socials', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'set_status', post_id: post.post_id, status: 'draft', property_id: post.property_id }),
        });
      }
      setNote('Content rewritten — review and approve.');
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'rewrite failed');
    } finally {
      setBusy(null);
    }
  }

  const activePlatforms = rules.filter((r) => r.active).map((r) => r.platform);
  const open = posts.filter((p) => ['proposed','draft','ready','failed'].includes(p.status));
  const byPlatform = new Map<string, SocialPostRow[]>();
  for (const pf of activePlatforms) byPlatform.set(pf, []);
  for (const p of open) {
    const arr = byPlatform.get(p.platform) ?? [];
    arr.push(p);
    byPlatform.set(p.platform, arr);
  }

  async function setStatus(postId: string, status: 'ready' | 'draft' | 'cancelled') {
    const post = posts.find((p) => p.post_id === postId);
    setBusy(postId); setErr(null);
    try {
      const res = await fetch('/api/marketing/socials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'set_status', post_id: postId, status, property_id: post?.property_id }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'update failed');
      router.refresh();
    } catch (ex: any) {
      setErr(ex?.message ?? 'update failed');
    } finally {
      setBusy(null);
    }
  }

  async function exportZip(scope: 'selection' | 'week' | 'month', opts: { postIds?: string[]; platform?: string; propertyId?: number }) {
    const key = `export:${scope}:${opts.platform ?? opts.postIds?.[0] ?? 'all'}`;
    setBusy(key); setErr(null); setNote(null);
    try {
      const res = await fetch('/api/marketing/social/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scope === 'selection'
          ? { post_ids: opts.postIds, property_id: opts.propertyId }
          : { scope, platform: opts.platform, property_id: opts.propertyId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error === 'no_posts_in_scope' ? 'No approved posts in this window — approve drafts first.' : (j.error ?? `export failed (${res.status})`));
      }
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const fname = cd.match(/filename="([^"]+)"/)?.[1] ?? 'social_export.zip';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      const warn = res.headers.get('X-Export-Warnings');
      setNote(`Exported ${res.headers.get('X-Export-Posts') ?? '?'} post(s) → ${fname}${warn && warn !== '0' ? ` · ${warn} format warning(s) in manifest.json` : ''}`);
    } catch (ex: any) {
      setErr(ex?.message ?? 'export failed');
    } finally {
      setBusy(null);
    }
  }

  async function sendSamplePack() {
    setBusy('samples'); setErr(null); setNote(null);
    try {
      const res = await fetch('/api/marketing/social/send-samples', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? 'send failed');
      setNote(`Sample pack sent to ${j.sent_to} — ${(j.channels ?? []).map((c: any) => c.platform).join(', ')}`);
    } catch (ex: any) {
      setErr(ex?.message ?? 'send failed');
    } finally {
      setBusy(null);
    }
  }

  const ruleFor = new Map(rules.map((r) => [r.platform, r]));

  return (
    <>
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 6, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>Channel inbox · draft posts awaiting sign-off</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" disabled={busy !== null} onClick={sendSamplePack} style={btnSecondary}
              title="Email 2 sample posts per active channel & format to PBS (acceptance evidence)">
              {busy === 'samples' ? 'sending…' : '✉ Sample pack → PBS'}
            </button>
            <span style={{ fontSize: 10, color: INK_M, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {open.length} open · one box per active channel
            </span>
          </div>
        </div>

        {err && (
          <div style={{ marginBottom: 8, padding: '6px 8px', border: `1px solid ${RED}`, borderRadius: 3, color: RED, fontSize: 11 }}>{err}</div>
        )}
        {note && (
          <div style={{ marginBottom: 8, padding: '6px 8px', border: `1px solid ${FOREST}`, borderRadius: 3, color: FOREST, fontSize: 11 }}>{note}</div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          {Array.from(byPlatform.entries()).map(([platform, list]) => {
            const rule = ruleFor.get(platform);
            return (
              <div key={platform} style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: FOREST, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {PRETTY[platform] ?? platform}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" disabled={busy !== null} onClick={() => exportZip('week', { platform, propertyId: list[0]?.property_id ?? posts[0]?.property_id })}
                      style={btnTiny} title={`Zip of this week's approved ${PRETTY[platform] ?? platform} posts`}>
                      {busy === `export:week:${platform}` ? '…' : '⬇ wk'}
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => exportZip('month', { platform, propertyId: list[0]?.property_id ?? posts[0]?.property_id })}
                      style={btnTiny} title={`Zip of this month's approved ${PRETTY[platform] ?? platform} posts`}>
                      {busy === `export:month:${platform}` ? '…' : '⬇ mo'}
                    </button>
                    <span style={{ fontSize: 10, color: INK_M }}>{list.length} open</span>
                  </span>
                </div>
                {rule && (
                  <div style={{ fontSize: 9, color: INK_M, marginBottom: 6 }}>
                    caption ≤ {rule.caption_max_chars ?? '—'} chars · {rule.hashtags_allowed ? `≤ ${rule.hashtag_max ?? '—'} hashtags` : 'no hashtags'}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {list.map((p) => {
                    const capLen = (p.caption ?? '').length;
                    const overCap = rule?.caption_max_chars != null && capLen > rule.caption_max_chars;
                    return (
                      <div key={p.post_id} style={{ background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{p.title ?? '(untitled)'}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: statusColor(p.status), border: `1px solid ${statusColor(p.status)}`, padding: '1px 5px', borderRadius: 2 }}>
                            {p.status}
                          </span>
                        </div>
                        {(() => {
                          const editing = captionEdit[p.post_id] !== undefined;
                          const currentText = captionEdit[p.post_id] ?? p.caption ?? '';
                          return editing ? (
                            <div style={{ marginBottom: 4 }}>
                              <textarea
                                value={currentText}
                                onChange={(e) => setCaptionEdit((prev) => ({ ...prev, [p.post_id]: e.target.value }))}
                                rows={5}
                                style={{ width: '100%', fontSize: 11, color: INK_S, fontFamily: 'inherit', border: `1px solid ${FOREST}`, borderRadius: 3, padding: '4px 6px', resize: 'vertical', boxSizing: 'border-box' }}
                              />
                              <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                                <button type="button" onClick={() => saveCaption(p, currentText)}
                                  disabled={captionSaving[p.post_id]}
                                  style={{ fontSize: 10, padding: '2px 8px', background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' }}>
                                  {captionSaving[p.post_id] ? 'Saving…' : '✓ Save'}
                                </button>
                                <button type="button" onClick={() => setCaptionEdit((e) => { const n = { ...e }; delete n[p.post_id]; return n; })}
                                  style={{ fontSize: 10, padding: '2px 8px', background: 'none', color: INK_M, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => setCaptionEdit((prev) => ({ ...prev, [p.post_id]: p.caption ?? '' }))}
                              title="Click to edit caption"
                              style={{ fontSize: 11, color: INK_S, whiteSpace: 'pre-wrap', marginBottom: 4, maxHeight: 96, overflow: 'hidden', cursor: 'text', borderRadius: 2, padding: '2px 3px', border: `1px solid transparent` }}
                              onMouseEnter={(e) => (e.currentTarget.style.border = `1px solid ${HAIR}`)}
                              onMouseLeave={(e) => (e.currentTarget.style.border = '1px solid transparent')}
                            >
                              {p.caption ? (p.caption.length > 280 ? p.caption.slice(0, 280) + '…' : p.caption) : <span style={{ color: INK_M, fontStyle: 'italic' }}>Click to add caption…</span>}
                            </div>
                          );
                        })()}
                        <div style={{ fontSize: 9, color: overCap ? RED : INK_M, marginBottom: p.hashtags?.length ? 4 : 6 }}>
                          {p.scheduled_at ? `target ${p.scheduled_at.slice(0, 10)} · ` : ''}
                          {capLen} chars{overCap ? ' — OVER CHANNEL LIMIT' : ''}
                          {p.last_error ? ` · last error: ${p.last_error.slice(0, 60)}` : ''}
                        </div>
                        {p.hashtags && p.hashtags.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                            {p.hashtags.map((h, i) => (
                              <span key={i} style={{ fontSize: 9, background: CREAM, color: FOREST, padding: '1px 5px', borderRadius: 10, border: `1px solid ${HAIR}` }}>
                                {h.startsWith('#') ? h : `#${h}`}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Pre-attached photo preview */}
                        {p.media_urls && p.media_urls.length > 0 && (
                          <div style={{ marginBottom: 6, position: 'relative', display: 'inline-block' }}>
                            <img
                              src={p.media_urls[0]}
                              alt="attached media"
                              style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 3, display: 'block', border: `1px solid ${HAIR}` }}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                            <span style={{ position: 'absolute', top: 3, right: 3, fontSize: 8, background: 'rgba(0,0,0,0.55)', color: WHITE, padding: '1px 4px', borderRadius: 2 }}>
                              media ✓
                            </span>
                          </div>
                        )}
                        {/* Link URL chip */}
                        {p.link_url && (
                          <div style={{ marginBottom: 6, fontSize: 9, color: FOREST, background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 3, padding: '2px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={p.link_url}>
                            🔗 {p.link_url}
                          </div>
                        )}
                        {p.platform === 'pinterest' && (
                          <div style={{ marginBottom: 6 }}>
                            <select
                              value={boardPick[p.post_id] ?? p.pinterest_board_id ?? ''}
                              onChange={(e) => assignBoard(p.post_id, e.target.value)}
                              style={{ fontSize: 10, padding: '3px 5px', borderRadius: 3, border: `1px solid ${HAIR}`, color: INK_S, width: '100%', background: WHITE }}>
                              <option value="">— Select Pinterest board —</option>
                              {pinterestBoards.map(b => (
                                <option key={b.board_id} value={b.board_id}>{b.board_name}</option>
                              ))}
                            </select>
                            {!boardPick[p.post_id] && !p.pinterest_board_id && (
                              <div style={{ fontSize: 9, color: AMBER, marginTop: 2 }}>⚠ No board selected — post will go to default protected board</div>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {p.status === 'proposed' && (
                            <button type="button" disabled={busy !== null} onClick={() => setStatus(p.post_id, 'draft')} style={btnSecondary}>
                              {busy === p.post_id ? '…' : '✓ Accept'}
                            </button>
                          )}
                          {p.status === 'draft' && (
                            <button type="button" disabled={busy !== null} onClick={() => setStatus(p.post_id, 'ready')} style={btnPrimary}>
                              {busy === p.post_id ? '…' : '✓ Approve'}
                            </button>
                          )}
                          {p.status === 'ready' && (
                            <button type="button" disabled={busy !== null} onClick={() => setStatus(p.post_id, 'draft')} style={btnSecondary}>
                              ↩ Back to draft
                            </button>
                          )}
                          <button type="button" disabled={busy !== null}
                            onClick={() => rewritePost(p)}
                            style={btnSecondary}
                            title="Ask AI to rewrite this post using real property data">
                            {busy === `rewrite:${p.post_id}` ? '…' : p.status === 'proposed' ? '✦ AI Write' : '↺ Rewrite'}
                          </button>
                          <button type="button" disabled={busy !== null}
                            onClick={() => openMediaPicker(p)}
                            style={btnSecondary}
                            title="Pick an image from the media library">
                            {busy === `media:${p.post_id}` ? '…' : '🖼 Media'}
                          </button>
                          <button type="button" disabled={busy !== null}
                            onClick={() => exportZip('selection', { postIds: [p.post_id], propertyId: p.property_id })}
                            style={btnSecondary} title="Download this post as an upload-ready zip (caption + media, channel-formatted)">
                            {busy === `export:selection:${p.post_id}` ? '…' : '⬇ Export'}
                          </button>
                          <button type="button" disabled={busy !== null} onClick={() => setStatus(p.post_id, 'cancelled')} style={btnDanger}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {list.length === 0 && (
                    <div style={{ fontSize: 10, color: INK_M, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
                      No open posts — accept calendar slots to fill this box.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>

      {/* Media picker overlay — rendered via portal onto document.body so it escapes any overflow/transform parent */}
      {mediaPicker && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: WHITE, borderRadius: 8, padding: '20px 24px', maxWidth: 860, width: '94vw', maxHeight: '84vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.32)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>Select media from library</div>
              <button type="button" onClick={() => setMediaPicker(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: INK_M, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ fontSize: 10, color: INK_M }}>Photos approved for social use · click to assign · scroll to browse all {mediaAssets.length > 0 ? `(${mediaAssets.length} shown)` : ''}</div>
            {mediaLoading && <div style={{ fontSize: 12, color: INK_M, padding: '32px 0', textAlign: 'center' }}>Loading library…</div>}
            {!mediaLoading && mediaAssets.length === 0 && (
              <div style={{ fontSize: 12, color: INK_M, padding: '32px 0', textAlign: 'center' }}>No media found for this property.</div>
            )}
            {!mediaLoading && mediaAssets.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, overflowY: 'auto', flex: 1 }}>
                {mediaAssets.map((a) => (
                  <button key={a.asset_id} type="button"
                    onClick={() => pickMedia(a)}
                    disabled={busy !== null}
                    style={{ background: CREAM, border: `1px solid ${HAIR}`, borderRadius: 4, padding: 6, cursor: 'pointer', textAlign: 'left' }}>
                    {a.thumbnail_url
                      ? <img src={a.thumbnail_url} alt={a.alt_text ?? a.filename} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 3, display: 'block', marginBottom: 4 }}
                             onError={(e) => { if (a.raw_path_url) e.currentTarget.src = a.raw_path_url; }} />
                      : <div style={{ width: '100%', aspectRatio: '4/3', background: HAIR, borderRadius: 3, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🖼</div>
                    }
                    <div style={{ fontSize: 9, color: INK_M, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.filename}>
                      {a.caption ?? a.filename}
                    </div>
                    {a.property_area && <div style={{ fontSize: 8, color: FOREST, marginTop: 2 }}>{a.property_area}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const btnPrimary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: RED, border: `1px solid ${RED}`, borderRadius: 3, cursor: 'pointer' };
const btnTiny: React.CSSProperties = { padding: '2px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: FOREST, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
