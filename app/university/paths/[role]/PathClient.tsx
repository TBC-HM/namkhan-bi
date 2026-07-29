'use client';
// app/university/paths/[role]/PathClient.tsx
// TBC University · Learn layer client: ordered checklist with per-user
// completion, inline quiz (graded server-side — answers never ship to the
// client), and the completion certificate on certificate paths (Hotel Math).
// Retaking a quiz keeps the best score (fn_university_quiz_submit contract).

import { useCallback, useEffect, useMemo, useState } from 'react';

const INK = '#1B1B1B';
const INK_SOFT = '#5A5A5A';
const HAIR = '#E6DFCC';
const GREEN = '#084838';
const GOLD = '#B48A3A';
const RED = '#B03826';
const WARM = '#F5F0E1';

type PathRow = {
  slug: string; title: string; description: string; certificate: boolean;
};
type ItemRow = {
  id: number; path_slug: string; sort_order: number; item_type: 'article' | 'quiz';
  article_slug: string | null; title: string | null; article_module: string | null;
  article_type: string | null; purpose: string | null;
  quiz_questions: { q: string; options: string[] }[] | null; pass_score: number | null;
};
type ProgressRow = { item_id: number; quiz_score: number | null; quiz_total: number | null; completed_at: string };
type QuizResult = { ok: boolean; score?: number; total?: number; passed?: boolean; pass_score?: number; correct?: number[]; error?: string };

