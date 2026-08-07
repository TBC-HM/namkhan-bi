// app/holding/it2/fleet/loops/page.tsx
// Loops & Chains — loops-audit-v1 slice 2 (2026-08-07, handover v55).
//
// PBS 2026-08-07: "in the UI a Loop is a cronjob? group them by department,
// click a row and I see the diagram and the detail - I cant scroll 140 loops."
//
// A cron job is a TRIGGER, not a loop. One pipeline is several cron jobs:
// enqueue -> send -> quality-sweep IS the newsletter loop. So this page lists
// the 19 real pipelines, filtered by department (same taxonomy as Build ->
// Specs), each row collapsed to one line and expanding to its diagram +
// exit condition + member jobs. Nobody scrolls 140 rows here — that is what
// the register at /fleet/cron is for.
//
// Read-only by design: the spec is the source of truth (decision D2).
// Reads public.v_cron_register (bridge view, claude_md 0.5).

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { ChainDiagram, LoopDiagram, HybridDiagram } from '../_lib/Diagrams';
import { PIPELINES, SHAPE_LABEL, DEPTS, deptOf, type Pipeline, type Dept } from '../_lib/pipelines';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  job_class: string;
  ok_7d: number;
  fail_7d: number;
  last_run: string | null;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  handled: boolean;
};

const FAILURES = [
  { n: 1, where: 'Chain', title: 'Handoff contract undefined', detail: 'Step A returns prose, step B expects JSON. Symptom: B appears to invent fields. Fix: enforce a schema on every step output.' },
  { n: 2, where: 'Chain', title: 'Silent null pass-through', detail: 'A found 0 rows, B mapped nothing, C wrote empty. Symptom: the page shows zero and no error exists anywhere. Fix: assert non-empty between steps.' },
  { n: 3, where: 'Chain', title: 'No transaction boundary', detail: 'C fails, B writes remain. Fix: stage then commit, or make every step idempotent.' },
  { n: 4, where: 'Loop', title: 'Unverifiable success test', detail: '"Report is good" cannot be evaluated, so the loop runs to its cap every time. Fix: exit on a SQL count, a diff, a status code.' },
  { n: 5, where: 'Loop', title: 'Dedupe against the wrong set', detail: 'Comparing against confirmed instead of seen makes rejected items reappear every round. State also grows each pass until cost blows up.' },
  { n: 6, where: 'Loop', title: 'Budget is the only exit that fires', detail: 'If the ceiling is what usually stops it, there is no working success test. This is the spend-runaway shape.' },
  { n: 7, where: 'Hybrid', title: 'Exit reason not propagated', detail: 'The chain continues regardless of WHY the loop stopped. Fix: gate the next step on exit_reason = success.' },
];

const XTASKS = [
  { id: 'X1', task: 'Wrap every cron command in a logger writing exit_reason + OUTCOME status (not job status)', covers: '135 jobs', note: 'The whole game. Every dead pipeline was invisible for a week for this one reason.' },
  { id: 'X2', task: 'Add max_attempts + dead-letter status to the 8 queue tables', covers: 'all retry loops', note: 'None has a max today — a permanently failing row retries forever.' },
  { id: 'X3', task: 'Add a drain-rate assertion to the batch loops', covers: 'the silent-backlog class', note: 'Health for a cron-paced loop is "is the queue shrinking", not "did it finish".' },
  { id: 'X4', task: 'Alarm on OUTCOME staleness, not job success', covers: 'whole platform', note: 'Three watchers ran green through six dead jobs.' },
  { id: 'X5', task: 'Move 2 plaintext webhook secrets into vault', covers: '2 jobs', note: 'Rotate at the Vercel end in the same pass.' },
  { id: 'X6', task: 'Drop the 2 stale guest.campaigns_bak_* tables', covers: 'housekeeping', note: 'Trivial.' },
];

