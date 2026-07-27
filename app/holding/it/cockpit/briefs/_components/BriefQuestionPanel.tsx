'use client';
// app/holding/it/cockpit/briefs/_components/BriefQuestionPanel.tsx
// Client component for answering open_question on needs_input briefs.

import { useState } from 'react';
import { TOKENS, MONO } from '../../_components/tokens';

interface Option { label: string; consequence: string; recommended?: boolean }
interface OpenQuestion { question: string; options: Option[]; asked_by?: string; asked_at?: string }

export function BriefQuestionInline({ slug, question }: { slug: string; question: OpenQuestion | null }) {
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (answered) {
    return (
      <div style={{ padding: '8px 12px', background: 'rgba(8,72,56,0.08)', borderRadius: 6, fontSize: 12, color: TOKENS.forest }}>
        ✓ Answered — brief flipped to ready. Refresh to see.
      </div>
    );
  }

  if (!question) {
    return (
      <div style={{ padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid var(--status-red)', background: 'rgba(184,84,42,0.07)', fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: 'var(--status-red)' }}>⚠ no options provided — agent contract gap</span>
      </div>
    );
  }

  const opts = [...question.options].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));

  async function choose(label: string) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/cockpit/briefs/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, choice: label }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Failed'); return; }
      setAnswered(true);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ padding: '10px 12px', background: 'rgba(180,138,58,0.1)', borderRadius: 6, borderLeft: '3px solid var(--status-amber)' }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4, color: TOKENS.ink }}>❓ {question.question}</div>
      {question.asked_by && (
        <div style={{ fontSize: 10, color: TOKENS.text2, marginBottom: 8, fontFamily: MONO }}>
          asked by {question.asked_by}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {opts.map((opt) => (
          <button key={opt.label} disabled={busy} onClick={() => choose(opt.label)} style={{
            textAlign: 'left', padding: '7px 10px', borderRadius: 5, cursor: busy ? 'wait' : 'pointer',
            border: opt.recommended ? `1.5px solid ${TOKENS.forest}` : `1px solid ${TOKENS.border}`,
            background: opt.recommended ? TOKENS.forest : TOKENS.bgRaised,
            color: opt.recommended ? '#fff' : TOKENS.ink,
            opacity: busy ? 0.7 : 1, display: 'block', width: '100%',
          }}>
            <div style={{ fontWeight: 600, fontSize: 11 }}>{opt.recommended && '★ '}{opt.label}</div>
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{opt.consequence}</div>
          </button>
        ))}
      </div>
      {err && <div style={{ fontSize: 11, color: 'var(--status-red)', marginTop: 6 }}>{err}</div>}
    </div>
  );
}
