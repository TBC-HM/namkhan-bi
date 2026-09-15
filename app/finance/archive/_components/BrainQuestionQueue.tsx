'use client';
// app/finance/archive/_components/BrainQuestionQueue.tsx
// PBS 2026-09-15 · documents the brain has a question about, with a decision CTA.
// 622 Namkhan documents sat at classification_status='needs_human', every one already
// carrying a proposal, and none of them had ever been shown to the owner with a button.
//   Confirm            → POST  /api/brain/review   → fn_brain_review_confirm
//   Not brain material → PATCH /api/brain/review   → fn_brain_review_dismiss(not_brain_material)
//   Wrong guess        → PATCH /api/brain/review   → fn_brain_review_dismiss(wrong_guess)
// There is no generic "dismiss": the DB function raises without an explicit mode, because a
// row that merely hides becomes an invisible backlog.
import { useEffect, useState, useCallback } from 'react';

type QueueRow = {
  doc_id: string;
  filename: string | null;
  title: string | null;
  dms_doc_type: string | null;
  extract_snippet: string | null;
  guess_doc_kind: string | null;
  guess_sensitivity: string | null;
  confidence: number | null;
  summary: string | null;
};

const PAGE_SIZE = 20;

const btn: React.CSSProperties = {
  fontSize: 12, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
  border: '1px solid var(--hair, #E6DFCC)', background: 'var(--paper, #FFFFFF)',
  color: 'var(--ink, #1B1B1B)',
};
const btnPrimary: React.CSSProperties = {
  ...btn, background: 'var(--forest, #084838)', color: '#FFFFFF', borderColor: 'var(--forest, #084838)',
};
const card: React.CSSProperties = {
  borderTop: '1px solid var(--hair, #E6DFCC)', padding: '10px 0', fontSize: 12.5,
  color: 'var(--ink, #1B1B1B)',
};
const mute: React.CSSProperties = { opacity: 0.65 };

export default function BrainQuestionQueue({ propertyId }: { propertyId: number }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/brain/review?pid=${propertyId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        if (!json.ok) setError(json.error ?? 'could not load the review queue');
        else setRows((json.queue ?? []) as QueueRow[]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'could not load the review queue');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [propertyId]);

  const drop = useCallback((docId: string) => {
    setRows((prev) => prev.filter((r) => r.doc_id !== docId));
  }, []);

  async function confirm(row: QueueRow) {
    if (!row.guess_doc_kind || !row.guess_sensitivity) {
      setError('this document has no proposal to confirm');
      return;
    }
    setBusy(row.doc_id); setError(null);
    try {
      const res = await fetch('/api/brain/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          doc_id: row.doc_id, doc_kind: row.guess_doc_kind, sensitivity: row.guess_sensitivity,
        }),
      });
      const json = await res.json();
      if (json.ok) drop(row.doc_id); else setError(json.error ?? 'confirm failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'confirm failed');
    } finally { setBusy(null); }
  }

  async function dismiss(row: QueueRow, mode: 'not_brain_material' | 'wrong_guess') {
    setBusy(row.doc_id); setError(null);
    try {
      const res = await fetch('/api/brain/review', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc_id: row.doc_id, mode }),
      });
      const json = await res.json();
      if (json.ok) drop(row.doc_id); else setError(json.error ?? 'dismiss failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'dismiss failed');
    } finally { setBusy(null); }
  }

  if (loading) return <div style={{ ...mute, fontSize: 12.5 }}>Loading the brain&rsquo;s open questions&hellip;</div>;
  if (error && rows.length === 0) return <div style={{ fontSize: 12.5, color: 'var(--ink, #1B1B1B)' }}>{error}</div>;
  if (rows.length === 0) return <div style={{ ...mute, fontSize: 12.5 }}>No open questions — every document has a confirmed classification.</div>;

  return (
    <div>
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>
        <strong>{rows.length}</strong> document{rows.length === 1 ? '' : 's'} waiting on a decision
        <span style={mute}> · confirming removes it from this list</span>
      </div>
      {error ? <div style={{ fontSize: 12, marginBottom: 6 }}>{error}</div> : null}

      {rows.slice(0, shown).map((row) => (
        <div key={row.doc_id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 240, flex: '1 1 320px' }}>
              <a href={`/api/legal/docs/file/${row.doc_id}?mode=preview`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                {row.title || row.filename || row.doc_id.slice(0, 8)}
              </a>
              <div style={{ ...mute, fontSize: 11.5, marginTop: 2 }}>
                {row.dms_doc_type ?? 'unclassified'}
                {row.filename ? ` · ${row.filename}` : ''}
              </div>
              {row.summary || row.extract_snippet ? (
                <div style={{ ...mute, marginTop: 4 }}>
                  {(row.summary || row.extract_snippet || '').slice(0, 220)}
                </div>
              ) : null}
            </div>

            <div style={{ minWidth: 200 }}>
              <div style={{ fontSize: 11.5, ...mute }}>Brain proposes</div>
              <div>
                {row.guess_doc_kind ?? '—'}
                <span style={mute}>{row.guess_sensitivity ? ` · ${row.guess_sensitivity}` : ''}</span>
                {typeof row.confidence === 'number' ? (
                  <span style={mute}> · {Math.round(row.confidence * 100)}%</span>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button style={btnPrimary} disabled={busy === row.doc_id} onClick={() => confirm(row)}>
                  {busy === row.doc_id ? '…' : 'Confirm'}
                </button>
                <button style={btn} disabled={busy === row.doc_id} onClick={() => dismiss(row, 'wrong_guess')}>
                  Wrong guess
                </button>
                <button style={btn} disabled={busy === row.doc_id} onClick={() => dismiss(row, 'not_brain_material')}>
                  Not brain material
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}

      {shown < rows.length ? (
        <div style={{ marginTop: 10 }}>
          <button style={btn} onClick={() => setShown((n) => n + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, rows.length - shown)} more
          </button>
        </div>
      ) : null}
    </div>
  );
}
