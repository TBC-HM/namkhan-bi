// app/holding/it2/fleet/loops/page.tsx
// Loops & Chains — loops-audit-v1 (2026-08-07, handover v55).
//
// Read-only review surface. It exists so a missing exit test is visible in five
// seconds without reading SQL. It is NOT an editing surface: the spec is the
// source of truth, the picture is generated from it (decision D2).
//
// Reads: public.v_cron_register (bridge view — cron.* is unreachable from the
// standard client, claude_md 0.5). Same source as the Cron register, grouped
// by structural class instead of by priority.

import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

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

const CLASSES: Array<{ key: string; title: string; shape: string; risk: string }> = [
  { key: 'batch-loop', title: 'Cron-paced batch loop', shape: 'LOOP — iteration is the cron tick, cap is the batch size, no exit condition by design', risk: 'Silent backlog. "Caught up" and "starved" look identical — nothing measures drain rate.' },
  { key: 'refresh', title: 'Refresh / recompute', shape: 'CHAIN — single step', risk: 'Statement timeout, stale materialised view, two consumers of one object.' },
  { key: 'webhook-chain', title: 'Webhook to route chain', shape: 'CHAIN — net.http_post out to a Vercel route', risk: 'An HTML error page parsed as JSON. Fails partially, looks alive.' },
  { key: 'watcher', title: 'Alarm / watcher', shape: 'LOOP over conditions', risk: 'Watches something already dead and still reports success.' },
  { key: 'chain', title: 'Plain chain', shape: 'CHAIN — runs once per tick', risk: 'Undefined handoff contract; silent null passed downstream.' },
  { key: 'cleanup', title: 'Cleanup / prune', shape: 'CHAIN — deletes', risk: 'Deletes the evidence an incident review would need.' },
  { key: 'stub', title: 'Stub', shape: 'Logs and returns', risk: 'A module advertised in the UI that does not exist.' },
];

const FAILURES = [
  { n: 1, where: 'Chain', title: 'Handoff contract undefined', detail: 'Step A returns prose, step B expects JSON. Symptom: B appears to invent fields. Fix: enforce a schema on every step output.' },
  { n: 2, where: 'Chain', title: 'Silent null pass-through', detail: 'A found 0 rows, B mapped nothing, C wrote empty. Symptom: the page shows $0 and no error exists anywhere. Fix: assert non-empty between steps.' },
  { n: 3, where: 'Chain', title: 'No transaction boundary', detail: 'C fails, B writes remain. Fix: stage then commit, or make every step idempotent.' },
  { n: 4, where: 'Loop', title: 'Unverifiable success test', detail: '"Report is good" cannot be evaluated, so the loop runs to its cap every time. Fix: exit on a SQL count, a diff, a status code.' },
  { n: 5, where: 'Loop', title: 'Dedupe against the wrong set', detail: 'Comparing against confirmed instead of seen makes rejected items reappear every round. State also grows each pass until cost blows up.' },
  { n: 6, where: 'Loop', title: 'Budget is the only exit that fires', detail: 'If the ceiling is what usually stops it, there is no working success test. This is the spend-runaway shape.' },
  { n: 7, where: 'Hybrid', title: 'Exit reason not propagated', detail: 'The chain continues regardless of WHY the loop stopped. Fix: gate the next step on exit_reason = success.' },
];

