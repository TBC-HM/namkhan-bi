// app/holding/it2/fleet/cron/page.tsx
// Cron jobs register — cron-fleet-page-v2 (2026-09-15).
//
// WHY THIS WAS REWRITTEN. PBS, looking at this page: "THE KPI TILES TELL
// ANOTHER STORY THAN THE CONTAINERS". They did. The page counted the P1-P5
// tiles itself (rows.filter(...).length) while the rows carried a `priority`
// classified in SQL. Two classifiers over one set of jobs, so they drifted.
//
// The fix is not better logic here — it is NO logic here. Every number, every
// colour, every status sentence and the row ORDER now come from one call:
//
//     SELECT public.fn_cron_fleet_payload(7);
//
// The summary is counted from the same rows the function returns, so a tile
// and its band cannot disagree by construction. If a figure is missing, add it
// to that function — never re-derive it in this file.
//
// Reads : public.fn_cron_fleet_payload(p_days)  — health, counts, order. Sole
//         authority for anything numeric or classified.
//         public.v_cron_register                — ANNOTATIONS ONLY (job class,
//         the human next-action text, handled flag). No health, no counting,
//         no ordering is taken from it; it is a lookup keyed by jobname and
//         the page renders fully without it.
// Writes: cockpit.cron_job_actions.handled via the Mark-handled server action.
//
// This is the JOB-level view. The pipeline-level view (19 named loops and
// chains, by department) is /fleet/loops. ?pipe=<key> filters this register to
// one pipeline, using the shared membership map so the two cannot disagree.
//
// "Server restarted" is NOT a job failure. Supabase restarts land in
// `fail_infra` and are never added to `fail` anywhere on this page.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { PIPELINES } from '../_lib/pipelines';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const WINDOW_DAYS = 7;

type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
type Colour = 'red' | 'amber' | 'blue' | 'grey' | 'green';

/** One job, exactly as fn_cron_fleet_payload returns it. Nothing is computed. */
type Job = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  ok: number;
  fail: number;
  fail_infra: number;
  last_run: string | null;
  hours: number;
  last_error: string | null;
  never_ran: boolean;
  priority: Priority;
  colour: Colour;
  state_label: string;
  note: string | null;
};

type Payload = {
  generated_at: string;
  window_days: number;
  // A band with zero jobs is ABSENT from summary, not zero — read with ?? 0.
  summary: Partial<Record<Priority, number>>;
  totals: { jobs: number; active: number; runs: number; hours: number; infra_failures: number };
  jobs: Job[];
};

/** Editable prose + the handled flag. Never health, never a count. */
type Note = {
  job_class: string;
  action_md: string;
  action_is_seeded: boolean;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
};

// ── skin ────────────────────────────────────────────────────────────────
// Keyed on job.colour, which the RPC decides. The page never picks a colour
// from a number. Every hex here is already in use in the it2 cream palette.
const SKIN: Record<Colour, { fg: string; tint: string; line: string }> = {
  red:   { fg: TOKENS.terracotta, tint: '#FDF6F4', line: '#E8CFC7' },
  amber: { fg: '#B8860B',         tint: '#FFF6E8', line: '#E8D8B8' },
  blue:  { fg: '#1565C0',         tint: '#F2F7FC', line: '#CFDDEC' },
  grey:  { fg: TOKENS.text2,      tint: '#F7F4EC', line: TOKENS.border },
  green: { fg: '#1F7A4D',         tint: '#F4F9F4', line: '#D6E6D8' },
};

// Labels and copy unchanged from v1 — PBS reads these. The colour here is only
// a FALLBACK, used when a band has no rows today (P1 is often empty). When the
// band has rows, its colour is taken from those rows — see bandColour below.
const BAND: Record<Priority, { label: string; colour: Colour; blurb: string }> = {
  P1: { label: 'Dead',       colour: 'red',   blurb: '100% failure over 7 days. Fix these first.' },
  P2: { label: 'Degraded',   colour: 'amber', blurb: 'Partly failing — looks alive, silently corrupts.' },
  P3: { label: 'Abandoned',  colour: 'grey',  blurb: 'Disabled. Each needs a keep-off / revive / delete decision.' },
  P4: { label: 'Unverified', colour: 'blue',  blurb: 'Active, no run in 7d. Usually just newly created — check the jobid.' },
  P5: { label: 'Healthy',    colour: 'green', blurb: 'No failures. Still unobservable until X1 lands.' },
};

