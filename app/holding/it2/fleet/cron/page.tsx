// app/holding/it2/fleet/cron/page.tsx
// Cron jobs register — loops-audit-v1 (2026-08-07, handover v55).
//
// THE point of this page: 126 active cron loops run unattended and NONE of them
// log an outcome. Six were 100% dead for a week before anyone noticed. This is
// the surface that makes that visible, and every row carries the actual next
// action — not a status badge you can do nothing with.
//
// This is the JOB-level view. The pipeline-level view (19 named loops and
// chains, by department) is /fleet/loops. ?pipe=<key> filters this register to
// one pipeline, using the shared membership map so the two cannot disagree.
//
// Reads : public.v_cron_register (bridge view, claude_md 0.5 — cron.* is not
//         reachable from the standard client).
// Writes: cockpit.cron_job_actions.handled via the Mark-handled server action.

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';
import { PIPELINES } from '../_lib/pipelines';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Row = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  job_class: string;
  ok_7d: number;
  fail_7d: number;
  last_run: string | null;
  last_error: string | null;
  priority: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  action_md: string;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
  action_is_seeded: boolean;
  priority_rank: number;
};

const PRIO: Record<string, { label: string; colour: string; blurb: string }> = {
  P1: { label: 'Dead', colour: TOKENS.terracotta, blurb: '100% failure over 7 days. Fix these first.' },
  P2: { label: 'Degraded', colour: '#B8860B', blurb: 'Partly failing — looks alive, silently corrupts.' },
  P3: { label: 'Abandoned', colour: '#7A5EA6', blurb: 'Disabled. Each needs a keep-off / revive / delete decision.' },
  P4: { label: 'Unverified', colour: TOKENS.text2, blurb: 'Active, no run in 7d. Usually just newly created — check the jobid.' },
  P5: { label: 'Healthy', colour: '#1F7A4D', blurb: 'No failures. Still unobservable until X1 lands.' },
};

const ORDER: Array<Row['priority']> = ['P1', 'P2', 'P3', 'P4', 'P5'];

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

async function getRows(): Promise<Row[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('v_cron_register')
    .select('*')
    .order('priority_rank', { ascending: true })
    .order('fail_7d', { ascending: false })
    .order('jobname', { ascending: true });
  if (error) {
    console.error('[cron-register]', error.message);
    return [];
  }
  return (data ?? []) as Row[];
}

