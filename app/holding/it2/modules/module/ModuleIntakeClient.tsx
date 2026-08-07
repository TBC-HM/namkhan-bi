'use client';
// Level-2 tenant module intake — client surface.
// Spec: cockpit.prototype_specs slug='intake-v2-single-surface' (passed). Brief: intake-l2-s4-page.
//
// HARD RULES FROM THE SPEC — do not "improve" these away:
//  1. NO FORM. One description box. The 16 completeness items are an extraction
//     target, not a questionnaire — a hotel GM cannot fill in 8 structured fields.
//  2. BANNED in tenant-facing copy: non-goal, acceptance criteria, KPI, bridge view,
//     schema, given/when/then.
//  3. Completeness is DERIVED by public.fn_intake_completeness. Never computed here.
//  4. Approve is disabled until BOTH tracks are complete.
//  5. Dismiss requires a reason and deletes nothing.
//  6. All four states render: empty, loading, error, no-permission.
//
// 2026-08-07 FIX: /api/specs/upload-md takes MULTIPART FORM DATA (file + goal_id),
// not JSON. The first version posted JSON, so req.formData() threw and every Start
// returned 500. Never set Content-Type on a FormData fetch — the browser must set
// the multipart boundary itself.

import { useState } from 'react';

export type GoalOption = { goal_id: number; slug: string; title: string; level: number };
export type IntakeRow = {
  slug: string; title: string; status: string; property_scope: string | null;
  tenant_done: number; tbc_done: number; pct: number; ready: boolean; idle_days: number;
};
type Kpis = { open: number; waiting: number; ready: number; idle: number };

const INK = '#1B1B1B', SOFT = '#5A5A5A', HAIR = '#E6DFCC', PAPER = '#FFFFFF';
const PRIMARY = '#1F3A2E', TERRA = '#B8542A', GREEN = '#2E7D32', GREY = '#8A8A8A';

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
  const pct = Math.round((done / 8) * 100);
  const ok = done === 8;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: SOFT, marginBottom: 4 }}>
        <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{done}/8</span>
      </div>
      <div style={{ height: 6, background: '#F4EFE2', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: ok ? GREEN : TERRA, borderRadius: 3, transition: 'width .25s' }} />
      </div>
    </div>
  );
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'module-request';
}

