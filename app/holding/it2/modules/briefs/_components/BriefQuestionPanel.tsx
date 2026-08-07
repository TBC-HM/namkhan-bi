'use client';
// app/holding/it2/modules/briefs/_components/BriefQuestionPanel.tsx
// Client component for answering open_question on needs_input briefs.

import { useState } from 'react';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

interface Option { label: string; consequence: string; recommended?: boolean }
interface OpenQuestion { question: string; options: Option[]; asked_by?: string; asked_at?: string }

export function BriefQuestionInline({ slug, question }: { slug: string; question: OpenQuestion | null }) {
  const [answered, setAnswered] = useState(false);
  // ADR-252 (PBS 2026-08-06 22:05): "before i could coment the question there was a
  // whole path now it is gone". This panel never had a free-text box — the option
  // "None of these — I will describe it" posted that LABEL as the answer, so the
  // owner had no way to describe anything. /api/cockpit/briefs/answer passes
  // `choice` straight through to fn_answer_brief_question, so free text has always
  // been accepted by the backend. Only the input was missing.
  const [free, setFree] = useState('');
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

  // owner-answer-path-consolidation-v1: answers go through THE single owner
  // route (/api/owner/answer → fn_owner_question_answer). Falls back to the
  // legacy brief endpoint if this brief has no contract row yet (404).
  async function submit(answer: { choice?: string; free_text?: string }) {
    setBusy(true); setErr(null);
    try {
      let r = await fetch('/api/owner/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asker_kind: 'brief', ref_id: slug, ...answer }),
      });
      if (r.status === 404) {
        r = await fetch('/api/cockpit/briefs/answer', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, ...answer }),
        });
      }
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? 'Failed'); return; }
      setAnswered(true);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }
  const choose = (label: string) => submit({ choice: label });

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
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${TOKENS.border}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: TOKENS.text2, marginBottom: 4 }}>
          Or answer in your own words
        </div>
        <textarea
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="Type your answer, a correction, or a question back to the agent…"
          rows={3}
          style={{ width: '100%', fontSize: 12, padding: '7px 9px', borderRadius: 5,
            border: `1px solid ${TOKENS.border}`, background: '#FFFFFF', color: TOKENS.ink,
            fontFamily: 'inherit', resize: 'vertical' }}
        />
        <button
          disabled={busy || free.trim().length < 3}
          onClick={() => submit({ free_text: free.trim() })}
          style={{ marginTop: 6, fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 5,
            cursor: busy || free.trim().length < 3 ? 'not-allowed' : 'pointer',
            border: `1px solid ${TOKENS.forest}`,
            background: free.trim().length < 3 ? TOKENS.bgRaised : TOKENS.forest,
            color: free.trim().length < 3 ? TOKENS.text2 : '#fff', opacity: busy ? 0.6 : 1 }}>
          Send my answer →
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: 'var(--status-red)', marginTop: 6 }}>{err}</div>}
    </div>
  );
}