function ago(ts: string | null): string {
  if (!ts) return 'never';
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins + 'm ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
  return Math.floor(mins / 1440) + 'd ago';
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

export default async function CronRegisterPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const rows = await getRows();
  const filter = typeof searchParams?.p === 'string' ? searchParams.p : '';
  const q = typeof searchParams?.q === 'string' ? searchParams.q.toLowerCase() : '';
  const pipeKey = typeof searchParams?.pipe === 'string' ? searchParams.pipe : '';
  const pipe = pipeKey ? PIPELINES.find((p) => p.key === pipeKey) ?? null : null;

  const counts = ORDER.reduce<Record<string, number>>((acc, p) => {
    acc[p] = rows.filter((r) => r.priority === p).length;
    return acc;
  }, {});
  const unhandledCritical = rows.filter(
    (r) => (r.priority === 'P1' || r.priority === 'P2') && !r.handled,
  ).length;
  const noOutcomeLogging = rows.filter((r) => r.active).length;

  const shown = rows.filter(
    (r) =>
      (!filter || r.priority === filter) &&
      (!pipe || pipe.members.includes(r.jobname)) &&
      (!q || r.jobname.toLowerCase().includes(q) || r.job_class.includes(q)),
  );

  const grouped = ORDER.map((p) => ({ p, list: shown.filter((r) => r.priority === p) })).filter(
    (g) => g.list.length > 0,
  );

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
      </div>

      {pipe && (
        <div style={{ ...card, borderLeft: '3px solid ' + TOKENS.forest, display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
            Filtered to the <strong>{pipe.name}</strong> pipeline — {shown.length} job
            {shown.length === 1 ? '' : 's'}.
          </span>
          <span style={{ fontSize: 11.5, color: TOKENS.text2 }}>
            Should exit when: <code style={{ fontFamily: MONO, fontSize: 11 }}>{pipe.exitCondition || 'undefined'}</code>
          </span>
          <Link href="/holding/it2/fleet/cron" style={{ fontSize: 12, color: TOKENS.forest, fontWeight: 600, marginLeft: 'auto' }}>
            Show all {rows.length}
          </Link>
        </div>
      )}

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
          <strong>{noOutcomeLogging}</strong> active jobs ·{' '}
          <strong style={{ color: TOKENS.terracotta }}>0</strong> log an <code>exit_reason</code>.
          One wrapper function instruments all of them (task X1).
        </span>
        <Link href="/holding/it2/fleet/loops" style={{ fontSize: 12, color: TOKENS.forest, fontWeight: 600 }}>
          Why this matters
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {ORDER.map((p) => {
          const on = filter === p;
          return (
            <Link
              key={p}
              href={on ? keep('') : keep('p=' + p)}
              style={{
                ...card,
                textDecoration: 'none',
                borderColor: on ? PRIO[p].colour : TOKENS.border,
                borderWidth: on ? 2 : 1,
                display: 'block',
              }}
            >
              <div style={lbl}>
                {p} · {PRIO[p].label}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO, color: PRIO[p].colour, margin: '2px 0' }}>
                {counts[p] ?? 0}
              </div>
              <div style={{ fontSize: 10.5, color: TOKENS.text3, lineHeight: 1.35 }}>
                {on ? 'Showing — click to clear' : PRIO[p].blurb}
              </div>
            </Link>
          );
        })}
      </div>

      {unhandledCritical > 0 && !pipe && (
        <div style={{ ...card, background: '#FDF6F4', borderColor: '#E8CFC7' }}>
          <span style={{ fontSize: 12.5, color: TOKENS.ink }}>
            <strong>{unhandledCritical}</strong> dead or degraded job
            {unhandledCritical === 1 ? '' : 's'} not yet marked handled. Start with{' '}
            <Link href="/holding/it2/fleet/cron?p=P1" style={{ color: TOKENS.forest, fontWeight: 600 }}>
              the {counts.P1 ?? 0} dead ones
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
          {shown.length} of {rows.length} jobs
        </span>
      </form>

      {grouped.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: TOKENS.text2, fontSize: 12.5 }}>
          No jobs match. <Link href="/holding/it2/fleet/cron" style={{ color: TOKENS.forest }}>Clear filters</Link>
        </div>
      )}

      {grouped.map(({ p, list }) => (
        <div key={p} style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '9px 14px',
              background: '#FAF7EF',
              borderBottom: '1px solid ' + TOKENS.border,
              display: 'flex',
              alignItems: 'baseline',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 700, color: PRIO[p].colour }}>
              {p} · {PRIO[p].label} ({list.length})
            </span>
            <span style={{ fontSize: 11.5, color: TOKENS.text2 }}>{PRIO[p].blurb}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Job</th>
                  <th style={th}>Cadence</th>
                  <th style={th}>Class</th>
                  <th style={{ ...th, textAlign: 'right' }}>ok / fail 7d</th>
                  <th style={th}>Last run</th>
                  <th style={{ ...th, minWidth: 320 }}>Action</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.jobid} style={{ opacity: r.handled ? 0.5 : 1 }}>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap' }}>
                      {r.jobname}
                      {!r.active && (
                        <span style={{ marginLeft: 6, fontSize: 9.5, color: '#7A5EA6', fontWeight: 700 }}>
                          OFF
                        </span>
                      )}
                    </td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                      {r.schedule}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: TOKENS.text2 }}>{r.job_class}</td>
                    <td style={{ ...td, fontFamily: MONO, fontSize: 11.5, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: TOKENS.text2 }}>{r.ok_7d}</span>
                      <span style={{ color: TOKENS.text3 }}> / </span>
                      <span style={{ color: r.fail_7d > 0 ? TOKENS.terracotta : TOKENS.text3, fontWeight: r.fail_7d > 0 ? 700 : 400 }}>
                        {r.fail_7d}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2, whiteSpace: 'nowrap' }}>
                      {ago(r.last_run)}
                    </td>
                    <td style={{ ...td, fontSize: 12, lineHeight: 1.45, maxWidth: 460 }}>
                      <span style={{ color: r.action_is_seeded ? TOKENS.ink : TOKENS.text3 }}>
                        {r.action_md}
                      </span>
                      {r.last_error && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ cursor: 'pointer', fontSize: 11, color: TOKENS.terracotta, fontWeight: 600 }}>
                            Show last error
                          </summary>
                          <pre
                            style={{
                              margin: '6px 0 0', padding: 8, background: '#FBF8F2',
                              border: '1px solid ' + TOKENS.border, borderRadius: 4,
                              fontFamily: MONO, fontSize: 10.5, whiteSpace: 'pre-wrap',
                              color: TOKENS.ink, maxHeight: 160, overflow: 'auto',
                            }}
                          >
                            {r.last_error}
                          </pre>
                        </details>
                      )}
                      {r.handled && r.handled_at && (
                        <div style={{ marginTop: 5, fontSize: 10.5, color: '#1F7A4D', fontWeight: 600 }}>
                          Handled {ago(r.handled_at)}
                          {r.handled_by ? ' by ' + r.handled_by : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <form action={markHandled}>
                        <input type="hidden" name="jobname" value={r.jobname} />
                        <input type="hidden" name="next" value={String(!r.handled)} />
                        <button
                          type="submit"
                          style={{
                            padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            borderRadius: 4, fontFamily: 'inherit',
                            border: '1px solid ' + (r.handled ? TOKENS.border : TOKENS.forest),
                            background: r.handled ? 'transparent' : TOKENS.forest,
                            color: r.handled ? TOKENS.text2 : '#FFF',
                          }}
                        >
                          {r.handled ? 'Reopen' : 'Mark handled'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: TOKENS.text3, lineHeight: 1.5, margin: '2px 0 0' }}>
        Source: <code>public.v_cron_register</code> — <code>cron.job</code> + 7-day run stats +{' '}
        <code>cockpit.cron_job_actions</code>. Action text is editable data, not code. Low ok-counts
        against a frequent cadence usually mean the job is <em>new</em> (jobids over 190 were created
        in the last days), not that runs were skipped — check the jobid before concluding anything
        failed. Make scenarios are not visible here and remain unswept.
      </p>
    </div>
  );
}
