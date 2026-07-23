// app/api/marketing/director/generate-plan/route.ts
// PBS 2026-07-23 · Plan generator v3 — AI propose stage.
// Body: { property_id, start_date, end_date, cadence_per_week?, group_slug?,
//         audience_types?, regenerate_empty_only?, direction? }
//
// v2 was a rule-based scaffolder: direction text was only stamped into
// p_ai_notes and influenced nothing.
// v3: after dates + goal rotation are computed, ONE Anthropic call per
// generation (chunked at 60 slots per call when larger) produces per-slot
// { title, concept } grounded in: the owner's direction text, the group's
// voice_type/voice_summary (v_subscriber_groups), the slot's goal
// (label + weight), the slot month/season, and a one-line brand anchor
// (v_reality_profile location/positioning). Then per slot:
//   p_title   = AI title
//   p_subject = AI title + ' — The Namkhan'
//   p_body_md = concept  (the concept IS the brief — flows into the draft
//               campaign on accept via fn_director_slot_approve, and from
//               there into propose-one's SLOT CONCEPT prompt section)
// FALLBACK: any AI failure (call error, unparseable/incomplete JSON) falls
// back to the v2 rule-based title/subject/body for the affected slots and the
// response carries ai: { fallback: true, error }. Plan generation never 500s
// on AI failure.
//
// Slots are written via public.fn_director_slot_upsert (SECURITY DEFINER RPC).
// Every call in this invocation shares one parent_plan_run_id (uuid).

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const AI_CHUNK_SIZE = 60;

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
  const wanted = preferred[Math.min(cadencePerWeek, 7) - 1] ?? [2];
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
  const active = goals.filter(g => g.active && g.weight > 0);
  if (active.length === 0) return Array(count).fill(goals[0]?.goal_key ?? 'general');
  const acc = active.map(g => ({ key: g.goal_key, w: g.weight, credit: 0 }));
  const total = acc.reduce((s, a) => s + a.w, 0);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    for (const a of acc) a.credit += a.w;
    acc.sort((x, y) => y.credit - x.credit || x.key.localeCompare(y.key));
    out.push(acc[0].key);
    acc[0].credit -= total;
  }
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

// Green season May–Oct · dry season Nov–Apr (matches emailWritingRules canon).
function seasonFor(dateISO: string): string {
  const m = Number(dateISO.slice(5, 7));
  return (m >= 5 && m <= 10)
    ? 'green season (warm rains, the river full and wild, quieter, retreat-friendly)'
    : 'dry season (warm sunny days, cool evenings on the river, peak months)';
}

// ── AI propose stage ─────────────────────────────────────────────────────────

type SlotSeed = {
  date: string;
  audience: string;
  goal_tag: string;
  goal_label: string;
  goal_weight: number;
};

type SlotIdea = { title: string; concept: string };

async function callAnthropic(system: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('anthropic_api_key_missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('anthropic_' + res.status + ' ' + t.slice(0, 200));
  }
  const j = await res.json();
  return j?.content?.[0]?.text || '';
}

