'use client';
// app/holding/it/cockpit/questions/QuestionWalkthrough.tsx
// PBS 2026-07-27: "answer question walkthrough, best even with multiple choice —
// do I need to find the question by reading a huge text? must be easier."
// One open question at a time, big option buttons, answer → next card.
// Bug #107: answered-state shows recorded choice + consequence + where deliverable arrives.

import { useState } from 'react';
import { TOKENS, MONO } from '../_components/tokens';

export interface OpenQ {
  kind: 'brief' | 'bug';
  ref: string;              // brief slug or bug id
  title: string;            // human title
  question: string;
  options: { label: string; consequence: string; recommended?: boolean }[];
  asked_by?: string;
  link: string;             // deep link to the full brief/bug
}

export default function QuestionWalkthrough({ questions }: { questions: OpenQ[] }) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({}); // ref -> chosen label
  // Bug #107: track the just-answered choice so we can show the promise-gap panel
  const [answeredChoice, setAnsweredChoice] = useState<{ label: string; consequence: string } | null>(null);

  const remaining = questions.filter((q) => !done[q.kind + q.ref]);
  const current = remaining[Math.min(idx, Math.max(remaining.length - 1, 0))];

  async function answer(q: OpenQ, opt: { label: string; consequence: string }) {
    setBusy(true); setErr(null);
    try {
      const url = q.kind === 'brief' ? '/api/cockpit/briefs/answer' : '/api/cockpit/bugs/answer';
      const body = q.kind === 'brief' ? { slug: q.ref, choice: opt.label } : { bug_id: Number(q.ref), choice: opt.label };
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? `failed (${r.status})`); return; }
      setDone((d) => ({ ...d, [q.kind + q.ref]: opt.label }));
      // Bug #107: show answered panel instead of silently advancing
      setAnsweredChoice({ label: opt.label, consequence: opt.consequence });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function advanceAfterAnswer() {
    setAnsweredChoice(null);
    setIdx(0);
  }

  if (questions.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: TOKENS.text2, fontSize: 13 }}>
        ✓ No open questions. Every loop is either running or waiting on work, not on you.
      </div>
    );
  }

  if (remaining.length === 0 && !answeredChoice) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>✓ All answered</div>
        <div style={{ fontSize: 12.5, color: TOKENS.text2 }}>
          {Object.keys(done).length} decision{Object.keys(done).length === 1 ? '' : 's'} recorded — the loops re-release automatically.
        </div>
      </div>
    );
  }

  const q = current ?? questions[questions.length - 1];
  const opts = [...q.options].sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
  const answeredCount = Object.keys(done).length;

  // Bug #107: answered-state panel — show recorded choice + what happens next
  if (answeredChoice) {
    const nextRemaining = questions.filter((qq) => !done[qq.kind + qq.ref]);
    return (
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontFamily: MONO, color: TOKENS.text2 }}>
            question {answeredCount} of {questions.length}
          </span>
          <div style={{ display: 'flex', gap: 3 }}>
            {questions.map((qq, i) => (
              <div key={i} style={{ width: 18, height: 4, borderRadius: 99,
                background: done[qq.kind + qq.ref] ? 'var(--status-green)' : TOKENS.border }} />
            ))}
          </div>
        </div>

        {/* Answered-state card */}
        <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 10, padding: '20px 22px' }}>
          <div style={{ fontSize: 12, color: 'var(--status-green)', fontWeight: 700, marginBottom: 10 }}>✓ Decision recorded</div>

          <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink, marginBottom: 6 }}>
            You chose: {answeredChoice.label}
          </div>

          <div style={{
            background: TOKENS.bg, border: `1px solid ${TOKENS.border}`, borderRadius: 8,
            padding: '10px 14px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontFamily: MONO, color: TOKENS.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              What happens next
            </div>
            <div style={{ fontSize: 12.5, color: TOKENS.ink, lineHeight: 1.5 }}>
              {answeredChoice.consequence}
            </div>
          </div>

          <div style={{ fontSize: 11, color: TOKENS.text2, marginBottom: 16 }}>
            The loop re-releases automatically — any deliverable promised above will arrive via the cockpit or the brief page.
          </div>

          {nextRemaining.length > 0 ? (
            <button
              onClick={advanceAfterAnswer}
              style={{
                background: TOKENS.forest, color: TOKENS.bg, border: 'none',
                borderRadius: 8, padding: '10px 20px', fontWeight: 700,
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Next question →
            </button>
          ) : (
            <div style={{ fontSize: 13, fontWeight: 600, color: TOKENS.ink }}>
              ✓ All {questions.length} question{questions.length === 1 ? '' : 's'} answered — nothing more waiting on you.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontFamily: MONO, color: TOKENS.text2 }}>
          question {answeredCount + 1} of {questions.length}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {questions.map((qq, i) => (
            <div key={i} style={{ width: 18, height: 4, borderRadius: 99,
              background: done[qq.kind + qq.ref] ? 'var(--status-green)' : (qq === q ? 'var(--status-amber)' : TOKENS.border) }} />
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 10, padding: '20px 22px' }}>
        <div style={{ fontSize: 10, fontFamily: MONO, color: TOKENS.text2, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          {q.kind === 'brief' ? 'build brief' : `bug #${q.ref}`} · {q.title}
          {q.asked_by ? ` · asked by ${q.asked_by}` : ''}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, color: TOKENS.ink, marginBottom: 14 }}>
          {q.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((opt) => (
            <button key={opt.label} disabled={busy} onClick={() => answer(q, opt)} style={{
              textAlign: 'left', padding: '11px 14px', borderRadius: 8, cursor: busy ? 'wait' : 'pointer',
              border: opt.recommended ? `2px solid ${TOKENS.forest}` : `1px solid ${TOKENS.border}`,
              background: opt.recommended ? TOKENS.forest : TOKENS.bg,
              color: opt.recommended ? TOKENS.bg : TOKENS.ink,
              opacity: busy ? 0.6 : 1,
            }}>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{opt.recommended ? '★ ' : ''}{opt.label}</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3, lineHeight: 1.45 }}>{opt.consequence}</div>
            </button>
          ))}
        </div>

        {err && <div style={{ fontSize: 12, color: 'var(--status-red)', marginTop: 10 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 11 }}>
          <a href={q.link} style={{ color: TOKENS.text2 }}>read full context →</a>
          {remaining.length > 1 && (
            <button disabled={busy} onClick={() => setIdx((idx + 1) % remaining.length)}
              style={{ background: 'none', border: 'none', color: TOKENS.text2, cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>
              skip for now →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