export default function PathClient({ pathSlug }: { pathSlug: string }) {
  const [path, setPath] = useState<PathRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [progress, setProgress] = useState<Map<number, ProgressRow>>(new Map());
  const [email, setEmail] = useState<string>('guest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [quizOpen, setQuizOpen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [quizResult, setQuizResult] = useState<Record<number, QuizResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/university/progress?path=${encodeURIComponent(pathSlug)}`);
      const j = await r.json();
      if (!j.ok) { setLoadError(j.error ?? 'load failed'); return; }
      setPath(j.path as PathRow);
      setItems((j.items as ItemRow[]) ?? []);
      setEmail(j.email ?? 'guest');
      const m = new Map<number, ProgressRow>();
      for (const p of (j.progress as ProgressRow[]) ?? []) m.set(p.item_id, p);
      setProgress(m);
      setLoadError(null);
    } catch {
      setLoadError('Network error — reload the page.');
    } finally {
      setLoading(false);
    }
  }, [pathSlug]);

  useEffect(() => { load(); }, [load]);

  const markDone = async (itemId: number) => {
    if (busyItem) return;
    setBusyItem(itemId);
    try {
      const r = await fetch('/api/university/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', item_id: itemId }),
      });
      const j = await r.json();
      if (j.ok) {
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(itemId, { item_id: itemId, quiz_score: null, quiz_total: null, completed_at: new Date().toISOString() });
          return next;
        });
      }
    } catch { /* best-effort */ } finally { setBusyItem(null); }
  };

  const submitQuiz = async (item: ItemRow) => {
    if (busyItem) return;
    const qn = item.quiz_questions?.length ?? 0;
    const a = answers[item.id] ?? [];
    if (a.filter((x) => x !== undefined).length < qn) return;
    setBusyItem(item.id);
    try {
      const r = await fetch('/api/university/progress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'quiz', item_id: item.id, answers: a }),
      });
      const j = (await r.json()) as QuizResult;
      setQuizResult((prev) => ({ ...prev, [item.id]: j }));
      if (j.ok) {
        setProgress((prev) => {
          const next = new Map(prev);
          next.set(item.id, { item_id: item.id, quiz_score: j.score ?? 0, quiz_total: j.total ?? 0, completed_at: new Date().toISOString() });
          return next;
        });
      }
    } catch { /* best-effort */ } finally { setBusyItem(null); }
  };

  const { doneCount, allDone, quizzesPassed } = useMemo(() => {
    let d = 0; let qp = true;
    for (const it of items) {
      const p = progress.get(it.id);
      if (p) d += 1;
      if (it.item_type === 'quiz') {
        const need = it.pass_score ?? 1;
        if (!p || (p.quiz_score ?? 0) < need) qp = false;
      }
    }
    return { doneCount: d, allDone: items.length > 0 && d === items.length, quizzesPassed: qp };
  }, [items, progress]);

  if (loading) return <div style={{ marginTop: 24, fontSize: 14, color: INK_SOFT }}>Loading the path…</div>;
  if (loadError || !path) {
    return (
      <div style={{ marginTop: 24, border: `1.5px dashed ${HAIR}`, borderRadius: 8, background: WARM, padding: '26px 22px', textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: INK }}>This path could not be loaded.</div>
        <div style={{ marginTop: 6, fontSize: 13.5, color: INK_SOFT }}>{loadError ?? 'Unknown path.'}</div>
        <a href="/university/paths" style={{ display: 'inline-block', marginTop: 12, fontSize: 13.5, fontWeight: 600, color: GREEN, textDecoration: 'none' }}>← All learning paths</a>
      </div>
    );
  }

  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;
  const earned = path.certificate && allDone && quizzesPassed;

  return (
    <div>
      <header style={{ margin: '12px 0 6px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: INK }}>{path.title}</h1>
        <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: INK_SOFT }}>{path.description}</p>
      </header>

      <div style={{ margin: '14px 0 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK_SOFT, marginBottom: 4 }}>
          <span>{doneCount} of {items.length} steps done</span>
          <span style={{ fontWeight: 600, color: pct === 100 ? GREEN : INK_SOFT }}>{pct}%</span>
        </div>
        <div style={{ height: 7, borderRadius: 4, background: WARM, overflow: 'hidden', border: `1px solid ${HAIR}` }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? GREEN : GOLD }} />
        </div>
      </div>

      {earned && (
        <div style={{
          margin: '0 0 18px', border: `2px solid ${GOLD}`, borderRadius: 10, background: '#FFFDF6',
          padding: '22px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 30, lineHeight: 1 }} aria-hidden>🎓</div>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: GOLD }}>
            Certificate of completion
          </div>
          <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color: INK }}>{path.title}</div>
          <div style={{ marginTop: 4, fontSize: 13.5, color: INK_SOFT }}>
            Completed by <strong style={{ color: INK }}>{email}</strong> · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: INK_SOFT }}>All {items.length} steps finished, quiz passed. Show this to your supervisor — their dashboard has it too.</div>
        </div>
      )}

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, idx) => {
          const p = progress.get(it.id);
          const isDone = !!p && (it.item_type !== 'quiz' || (p.quiz_score ?? 0) >= (it.pass_score ?? 1));
          const res = quizResult[it.id];
          return (
            <li key={it.id} style={{ background: '#FFFFFF', border: `1px solid ${isDone ? GREEN : HAIR}`, borderRadius: 8, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden style={{
                  width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700,
                  background: isDone ? GREEN : WARM, color: isDone ? '#FFFFFF' : INK_SOFT,
                  border: `1px solid ${isDone ? GREEN : HAIR}`,
                }}>
                  {isDone ? '✓' : idx + 1}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {it.item_type === 'article' && it.article_slug && it.article_module ? (
                    <a href={it.article_module === 'kpis' && it.article_slug.startsWith('kpi-')
                        ? `/university/kpi/${it.article_slug.slice(4)}`
                        : `/university/${it.article_module}/${it.article_slug}`}
                       style={{ fontSize: 14.5, fontWeight: 600, color: GREEN, textDecoration: 'none' }}>
                      {it.title ?? it.article_slug}
                    </a>
                  ) : (
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: INK }}>
                      {it.title ?? 'Quiz'}{it.item_type === 'quiz' && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 3, padding: '1px 5px' }}>QUIZ</span>}
                    </span>
                  )}
                  {it.purpose && <div style={{ fontSize: 12, color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.purpose}</div>}
                </div>
                {it.item_type === 'article' && !isDone && (
                  <button type="button" onClick={() => markDone(it.id)} disabled={busyItem === it.id} style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
                    border: `1px solid ${GREEN}`, background: '#FFFFFF', color: GREEN, fontFamily: 'inherit', flex: 'none',
                  }}>
                    Mark done
                  </button>
                )}
                {it.item_type === 'quiz' && (
                  <button type="button" onClick={() => setQuizOpen(quizOpen === it.id ? null : it.id)} style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 5, cursor: 'pointer',
                    border: `1px solid ${isDone ? GREEN : GOLD}`, background: '#FFFFFF', color: isDone ? GREEN : GOLD, fontFamily: 'inherit', flex: 'none',
                  }}>
                    {isDone ? `Passed ${p?.quiz_score}/${p?.quiz_total}` : quizOpen === it.id ? 'Hide quiz' : p ? `Retry (best ${p.quiz_score}/${p.quiz_total})` : 'Take the quiz'}
                  </button>
                )}
              </div>

              {it.item_type === 'quiz' && quizOpen === it.id && Array.isArray(it.quiz_questions) && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${HAIR}` }}>
                  {it.quiz_questions.map((q, qi) => {
                    const chosen = answers[it.id]?.[qi];
                    const graded = res?.ok && Array.isArray(res.correct);
                    return (
                      <div key={qi} style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: INK, marginBottom: 6 }}>{qi + 1}. {q.q}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {q.options.map((opt, oi) => {
                            const isChosen = chosen === oi;
                            const isRight = graded && res!.correct![qi] === oi;
                            const wrongChoice = graded && isChosen && !isRight;
                            return (
                              <button key={oi} type="button" onClick={() => {
                                if (graded) return;
                                setAnswers((prev) => {
                                  const arr = [...(prev[it.id] ?? [])];
                                  arr[qi] = oi;
                                  return { ...prev, [it.id]: arr };
                                });
                              }} style={{
                                textAlign: 'left', fontSize: 13, padding: '7px 10px', borderRadius: 5, cursor: graded ? 'default' : 'pointer',
                                fontFamily: 'inherit', lineHeight: 1.5,
                                border: `1px solid ${isRight && graded ? GREEN : wrongChoice ? RED : isChosen ? GOLD : HAIR}`,
                                background: isRight && graded ? '#EEF4EF' : wrongChoice ? '#FAEDEA' : isChosen ? '#FBF3E2' : '#FFFFFF',
                                color: INK,
                              }}>
                                {opt}{graded && isRight ? ' ✓' : ''}{wrongChoice ? ' ✗' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {!res?.ok ? (
                    <button type="button" onClick={() => submitQuiz(it)}
                      disabled={busyItem === it.id || (answers[it.id]?.filter((x) => x !== undefined).length ?? 0) < it.quiz_questions.length}
                      style={{
                        fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 5, border: 'none',
                        background: GREEN, color: '#FFFFFF', cursor: 'pointer', fontFamily: 'inherit',
                        opacity: (answers[it.id]?.filter((x) => x !== undefined).length ?? 0) < it.quiz_questions.length ? 0.5 : 1,
                      }}>
                      {busyItem === it.id ? 'Checking…' : 'Check my answers'}
                    </button>
                  ) : (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: res.passed ? GREEN : RED }}>
                      {res.passed ? `Passed — ${res.score}/${res.total} correct.` : `${res.score}/${res.total} correct — you need ${res.pass_score}. Review the marked answers, then retry: `}
                      {!res.passed && (
                        <button type="button" onClick={() => {
                          setQuizResult((prev) => ({ ...prev, [it.id]: { ok: false } }));
                          setAnswers((prev) => ({ ...prev, [it.id]: [] }));
                        }} style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 4, padding: '4px 10px', borderRadius: 4, border: `1px solid ${GOLD}`, background: '#FFFFFF', color: GOLD, cursor: 'pointer', fontFamily: 'inherit' }}>
                          Try again
                        </button>
                      )}
                    </div>
                  )}
                  {res && !res.ok && res.error && <div style={{ marginTop: 6, fontSize: 12.5, color: RED }}>{res.error}</div>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
