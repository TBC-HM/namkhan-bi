// app/holding/it2/system/live/page.tsx
// Builder heartbeat UI (ADR-209, 2026-07-30). One box per builder/verifier
// round — live ones pulse, finished ones fade.
// action-center-inbox-v1 §OI#2 + finding #31 (2026-08-04): SSR now also loads
// push-ledger evidence + silent in_progress briefs, and ?brief=<slug> filters
// the board (the 👁 Watch CTA on module cards deep-links here).
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { LiveBuildersView, type LiveRow, type PushRow, type SilentRow } from './LiveBuildersView';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function LiveBuildersPage({
  searchParams,
}: {
  searchParams?: { brief?: string };
}) {
  const sb = getSupabaseAdmin();
  const sixHoursAgo = new Date(Date.now() - 6 * 3600_000).toISOString();

  const [liveRes, pushRes, briefRes] = await Promise.all([
    sb.from('v_builder_liveness')
      .select('*')
      .order('last_beat_at', { ascending: false })
      .limit(60),
    (sb as any).from('v_push_ledger')
      .select('id, path, branch, message, ok, http, pushed_at')
      .gte('pushed_at', sixHoursAgo)
      .order('pushed_at', { ascending: false })
      .limit(120),
    (sb as any).from('v_build_briefs_index')
      .select('slug, title, status, last_updated_at')
      .eq('status', 'in_progress'),
  ]);

  const rows = (liveRes.data ?? []) as LiveRow[];
  const withLive = new Set(rows.filter((r) => r.alive).map((r) => r.brief_slug));
  const lastBeatBySlug: Record<string, string> = {};
  for (const r of rows) {
    if (!lastBeatBySlug[r.brief_slug] || lastBeatBySlug[r.brief_slug] < r.last_beat_at) {
      lastBeatBySlug[r.brief_slug] = r.last_beat_at;
    }
  }
  const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString();
  const silent = ((briefRes?.data ?? []) as SilentRow[]).filter(
    (b) => !withLive.has(b.slug) && (!lastBeatBySlug[b.slug] || lastBeatBySlug[b.slug] < twentyMinAgo),
  );

  return (
    <LiveBuildersView
      initial={rows}
      initialPushes={(pushRes?.data ?? []) as PushRow[]}
      initialSilent={silent}
      initialError={liveRes.error?.message ?? null}
      filterBrief={searchParams?.brief ?? null}
    />
  );
}
