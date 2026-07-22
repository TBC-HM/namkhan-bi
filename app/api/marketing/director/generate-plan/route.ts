// app/api/marketing/director/generate-plan/route.ts
// PBS 2026-07-21 pm (Newsletter Calendar v2): AI-generated per-group plan.
// Body: { property_id, start_date, end_date, cadence_per_week?, group_slug?,
//         audience_types?, regenerate_empty_only? }
//
// If group_slug is set, generates slots targeted at that group (adjusts cadence
// + tone accordingly) and stamps group_slug on each slot. If group_slug is
// omitted/null, cross-group cadence (existing behaviour) is used.
//
// Slots are written via public.fn_director_slot_upsert (SECURITY DEFINER RPC)
// which now accepts p_group_slug + p_parent_plan_run_id. Every call in this
// invocation shares one parent_plan_run_id (uuid) so a plan can be traced back.
//
// LLM: currently rule-based scaffolder — deterministic, respects goal weights,
// distributes N slots-per-week evenly across working days. AI copywriting hop
// is performed by /api/marketing/director/refine-slot on demand.

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  property_id?: number;
  start_date?: string;
  end_date?: string;
  cadence_per_week?: number;
  group_slug?: string | null;
  audience_types?: string[];
  regenerate_empty_only?: boolean;
  direction?: string;
};

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

function daysBetween(startISO: string, endISO: string): Date[] {
  const out: Date[] = [];
  const start = new Date(startISO + 'T00:00:00Z');
  const end = new Date(endISO + 'T00:00:00Z');
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) out.push(new Date(t));
  return out;
}

// Pick slot dates deterministically: cadence per week evenly spaced.
// cadence=1 → Tuesday. cadence=2 → Tuesday+Thursday. cadence=3 → Mon/Wed/Fri.
function pickSlotDates(all: Date[], cadencePerWeek: number): Date[] {
  if (cadencePerWeek <= 0) return [];
  const byWeek = new Map<string, Date[]>();
  for (const d of all) {
    // ISO week key
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = tmp.getUTCDay() || 7;
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const key = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(d);
  }
  // Preferred day indexes (Sun=0..Sat=6): Tue=2, Thu=4, Mon=1, Wed=3, Fri=5
  const preferred: number[][] = [[2],[2,4],[1,3,5],[1,3,5,4],[1,2,3,4,5],[1,2,3,4,5,0],[1,2,3,4,5,0,6]];
  const wanted = preferred[Math.min(cadencePerWeek, 7) - 1];
  const picked: Date[] = [];
  for (const week of byWeek.values()) {
    for (const dow of wanted) {
      const hit = week.find(d => d.getUTCDay() === dow);
      if (hit) picked.push(hit);
    }
  }
  return picked;
}

// Rotate through active goals weighted by weight. Higher weight = more slots.
function planGoalRotation(goals: Array<{ goal_key: string; goal_label: string; weight: number; active: boolean }>, count: number): string[] {
  const pool: string[] = [];
  for (const g of goals) if (g.active && g.weight > 0) for (let i=0;i<g.weight;i++) pool.push(g.goal_key);
  if (pool.length === 0 && goals[0]) return Array(count).fill(goals[0].goal_key);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(pool[i % pool.length]);
  return out;
}