export default function ModuleIntakeClient({ goals, intakes, kpis, staleDays }: {
  goals: GoalOption[]; intakes: IntakeRow[]; kpis: Kpis; staleDays: number;
}) {
  const [description, setDescription] = useState('');
  const [goalId, setGoalId] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissFor, setDismissFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState<string | null>(null);

  async function start() {
    if (!description.trim() || !goalId) return;
    setBusy(true); setError(null);
    try {
      // The route reads multipart form data: a real file + goal_id. Wrap the plain
      // description as an .md file so it lands in dms as verbatim canon, exactly
      // like an uploaded owner MD. Reuses the md-intake-v1 evaluator — no second path.
      const title = description.trim().split('\n')[0].slice(0, 80);
      const body = `# ${title}\n\n_Level-2 tenant intake · described in the owner's own words._\n\n${description.trim()}\n`;
      const file = new File([body], `level2-${slugify(title)}.md`, { type: 'text/markdown' });

      const fd = new FormData();
      fd.append('file', file);
      fd.append('goal_id', String(goalId));
      // No Content-Type header — the browser sets the multipart boundary.
      const res = await fetch('/api/specs/upload-md', { method: 'POST', body: fd });

      if (!res.ok) {
        let detail = '';
        try { const j = await res.json(); detail = j?.error ?? ''; } catch { /* non-JSON body */ }
        throw new Error(detail || `We could not start this (${res.status}). Nothing was saved.`);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Nothing was saved.');
    } finally { setBusy(false); }
  }

  // Dismiss is deliberately NOT wired to a network call: /api/specs/dismiss does not
  // exist. A button that 404s is a false control — the exact pattern this pipeline
  // exists to stop. The reason is captured and surfaced until the route lands.
  function requestDismiss(slug: string) {
    if (!reason.trim()) return;
    setNote(`Noted for "${slug}": ${reason} — tell PBS; dropping is not automatic yet.`);
    setDismissFor(null); setReason('');
  }

  const card = { background: PAPER, border: `1px solid ${HAIR}`, borderRadius: 8, padding: 20, marginBottom: 16 };
  const btn = (bg: string, fg: string, on: boolean) => ({
    background: bg, color: fg, border: `1px solid ${bg}`, borderRadius: 6, padding: '9px 16px',
    fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    cursor: on ? 'pointer' : 'not-allowed', opacity: on ? 1 : 0.4,
  });

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
        <div style={{ ...card, borderLeft: `3px solid ${GREY}` }}>
          <div style={{ fontSize: 13, color: INK }}>{note}</div>
          <button onClick={() => setNote(null)} style={{ ...btn(PAPER, PRIMARY, true), marginTop: 12 }}>Got it</button>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SOFT, fontWeight: 700, marginBottom: 10 }}>
          What do you want to be able to do?
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={5}
          placeholder="For example: I want to see which rooms are out of service and tell housekeeping to fix them before check-in."
          style={{ width: '100%', padding: '10px 12px', border: `1px solid ${HAIR}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit', background: '#F4EFE2', color: INK, resize: 'vertical' }}
        />
        <div style={{ fontSize: 11.5, color: SOFT, margin: '8px 0 14px' }}>
          Plain words are enough. We read it, work out what we still need, and ask you the rest.
        </div>

        <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SOFT, fontWeight: 700, marginBottom: 6 }}>
          Which of your goals does this serve?
        </div>
        <select
          value={goalId}
          onChange={e => setGoalId(e.target.value ? Number(e.target.value) : '')}
          style={{ width: '100%', maxWidth: 560, padding: '9px 12px', border: `1px solid ${HAIR}`, borderRadius: 6, fontSize: 13, background: PAPER, color: INK }}
        >
          <option value="">— pick the goal this helps —</option>
          {goals.map(g => <option key={g.goal_id} value={g.goal_id}>{g.title}</option>)}
        </select>
        {goals.length === 0 && (
          <div style={{ fontSize: 11.5, color: TERRA, marginTop: 8 }}>
            No goals are set up yet — one is needed before anything can start. Ask your TBC contact to add them.
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

      <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: SOFT, fontWeight: 700, margin: '28px 0 12px' }}>
        In progress
      </div>

      {intakes.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, color: INK, marginBottom: 6 }}>Nothing in progress yet.</div>
          <div style={{ fontSize: 12.5, color: SOFT }}>Describe what you need in the box above to start your first one.</div>
        </div>
      ) : intakes.map(i => (
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

          <div style={{ fontSize: 12, color: i.ready ? GREEN : TERRA, fontWeight: 600, margin: '10px 0 14px' }}>
            {i.ready ? 'Ready — approve it and we start building.' : 'Not ready yet. Nothing starts until this is complete.'}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${HAIR}`, paddingTop: 14 }}>
            <button disabled={!i.ready} style={btn(PRIMARY, '#F4EFE2', i.ready)}>Approve &amp; build</button>
            <button onClick={() => setDismissFor(dismissFor === i.slug ? null : i.slug)}
                    style={{ ...btn(PAPER, SOFT, true), borderColor: HAIR }}>Drop it</button>
          </div>

          {dismissFor === i.slug && (
            <div style={{ borderTop: `1px solid ${HAIR}`, marginTop: 14, paddingTop: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: INK, marginBottom: 8 }}>
                Why are you dropping it? One line — so nobody proposes the same thing again in three months.
              </div>
              <input
                value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g. we solved it with a whiteboard, not worth building"
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${HAIR}`, borderRadius: 6, fontSize: 13, background: '#F4EFE2', color: INK }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => requestDismiss(i.slug)} disabled={!reason.trim()}
                        style={btn(TERRA, PAPER, !!reason.trim())}>Confirm</button>
                <button onClick={() => { setDismissFor(null); setReason(''); }} style={btn(PAPER, PRIMARY, true)}>Keep it</button>
              </div>
              <div style={{ fontSize: 11, color: SOFT, marginTop: 10 }}>
                Nothing is deleted. You can pick it back up later exactly where it stopped.
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
