'use client';
// Level-2 tenant module intake — client surface.
// Spec: cockpit.prototype_specs slug='intake-v2-single-surface'. ADR-260/262.
//
// HARD RULES — do not "improve" these away:
//  1. NO FORM. One description box. The 16 items are an extraction target.
//  2. BANNED in tenant copy: non-goal, acceptance criteria, KPI, bridge view, schema,
//     given/when/then. The SQL jargon guard rejects questions containing them.
//  3. Completeness is DERIVED by fn_intake_completeness. Never computed here.
//  4. Approve is gated in SQL by fn_intake_approve. The disabled button is a courtesy,
//     not the control — the function refuses below 100% regardless of the UI.
//  5. Dismiss requires a reason and deletes nothing.
//  6. Goals are TENANT-scoped. Holding goals must never reach a GM.
//
// v3 2026-08-07 — §10.6 gaps 1-4 closed: property selector, tenant goals, open
// interview question with answer path, real dismiss/revive, real approve.

import { useState } from 'react';

export type GoalOption = { goal_id: number; property_id: number; title: string; level: number };
export type PropertyOption = { property_id: number; name: string };
export type OpenQuestion = {
  field?: string; question?: string; context?: string; options?: string[];
  free_text?: string; rephrase?: string;
};
export type IntakeRow = {
  slug: string; title: string; status: string; property_scope: string | null;
  tenant_done: number; tbc_done: number; pct: number; ready: boolean; idle_days: number;
  open_question: OpenQuestion | null; dismissed_reason: string | null;
};
type Kpis = { open: number; waiting: number; ready: number; idle: number };

const INK = '#1B1B1B', SOFT = '#5A5A5A', HAIR = '#E6DFCC', PAPER = '#FFFFFF';
const PRIMARY = '#1F3A2E', TERRA = '#B8542A', GREEN = '#2E7D32', GREY = '#8A8A8A';

const card = { background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 8, padding: 20, marginBottom: 16 };
const btn = (bg: string, fg: string, on: boolean) => ({
  background: bg, color: fg, border: `1px solid ${bg}`, borderRadius: 6, padding: '9px 16px',
  fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
  cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4,
});
const input = { width: '100%', padding: '9px 12px', border: `1px solid ${HAIR}`, borderRadius: 6, fontSize: 13, background: '#F4EFE2', color: INK };
const lbl = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: SOFT, fontWeight: 700 };

function Tile({ label, value, action, tone }: { label: string; value: number; action: string; tone: string }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 8, padding: '12px 16px', minHeight: 88, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 11, color: SOFT, lineHeight: 1.3 }}>{label}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone, flex: '0 0 8px', marginTop: 4 }} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: PRIMARY }}>{value}</div>
        <div style={{ fontSize: 10.5, color: SOFT, marginTop: 4 }}>{action}</div>
      </div>
    </div>
  );
}