const card: React.CSSProperties = {
  background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`,
  borderRadius: 8, padding: '14px 16px',
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: TOKENS.text2,
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.text2,
  borderBottom: `1px solid ${TOKENS.border}`,
};
const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: 12.5, color: TOKENS.ink,
  borderBottom: `1px solid ${TOKENS.border}`, verticalAlign: 'top',
};

async function getRows(): Promise<Row[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_cron_register')
    .select('jobid,jobname,schedule,active,job_class,ok_7d,fail_7d,last_run,priority,handled');
  if (error) {
    console.error('[loops]', error.message);
    return [];
  }
  return (data ?? []) as Row[];
}

type Health = { state: 'dead' | 'degraded' | 'partial' | 'ok'; colour: string; label: string };

function healthOf(mine: Row[]): Health {
  const nDead = mine.filter((r) => r.priority === 'P1').length;
  const nDeg = mine.filter((r) => r.priority === 'P2').length;
  const nOff = mine.filter((r) => !r.active).length;
  if (nDead > 0) return { state: 'dead', colour: TOKENS.terracotta, label: nDead + ' dead' };
  if (nDeg > 0) return { state: 'degraded', colour: '#B8860B', label: nDeg + ' degraded' };
  if (nOff > 0) return { state: 'partial', colour: '#7A5EA6', label: nOff + ' off' };
  return { state: 'ok', colour: '#1F7A4D', label: 'healthy' };
}

function Diagram({ shape }: { shape: Pipeline['shape'] }) {
  if (shape === 'chain') return <ChainDiagram />;
  if (shape === 'loop') return <LoopDiagram />;
  return <HybridDiagram />;
}

export default async function LoopsAndChainsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rows = await getRows();
  const dept = (typeof searchParams?.dept === 'string' ? searchParams.dept : '') as Dept | '';
  const openKey = typeof searchParams?.open === 'string' ? searchParams.open : '';

  const withRows = PIPELINES.map((p) => {
    const mine = rows.filter((r) => p.members.includes(r.jobname));
    return { p, mine, health: healthOf(mine), dept: deptOf(p.key) };
  });

  const deptCounts = DEPTS.map((d) => ({
    ...d,
    n: withRows.filter((w) => w.dept === d.key).length,
    bad: withRows.filter((w) => w.dept === d.key && (w.health.state === 'dead' || w.health.state === 'degraded')).length,
  })).filter((d) => d.n > 0);

  const shown = dept ? withRows.filter((w) => w.dept === dept) : withRows;
  const rank = { dead: 0, degraded: 1, partial: 2, ok: 3 } as const;
  const ordered = [...shown].sort(
    (a, b) => rank[a.health.state] - rank[b.health.state] || a.p.name.localeCompare(b.p.name),
  );

  const mappedJobs = new Set(PIPELINES.flatMap((p) => p.members));
  const unmapped = rows.filter((r) => !mappedJobs.has(r.jobname)).length;
  const deadPipes = withRows.filter((w) => w.health.state === 'dead').length;
  const activeJobs = rows.filter((r) => r.active).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: TOKENS.ink, margin: '0 0 4px' }}>
          Loops &amp; Chains
        </h1>
        <p style={{ fontSize: 12.5, color: TOKENS.text2, margin: 0, maxWidth: 820, lineHeight: 1.5 }}>
          <strong style={{ color: TOKENS.ink }}>A cron job is a trigger, not a loop.</strong> One
          pipeline is several cron jobs — enqueue, send, quality-sweep <em>is</em> the newsletter
          loop. Pick a department, expand a row for its diagram and detail. The full job-by-job list
          lives in{' '}
          <Link href="/holding/it2/fleet/cron" style={{ color: TOKENS.forest, fontWeight: 600 }}>
            the register
          </Link>
          .
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link
          href="/holding/it2/fleet/loops"
          style={{
            padding: '5px 13px', borderRadius: 5, fontSize: 12, fontWeight: dept ? 400 : 700,
            textDecoration: 'none', border: '1px solid ' + (dept ? TOKENS.border : TOKENS.forest),
            background: dept ? 'transparent' : TOKENS.forest, color: dept ? TOKENS.text2 : '#FFF',
          }}
        >
          All <span style={{ fontFamily: MONO, opacity: 0.8 }}>{withRows.length}</span>
        </Link>
        {deptCounts.map((d) => {
          const on = dept === d.key;
          return (
            <Link
              key={d.key}
              href={'/holding/it2/fleet/loops?dept=' + d.key}
              style={{
                padding: '5px 13px', borderRadius: 5, fontSize: 12, fontWeight: on ? 700 : 400,
                textDecoration: 'none', border: '1px solid ' + (on ? TOKENS.forest : TOKENS.border),
                background: on ? TOKENS.forest : 'transparent', color: on ? '#FFF' : TOKENS.ink,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {d.bad > 0 && <span style={{ width: 6, height: 6, borderRadius: 3, background: TOKENS.terracotta, display: 'inline-block' }} />}
              {d.label}
              <span style={{ fontFamily: MONO, fontSize: 11, opacity: 0.75 }}>{d.n}</span>
            </Link>
          );
        })}
      </div>

      {deadPipes > 0 && (
        <div style={{ ...card, borderLeft: '3px solid ' + TOKENS.terracotta, padding: '10px 14px' }}>
          <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
            <strong>{deadPipes} of {withRows.length} pipelines have a dead job inside them</strong>,
            and <strong style={{ color: TOKENS.terracotta }}>none of the {activeJobs} active jobs</strong>{' '}
            log an outcome. One wrapper fixes the second problem (X1, in the reference section below).
          </span>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {ordered.map((w, i) => (
          <details key={w.p.key} open={openKey === w.p.key} style={{ borderTop: i === 0 ? 'none' : '1px solid ' + TOKENS.border }}>
            <summary
              style={{
                cursor: 'pointer', listStyle: 'none', padding: '11px 14px',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}
            >
              <span style={{ width: 4, height: 26, borderRadius: 2, background: w.health.colour, flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: TOKENS.ink }}>{w.p.name}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, fontFamily: MONO, color: TOKENS.text2, border: '1px solid ' + TOKENS.border, borderRadius: 3, padding: '1px 5px' }}>
                {SHAPE_LABEL[w.p.shape]}
              </span>
              <span style={{ fontSize: 11, color: TOKENS.text3 }}>
                {DEPTS.find((d) => d.key === w.dept)?.label}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: TOKENS.text2 }}>
                  {w.mine.length} job{w.mine.length === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: w.health.colour, minWidth: 68, textAlign: 'right' }}>
                  {w.health.label}
                </span>
              </span>
            </summary>

            <div style={{ padding: '0 14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12.5, color: TOKENS.text2, margin: 0, lineHeight: 1.5, maxWidth: 760 }}>
                {w.p.purpose}
              </p>

              <div style={{ background: '#FBF8F2', border: '1px solid ' + TOKENS.border, borderRadius: 6, padding: '10px 12px' }}>
                <Diagram shape={w.p.shape} />
              </div>

              <div style={{ fontSize: 12, color: TOKENS.text2 }}>
                <span style={{ fontWeight: 700, color: TOKENS.ink }}>Should exit when:</span>{' '}
                {w.p.exitCondition ? (
                  <code style={{ fontFamily: MONO, fontSize: 11.5 }}>{w.p.exitCondition}</code>
                ) : (
                  <em style={{ color: TOKENS.terracotta }}>no exit condition defined</em>
                )}
              </div>

              {w.p.warning && (
                <div style={{ fontSize: 12, color: TOKENS.ink, background: '#FDF6F4', border: '1px solid #E8CFC7', borderRadius: 5, padding: '8px 10px', lineHeight: 1.5 }}>
                  {w.p.warning}
                </div>
              )}

              <div>
                <div style={{ ...lbl, marginBottom: 5 }}>Jobs in this pipeline</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={th}>Job</th>
                        <th style={th}>Cadence</th>
                        <th style={{ ...th, textAlign: 'right' }}>ok / fail 7d</th>
                        <th style={th}>State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.p.members.map((m) => {
                        const r = w.mine.find((x) => x.jobname === m);
                        const c = !r ? TOKENS.text3 : !r.active ? '#7A5EA6' : r.priority === 'P1' ? TOKENS.terracotta : r.priority === 'P2' ? '#B8860B' : TOKENS.text2;
                        return (
                          <tr key={m}>
                            <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: c, textDecoration: r && !r.active ? 'line-through' : 'none' }}>
                              {m}
                            </td>
                            <td style={{ ...td, fontFamily: MONO, fontSize: 10.5, color: TOKENS.text2 }}>
                              {r ? r.schedule : '—'}
                            </td>
                            <td style={{ ...td, fontFamily: MONO, fontSize: 11, textAlign: 'right' }}>
                              {r ? (
                                <>
                                  <span style={{ color: TOKENS.text2 }}>{r.ok_7d}</span>
                                  <span style={{ color: TOKENS.text3 }}> / </span>
                                  <span style={{ color: r.fail_7d > 0 ? TOKENS.terracotta : TOKENS.text3, fontWeight: r.fail_7d > 0 ? 700 : 400 }}>{r.fail_7d}</span>
                                </>
                              ) : '—'}
                            </td>
                            <td style={{ ...td, fontSize: 11, color: c, fontWeight: 600 }}>
                              {!r ? 'not in cron.job' : !r.active ? 'disabled' : r.priority === 'P1' ? 'dead' : r.priority === 'P2' ? 'degraded' : r.priority === 'P4' ? 'no run 7d' : 'ok'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <Link href={'/holding/it2/fleet/cron?pipe=' + w.p.key} style={{ fontSize: 12, color: TOKENS.forest, fontWeight: 600 }}>
                Open these {w.mine.length} jobs in the register, with fixes
              </Link>
            </div>
          </details>
        ))}
      </div>

      {unmapped > 0 && (
        <div style={{ ...card, padding: '10px 14px' }}>
          <span style={{ fontSize: 12, color: TOKENS.text2 }}>
            <strong style={{ color: TOKENS.ink }}>{unmapped} jobs</strong> belong to no pipeline yet
            — mostly cleanup and one-off refreshes.{' '}
            <Link href="/holding/it2/fleet/cron" style={{ color: TOKENS.forest, fontWeight: 600 }}>
              See them in the register
            </Link>{' '}
            and add them to <code>fleet/_lib/pipelines.ts</code> as they earn a name.
          </span>
        </div>
      )}

      <details style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <summary style={{ cursor: 'pointer', listStyle: 'none', padding: '11px 14px', fontSize: 12.5, fontWeight: 700, color: TOKENS.ink, background: '#FAF7EF' }}>
          Reference · the 7 failure points, and the cross-cutting fixes
        </summary>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={lbl}>Where they break — always on the arrows, not in the boxes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
              <tbody>
                {FAILURES.map((f) => (
                  <tr key={f.n}>
                    <td style={{ ...td, width: 34, textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', width: 20, height: 20, lineHeight: '20px', borderRadius: '50%', background: TOKENS.terracotta, color: '#FFF', fontSize: 11, fontWeight: 700, fontFamily: MONO }}>
                        {f.n}
                      </span>
                    </td>
                    <td style={{ ...td, width: 64, fontSize: 11, color: TOKENS.text2 }}>{f.where}</td>
                    <td style={{ ...td, width: 210, fontWeight: 600 }}>{f.title}</td>
                    <td style={{ ...td, fontSize: 12, color: TOKENS.text2, lineHeight: 1.45 }}>{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={lbl}>Cross-cutting fixes — one change, many jobs</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
              <tbody>
                {XTASKS.map((x) => (
                  <tr key={x.id} style={x.id === 'X1' ? { background: '#FBF8F2' } : undefined}>
                    <td style={{ ...td, width: 40, fontFamily: MONO, fontWeight: 700, color: x.id === 'X1' ? TOKENS.terracotta : TOKENS.text2 }}>{x.id}</td>
                    <td style={{ ...td, fontWeight: x.id === 'X1' ? 600 : 400 }}>{x.task}</td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>{x.covers}</td>
                    <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2 }}>{x.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <p style={{ fontSize: 11, color: TOKENS.text3, lineHeight: 1.5, margin: '2px 0 0' }}>
        Source: <code>public.v_cron_register</code>; pipeline membership is explicit in{' '}
        <code>fleet/_lib/pipelines.ts</code>, shared with the register so the two can never disagree.{' '}
        <strong>Not covered and still blind:</strong> Make scenarios (no inspection path), Vercel API
        route internals, agent mention handoff chains, and Mews/TDP_BI_HUB jobs in the sibling
        project. Treat every count as a floor, not a ceiling.
      </p>
    </div>
  );
}