function toneForGroup(slug: string | null | undefined): string {
  if (!slug) return 'informative';
  if (slug === 'returning-guests') return 'warm, personal, we-miss-you';
  if (slug === 'guests') return 'welcoming, informative, sightseeing tips';
  if (slug === 'dmc-contracted' || slug === 'dmc') return 'commercial, availability + rates, quick-turnaround';
  if (slug === 'fit' || slug === 'ota-traveller') return 'transactional, price + book, urgency';
  if (slug === 'ota') return 'brand-safe (no direct pricing), FYI updates';
  if (slug === 'btb') return 'partnership-focused, calendar & inventory led';
  return 'informative';
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const property_id = Number(body?.property_id);
  const start_date = String(body?.start_date || '').trim();
  const end_date = String(body?.end_date || '').trim();
  const cadence_per_week = Math.max(0, Math.min(7, Number(body?.cadence_per_week ?? 1)));
  const group_slug = body?.group_slug ? String(body.group_slug) : null;
  const audience_types = Array.isArray(body?.audience_types) && body!.audience_types!.length > 0
    ? body!.audience_types!.map(String)
    : ['b2c'];
  const regenerate_empty_only = body?.regenerate_empty_only !== false;
  const direction = body?.direction ? String(body.direction).trim().slice(0, 500) : '';

  if (!property_id || !start_date || !end_date) {
    return NextResponse.json({ ok: false, error: 'property_id + start_date + end_date required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Load goals · prefer per-group override, fall back to global (group_slug IS NULL).
  // Merge in JS: pull both scopes, then per goal_key pick the group-scoped row if present.
  const { data: goalsData, error: goalsErr } = await sb
    .from('v_director_goals').select('goal_key, goal_label, weight, active, group_slug')
    .eq('property_id', property_id)
    .or(group_slug ? `group_slug.eq.${group_slug},group_slug.is.null` : 'group_slug.is.null');
  if (goalsErr) return NextResponse.json({ ok: false, error: `load goals failed: ${goalsErr.message}` }, { status: 500 });
  type GoalRow = { goal_key: string; goal_label: string; weight: number; active: boolean; group_slug: string | null };
  const allGoals = (goalsData as GoalRow[] | null) ?? [];
  const byKey = new Map<string, GoalRow>();
  for (const g of allGoals) {
    const existing = byKey.get(g.goal_key);
    // Prefer per-group row (group_slug=our group) over global (NULL)
    if (!existing || (g.group_slug === group_slug && existing.group_slug === null)) byKey.set(g.goal_key, g);
  }
  const goals = Array.from(byKey.values()).sort((a, b) => b.weight - a.weight);

  // Existing slots in range (for regenerate_empty_only)
  let existingKeys = new Set<string>();
  if (regenerate_empty_only) {
    const { data: existing } = await sb
      .from('v_director_calendar').select('slot_date, audience_type, goal_tag')
      .eq('property_id', property_id).gte('slot_date', start_date).lte('slot_date', end_date);
    for (const e of (existing as Array<{ slot_date: string; audience_type: string; goal_tag: string }> | null) ?? []) {
      existingKeys.add(`${e.slot_date}|${e.audience_type}|${e.goal_tag}`);
    }
  }

  // Compute slot dates
  const allDays = daysBetween(start_date, end_date);
  const dates = pickSlotDates(allDays, cadence_per_week);
  const tone = toneForGroup(group_slug);

  // Distribute goals across dates
  const goalCycle = planGoalRotation(goals, dates.length * audience_types.length);

  const parent_plan_run_id = randomUUID();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  let idx = 0;
  for (const audience of audience_types) {
    for (const d of dates) {
      const goal_tag = goalCycle[idx++] ?? 'general';
      const key = `${ymd(d)}|${audience}|${goal_tag}`;
      if (regenerate_empty_only && existingKeys.has(key)) { skipped++; continue; }

      const goalLabel = goals.find(g => g.goal_key === goal_tag)?.goal_label ?? goal_tag;
      const title = group_slug
        ? `${goalLabel} · ${group_slug}`
        : `${goalLabel}`;
      const subject = `${goalLabel} — Namkhan Retreat`;
      const body_md = `Placeholder body. Tone: ${tone}. Goal: ${goalLabel}. Group: ${group_slug ?? 'all'}. Use Refine to generate AI copy tailored to this audience.`;

      const { error: upErr } = await sb.rpc('fn_director_slot_upsert', {
        p_property_id: property_id,
        p_slot_date: ymd(d),
        p_audience_type: audience,
        p_campaign_kind: 'broadcast',
        p_goal_tag: goal_tag,
        p_title: title,
        p_subject: subject,
        p_body_md: body_md,
        p_status: 'proposed',
        p_ai_notes: direction ? `tone=${tone} · direction=${direction}` : `tone=${tone}`,
        p_group_slug: group_slug,
        p_parent_plan_run_id: parent_plan_run_id,
      });
      if (upErr) { errors.push(`${ymd(d)}: ${upErr.message}`); continue; }
      created++;
    }
  }

  return NextResponse.json({
    ok: true,
    parent_plan_run_id,
    summary: {
      slots_created: created,
      slots_skipped_existing: skipped,
      dates_considered: dates.length,
      audiences: audience_types,
      cadence_per_week,
      group_slug,
      tone,
    },
    errors,
  });
}