function Track({ label, done }: { label: string; done: number }) {
  const ok = done === 8;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SOFT, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{done}/8</span>
      </div>
      <div style={{ height: 6, background: '#F4EFE2', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((done / 8) * 100)}%`, background: ok ? GREEN : TERRA, borderRadius: 3, transition: 'width .25s' }} />
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'module-request';
}

export default function ModuleIntakeClient({ goals, properties, intakes, kpis, staleDays }: {
  goals: GoalOption[]; properties: PropertyOption[]; intakes: IntakeRow[]; kpis: Kpis; staleDays: number;
}) {
  const [propertyId, setPropertyId] = useState<number | ''>(properties[0]?.property_id ?? '');
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [dismissFor, setDismissFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const myGoals = goals.filter(g => g.property_id === propertyId);

  async function call(payload: Record<string, unknown>, onOk?: (r: Record<string, unknown>) => void) {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/specs/intake', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const r = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok || r.ok === false) throw new Error((r.error as string) || `Request failed (${res.status}).`);
      if (onOk) onOk(r); else window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Nothing was changed.');
    } finally { setBusy(false); }
  }

  async function start() {
    if (!description.trim() || !goalId) return;
    setBusy(true); setError(null);
    try {
      // Wrap the plain description as an .md File — the route reads MULTIPART form
      // data (file + goal_id), not JSON. Reuses the md-intake-v1 evaluator.
      const title = description.trim().split('\n')[0].slice(0, 80);
      const body = `# ${title}\n\n_Level-2 tenant intake · described in the owner's own words._\n\n${description.trim()}\n`;
      const file = new File([body], `level2-${slugify(title)}.md`, { type: 'text/markdown' });
      const fd = new FormData();
      fd.append('file', file);
      fd.append('goal_id', String(goalId));
      const res = await fetch('/api/specs/upload-md', { method: 'POST', body: fd });
      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j?.error ?? ''; } catch { /* non-JSON */ }
        throw new Error(detail || `We could not start this (${res.status}). Nothing was saved.`);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Nothing was saved.');
    } finally { setBusy(false); }
  }

  const live = intakes.filter(i => i.status !== 'abandoned');
  const dropped = intakes.filter(i => i.status === 'abandoned');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12, marginBottom: 24 }}>
        <Tile label="Open" value={kpis.open} action="in progress now" tone={GREY} />
        <Tile label="Waiting on you" value={kpis.waiting} action="answer to continue" tone={kpis.waiting ? TERRA : GREY} />
        <Tile label="Ready to approve" value={kpis.ready} action="approve to start the build" tone={kpis.ready ? GREEN : GREY} />
        <Tile label={`Untouched ${staleDays}+ days`} value={kpis.idle} action="drop it or pick it back up" tone={kpis.idle ? TERRA : GREY} />
      </div>

      {error && (
        <div style={{ ...card, borderColor: TERRA, borderLeft: `3px solid ${TERRA}` }}>
          <div style={{ fontSize: 13, color: INK }}>{error}</div>
          <button onClick={() => setError(null)} style={{ ...btn(PAPER, PRIMARY, true), marginTop: 12 }}>Try again</button>
        </div>
      )}
      {note && (
        <div style={{ ...card, borderLeft: `3px solid ${GREEN}` }}>
          <div style={{ fontSize: 13, color: INK }}>{note}</div>
          <button onClick={() => { setNote(null); window.location.reload(); }} style={{ ...btn(PAPER, PRIMARY, true), marginTop: 12 }}>OK</button>
        </div>
      )}

      <div style={card}>
        <div style={{ ...lbl, marginBottom: 6 }}>Which property is this for?</div>
        <select value={propertyId} onChange={e => { setPropertyId(Number(e.target.value)); setGoalId(''); }}
                style={{ ...input, background: PAPER, maxWidth: 360, marginBottom: 16 }}>
          {properties.map(p => <option key={p.property_id} value={p.property_id}>{p.name}</option>)}
        </select>

        <div style={{ ...lbl, marginBottom: 10 }}>What do you want to be able to do?</div>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
          placeholder="For example: I want to see which rooms are out of service and tell housekeeping to fix them before check-in."
          style={{ ...input, fontFamily: 'inherit', resize: 'vertical' }} />
        <div style={{ fontSize: 11.5, color: SOFT, margin: '8px 0 14px' }}>
          Plain words are enough. We read it, work out what we still need, and ask you the rest.
        </div>

        <div style={{ ...lbl, marginBottom: 6 }}>Which of your goals does this serve?</div>
        <select value={goalId} onChange={e => setGoalId(e.target.value ? Number(e.target.value) : '')}
                style={{ ...input, background: PAPER, maxWidth: 560 }}>
          <option value="">— pick the goal this helps —</option>
          {myGoals.map(g => <option key={g.goal_id} value={g.goal_id}>{g.title}</option>)}
        </select>
        {myGoals.length === 0 && (
          <div style={{ fontSize: 11.5, color: TERRA, marginTop: 8 }}>
            No goals are set up for this property yet — one is needed before anything can start.
            Ask your TBC contact to add them.
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={start} disabled={busy || !description.trim() || !goalId}
                  style={btn(PRIMARY, '#F4EFE2', !busy && !!description.trim() && !!goalId)}>
            {busy ? 'Reading it…' : 'Start'}
          </button>
          <span style={{ fontSize: 11.5, color: SOFT }}>Nothing is built until you approve it.</span>
        </div>
      </div>

      <div style={{ ...lbl, margin: '28px 0 12px' }}>In progress</div>

      {live.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, color: INK, marginBottom: 6 }}>Nothing in progress yet.</div>
          <div style={{ fontSize: 12.5, color: SOFT }}>Describe what you need in the box above to start your first one.</div>
        </div>
      ) : live.map(i => (
        <div key={i.slug} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: PRIMARY }}>{i.title}</div>
              <div style={{ fontSize: 11.5, color: SOFT, marginTop: 2 }}>
                {i.property_scope ?? 'unscoped'} · untouched {i.idle_days} {i.idle_days === 1 ? 'day' : 'days'}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: i.ready ? GREEN : TERRA }}>
              {i.pct}<span style={{ fontSize: 14 }}>%</span>
            </div>
          </div>

          <Track label="Your part" done={i.tenant_done} />
          <Track label="Our part" done={i.tbc_done} />

          {i.open_question ? (
            <div style={{ background: '#F4EFE2', border: `1px solid ${HAIR}`, borderLeft: `3px solid ${TERRA}`, borderRadius: '0 6px 6px 0', padding: 16, margin: '12px 0' }}>
              <div style={{ ...lbl, color: TERRA, marginBottom: 8 }}>We need one thing from you</div>
              {i.open_question.context && (
                <div style={{ fontSize: 12, color: SOFT, marginBottom: 8 }}>{i.open_question.context}</div>
              )}
              <div style={{ fontSize: 14, fontWeight: 600, color: INK, marginBottom: 12 }}>{i.open_question.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {(i.open_question.options ?? []).map((o, n) => (
                  <button key={n} onClick={() => call({ action: 'answer', slug: i.slug, answer: o })}
                          disabled={busy}
                          style={{ ...btn(PAPER, PRIMARY, !busy), textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontSize: 13, textAlign: 'left', borderColor: HAIR }}>
                    {o}
                  </button>
                ))}
              </div>
              <input value={answers[i.slug] ?? ''} onChange={e => setAnswers({ ...answers, [i.slug]: e.target.value })}
                     placeholder={i.open_question.free_text ?? 'None of these — let me say it my own way'}
                     style={input} />
              <div style={{ marginTop: 10 }}>
                <button onClick={() => call({ action: 'answer', slug: i.slug, answer: answers[i.slug] })}
                        disabled={busy || !(answers[i.slug] ?? '').trim()}
                        style={btn(TERRA, PAPER, !busy && !!(answers[i.slug] ?? '').trim())}>Send my answer</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: i.ready ? GREEN : TERRA, fontWeight: 600, margin: '10px 0 14px' }}>
              {i.ready ? 'Ready — approve it and we start building.' : 'Not ready yet. Nothing starts until this is complete.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
            <button disabled={!i.ready || busy}
                    onClick={() => call({ action: 'approve', slug: i.slug }, r =>
                      setNote(`Approved. ${(r.note as string) ?? ''} Brief: ${(r.brief_slug as string) ?? ''}`))}
                    style={btn(PRIMARY, '#F4EFE2', i.ready && !busy)}>Approve &amp; build</button>
            <button onClick={() => setDismissFor(dismissFor === i.slug ? null : i.slug)} disabled={busy}
                    style={{ ...btn(PAPER, SOFT, !busy), borderColor: HAIR }}>Drop it</button>
          </div>

          {dismissFor === i.slug && (
            <div style={{ borderTop: `1px solid ${HAIR}`, marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 8 }}>
                Why are you dropping it? One line — so nobody proposes the same thing again in three months.
              </div>
              <input value={reason} onChange={e => setReason(e.target.value)}
                     placeholder="e.g. we solved it with a whiteboard, not worth building" style={input} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => call({ action: 'dismiss', slug: i.slug, reason })}
                        disabled={busy || !reason.trim()}
                        style={btn(TERRA, PAPER, !busy && !!reason.trim())}>Confirm</button>
                <button onClick={() => { setDismissFor(null); setReason(''); }} style={btn(PAPER, PRIMARY, true)}>Keep it</button>
              </div>
              <div style={{ fontSize: 11, color: SOFT, marginTop: 10 }}>
                Nothing is deleted. You can pick it back up later exactly where it stopped.
              </div>
            </div>
          )}
        </div>
      ))}

      {dropped.length > 0 && (
        <>
          <div style={{ ...lbl, margin: '28px 0 12px' }}>Dropped</div>
          {dropped.map(i => (
            <div key={i.slug} style={{ ...card, opacity: 0.7 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: SOFT }}>{i.title}</div>
              <div style={{ fontSize: 12.5, color: SOFT, margin: '6px 0 12px' }}>
                {i.dismissed_reason ?? 'no reason recorded'}
              </div>
              <button onClick={() => call({ action: 'revive', slug: i.slug })} disabled={busy}
                      style={btn(PAPER, PRIMARY, !busy)}>Pick it back up</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
