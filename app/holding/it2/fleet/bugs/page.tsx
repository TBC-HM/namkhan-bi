// app/holding/it2/fleet/bugs/page.tsx
// Bugs — IT2 Action Center sub-tab. Same data as /holding/bugs but
// embedded inside the IT2 nav (no separate sub-nav needed).
// Reads from v_bugs_with_agent_state, renders BugsClient.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BugsClient, { type BugRow } from '@/app/holding/bugs/_components/BugsClient';
import Link from 'next/link';
import { TOKENS, MONO } from '@/components/cockpit/tokens';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadBugs(): Promise<BugRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('v_bugs_with_agent_state')
    .select('id, dept_slug, body, status, fix_link, fix_label, created_by, page_url, viewport, user_agent, reporter_user_id, property_id, notes, created_at, acked_at, started_at, done_at, updated_at, agent_phase, agent_pr_url, agent_branch, agent_commit_sha, open_question, owner_answer, owner_answered_at, owner_answered_by, waiting_on, next_action')
    .in('status', ['new', 'acked', 'processing', 'done', 'wont_fix', 'dismissed'])
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as BugRow[];
}

export default async function It2BugsPage() {
  const rows = await loadBugs();
  const now = Date.now();
  const oneDayAgo  = now - 24 * 3600 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

  // ADR-224: was `!r.done_at && status not in (wont_fix,dismissed)`. 20 bugs had
  // status='done' with done_at NULL — the terminal transition never wrote a timestamp —
  // so the tile read 35 when 15 were open. Status is the truth; the clock is evidence.
  const openCount  = rows.filter((r) => r.status === 'new' || r.status === 'acked' || r.status === 'processing').length;
  // ADR-224: PBS 2026-08-05 — "we have no bucket indicated human needed". waiting_on was
  // already computed in v_bugs_with_agent_state and rendered nowhere.
  const needsYou   = rows.filter((r) => r.waiting_on === 'you'
    && (r.status === 'new' || r.status === 'acked' || r.status === 'processing')).length;
  const todayNew   = rows.filter((r) => new Date(r.created_at).getTime() >= oneDayAgo).length;
  const inProgress = rows.filter((r) => r.started_at && !r.done_at).length;
  const done7d     = rows.filter((r) => r.done_at && new Date(r.done_at).getTime() >= sevenDaysAgo).length;

  const doneWithTiming = rows.filter((r) => r.done_at && r.created_at);
  const avgHours = doneWithTiming.length > 0
    ? doneWithTiming.reduce((s, r) => s + (new Date(r.done_at!).getTime() - new Date(r.created_at).getTime()), 0) / doneWithTiming.length / 3600 / 1000
    : null;

  const kpis = [
    { label: 'Open',         value: String(openCount) },
    { label: 'Needs you',    value: String(needsYou) },
    { label: "Today's new",  value: String(todayNew) },
    { label: 'In progress',  value: String(inProgress) },
    { label: 'Done · 7d',    value: String(done7d) },
    { label: 'Avg time to fix', value: avgHours != null ? avgHours.toFixed(1) + 'h' : '—' },
  ];

  return (
    <div style={{ maxWidth: 1200, color: TOKENS.ink }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 2px' }}>Bug reports</h1>
          <p style={{ fontSize: 12, color: TOKENS.text2, margin: 0 }}>
            All bugs from the site-wide widget · open queue · agent-fixable items marked
          </p>
        </div>
        <Link href="/holding/bugs/done" style={{ fontSize: 12, fontWeight: 600, color: TOKENS.forest, textDecoration: 'none', border: `1px solid ${TOKENS.border}`, padding: '5px 12px', borderRadius: 5 }}>
          View done log →
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ background: TOKENS.bgRaised, border: `1px solid ${TOKENS.border}`, borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: TOKENS.text2 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: MONO, margin: '2px 0', color: TOKENS.ink }}>{k.value}</div>
          </div>
        ))}
      </div>

      <BugsClient initialRows={rows} />
    </div>
  );
}
