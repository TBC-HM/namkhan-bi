'use client';
// app/guest/reputation/_components/ReplyComposer.tsx
// GBP completion brief (autospec-gbp_module-20260725) §5.5 · 2026-07-29.
// Reply composer opened by /guest/reputation?review=<id> (deep-linked from the
// GBP page "Reply →" buttons). Posts through /api/google/reply → google-sync
// post-reply. Pre-allowlist the upstream error is shown verbatim — no fake success.
// Styling mirrors sibling components (ReputationReviewsTabs) — same palette consts.
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import SourceBadge from '@/components/marketing/SourceBadge';

type Review = {
  id: number;
  source: string;
  reviewer_name: string | null;
  rating_norm: number | string | null;
  title: string | null;
  body: string | null;
  reviewed_at: string | null;
  response_status: string | null;
  response_text: string | null;
};

const HAIR = '#E6DFCC';
const WHITE = '#FFFFFF';
const INK = '#1B1B1B';
const INK_S = '#3A3A3A';
const INK_M = '#5A5A5A';
const GREEN = '#1F3A2E';
const RED = '#B04A2F';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try { return new Date(iso).toISOString().slice(0, 10); } catch { return '—'; }
}

export default function ReplyComposer({ review, propertyId }: { review: Review; propertyId: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const [comment, setComment] = useState(review.response_text ?? '');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const alreadyResponded = review.response_status === 'responded';

  async function submit() {
    if (busy || comment.trim().length < 2) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/google/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property: propertyId, reviewId: review.id, comment: comment.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setResult({ ok: true, message: j.warning ? 'Reply posted. Note: ' + j.warning : 'Reply posted to Google.' });
        router.refresh();
      } else {
        setResult({ ok: false, message: String(j.error ?? 'reply failed') });
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    router.replace(pathname);
  }

  return (
    <div style={{ background: WHITE, border: '1px solid ' + HAIR, borderLeft: '3px solid ' + GREEN, borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: INK_M }}>
          Reply to review
        </div>
        <button onClick={dismiss} title="Close composer"
          style={{ background: 'transparent', border: 'none', color: INK_M, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
      </div>

      {/* The review being answered */}
      <div style={{ padding: '10px 12px', background: '#FCFBF5', border: '1px solid ' + HAIR, borderRadius: 4, marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
          <SourceBadge source={review.source} />
          <span style={{ fontWeight: 600, fontSize: 12, color: INK }}>{review.reviewer_name ?? 'Anonymous'}</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: INK }}>{review.rating_norm != null ? Number(review.rating_norm).toFixed(1) + ' / 5' : '—'}</span>
          <span style={{ color: INK_M, fontSize: 11 }}>{fmtDate(review.reviewed_at)}</span>
        </div>
        {review.title && <div style={{ fontStyle: 'italic', fontWeight: 500, fontSize: 12, color: INK, marginBottom: 3 }}>{review.title}</div>}
        {review.body && <div style={{ fontSize: 12, color: INK_S, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{review.body}</div>}
      </div>

      {alreadyResponded && (
        <div style={{ fontSize: 11, color: GREEN, marginBottom: 8 }}>
          ✓ Already replied — submitting again updates the public reply on Google.
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="Write the public reply — brand voice, thank the guest, address specifics…"
        style={{
          width: '100%', boxSizing: 'border-box', padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
          color: INK, background: WHITE, border: '1px solid ' + HAIR, borderRadius: 4,
          fontFamily: 'inherit', resize: 'vertical', marginBottom: 8,
        }}
      />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={submit} disabled={busy || comment.trim().length < 2}
          style={{
            padding: '6px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            background: busy || comment.trim().length < 2 ? INK_M : GREEN, color: WHITE,
            border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
          }}>
          {busy ? 'Posting…' : 'Post reply to Google'}
        </button>
        <span style={{ fontSize: 10, color: INK_M }}>{comment.trim().length} chars · posts publicly as The Namkhan</span>
      </div>

      {result && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 4, fontSize: 12,
          background: result.ok ? '#E4F1E0' : '#FBE8E4',
          border: '1px solid ' + (result.ok ? '#A9CFA0' : '#E8B7AB'),
          color: result.ok ? '#1F5C2C' : RED,
        }}>
          {result.ok ? <strong>✓ </strong> : <strong>Reply not posted: </strong>}{result.message}
        </div>
      )}
    </div>
  );
}
