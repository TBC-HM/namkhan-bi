// app/holding/bugs/page.tsx
// PBS 2026-07-16 — bugs directory. All bug-widget reports land in
// public.cockpit_bugs; this page surfaces them with CTAs (ack/start/done/dismiss)
// and a "Copy for agent" clipboard action that emits a structured JSON blob a
// future auto-fix agent can pick up.
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import BugsClient, { type BugRow } from './_components/BugsClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const T = {
  paper: '#FFFFFF', hairline: '#E6DFCC', warm: '#F5F0E1',
  ink: '#1B1B1B', inkSoft: '#5A5A5A', green: '#084838',
};

const HOLDING_NAV = [
  { label: 'Overview', href: '/holding' },
  { label: 'Properties', href: '/holding/properties' },
  { label: 'Users', href: '/holding/users' },
  { label: 'Bugs', href: '/holding/bugs' },
];

async function loadBugs(): Promise<BugRow[]> {
  const sb = getSupabaseAdmin();
  // PBS 2026-07-17 — v_bugs_with_agent_state joins the latest agent run
  // so BugsClient can render agent phase + PR link inline per row.
  const { data } = await sb
    .from('v_bugs_with_agent_state')
    .select('id, dept_slug, body, status, fix_link, fix_label, created_by, page_url, viewport, user_agent, reporter_user_id, property_id, notes, created_at, acked_at, started_at, done_at, updated_at, agent_phase, agent_pr_url, agent_branch, agent_commit_sha')
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []) as BugRow[];
}

export default async function HoldingBugsPage() {
  const rows = await loadBugs();
  const now = Date.now();
  const oneDayAgo = now - 24 * 3600 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;

  const openCount = rows.filter((r) => !r.done_at && r.status !== 'dismissed').length;
  const todayNew = rows.filter((r) => new Date(r.created_at).getTime() >= oneDayAgo).length;
  const inProgress = rows.filter((r) => r.started_at && !r.done_at).length;
  const done7d = rows.filter((r) => r.done_at && new Date(r.done_at).getTime() >= sevenDaysAgo).length;

  const doneWithTiming = rows.filter((r) => r.done_at && r.created_at);
  const avgHours = doneWithTiming.length > 0
    ? doneWithTiming.reduce((s, r) => s + (new Date(r.done_at!).getTime() - new Date(r.created_at).getTime()), 0) / doneWithTiming.length / 3600 / 1000
    : null;

  return (
    <div style={{ background: T.paper, minHeight: '100vh', color: T.ink, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Sub-nav */}
      <nav style={{ borderBottom: `1px solid ${T.hairline}`, background: T.paper }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0 }}>
          {HOLDING_NAV.map((item) => {
            const active = item.href === '/holding/bugs';
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'inline-block',
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? T.green : T.inkSoft,
                  textDecoration: 'none',
                  borderBottom: active ? `2px solid ${T.green}` : '2px solid transparent',
                  marginBottom: -1,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div style={{ padding: 24 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 4 }}>
              Holding <span style={{ color: T.inkSoft, margin: '0 6px' }}>›</span> Bugs
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: T.ink }}>Bug reports</div>
            <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 4 }}>
              Every bug submitted via the site-wide widget. Use the CTAs to move through the lifecycle. &ldquo;Copy for agent&rdquo; emits a task payload for autonomous fixers.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Tile label="Open" value={String(openCount)} />
            <Tile label="Today's new" value={String(todayNew)} />
            <Tile label="In progress" value={String(inProgress)} />
            <Tile label="Done · 7d" value={String(done7d)} />
            <Tile label="Avg time to fix" value={avgHours != null ? avgHours.toFixed(1) + 'h' : '—'} />
          </div>

          <BugsClient initialRows={rows} />
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: T.paper, border: `1px solid ${T.hairline}`, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: T.inkSoft, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
