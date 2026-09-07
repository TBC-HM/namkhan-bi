'use client';
// Inline Q&A answer panel for the GBP page.
// Each unanswered question shows a textarea + submit button — no redirect needed.
// Answer is saved via /api/google/answer-qa (DB write + optional GBP API call).

import { useState } from 'react';

type QaRow = {
  question_id: string;
  question: string;
  asked_by: string;
  asked_at: string;
  answered: boolean;
  answer: string | null;
};

const WHITE  = '#FFFFFF';
const HAIR   = '#E6DFCC';
const INK    = '#1B1B1B';
const INK_S  = '#3A3A3A';
const INK_M  = '#5A5A5A';
const GREEN  = '#084838';
const AMBER  = '#C28F2C';
const RED    = '#B04A2F';

function fmtRelative(d: string): string {
  if (!d) return '—';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
}

function QaCard({ row, propertyId }: { row: QaRow; propertyId: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [localAnswer, setLocalAnswer] = useState<string | null>(row.answer);
  const [answered, setAnswered] = useState(row.answered);

  async function submit() {
    if (busy || text.trim().length < 2) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch('/api/google/answer-qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: propertyId, question_id: row.question_id, answer_text: text.trim() }),
      });
      const j = await r.json();
      if (j.ok) {
        setLocalAnswer(text.trim());
        setAnswered(true);
        setOpen(false);
        setText('');
        setResult({ ok: true, message: 'Answer saved.' });
      } else {
        setResult({ ok: false, message: String(j.error ?? 'save failed') });
      }
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: '10px 12px',
      background: answered ? WHITE : '#FDF7E6',
      border: `1px solid ${answered ? HAIR : AMBER}`,
      borderRadius: 4,
    }}>
      <div style={{ fontSize: 12, color: INK, fontWeight: 600, marginBottom: 3 }}>{row.question}</div>
      <div style={{ fontSize: 10, color: INK_M, marginBottom: 6 }}>
        asked by {row.asked_by} · {fmtRelative(row.asked_at)}
      </div>

      {answered && localAnswer ? (
        <div style={{ fontSize: 11, color: INK_S, fontStyle: 'italic', paddingLeft: 8, borderLeft: `2px solid ${GREEN}` }}>
          {localAnswer}
        </div>
      ) : open ? (
        <div style={{ marginTop: 4 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Write the public answer — brand voice, warm, specific to the question…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 11,
              lineHeight: 1.5, color: INK, background: WHITE, border: `1px solid ${HAIR}`,
              borderRadius: 4, fontFamily: 'inherit', resize: 'vertical', marginBottom: 6,
            }}
          />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button onClick={submit} disabled={busy || text.trim().length < 2}
              style={{
                padding: '5px 12px', fontSize: 11, fontWeight: 600,
                background: busy || text.trim().length < 2 ? INK_M : GREEN,
                color: WHITE, border: 'none', borderRadius: 3, cursor: busy ? 'wait' : 'pointer',
                fontFamily: 'inherit',
              }}>
              {busy ? 'Saving…' : 'Post answer publicly'}
            </button>
            <button onClick={() => { setOpen(false); setText(''); setResult(null); }}
              style={{ padding: '5px 10px', fontSize: 11, background: 'transparent', border: `1px solid ${HAIR}`, borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', color: INK_M }}>
              Cancel
            </button>
            <span style={{ fontSize: 10, color: INK_M }}>{text.trim().length} chars</span>
          </div>
          {result && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 3, fontSize: 11,
              background: result.ok ? '#E4F1E0' : '#FBE8E4',
              border: `1px solid ${result.ok ? '#A9CFA0' : '#E8B7AB'}`,
              color: result.ok ? '#1F5C2C' : RED,
            }}>
              {result.message}
            </div>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          style={{
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            background: GREEN, color: WHITE, border: 'none', borderRadius: 3,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Answer publicly →
        </button>
      )}
    </div>
  );
}

export default function GbpQaPanel({ rows, propertyId }: { rows: QaRow[]; propertyId: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.slice(0, 6).map((q) => (
        <QaCard key={q.question_id} row={q} propertyId={propertyId} />
      ))}
    </div>
  );
}
