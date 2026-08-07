'use client';
// Shared question-and-multiple-choice panel for needs_human / needs_input surfaces.
// Used on: bugs board, briefs pages, specs page cards.
// On click → POST to answerUrl → calls toast → parent refreshes row.
//
// ADR-223 (2026-08-05): options are now accepted as EITHER {label, consequence}
// objects OR plain strings. A question written with string options used to render
// buttons whose label was undefined, so the POST body lost `choice` and the API
// answered 400 "bug_id and choice required" — the question looked answerable and
// silently was not. A malformed question must degrade to a usable button, never to
// a dead form. Empty/missing options now say so instead of rendering nothing.

import { useState } from 'react';

export type QuestionOption = { label: string; consequence?: string; recommended?: boolean };
export type RawOption = QuestionOption | string;

export interface OpenQuestion {
  question?: string;
  /** Older rows used `context` for the question text. */
  context?: string;
  options: RawOption[];
  asked_by?: string;
  asked_at?: string;
}

interface Props {
  question: OpenQuestion;
  answerUrl: string;
  /** Builds the POST body. `answer` carries choice OR free_text (law 735). */
  answerBody: (answer: { choice?: string; free_text?: string }) => Record<string, unknown>;
  onAnswered: (choice: string) => void;
  /** If true, render compact (no border box, smaller text) for table rows */
  compact?: boolean;
}

/** Normalise string|object options into a single shape. Drops anything unusable. */
export function normaliseOptions(raw: RawOption[] | undefined | null): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o): QuestionOption | null => {
      if (typeof o === 'string') return o.trim() ? { label: o.trim() } : null;
      if (o && typeof o === 'object' && typeof o.label === 'string' && o.label.trim()) {
        return { label: o.label.trim(), consequence: o.consequence, recommended: o.recommended };
      }
      return null;
    })
    .filter((o): o is QuestionOption => o !== null);
}

export default function QuestionPanel({ question, answerUrl, answerBody, onAnswered, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // owner-answer-path-consolidation-v1 (bug 169): this panel had no free-text
  // input, so when no option fit, the owner was stuck (law 735 violation).
  const [free, setFree] = useState('');

  const text = question.question ?? question.context ?? 'A decision is needed (no question text was filed).';
  const opts = normaliseOptions(question.options).sort(
    (a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)
  );

  async function submit(answer: { choice?: string; free_text?: string }) {
    const display = answer.choice ?? answer.free_text ?? '';
    if (!display) { setErr('This option has no value — agent filed a malformed question.'); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(answerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answerBody(answer)),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Failed'); return; }
      onAnswered(display);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const choose = (label: string) => submit({ choice: label });

  const wrap: React.CSSProperties = compact ? {
    padding: '10px 12px', background: '#FBF3D9', borderRadius: 6,
    borderLeft: '3px solid #B48A3A',
  } : {
    padding: '14px 16px', background: '#FBF3D9', borderRadius: 8,
    border: '1px solid rgba(180,138,58,0.35)', marginTop: 8,
  };

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>❓</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: compact ? 12 : 13, color: '#1B1B1B', lineHeight: 1.4 }}>
            {text}
          </div>
          {question.asked_by && (
            <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2 }}>
              asked by {question.asked_by}
              {question.asked_at ? ` · ${new Date(question.asked_at).toLocaleDateString('en-GB', { timeZone: 'UTC' })}` : ''}
            </div>
          )}
        </div>
      </div>

      {opts.length === 0 ? (
        <div style={{ fontSize: 11, color: '#B04A2F', fontWeight: 600 }}>
          ⚠ this question has no usable options — agent contract gap (law 735). Nothing to click.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {opts.map((opt) => (
            <button
              key={opt.label}
              disabled={busy}
              onClick={() => choose(opt.label)}
              style={{
                textAlign: 'left', padding: '8px 12px', borderRadius: 6, cursor: busy ? 'wait' : 'pointer',
                border: opt.recommended ? '1.5px solid #084838' : '1px solid #E6DFCC',
                background: opt.recommended ? '#084838' : '#FFFFFF',
                color: opt.recommended ? '#FFFFFF' : '#1B1B1B',
                opacity: busy ? 0.7 : 1,
                display: 'block', width: '100%',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 12 }}>
                {opt.recommended && '★ '}{opt.label}
              </div>
              {opt.consequence && (
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
                  {opt.consequence}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* law 735: free text is ALWAYS available, even when options render fine */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E6DFCC' }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: '#8A8A8A', marginBottom: 4 }}>
          Or answer in your own words
        </div>
        <textarea
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="Type your answer, a correction, or a question back to the agent…"
          rows={2}
          style={{ width: '100%', fontSize: 12, padding: '7px 9px', borderRadius: 5,
            border: '1px solid #E6DFCC', background: '#FFFFFF', color: '#1B1B1B',
            fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button
          disabled={busy || free.trim().length < 3}
          onClick={() => submit({ free_text: free.trim() })}
          style={{ marginTop: 6, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 5,
            cursor: busy || free.trim().length < 3 ? 'not-allowed' : 'pointer',
            border: '1px solid #084838',
            background: free.trim().length < 3 ? '#FFFFFF' : '#084838',
            color: free.trim().length < 3 ? '#8A8A8A' : '#FFFFFF', opacity: busy ? 0.6 : 1 }}>
          Send my answer →
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: '#B04A2F', marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/** Fallback when needs_human/needs_input but open_question is missing */
export function MissingOptionsFallback({ notes }: { notes?: string | null }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 6, borderLeft: '3px solid #B04A2F',
      background: '#FDECE4', fontSize: 12, color: '#1B1B1B',
    }}>
      <div style={{ fontWeight: 600, color: '#B04A2F', marginBottom: 4 }}>
        ⚠ no options provided — agent contract gap
      </div>
      {notes && <div style={{ color: '#5A5A5A', whiteSpace: 'pre-wrap' }}>{notes}</div>}
    </div>
  );
}
