'use client';
// app/marketing/social/_components/SocialInbox.tsx
// spec-social-media-module (2026-07-25, run 2) · A6 — DB-backed approval inbox.
// Newsletter "broadcasts" analog with the grouping dimension changed from
// audience-group to CHANNEL (research §0.R R5): one box per active channel,
// auto-filled with marketing.social_posts drafts created when calendar slots
// are accepted. Actions reuse the existing post lifecycle RPCs via
// POST /api/marketing/socials (op=set_status): draft → ready → cancelled.
// Run 3 (A5/A7): Export wired — per-post zip, per-channel week/month zip via
// POST /api/marketing/social/export (blob download), and the A7 sample-pack
// email button (2 posts per channel & format → PBS) via
// POST /api/marketing/social/send-samples.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SocialChannelRule } from '@/lib/marketing';
import type { SocialPostRow } from '@/lib/marketing-social';

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
  linkedin: 'LinkedIn', x: 'X / Twitter',
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

  const activePlatforms = rules.filter((r) => r.active).map((r) => r.platform);
  const open = posts.filter((p) => p.status === 'draft' || p.status === 'ready' || p.status === 'failed');
  const byPlatform = new Map<string, SocialPostRow[]>();
  for (const pf of activePlatforms) byPlatform.set(pf, []);
  for (const p of open) {
    const arr = byPlatform.get(p.platform) ?? [];
    arr.push(p);
    byPlatform.set(p.platform, arr);
  }

  async function setStatus(postId: string, status: 'ready' | 'draft' | 'cancelled') {
    setBusy(postId); setErr(null);
    try {
      const res = await fetch('/api/marketing/socials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'set_status', post_id: postId, status }),
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

  async function exportZip(scope: 'selection' | 'week' | 'month', opts: { postIds?: string[]; platform?: string }) {
    const key = `export:${scope}:${opts.platform ?? opts.postIds?.[0] ?? 'all'}`;
    setBusy(key); setErr(null); setNote(null);
    try {
      const res = await fetch('/api/marketing/social/export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scope === 'selection' ? { post_ids: opts.postIds } : { scope, platform: opts.platform }),
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
                    <button type="button" disabled={busy !== null} onClick={() => exportZip('week', { platform })}
                      style={btnTiny} title={`Zip of this week's approved ${PRETTY[platform] ?? platform} posts`}>
                      {busy === `export:week:${platform}` ? '…' : '⬇ wk'}
                    </button>
                    <button type="button" disabled={busy !== null} onClick={() => exportZip('month', { platform })}
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
                        {p.caption && (
                          <div style={{ fontSize: 11, color: INK_S, whiteSpace: 'pre-wrap', marginBottom: 4, maxHeight: 96, overflow: 'hidden' }}>
                            {p.caption.length > 280 ? p.caption.slice(0, 280) + '…' : p.caption}
                          </div>
                        )}
                        <div style={{ fontSize: 9, color: overCap ? RED : INK_M, marginBottom: 6 }}>
                          {p.scheduled_at ? `target ${p.scheduled_at.slice(0, 10)} · ` : ''}
                          {capLen} chars{overCap ? ' — OVER CHANNEL LIMIT' : ''}
                          {p.last_error ? ` · last error: ${p.last_error.slice(0, 60)}` : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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
                            onClick={() => exportZip('selection', { postIds: [p.post_id] })}
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
  );
}

const btnPrimary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 600, background: FOREST, color: WHITE, border: 'none', borderRadius: 3, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: INK_S, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
const btnDanger: React.CSSProperties = { padding: '4px 10px', fontSize: 11, fontWeight: 500, background: WHITE, color: RED, border: `1px solid ${RED}`, borderRadius: 3, cursor: 'pointer' };
const btnTiny: React.CSSProperties = { padding: '2px 6px', fontSize: 10, fontWeight: 600, background: WHITE, color: FOREST, border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer' };
