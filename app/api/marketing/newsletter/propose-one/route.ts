// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-22 · Grounded proposer v2.
//
// v1 fed Claude just the seed text + a hardcoded identity paragraph — Claude was
// inventing prices, links, and property facts. v2 injects the real DB context so
// the model has to stay factual:
//
//   - v_marketing_email_general_rules · the 15+ active guardrails
//   - v_marketing_internal_link_catalog · the 4 pinned Cloudbeds URLs + T&Cs
//   - v_group_email_policy · per-group constraints (OTA Traveller only gets 3
//     lifecycle types, plain text, no links, fixed schedules — enforced here)
//   - v_director_goals · per-group weights (falls back to global) so tone matches
//   - v_property_retreats + v_activities_catalog · real upsell inventory
//   - marketing.property_email_settings · sender identity + footer
//
// The route still returns { ok, proposal: { subject, body_md, goal_tag } } to
// stay backward-compatible with the Director autocompose cron + the Refine flow.
// PUT (save-as-draft) is unchanged from v1.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';
export const maxDuration = 60;

const NAMKHAN_ID = 260955;

const IDENTITY = [
  'You are the marketing writer for The Namkhan Luang Prabang, a 30-key riverside',
  'boutique retreat outside Luang Prabang, Laos. Your voice is calm, understated,',
  'warm, never salesy. Write for repeat travellers who value quiet, nature, and craft.',
  'Do not use emojis. Do not fabricate offers. Do not invent prices or product names.',
  'If a fact is not in the CONTEXT you are given, do not include it.',
].join(' ');

const OUTPUT_JSON_RULES = [
  'Return STRICT JSON with keys:',
  '  subject  (string, <= 65 chars, no exclamation marks)',
  '  body_md  (string, plain Markdown, 4-8 short paragraphs, greet with "Dear {{first_name}},")',
  '  goal_tag (short slug like "green-season-family" or "birthday-warm-wishes" · optional)',
].join(' ');

const OUTPUT_PLAIN_RULES = [
  'Return STRICT JSON with keys:',
  '  subject  (string, <= 55 chars, no exclamation marks, no special characters, no ALL CAPS)',
  '  body_md  (string, PLAIN TEXT ONLY · no Markdown, no HTML, no bullet points,',
  '           no URLs, no images, no formatting, 3-5 short paragraphs.',
  '           Greet with "Dear {{first_name}}," and sign off with the sender name + role.)',
  '  goal_tag (short slug · optional)',
].join(' ');

// Extra SYSTEM rules layered on when the group policy forces plain text + blocks links.
// Goal: pass OTA-sourced inbox filters (Booking.com / Airbnb / Expedia / Ctrip / Agoda relays).
// These filters flag standard marketing signals — strip them upfront.
const ANTI_SPAM_FILTER_RULES = [
  'Constraints for maximum inbox deliverability (OTA-sourced address filters):',
  '- Do NOT use marketing verbs: book, reserve, buy, order, offer, discount, save, exclusive, limited, hurry, act now, click, tap, register, subscribe.',
  '- Do NOT include prices, promo codes, percentages, currency symbols, or the words "free", "gift", "bonus".',
  '- Do NOT use ALL CAPS words, multiple exclamation marks, or multiple question marks.',
  '- Do NOT mention the OTA brand (Booking.com, Airbnb, Expedia, Agoda, Ctrip, etc.) by name.',
  '- Do NOT include tracking pixels, unsubscribe text, or any URL — the send layer adds compliance footer separately.',
  '- Use short warm sentences. Indicative mood, not imperative.',
  '- Sign off with a real named person + role + hotel physical address on the last line — improves sender reputation.',
  '- Reference the guest\'s stay dates naturally where relevant. Do not say "your reservation".',
  '- Keep under ~180 words total. Long emails flag more heavily.',
].join('\n');

type ProposeBody = {
  property_id?: number;
  kind?: string;
  seed_text?: string;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
  group_slug?: string | null;
  instruction?: string;
  prior?: { subject?: string; body_md?: string };
};

type SaveBody = {
  property_id?: number;
  kind?: 'broadcast' | 'lifecycle';
  subject?: string;
  body_md?: string;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
  goal_tag?: string | null;
  name?: string;
};

function normalizeKind(k: unknown): 'broadcast' | 'lifecycle' {
  return k === 'lifecycle' ? 'lifecycle' : 'broadcast';
}

type Policy = {
  group_slug: string;
  allowed_kinds: string[];
  force_plain_text: boolean;
  block_links: boolean;
  block_images: boolean;
  booking_confirm_hours_after: number | null;
  before_checkin_days: number | null;
  after_checkout_hours: number | null;
  notes: string | null;
};

