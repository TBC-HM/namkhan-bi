'use client';
// app/holding/it2/questions/QuestionWalkthrough.tsx
// PBS 2026-07-27: "answer question walkthrough, best even with multiple choice —
// do I need to find the question by reading a huge text? must be easier."
// One open question at a time, big option buttons, answer → next card.
// Bug #107: answered-state shows recorded choice + consequence + where deliverable arrives.

import { useState } from 'react';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export interface OpenQ {
  kind: 'brief' | 'bug' | 'law' | 'finding' | 'comment';
  ref: string;              // brief slug, bug id, finding id, or law-proposal id
  title: string;            // human title
  question: string;
  options: { label: string; consequence?: string; recommended?: boolean }[];
  asked_by?: string;
  link: string;             // deep link to the full brief/bug/finding
  /** governance.owner_questions id — present for all non-law kinds
   *  (owner-answer-path-consolidation-v1: ONE contract, ONE route). */
  qid?: number;
}

export default function QuestionWalkthrough({ questions }: { questions: OpenQ[] }) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({}); // ref -> chosen label
  // Bug #107: track the just-answered choice so we can show the promise-gap panel
  const [answeredChoice, setAnsweredChoice] = useState<{ label: string; consequence: string } | null>(null);
  // law 735: free text is always an escape hatch
  const [free, setFree] = useState('');

  const remaining = questions.filter((q) => !done[q.kind + q.ref]);
  const current = remaining[Math.min(idx, Math.max(remaining.length - 1, 0))];

  // owner-answer-path-consolidation-v1: every non-law kind answers through THE
  // single owner route (/api/owner/answer → fn_owner_question_answer), option
  // click OR free text (law 735). Laws keep their own decision contract.
  async function answer(q: OpenQ, ans: { choice?: string; free_text?: string; consequence?: string }) {
    setBusy(true); setErr(null);
    const display = ans.choice ?? ans.free_text ?? '';
    try {
      let url: string;
      let body: Record<string, unknown>;
      if (q.kind === 'law') {
        url = '/api/cockpit/laws/answer';
        body = { proposal_id: Number(q.ref), choice: display };
      } else {
        url = '/api/owner/answer';
        body = q.qid
          ? { question_id: q.qid, choice: ans.choice, free_text: ans.free_text }
          : { asker_kind: q.kind, ref_id: q.ref, choice: ans.choice, free_text: ans.free_text };
      }
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error ?? `failed (${r.status})`); return; }
      setDone((d) => ({ ...d, [q.kind + q.ref]: display }));
      setFree('');
      // Bug #107: show answered panel instead of silently advancing
      setAnsweredChoice({
        label: display,
        consequence: ans.consequence ?? 'The asking agent receives your answer verbatim and continues with it.',
      });
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
          {q.kind === 'brief' ? 'build brief' : q.kind === 'law' ? 'operating law'
            : q.kind === 'finding' ? `finding #${q.ref}` : q.kind === 'comment' ? 'comment thread'
            : `bug #${q.ref}`} · {q.title}
          {q.asked_by ? ` · asked by ${q.asked_by}` : ''}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, color: TOKENS.ink, marginBottom: 14 }}>
          {q.question}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opts.map((opt) => (
            <button key={opt.label} disabled={busy}
              onClick={() => answer(q, { choice: opt.label, consequence: opt.consequence })} style={{
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

        {/* law 735: free-text answer, always available (laws too — recorded as the decision) */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${TOKENS.border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: TOKENS.text2, marginBottom: 4 }}>
            Or answer in your own words
          </div>
          <textarea
            value={free}
            onChange={(e) => setFree(e.target.value)}
            placeholder="Type your answer, a correction, or a question back to the agent…"
            rows={2}
            style={{ width: '100%', fontSize: 12.5, padding: '8px 10px', borderRadius: 6,
              border: `1px solid ${TOKENS.border}`, background: TOKENS.bg, color: TOKENS.ink,
              fontFamily: 'inherit', resize: 'vertical' }}
          />
          <button
            disabled={busy || free.trim().length < 3}
            onClick={() => answer(q, { free_text: free.trim() })}
            style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, padding: '7px 16px', borderRadius: 6,
              cursor: busy || free.trim().length < 3 ? 'not-allowed' : 'pointer',
              border: `1px solid ${TOKENS.forest}`,
              background: free.trim().length < 3 ? TOKENS.bg : TOKENS.forest,
              color: free.trim().length < 3 ? TOKENS.text2 : '#fff', opacity: busy ? 0.6 : 1 }}>
            Send my answer →
          </button>
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