const XTASKS = [
  { id: 'X1', task: 'Wrap every cron command in a logger writing exit_reason + OUTCOME status (not job status) + rows affected', covers: '135 jobs', note: 'The whole game. Every dead job below was invisible for a week for this one reason.' },
  { id: 'X2', task: 'Add max_attempts + dead-letter status to the 8 queue tables', covers: 'all retry loops', note: 'None has a max today — a permanently failing row retries forever.' },
  { id: 'X3', task: 'Add a drain-rate assertion to the batch loops', covers: 'the silent-backlog class', note: 'For a cron-paced loop the health test is not "did it finish" but "is the queue shrinking".' },
  { id: 'X4', task: 'Alarm on OUTCOME staleness, not job success', covers: 'whole platform', note: 'Three watchers ran green through six dead jobs.' },
  { id: 'X5', task: 'Move 2 plaintext webhook secrets out of cron command text into vault', covers: '2 jobs', note: 'Rotate at the Vercel end in the same pass.' },
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

export default async function LoopsAndChainsPage() {
  const rows = await getRows();
  const active = rows.filter((r) => r.active);
  const dead = rows.filter((r) => r.priority === 'P1');
  const degraded = rows.filter((r) => r.priority === 'P2');
  const abandoned = rows.filter((r) => r.priority === 'P3');
  const batch = active.filter((r) => r.job_class === 'batch-loop');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 19, fontWeight: 700, color: TOKENS.ink, margin: '0 0 4px' }}>
          Loops &amp; Chains
        </h1>
        <p style={{ fontSize: 12.5, color: TOKENS.text2, margin: 0, maxWidth: 800, lineHeight: 1.5 }}>
          A <strong>chain</strong> runs once and ends. A <strong>loop</strong> repeats until an exit
          condition fires. Most of this platform is a <strong>hybrid</strong> — a chain with one
          looping stage. Read-only by design: the spec is the source of truth, this is the review
          surface.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
        {[
          { k: 'Active loops & chains', v: active.length, c: TOKENS.ink, href: '/holding/it2/fleet/cron' },
          { k: 'Dead (P1)', v: dead.length, c: TOKENS.terracotta, href: '/holding/it2/fleet/cron?p=P1' },
          { k: 'Degraded (P2)', v: degraded.length, c: '#B8860B', href: '/holding/it2/fleet/cron?p=P2' },
          { k: 'Logging exit_reason', v: 0, c: TOKENS.terracotta, href: '/holding/it2/fleet/cron' },
        ].map((t) => (
          <Link key={t.k} href={t.href} style={{ ...card, textDecoration: 'none', display: 'block' }}>
            <div style={lbl}>{t.k}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: t.c, margin: '2px 0' }}>{t.v}</div>
            <div style={{ fontSize: 10.5, color: TOKENS.forest, fontWeight: 600 }}>Open in register</div>
          </Link>
        ))}
      </div>

      <div style={{ ...card, borderLeft: `3px solid ${TOKENS.brass}` }}>
        <div style={lbl}>The structural finding</div>
        <p style={{ fontSize: 13, color: TOKENS.ink, margin: '6px 0 8px', lineHeight: 1.55, maxWidth: 820 }}>
          <strong>{batch.length} of {active.length}</strong> active jobs are{' '}
          <strong>cron-paced batch loops</strong> — the iteration is the cron tick, the cap is the
          batch size, and there is <strong>no exit condition at all</strong>. That is legitimate for
          steady-state ingestion, but it means <em>caught up</em> and <em>starved</em> look
          identical from outside. The failure mode is not runaway cost; it is{' '}
          <strong>silent, permanent backlog</strong> — if work arrives faster than{' '}
          <code>batch_size x frequency</code>, the queue grows forever and every run still reports
          success.
        </p>
        <pre
          style={{
            margin: 0, padding: 10, background: '#FBF8F2', border: `1px solid ${TOKENS.border}`,
            borderRadius: 4, fontFamily: MONO, fontSize: 11, color: TOKENS.ink, overflowX: 'auto',
          }}
        >{`-- every minute, forever, no exit test
SELECT CASE WHEN public.fn_automation_enabled()
       THEN public.fn_polish_next_batch(2) END;`}</pre>
        <p style={{ fontSize: 12, color: TOKENS.text2, margin: '8px 0 0' }}>
          Health test for this class is not &ldquo;did it finish&rdquo; but{' '}
          <strong style={{ color: TOKENS.ink }}>&ldquo;is the queue shrinking, or at least flat&rdquo;</strong> — task X3 below.
        </p>
      </div>

      {(dead.length > 0 || abandoned.length > 0) && (
        <div style={{ ...card, background: '#FDF6F4', borderColor: '#E8CFC7' }}>
          <div style={lbl}>Needs you</div>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 12.5, color: TOKENS.ink, lineHeight: 1.7 }}>
            {dead.length > 0 && (
              <li>
                <strong>{dead.length} loops are 100% dead.</strong>{' '}
                <Link href="/holding/it2/fleet/cron?p=P1" style={{ color: TOKENS.forest, fontWeight: 600 }}>
                  Fix list with causes
                </Link>
              </li>
            )}
            {abandoned.length > 0 && (
              <li>
                <strong>{abandoned.length} disabled jobs</strong> each need a keep-off / revive /
                delete decision.{' '}
                <Link href="/holding/it2/fleet/cron?p=P3" style={{ color: TOKENS.forest, fontWeight: 600 }}>
                  Decide
                </Link>
              </li>
            )}
            <li>
              <strong>Nothing logs an outcome.</strong> X1 below instruments all {rows.length} jobs with one wrapper.
            </li>
          </ul>
        </div>
      )}

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#FAF7EF', borderBottom: `1px solid ${TOKENS.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.ink }}>What exists, by shape</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Class</th>
                <th style={{ ...th, textAlign: 'right' }}>Active</th>
                <th style={{ ...th, textAlign: 'right' }}>Failing</th>
                <th style={th}>Shape</th>
                <th style={th}>Typical failure</th>
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => {
                const inClass = active.filter((r) => r.job_class === c.key);
                const bad = inClass.filter((r) => r.fail_7d > 0).length;
                if (inClass.length === 0) return null;
                return (
                  <tr key={c.key}>
                    <td style={{ ...td, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.title}</td>
                    <td style={{ ...td, fontFamily: MONO, textAlign: 'right' }}>{inClass.length}</td>
                    <td style={{ ...td, fontFamily: MONO, textAlign: 'right', color: bad ? TOKENS.terracotta : TOKENS.text3, fontWeight: bad ? 700 : 400 }}>
                      {bad}
                    </td>
                    <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2, maxWidth: 260 }}>{c.shape}</td>
                    <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2, maxWidth: 300 }}>{c.risk}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <Link href={`/holding/it2/fleet/cron?q=${c.key}`} style={{ fontSize: 11.5, color: TOKENS.forest, fontWeight: 600 }}>
                        View {inClass.length}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#FAF7EF', borderBottom: `1px solid ${TOKENS.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.ink }}>
            Where they break — the failures are in the arrows, not the boxes
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {FAILURES.map((f) => (
                <tr key={f.n}>
                  <td style={{ ...td, width: 34, textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block', width: 20, height: 20, lineHeight: '20px',
                        borderRadius: '50%', background: TOKENS.terracotta, color: '#FFF',
                        fontSize: 11, fontWeight: 700, fontFamily: MONO,
                      }}
                    >
                      {f.n}
                    </span>
                  </td>
                  <td style={{ ...td, width: 70, fontSize: 11, color: TOKENS.text2, whiteSpace: 'nowrap' }}>{f.where}</td>
                  <td style={{ ...td, width: 220, fontWeight: 600, whiteSpace: 'nowrap' }}>{f.title}</td>
                  <td style={{ ...td, fontSize: 12, color: TOKENS.text2, lineHeight: 1.45 }}>{f.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '9px 14px', background: '#FAF7EF', borderBottom: `1px solid ${TOKENS.border}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: TOKENS.ink }}>
            Cross-cutting fixes — one change, many jobs
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 44 }}>#</th>
                <th style={th}>Task</th>
                <th style={th}>Covers</th>
                <th style={th}>Why</th>
              </tr>
            </thead>
            <tbody>
              {XTASKS.map((x) => (
                <tr key={x.id} style={x.id === 'X1' ? { background: '#FBF8F2' } : undefined}>
                  <td style={{ ...td, fontFamily: MONO, fontWeight: 700, color: x.id === 'X1' ? TOKENS.terracotta : TOKENS.text2 }}>
                    {x.id}
                  </td>
                  <td style={{ ...td, fontWeight: x.id === 'X1' ? 600 : 400 }}>{x.task}</td>
                  <td style={{ ...td, fontFamily: MONO, fontSize: 11.5, whiteSpace: 'nowrap', color: TOKENS.text2 }}>{x.covers}</td>
                  <td style={{ ...td, fontSize: 11.5, color: TOKENS.text2 }}>{x.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: TOKENS.text3, lineHeight: 1.5, margin: '2px 0 0' }}>
        Source: <code>public.v_cron_register</code>. <strong>Not covered here and still blind:</strong>{' '}
        Make scenarios (no inspection path — they run outside the repo and outside{' '}
        <code>cockpit_audit_log</code>), Vercel API route internals, agent mention handoff chains,
        and Mews/TDP_BI_HUB jobs in the sibling project. Treat every count as a floor, not a ceiling.
      </p>
    </div>
  );
}