/** Tile order only. Band sections follow the payload's own order. */
const TILE_ORDER: Priority[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

async function markHandled(formData: FormData) {
  'use server';
  const jobname = String(formData.get('jobname') || '');
  const next = String(formData.get('next')) === 'true';
  if (!jobname) return;
  const sb = getSupabaseAdmin();
  await (sb as any)
    .from('cron_job_actions')
    .update({
      handled: next,
      handled_at: next ? new Date().toISOString() : null,
      handled_by: next ? 'PBS' : null,
      updated_at: new Date().toISOString(),
    })
    .eq('jobname', jobname);
  revalidatePath('/holding/it2/fleet/cron');
}

async function getPayload(): Promise<Payload | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any).rpc('fn_cron_fleet_payload', { p_days: WINDOW_DAYS });
  if (error) {
    console.error('[cron-fleet] fn_cron_fleet_payload:', error.message);
    return null;
  }
  if (!data || !Array.isArray((data as Payload).jobs)) {
    console.error('[cron-fleet] payload missing a jobs array');
    return null;
  }
  return data as Payload;
}

/** Annotation lookup. Failure here degrades one column, never the page. */
async function getNotes(): Promise<Map<string, Note>> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('v_cron_register')
    .select('jobname, job_class, action_md, action_is_seeded, handled, handled_at, handled_by');
  if (error) {
    console.error('[cron-fleet] v_cron_register annotations:', error.message);
    return new Map();
  }
  return new Map<string, Note>((data ?? []).map((r: any) => [r.jobname as string, r as Note]));
}

function ago(ts: string | null): string {
  if (!ts) return 'never';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  return Math.floor(mins / 1440) + 'd ago';
}

/** UTC, explicitly — the reader should not have to guess the server's clock. */
function stampUtc(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

const card: React.CSSProperties = {
  background: TOKENS.bgRaised,
  border: '1px solid ' + TOKENS.border,
  borderRadius: 8,
  padding: '12px 14px',
};
const lbl: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: TOKENS.text2,
};
const th: React.CSSProperties = {
  textAlign: 'left', padding: '7px 10px', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: TOKENS.text2,
  borderBottom: '1px solid ' + TOKENS.border, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '9px 10px', fontSize: 12.5, color: TOKENS.ink,
  borderBottom: '1px solid ' + TOKENS.border, verticalAlign: 'top',
};
const muted: React.CSSProperties = {
  fontSize: 10.5, color: TOKENS.text3, lineHeight: 1.4, marginTop: 3,
};

