'use client';
// Inline review reply panel for the GBP page.
// Clicking "Reply →" opens a compose form in-place — no redirect to reputation page.
// Uses the same /api/google/reply endpoint as ReplyComposer.

import { useState } from 'react';
import SourceBadge from '@/components/marketing/SourceBadge';
import TenantLink from '@/components/nav/TenantLink';

type ReviewRow = {
  id: number;
  source: string;
  reviewer_name: string | null;
  rating_norm: number | null;
  title: string | null;
  body: string | null;
  reviewed_at: string | null;
  response_status: string | null;
  response_text: string | null;
};

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#3A3A3A';
const INK_M  = '#5A5A5A';
const GREEN  = '#084838';
const AMBER  = '#C28F2C';
const RED    = '#B04A2F';
const CREAM  = '#F5F0E1';

function fmtRelative(d: string | null): string {
  if (!d) return '—';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}

function ReviewCard({ r, propertyId }: { r: ReviewRow; propertyId: number }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [replied, setReplied] = useState(r.response_status === 'responded');

  async function aiDraft() {
    setAiBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/google/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          mode: 'review_reply',
          review_text: r.body ?? r.title ?? '',
          reviewer_name: r.reviewer_name ?? 'Guest',
          rating: r.rating_norm ?? 0,
        }),
      });
      const j = await res.json();
      if (j.ok) setComment(j.draft ?? '');
      else setResult({ ok: false, message: String(j.error ?? 'AI draft failed') });
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setAiBusy(false);
    }
  }

  async function submit() {
    if (busy || comment.trim().length < 2) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/google/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property: propertyId, reviewId: r.id, comment: comment.trim() }),
      });
      const j = await res.json();
      if (j.ok) {
        setReplied(true);
        setOpen(false);
        setComment('');
        setResult({ ok: true, message: j.warning ? 'Reply posted. Note: ' + j.warning : 'Reply posted to Google.' });
      } else {
        setResult({ ok: false, message: String(j.error ?? 'reply failed') });
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: '10px 12px', background: WHITE, border: `1px solid ${HAIR}`, borderRadius: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SourceBadge source="google" size="sm" />
          <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>{r.reviewer_name ?? 'Anonymous'}</span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: r.rating_norm != null && r.rating_norm >= 4 ? GREEN : r.rating_norm != null && r.rating_norm <= 3 ? RED : INK_M,
          }}>{r.rating_norm != null ? r.rating_norm.toFixed(1) + '★' : '—'}</span>
        </div>
        <span style={{ fontSize: 10, color: INK_M }}>{fmtRelative(r.reviewed_at)}</span>
      </div>
      {r.title && <div style={{ fontSize: 12, fontWeight: 600, color: INK, marginBottom: 2 }}>{r.title}</div>}
      {r.body && (
        <div style={{ fontSize: 11, color: INK_S, lineHeight: 1.5, marginBottom: 6 }}>
          {r.body.length > 220 ? r.body.slice(0, 220) + '…' : r.body}
        </div>
      )}

      {/* Reply state */}
      {replied && !open ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: GREEN, fontWeight: 600 }}>✓ Replied</span>
          {result && result.ok && <span style={{ fontSize: 10, color: GREEN }}>{result.message}</span>}
        </div>
      ) : open ? (
        <div style={{ marginTop: 4, background: CREAM, borderRadius: 4, padding: '10px 10px 8px' }}>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={3}
            placeholder="Write the public reply — brand voice, thank the guest, address specifics…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 11,
              lineHeight: 1.5, color: INK, background: WHITE, border: `1px solid ${HAIR}`,
              borderRadius: 4, fontFamily: 'inherit', resize: 'vertical', marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={busy || aiBusy || comment.trim().length < 2}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600,
                background: busy || aiBusy || comment.trim().length < 2 ? INK_M : GREEN,
                color: WHITE, border: 'none', borderRadius: 3, cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {busy ? 'Posting…' : 'Post reply to Google'}
            </button>
            <button onClick={aiDraft} disabled={aiBusy || busy}
              style={{
                padding: '5px 10px', fontSize: 11, fontWeight: 600,
                background: aiBusy ? AMBER : '#00AF87', color: WHITE,
                border: 'none', borderRadius: 3, cursor: aiBusy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {aiBusy ? '✨ Drafting…' : '✨ AI draft'}
            </button>
            <button onClick={() => { setOpen(false); setComment(''); setResult(null); }}
              style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', color: INK_M }}>
              Cancel
            </button>
            <span style={{ fontSize: 10, color: INK_M }}>{comment.trim().length} chars</span>
          </div>
          {result && !result.ok && (
            <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 3, fontSize: 11, background: '#FBE8E4', border: `1px solid #E8B7AB`, color: RED }}>
              {result.message}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={() => setOpen(true)}
            style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 600,
              background: GREEN, color: WHITE, border: 'none', borderRadius: 3,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
            Reply →
          </button>
          {result && result.ok && <span style={{ fontSize: 10, color: GREEN }}>{result.message}</span>}
        </div>
      )}
    </div>
  );
}

export default function GbpReviewReply({ reviews, propertyId }: { reviews: ReviewRow[]; propertyId: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {reviews.map((r) => (
        <ReviewCard key={r.id} r={r} propertyId={propertyId} />
      ))}
      <TenantLink href="/guest/reputation"
        style={{ alignSelf: 'flex-end', marginTop: 4, fontSize: 11, color: '#084838', textDecoration: 'underline' }}>
        All reviews on reputation page →
      </TenantLink>
    </div>
  );
}