async function loadContext(sb: ReturnType<typeof getSupabaseAdmin>, group_slug: string | null) {
  const [rulesR, linksR, retreatsR, activitiesR, sendersR, goalsR, policyR, groupR] = await Promise.all([
    sb.from('v_marketing_email_general_rules').select('rule_type, rule_text, group_slug').limit(50),
    sb.from('v_marketing_internal_link_catalog').select('section, anchor_hint, url, title, description').eq('property_id', NAMKHAN_ID).limit(20),
    sb.from('v_property_retreats').select('name, short_description, focus_notes').eq('property_id', NAMKHAN_ID).eq('is_active', true).limit(10),
    sb.from('v_activities_catalog').select('activity_name, short_description, price_incl_taxes_usd').eq('property_id', NAMKHAN_ID).limit(15),
    sb.from('v_marketing_property_email_settings').select('from_name, from_email, footer_text, unsubscribe_url').eq('property_id', NAMKHAN_ID).maybeSingle(),
    sb.from('v_director_goals').select('goal_key, goal_label, weight, group_slug').eq('property_id', NAMKHAN_ID).eq('active', true),
    group_slug
      ? sb.from('v_group_email_policy').select('*').eq('group_slug', group_slug).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    group_slug
      ? sb.from('v_subscriber_groups').select('slug, name, voice_type, voice_summary').eq('slug', group_slug).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  // Guardrails: prefer group-scoped when present, else global (NULL group_slug).
  type RuleRow = { rule_type: string; rule_text: string; group_slug: string | null };
  const allRules = (rulesR.data as RuleRow[] | null) ?? [];
  const rules = allRules.filter(r => r.group_slug === group_slug || r.group_slug === null);

  // Editorial goals: per-group override wins, global fallback
  type GoalRow = { goal_key: string; goal_label: string; weight: number; group_slug: string | null };
  const allGoals = (goalsR.data as GoalRow[] | null) ?? [];
  const byKey = new Map<string, GoalRow>();
  for (const g of allGoals) {
    const existing = byKey.get(g.goal_key);
    if (!existing || (g.group_slug === group_slug && existing.group_slug === null)) byKey.set(g.goal_key, g);
  }
  const goals = Array.from(byKey.values())
    .filter(g => (g.weight ?? 0) > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const policy: Policy | null = ((policyR as { data?: Policy | null }).data) ?? null;

  type GroupVoice = { slug: string; name: string; voice_type: 'b2c'|'b2b'|'mixed' | null; voice_summary: string | null };
  const group: GroupVoice | null = ((groupR as { data?: GroupVoice | null }).data) ?? null;

  return {
    rules,
    links: (linksR.data as Array<{ section: string; anchor_hint: string; url: string; title: string | null; description: string | null }> | null) ?? [],
    retreats: (retreatsR.data as Array<{ name: string; short_description: string | null; focus_notes: string | null }> | null) ?? [],
    activities: (activitiesR.data as Array<{ activity_name: string; short_description: string | null; price_incl_taxes_usd: number | null }> | null) ?? [],
    sender: (sendersR.data as { from_name: string | null; from_email: string | null; footer_text: string | null; unsubscribe_url: string | null } | null) ?? null,
    goals,
    policy,
    group,
  };
}

function assembleUserPrompt(
  body: ProposeBody,
  ctx: Awaited<ReturnType<typeof loadContext>>,
): string {
  const parts: string[] = [];
  parts.push('### CAMPAIGN');
  parts.push(`kind: ${body.kind ?? 'broadcast'}`);
  parts.push(`target_date: ${body.target_date ?? 'flexible'}`);
  parts.push(`audience_type: ${body.audience_type ?? 'b2c'}`);
  if (body.group_slug) parts.push(`audience_group: ${body.group_slug}`);
  parts.push(`seed_text: ${(body.seed_text ?? '').trim()}`);

  if (ctx.group?.voice_summary) {
    parts.push('');
    parts.push(`### GROUP VOICE · ${ctx.group.name} (${ctx.group.voice_type ?? 'b2c'})`);
    parts.push('Read this before writing. It defines who they are and how to speak to them.');
    parts.push(ctx.group.voice_summary);
  }

  if (ctx.policy) {
    parts.push('');
    parts.push('### GROUP POLICY (HARD CONSTRAINTS)');
    parts.push(`allowed_kinds: [${ctx.policy.allowed_kinds.join(', ')}]`);
    if (ctx.policy.force_plain_text) parts.push('output: PLAIN TEXT ONLY · no Markdown · no HTML');
    if (ctx.policy.block_links)      parts.push('links: NONE ALLOWED · do not include any URLs');
    if (ctx.policy.block_images)     parts.push('images: NONE ALLOWED');
    if (ctx.policy.notes)            parts.push(`notes: ${ctx.policy.notes}`);
  }

  parts.push('');
  parts.push('### GUARDRAILS (LOAD-BEARING · you must follow these)');
  if (ctx.rules.length === 0) parts.push('(none loaded)');
  else for (const r of ctx.rules) parts.push(`- [${r.rule_type}] ${r.rule_text}`);

  if (!ctx.policy?.block_links && ctx.links.length > 0) {
    parts.push('');
    parts.push('### LINK CATALOG · the ONLY valid URLs (use anchor_hint text, never raw URL)');
    for (const l of ctx.links) {
      parts.push(`- [${l.section}] "${l.anchor_hint}" → ${l.url}${l.description ? ` (${l.description})` : ''}`);
    }
  }

  if (ctx.retreats.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · RETREATS (facts only from here)');
    for (const r of ctx.retreats) {
      parts.push(`- ${r.name}${r.short_description ? ` — ${r.short_description}` : ''}`);
    }
  }

  if (ctx.activities.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · ACTIVITIES (upsell inventory)');
    for (const a of ctx.activities.slice(0, 10)) {
      parts.push(`- ${a.activity_name}${a.short_description ? ` — ${a.short_description}` : ''}`);
    }
  }

  if (ctx.goals.length > 0) {
    parts.push('');
    parts.push('### EDITORIAL GOALS FOR THIS AUDIENCE (top 5 by weight · use to steer topic)');
    for (const g of ctx.goals) parts.push(`- ${g.goal_key} (weight ${g.weight}) — ${g.goal_label}`);
  }

  if (ctx.sender) {
    parts.push('');
    parts.push('### SENDER IDENTITY');
    if (ctx.sender.from_name)   parts.push(`from_name: ${ctx.sender.from_name}`);
    if (ctx.sender.footer_text) parts.push(`footer: ${ctx.sender.footer_text}`);
  }

  if (body.instruction && body.prior) {
    parts.push('');
    parts.push('### REFINE MODE — previous draft below · apply the instruction, keep tone + audience');
    parts.push(`Previous subject: ${body.prior.subject ?? ''}`);
    parts.push('Previous body:');
    parts.push(body.prior.body_md ?? '');
    parts.push(`Refine instruction: ${body.instruction}`);
  }

  return parts.join('\n');
}

async function callAnthropic(system: string, userPrompt: string): Promise<{ subject: string; body_md: string; goal_tag: string | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('anthropic_api_key_missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-7',
      max_tokens: 1600,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('anthropic_' + res.status + ' ' + t.slice(0, 200));
  }
  const j = await res.json();
  const text = j?.content?.[0]?.text || '{}';
  const parsed = JSON.parse(text);
  return {
    subject: String(parsed.subject || '').slice(0, 120),
    body_md: String(parsed.body_md || ''),
    goal_tag: parsed.goal_tag ? String(parsed.goal_tag).slice(0, 80) : null,
  };
}

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const seed = String(body.seed_text ?? '').trim();
  if (!seed) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const group_slug = body.group_slug ? String(body.group_slug) : null;

  const sb = getSupabaseAdmin();
  const ctx = await loadContext(sb, group_slug);

  // Enforce group policy · reject a broadcast for an audience that only allows lifecycle
  const requestedKind = body.kind ? String(body.kind) : 'broadcast';
  if (ctx.policy && ctx.policy.allowed_kinds.length > 0 && !ctx.policy.allowed_kinds.includes(requestedKind)) {
    return NextResponse.json({
      ok: false,
      error: `policy_violation: group ${group_slug} only allows [${ctx.policy.allowed_kinds.join(', ')}]`,
    }, { status: 400 });
  }

  const outputRules = ctx.policy?.force_plain_text ? OUTPUT_PLAIN_RULES : OUTPUT_JSON_RULES;
  // Layer the anti-spam-filter rules on top when policy forces plain text + blocks links
  // (OTA Traveller path today · could apply to any future group with the same pattern).
  const antiSpam = (ctx.policy?.force_plain_text && ctx.policy?.block_links) ? `\n\n${ANTI_SPAM_FILTER_RULES}` : '';
  const system = `${IDENTITY}\n\n${outputRules}${antiSpam}`;
  const userPrompt = assembleUserPrompt(body, ctx);

  try {
    const proposal = await callAnthropic(system, userPrompt);
    return NextResponse.json({
      ok: true,
      proposal,
      context_used: {
        rules: ctx.rules.length,
        links: ctx.policy?.block_links ? 0 : ctx.links.length,
        retreats: ctx.retreats.length,
        activities: ctx.activities.length,
        goals: ctx.goals.length,
        policy_applied: !!ctx.policy,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// PUT unchanged · save proposal as guest.campaigns draft
export async function PUT(req: NextRequest) {
  let body: SaveBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const property_id = Number(body.property_id);
  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const subject = String(body.subject ?? '').trim();
  const body_md = String(body.body_md ?? '').trim();
  if (!subject || !body_md) {
    return NextResponse.json({ ok: false, error: 'subject_and_body_required' }, { status: 400 });
  }
  const kind = normalizeKind(body.kind);
  const name = String(body.name || subject).slice(0, 200);
  const planned_date = body.target_date ? String(body.target_date).slice(0, 10) : null;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.schema('guest').from('campaigns').insert({
    property_id,
    name,
    subject,
    body_md,
    campaign_kind: kind,
    status: 'draft',
    schedule_kind: 'once',
    planned_date,
    audience_type: body.audience_type ?? 'b2c',
    goal_tag: body.goal_tag ?? null,
    created_by: 'propose-newsletter-ai',
  }).select('campaign_id').maybeSingle();

  if (error || !data?.campaign_id) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign_id: data.campaign_id });
}