export default async function CronRegisterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const [payload, notes] = await Promise.all([getPayload(), getNotes()]);

  if (!payload) {
    return (
      <div style={{ ...card, borderLeft: '3px solid ' + TOKENS.terracotta }}>
        <h1 style={{ fontSize: 17, fontWeight: 700, color: TOKENS.ink, margin: '0 0 6px' }}>
          Cron jobs · register
        </h1>
        <p style={{ fontSize: 12.5, color: TOKENS.ink, margin: 0, lineHeight: 1.5 }}>
          <code style={{ fontFamily: MONO }}>public.fn_cron_fleet_payload({WINDOW_DAYS})</code>{' '}
          did not return. Nothing is shown rather than a stale or half-built picture — the server
          log carries the reason.
        </p>
      </div>
    );
  }

  const { summary, totals, jobs } = payload;

  // A band's colour is read off the rows it counts, so a tile can never be
  // tinted differently from the band underneath it. BAND[] only fills in for a
  // band that has no rows in this window.
  const bandColour = new Map<Priority, Colour>();
  for (const j of jobs) if (!bandColour.has(j.priority)) bandColour.set(j.priority, j.colour);

  const filter = typeof searchParams?.p === 'string' ? (searchParams.p as Priority) : '';
  const q = typeof searchParams?.q === 'string' ? searchParams.q.toLowerCase() : '';
  const pipeKey = typeof searchParams?.pipe === 'string' ? searchParams.pipe : '';
  const pipe = pipeKey ? PIPELINES.find((p) => p.key === pipeKey) ?? null : null;

  // Display filter only. Order is the payload's order, untouched.
  const shown = jobs.filter(
    (j) =>
      (!filter || j.priority === filter) &&
      (!pipe || pipe.members.includes(j.jobname)) &&
      (!q ||
        j.jobname.toLowerCase().includes(q) ||
        (notes.get(j.jobname)?.job_class ?? '').toLowerCase().includes(q)),
  );

  // Bands appear in the order the RPC sorted them (P1, P2, P4, P3, P5) — not
  // an order this file decides.
  const bandOrder: Priority[] = [];
  for (const j of shown) if (!bandOrder.includes(j.priority)) bandOrder.push(j.priority);

  // The one legitimate scan over jobs: who still needs a decision. It reads
  // the RPC's colour, so it cannot disagree with the tiles about what is bad.
  const unhandledCritical = shown.filter(
    (j) => (j.colour === 'red' || j.colour === 'amber') && !(notes.get(j.jobname)?.handled ?? false),
  ).length;

  const keep = (extra: string) => {
    const parts: string[] = [];
    if (pipeKey) parts.push('pipe=' + pipeKey);
    if (extra) parts.push(extra);
    return parts.length ? '/holding/it2/fleet/cron?' + parts.join('&') : '/holding/it2/fleet/cron';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: TOKENS.ink, margin: '0 0 4px' }}>
          Cron jobs · register
        </h1>
        <p style={{ fontSize: 12.5, color: TOKENS.text2, margin: 0, maxWidth: 780, lineHeight: 1.5 }}>
          Every scheduled job, ranked by what needs doing. Job status is logged;{' '}
          <strong style={{ color: TOKENS.ink }}>outcome status is not</strong> — which is why six
          jobs sat 100% dead for a week without an alarm. For the pipeline view by department, see{' '}
          <Link href="/holding/it2/fleet/loops" style={{ color: TOKENS.forest, fontWeight: 600 }}>
            Loops &amp; Chains
          </Link>
          .
        </p>
        <p style={{ fontSize: 11, color: TOKENS.text3, margin: '6px 0 0', lineHeight: 1.45 }}>
          Counted over the last <strong>{payload.window_days} days</strong> · measured{' '}
          {stampUtc(payload.generated_at)} · every figure below reproduces from{' '}
          <code style={{ fontFamily: MONO, fontSize: 10.5 }}>
            SELECT public.fn_cron_fleet_payload({payload.window_days});
          </code>
        </p>
      </div>

      {pipe && (
        <div style={{ ...card, borderLeft: '3px solid ' + TOKENS.forest, display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
            Filtered to the <strong>{pipe.name}</strong> pipeline — {shown.length}{' '}
            {plural(shown.length, 'job', 'jobs')}.
          </span>
          <span style={{ fontSize: 11.5, color: TOKENS.text2 }}>
            Should exit when:{' '}
            <code style={{ fontFamily: MONO, fontSize: 11 }}>{pipe.exitCondition || 'undefined'}</code>
          </span>
          <Link href="/holding/it2/fleet/cron" style={{ fontSize: 12, color: TOKENS.forest, fontWeight: 600, marginLeft: 'auto' }}>
            Show all {totals.jobs}
          </Link>
        </div>
      )}

      {/* Fleet totals — straight off payload.totals. */}
      <div style={{ ...card, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline' }}>
        {[
          { k: 'jobs', v: totals.jobs, t: 'jobs registered' },
          { k: 'active', v: totals.active, t: 'active' },
          { k: 'runs', v: totals.runs.toLocaleString('en-GB'), t: 'runs in window' },
          { k: 'hours', v: totals.hours + 'h', t: 'compute in window' },
        ].map((m) => (
          <div key={m.k}>
            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: MONO, color: TOKENS.ink }}>{m.v}</div>
            <div style={lbl}>{m.t}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', maxWidth: 330 }}>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: MONO, color: TOKENS.text2 }}>
            {totals.infra_failures}
          </div>
          <div style={lbl}>infra restarts</div>
          <div style={{ fontSize: 10.5, color: TOKENS.text3, lineHeight: 1.4, marginTop: 2 }}>
            Supabase server restarts. Counted apart from job failures everywhere on this page — no
            job is at fault for these.
          </div>
        </div>
      </div>

      <div
        style={{
          ...card,
          borderLeft: '3px solid ' + TOKENS.terracotta,
          display: 'flex',
          gap: 14,
          alignItems: 'baseline',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
          <strong>{totals.active}</strong> active jobs ·{' '}
          <strong style={{ color: TOKENS.terracotta }}>0</strong> log an <code>exit_reason</code>.
          One wrapper function instruments all of them (task X1).
        </span>
        <Link href="/holding/it2/fleet/loops" style={{ fontSize: 12, color: TOKENS.forest, fontWeight: 600 }}>
          Why this matters
        </Link>
      </div>

      {/* Tiles read payload.summary. No counting happens in this file. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {TILE_ORDER.map((p) => {
          const on = filter === p;
          const skin = SKIN[bandColour.get(p) ?? BAND[p].colour];
          const n = summary[p] ?? 0;
          return (
            <Link
              key={p}
              href={on ? keep('') : keep('p=' + p)}
              style={{
                ...card,
                textDecoration: 'none',
                background: n > 0 ? skin.tint : TOKENS.bgRaised,
                borderColor: on ? skin.fg : skin.line,
                borderWidth: on ? 2 : 1,
                borderLeft: '3px solid ' + skin.fg,
                display: 'block',
              }}
            >
              <div style={lbl}>
                {p} · {BAND[p].label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO, color: skin.fg, margin: '2px 0' }}>
                {n}
              </div>
              <div style={{ fontSize: 10.5, color: TOKENS.text3, lineHeight: 1.35 }}>
                {on ? 'Showing — click to clear' : BAND[p].blurb}
              </div>
            </Link>
          );
        })}
      </div>

      {unhandledCritical > 0 && !pipe && (
        <div style={{ ...card, background: SKIN.red.tint, borderColor: SKIN.red.line }}>
          <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
            <strong>{unhandledCritical}</strong> dead or degraded{' '}
            {plural(unhandledCritical, 'job', 'jobs')} not yet marked handled. Start with{' '}
            <Link href="/holding/it2/fleet/cron?p=P1" style={{ color: TOKENS.forest, fontWeight: 600 }}>
              the {summary.P1 ?? 0} dead {plural(summary.P1 ?? 0, 'one', 'ones')}
            </Link>
            .
          </span>
        </div>
      )}

      <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {filter && <input type="hidden" name="p" value={filter} />}
        {pipeKey && <input type="hidden" name="pipe" value={pipeKey} />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Filter by job name or class..."
          style={{
            padding: '6px 10px', fontSize: 12.5, fontFamily: 'inherit', minWidth: 260,
            border: '1px solid ' + TOKENS.border, borderRadius: 4, background: '#FFF', color: TOKENS.ink,
          }}
        />
        <button
          type="submit"
          style={{
            padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: '1px solid ' + TOKENS.forest, borderRadius: 4,
            background: TOKENS.forest, color: '#FFF', fontFamily: 'inherit',
          }}
        >
          Filter
        </button>
        {(q || filter || pipeKey) && (
          <Link href="/holding/it2/fleet/cron" style={{ fontSize: 12, color: TOKENS.text2 }}>
            Clear
          </Link>
        )}
        <span style={{ fontSize: 11.5, color: TOKENS.text3, marginLeft: 'auto' }}>
          {shown.length} of {totals.jobs} jobs
        </span>
      </form>

      {bandOrder.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: TOKENS.text2, fontSize: 12.5 }}>
          No jobs match. <Link href="/holding/it2/fleet/cron" style={{ color: TOKENS.forest }}>Clear filters</Link>
        </div>
      )}

      {bandOrder.map((p) => {
        const list = shown.filter((j) => j.priority === p);
        const skin = SKIN[bandColour.get(p) ?? BAND[p].colour];
        const band = summary[p] ?? list.length;
        return (
          <div key={p} style={{ ...card, padding: 0, overflow: 'hidden', borderLeft: '3px solid ' + skin.fg }}>
            <div
              style={{
                padding: '9px 14px',
                background: skin.tint,
                borderBottom: '1px solid ' + skin.line,
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: skin.fg }}>
                {p} · {BAND[p].label} ({list.length}
                {list.length === band ? '' : ' of ' + band})
              </span>
              <span style={{ fontSize: 11.5, color: TOKENS.text2 }}>{BAND[p].blurb}</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Job</th>
                    <th style={th}>Cadence</th>
                    <th style={th}>Class</th>
                    <th style={{ ...th, minWidth: 190 }}>State</th>
                    <th style={{ ...th, textAlign: 'right' }}>ok / fail {payload.window_days}d</th>
                    <th style={th}>Last run</th>
                    <th style={{ ...th, minWidth: 300 }}>Action</th>
                    <th style={th} />
                  </tr>
                </thead>
                <tbody>
                  {list.map((j) => {
                    const s = SKIN[j.colour];
                    const n = notes.get(j.jobname);
                    return (
                      <tr key={j.jobid} style={{ background: s.tint, opacity: n?.handled ? 0.55 : 1 }}>
                        <td
                          style={{
                            ...td,
                            fontFamily: MONO,
                            fontSize: 11.5,
                            whiteSpace: 'nowrap',
                            borderLeft: '3px solid ' + s.fg,
                          }}
                        >
                          {j.jobname}
                          {!j.active && (
                            <span style={{ marginLeft: 6, fontSize: 9.5, color: SKIN.grey.fg, fontWeight: 700 }}>
                              OFF
                            </span>
                          )}
                          <div style={{ ...muted, fontFamily: 'inherit' }}>#{j.jobid}</div>
                        </td>
                        <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                          {j.schedule}
                        </td>
                        <td style={{ ...td, fontSize: 11, color: TOKENS.text2 }}>{n?.job_class ?? '—'}</td>

                        {/* state_label is the RPC's sentence. Nothing is written here. */}
                        <td style={{ ...td, fontSize: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span
                              aria-hidden
                              style={{
                                width: 8, height: 8, borderRadius: '50%',
                                background: s.fg, flex: '0 0 auto',
                              }}
                            />
                            <span style={{ color: s.fg, fontWeight: 600 }}>{j.state_label}</span>
                          </span>
                          {j.fail_infra > 0 && (
                            <div style={muted}>
                              {j.fail_infra} infra {plural(j.fail_infra, 'restart', 'restarts')}, no job fault
                            </div>
                          )}
                          {j.note && <div style={muted}>{j.note}</div>}
                        </td>

                        <td style={{ ...td, fontFamily: MONO, fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <span style={{ color: TOKENS.text2 }}>{j.ok}</span>
                          <span style={{ color: TOKENS.text3 }}> / </span>
                          <span style={{ color: j.fail > 0 ? TOKENS.terracotta : TOKENS.text3, fontWeight: j.fail > 0 ? 700 : 400 }}>
                            {j.fail}
                          </span>
                          {j.fail_infra > 0 && (
                            <div style={{ ...muted, fontFamily: MONO }}>+{j.fail_infra} infra</div>
                          )}
                          <div style={{ ...muted, fontFamily: MONO }}>{j.hours}h</div>
                        </td>

                        <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                          {ago(j.last_run)}
                        </td>

                        <td style={{ ...td, fontSize: 12, lineHeight: 1.45, maxWidth: 440 }}>
                          <span style={{ color: n?.action_is_seeded ? TOKENS.ink : TOKENS.text3 }}>
                            {n?.action_md ?? 'No action written yet.'}
                          </span>
                          {j.last_error && (
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ cursor: 'pointer', fontSize: 11, color: TOKENS.terracotta, fontWeight: 600 }}>
                                Show last error
                              </summary>
                              <pre
                                style={{
                                  margin: '6px 0 0', padding: 8, background: TOKENS.bgRaised,
                                  border: '1px solid ' + TOKENS.border, borderRadius: 4,
                                  fontFamily: MONO, fontSize: 10.5, whiteSpace: 'pre-wrap',
                                  color: TOKENS.ink, maxHeight: 160, overflow: 'auto',
                                }}
                              >
                                {j.last_error}
                              </pre>
                            </details>
                          )}
                          {n?.handled && n.handled_at && (
                            <div style={{ marginTop: 5, fontSize: 10.5, color: SKIN.green.fg, fontWeight: 600 }}>
                              Handled {ago(n.handled_at)}
                              {n.handled_by ? ' by ' + n.handled_by : ''}
                            </div>
                          )}
                        </td>

                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <form action={markHandled}>
                            <input type="hidden" name="jobname" value={j.jobname} />
                            <input type="hidden" name="next" value={String(!(n?.handled ?? false))} />
                            <button
                              type="submit"
                              style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                borderRadius: 4, fontFamily: 'inherit',
                                border: '1px solid ' + (n?.handled ? TOKENS.border : TOKENS.forest),
                                background: n?.handled ? 'transparent' : TOKENS.forest,
                                color: n?.handled ? TOKENS.text2 : '#FFF',
                              }}
                            >
                              {n?.handled ? 'Reopen' : 'Mark handled'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 11, color: TOKENS.text3, lineHeight: 1.5, margin: '2px 0 0' }}>
        Health, counts and row order: <code>public.fn_cron_fleet_payload({payload.window_days})</code>{' '}
        — one classification, so a tile and its band cannot disagree. Job class and the action text
        are annotations from <code>public.v_cron_register</code> + <code>cockpit.cron_job_actions</code>;
        they are editable data, not code, and carry no health meaning. Rescheduling a job assigns a{' '}
        <strong>new jobid</strong> and leaves its run history with the old one, so a recently
        rescheduled job legitimately sits in P4 for up to {payload.window_days} days — check the
        jobid before concluding a run was skipped. Make scenarios are not visible here and remain
        unswept.
      </p>
    </div>
  );
}