function stripCodeFences(text: string): string {
  let s = text.trim();
  const fenced = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```\s*$/);
  if (fenced) return fenced[1].trim();
  if (s.startsWith('```')) s = s.replace(/^```[a-zA-Z]*\s*/, '');
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

const PLAN_SYSTEM = [
  'You are the newsletter planning editor for The Namkhan — a 30-key riverside boutique retreat 20 minutes downriver from Luang Prabang, Laos.',
  'For each campaign slot you receive, you write an email TITLE and a 1-2 sentence CONCEPT (the creative brief a copywriter will follow later).',
  'TITLE rules: <= 60 chars · specific and evocative, never generic ("Retreats · guests-int" is what you are replacing) · no exclamation marks · no ALL CAPS · no emoji.',
  'CONCEPT rules: 1-2 sentences · name the angle, the seasonal/sensory hook, and what the reader should feel or do · grounded in the property and the audience voice · never salesy, no prices, no invented events or offers.',
  'Vary the angles across slots — consecutive slots must not repeat the same hook, even for the same goal.',
  'Return STRICT JSON only: an array with EXACTLY one object per slot, same order as given:',
  '[{ "date": "YYYY-MM-DD", "goal_tag": "...", "title": "...", "concept": "..." }]',
  'No code fences, no preamble, no trailing text.',
].join('\n');

function buildPlanPrompt(
  slots: SlotSeed[],
  direction: string,
  tone: string,
  group: { slug: string; name: string; voice_type: string | null; voice_summary: string | null } | null,
  brandAnchor: string,
): string {
  const parts: string[] = [];
  parts.push('### PROPERTY');
  parts.push(brandAnchor);
  parts.push('Seasons: green season May–October (warm rains, wild river, quieter) · dry season November–April (warm days, cool river evenings, peak).');

  parts.push('');
  parts.push('### AUDIENCE');
  if (group) {
    parts.push(`group: ${group.name} (${group.slug} · ${group.voice_type ?? 'b2c'})`);
    if (group.voice_summary) parts.push(`voice: ${group.voice_summary}`);
  } else {
    parts.push('group: all subscriber groups (mixed)');
  }
  parts.push(`tone: ${tone}`);

  parts.push('');
  parts.push("### DIRECTION FROM THE OWNER (steer every title and concept with this — it outranks everything below)");
  parts.push(direction || '(none given — plan from goals, season and audience voice)');

  parts.push('');
  parts.push('### SLOTS (one line each · write one title + concept per line, same order)');
  slots.forEach((s, i) => {
    parts.push(`${i + 1}. ${s.date} · audience ${s.audience} · goal ${s.goal_tag} (weight ${s.goal_weight}) — "${s.goal_label}" · ${seasonFor(s.date)}`);
  });

  parts.push('');
  parts.push(`### OUTPUT`);
  parts.push(`STRICT JSON array of exactly ${slots.length} objects, same order: [{ "date", "goal_tag", "title", "concept" }]. Nothing else.`);
  return parts.join('\n');
}

// One call per chunk of <= AI_CHUNK_SIZE slots. Returns ideas aligned by index
// (null where the AI response was missing/invalid for that slot).
async function proposeSlotIdeas(
  slots: SlotSeed[],
  direction: string,
  tone: string,
  group: { slug: string; name: string; voice_type: string | null; voice_summary: string | null } | null,
  brandAnchor: string,
): Promise<{ ideas: Array<SlotIdea | null>; error: string | null }> {
  const ideas: Array<SlotIdea | null> = Array(slots.length).fill(null);
  let firstError: string | null = null;

  for (let offset = 0; offset < slots.length; offset += AI_CHUNK_SIZE) {
    const chunk = slots.slice(offset, offset + AI_CHUNK_SIZE);
    try {
      const prompt = buildPlanPrompt(chunk, direction, tone, group, brandAnchor);
      const text = await callAnthropic(PLAN_SYSTEM, prompt, 4000);
      const parsed = JSON.parse(stripCodeFences(text));
      if (!Array.isArray(parsed)) throw new Error('plan_json_not_array');
      for (let i = 0; i < chunk.length; i++) {
        const item = parsed[i] as { date?: unknown; goal_tag?: unknown; title?: unknown; concept?: unknown } | undefined;
        if (!item || typeof item !== 'object') continue;
        const title = String(item.title ?? '').trim().slice(0, 120);
        const concept = String(item.concept ?? '').trim().slice(0, 600);
        if (!title || !concept) continue;
        // Sanity: date/goal must match the slot we asked for (order guard).
        if (String(item.date ?? '') !== chunk[i].date) continue;
        if (String(item.goal_tag ?? '') !== chunk[i].goal_tag) continue;
        ideas[offset + i] = { title, concept };
      }
    } catch (e) {
      if (!firstError) firstError = (e as Error).message;
      // leave this chunk's ideas as null → rule-based fallback per slot
    }
  }
  return { ideas, error: firstError };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const property_id = Number(body?.property_id);
  const start_date = String(body?.start_date || '').trim();
  const end_date = String(body?.end_date || '').trim();
  const cadence_per_week = Math.max(0, Math.min(7, Math.round(Number(body?.cadence_per_week ?? 1))));
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

  // Group voice + brand anchor for the AI propose stage (both optional — failures degrade to rule-based).
  let group: { slug: string; name: string; voice_type: string | null; voice_summary: string | null } | null = null;
  if (group_slug) {
    const { data } = await sb.from('v_subscriber_groups').select('slug, name, voice_type, voice_summary').eq('slug', group_slug).maybeSingle();
    group = (data as { slug: string; name: string; voice_type: string | null; voice_summary: string | null } | null) ?? null;
  }
  let brandAnchor = 'The Namkhan — 30-key riverside boutique retreat on the Nam Khan river, 20 minutes downriver from Luang Prabang, Laos.';
  {
    const { data } = await sb.from('v_reality_profile').select('location, positioning').eq('property_id', property_id).maybeSingle();
    const reality = (data as { location: string | null; positioning: string | null } | null) ?? null;
    if (reality?.location) {
      brandAnchor = `The Namkhan — 30-key riverside boutique retreat · ${reality.location}${reality.positioning ? ` · ${reality.positioning}` : ''}`;
    }
  }

  // Existing slots in range (for regenerate_empty_only)
  const existingKeys = new Set<string>();
  if (regenerate_empty_only) {
    const { data: existing } = await sb
      .from('v_director_calendar').select('slot_date, audience_type, goal_tag, group_slug')
      .eq('property_id', property_id).gte('slot_date', start_date).lte('slot_date', end_date);
    for (const e of (existing as Array<{ slot_date: string; audience_type: string; goal_tag: string; group_slug?: string | null }> | null) ?? []) {
      existingKeys.add(`${e.slot_date}|${e.audience_type}|${e.goal_tag}|${e.group_slug ?? ''}`);
    }
  }

  // Compute slot dates
  const allDays = daysBetween(start_date, end_date);
  const dates = pickSlotDates(allDays, cadence_per_week);
  const tone = toneForGroup(group_slug);

  // Distribute goals across dates
  const goalCycle = planGoalRotation(goals, dates.length * audience_types.length);

  // Build the flat slot list in the SAME order the write loop consumes it.
  const slotSeeds: SlotSeed[] = [];
  {
    let i = 0;
    for (const audience of audience_types) {
      for (const d of dates) {
        const goal_tag = goalCycle[i++] ?? 'general';
        const g = goals.find(x => x.goal_key === goal_tag);
        slotSeeds.push({
          date: ymd(d),
          audience,
          goal_tag,
          goal_label: g?.goal_label ?? goal_tag,
          goal_weight: g?.weight ?? 0,
        });
      }
    }
  }

  // AI propose stage — one Anthropic call per <=60-slot chunk. Never fatal.
  const { ideas, error: aiError } = slotSeeds.length > 0
    ? await proposeSlotIdeas(slotSeeds, direction, tone, group, brandAnchor)
    : { ideas: [] as Array<SlotIdea | null>, error: null };
  const aiUsed = ideas.filter(Boolean).length;

  const parent_plan_run_id = randomUUID();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < slotSeeds.length; i++) {
    const s = slotSeeds[i];
    const key = `${s.date}|${s.audience}|${s.goal_tag}|${group_slug ?? ''}`;
    if (regenerate_empty_only && existingKeys.has(key)) { skipped++; continue; }

    const idea = ideas[i];
    const title = idea
      ? idea.title
      : (group_slug ? `${s.goal_label} · ${group_slug}` : s.goal_label);
    const subject = idea
      ? `${idea.title} — The Namkhan`
      : `${s.goal_label} — The Namkhan`;
    const body_md = idea
      ? idea.concept
      : `Placeholder body. Tone: ${tone}. Goal: ${s.goal_label}. Group: ${group_slug ?? 'all'}. Use Refine to generate AI copy tailored to this audience.`;
    const noteBits = [`tone=${tone}`];
    if (direction) noteBits.push(`direction=${direction}`);
    noteBits.push(idea ? 'concept=ai' : 'concept=fallback');

    const { error: upErr } = await sb.rpc('fn_director_slot_upsert', {
      p_property_id: property_id,
      p_slot_date: s.date,
      p_audience_type: s.audience,
      p_campaign_kind: 'broadcast',
      p_goal_tag: s.goal_tag,
      p_title: title,
      p_subject: subject,
      p_body_md: body_md,
      p_status: 'proposed',
      p_ai_notes: noteBits.join(' · '),
      p_group_slug: group_slug,
      p_parent_plan_run_id: parent_plan_run_id,
    });
    if (upErr) { errors.push(`${s.date}: ${upErr.message}`); continue; }
    created++;
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
    ai: {
      used: aiUsed,
      total: slotSeeds.length,
      ai_fallback: aiUsed < slotSeeds.length,
      ...(aiError ? { error: aiError } : {}),
    },
    errors,
  });
}
