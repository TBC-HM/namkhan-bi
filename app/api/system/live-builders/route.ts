// app/api/system/live-builders/route.ts
// Read surface for the builder heartbeat UI (ADR-209). Polled client-side
// every 10s from /holding/it2/system/live.
// action-center-inbox-v1 §OI#2 (2026-08-04): upgraded — also returns
// (a) recent push-ledger rows so each live box can stream the worker's landed
//     commits (claims backed by shipped evidence),
// (b) "silent" briefs: status=in_progress with NO live heartbeat — a fired
//     session that died without claiming/beating becomes a visible red box,
//     not nothing. (No fire log exists yet, so silence is derived from brief
//     state vs heartbeat state — logged as agent decision in the build log.)

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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

  if (liveRes.error) {
    return NextResponse.json({ error: liveRes.error.message }, { status: 500 });
  }

  const rows = liveRes.data ?? [];
  const pushes = pushRes?.data ?? [];

  // Silent deaths: briefs claiming to be in_progress with no live lease AND no
  // beat in the last 20 minutes — the builder is gone but the brief says busy.
  const withLive = new Set(
    rows.filter((r: any) => r.alive).map((r: any) => r.brief_slug),
  );
  const lastBeatBySlug: Record<string, string> = {};
  for (const r of rows) {
    const s = (r as any).brief_slug;
    if (!lastBeatBySlug[s] || lastBeatBySlug[s] < (r as any).last_beat_at) {
      lastBeatBySlug[s] = (r as any).last_beat_at;
    }
  }
  const twentyMinAgo = new Date(Date.now() - 20 * 60_000).toISOString();
  const silent = (briefRes?.data ?? []).filter(
    (b: any) =>
      !withLive.has(b.slug) &&
      (!lastBeatBySlug[b.slug] || lastBeatBySlug[b.slug] < twentyMinAgo),
  );

  return NextResponse.json({ rows, pushes, silent });
}
