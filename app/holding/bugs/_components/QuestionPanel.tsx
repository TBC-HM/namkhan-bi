'use client';
// Shared question-and-multiple-choice panel for needs_human / needs_input surfaces.
// Used on: bugs board, briefs pages, specs page cards.
// On click → POST to answerUrl → calls toast → parent refreshes row.

import { useState } from 'react';

export interface OpenQuestion {
  question: string;
  options: Array<{ label: string; consequence: string; recommended?: boolean }>;
  asked_by?: string;
  asked_at?: string;
}

interface Props {
  question: OpenQuestion;
  answerUrl: string;
  answerBody: (choice: string) => Record<string, unknown>;
  onAnswered: (choice: string) => void;
  /** If true, render compact (no border box, smaller text) for table rows */
  compact?: boolean;
}

export default function QuestionPanel({ question, answerUrl, answerBody, onAnswered, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Recommended option first
  const opts = [...question.options].sort((a, b) =>
    (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0)
  );

  async function choose(label: string) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(answerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answerBody(label)),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Failed'); return; }
      onAnswered(label);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
            {question.question}
          </div>
          {question.asked_by && (
            <div style={{ fontSize: 10, color: '#8A8A8A', marginTop: 2 }}>
              asked by {question.asked_by}
              {question.asked_at ? ` · ${new Date(question.asked_at).toLocaleDateString()}` : ''}
            </div>
          )}
        </div>
      </div>
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
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>
              {opt.consequence}
            </div>
          </button>
        ))}
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
