// app/api/cron/director-autopilot/route.ts
// PBS 2026-07-22 · AI Director Studio · Phase 2 autopilot.
//
// Weekly cron (Sun 23:00 UTC = Mon 06:00 Vientiane) — auto-extends the plan
// horizon to today + 30 days for every subscriber group. Per-group weights
// (from marketing.director_goals with group_slug filter · falls back to
// global when a group has no override) drive the goal rotation.
//
// Result: PBS opens the Director page → the 12-month calendar always has
// the next 30 days pre-filled with proposed slots, per group. No manual
// "Generate plan" click needed.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAMKHAN_ID = 260955;
const HORIZON_DAYS = 30;
const DEFAULT_CADENCE_PER_WEEK = 1.0;

async function handle(req: Request) {
  const url = new URL(req.url);
  const dry = url.searchParams.get('dry') === '1';
  const origin = new URL(req.url).origin;

  const sb = getSupabaseAdmin();

  // Groups to plan for (skip parent-only / archived slugs). Cadence is per-group.
  const { data: groupRows, error: gErr } = await sb
    .from('v_subscriber_groups').select('slug, name, newsletter_cadence_per_week').order('sort_order', { nullsFirst: false });
  if (gErr) return NextResponse.json({ ok: false, error: gErr.message }, { status: 500 });
  const groups = (groupRows as Array<{ slug: string; name: string; newsletter_cadence_per_week: number | string | null }> | null) ?? [];

  const start = new Date();
  const end   = new Date(start.getTime() + HORIZON_DAYS * 24 * 3600 * 1000);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const results: Array<{ group_slug: string; inserted?: number; error?: string; skipped?: boolean }> = [];

  for (const g of groups) {
    // Skip if the group has no active goals at all (per-group override where every weight=0
    // AND no global fallback that reaches non-zero for it). Cheap check via v_director_goals.
    const { data: goalCheck } = await sb
      .from('v_director_goals').select('goal_key, weight, active, group_slug')
      .eq('property_id', NAMKHAN_ID)
      .or(`group_slug.eq.${g.slug},group_slug.is.null`);
    const hasAnyActive = (goalCheck ?? []).some(r => r.active && (r.weight ?? 0) > 0);
    if (!hasAnyActive) { results.push({ group_slug: g.slug, skipped: true }); continue; }

    if (dry) { results.push({ group_slug: g.slug, skipped: true }); continue; }

    const cadence = Number(g.newsletter_cadence_per_week ?? DEFAULT_CADENCE_PER_WEEK);
    if (!Number.isFinite(cadence) || cadence <= 0) {
      results.push({ group_slug: g.slug, skipped: true }); continue;
    }

    // Fire the same generate-plan route so logic stays single-sourced.
    try {
      const r = await fetch(`${origin}/api/marketing/director/generate-plan`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          property_id: NAMKHAN_ID,
          start_date: ymd(start),
          end_date: ymd(end),
          cadence_per_week: cadence,
          group_slug: g.slug,
          regenerate_empty_only: true,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) results.push({ group_slug: g.slug, error: j?.error ?? String(r.status) });
      else results.push({ group_slug: g.slug, inserted: j?.inserted ?? 0 });
    } catch (e: unknown) {
      results.push({ group_slug: g.slug, error: e instanceof Error ? e.message : 'fetch_failed' });
    }
  }

  const total_inserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
  const errors = results.filter(r => r.error);
  return NextResponse.json({
    ok: errors.length === 0,
    horizon_days: HORIZON_DAYS,
    groups_total: groups.length,
    groups_planned: results.filter(r => r.inserted !== undefined).length,
    total_inserted,
    errors,
    results,
    ran_at: new Date().toISOString(),
  });
}

export async function GET(req: Request)  { return handle(req); }
export async function POST(req: Request) { return handle(req); }
