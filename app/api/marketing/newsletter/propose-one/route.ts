// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-23 · Grounded proposer v3 — Liam → Saya → Veda chain.
//
// v2 was a single Claude call with rich context.
// v3 splits the work across 3 identities from cockpit_agent_identity:
//
//   Liam (curator) — picks 3 approved photos with captions from v_marketing_media_page
//                    matching the group's story area. Feeds visual+caption anchor to Saya.
//   Saya (writer)  — the primary draft call. Same context v2 loaded + Liam's picks.
//   Veda (critic)  — scores the draft against a rubric (sensory anchor · forbidden
//                    phrases · URL only from catalog · signature · length · voice).
//                    On score < 60, Saya gets one retry with Veda's critique injected.
//
// Response adds agent_trace[] + veda so /needs-review can show reasoning.
// Backward-compatible: still returns { ok, proposal: { subject, body_md, goal_tag } }.
// PUT (save-as-draft) unchanged from v2.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';
export const maxDuration = 90;

const NAMKHAN_ID = 260955;

const AGENT_LIAM = 'e4178c65-7314-4be6-aab3-8aa008b73e0f';
const AGENT_SAYA = '6eb7653c-1db1-4ccf-b688-04327c433111';
const AGENT_VEDA = '5dc1d7ab-a671-4946-8f09-3d08d3602dbc';

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

// Group → preferred property_area for Liam's photo pick.
// Order matters — first match wins in the SQL filter.
const GROUP_AREA_HINT: Record<string, string[]> = {
  'retreats':            ['retreats', 'jungle-spa', 'organic-farm', 'roots'],
  'dmc-contracted':      ['hotel-property', 'accommodation', 'roots'],
  'ota-traveller':       ['hotel-property', 'accommodation'],
  'guests-sea':          ['accommodation', 'organic-farm', 'roots'],
  'guests-int':          ['accommodation', 'jungle-spa', 'roots', 'organic-farm'],
  'returning-guests':    ['jungle-spa', 'roots', 'accommodation'],
  'weddings-events':     ['hotel-property', 'facilities'],
};

type PhotoPick = { caption: string; alt_text: string | null; property_area: string | null; asset_id: string };

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

  type RuleRow = { rule_type: string; rule_text: string; group_slug: string | null };
  const allRules = (rulesR.data as RuleRow[] | null) ?? [];
  const rules = allRules.filter(r => r.group_slug === group_slug || r.group_slug === null);

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

// Liam · pick 3 approved photos with captions, ordered by qc_score.
// Skipped when policy blocks images (OTA path) — but captions still inform Saya's
// sensory anchor even if the image itself isn't attached.
async function liamPickPhotos(
  sb: ReturnType<typeof getSupabaseAdmin>,
  group_slug: string | null,
): Promise<PhotoPick[]> {
  const areas = (group_slug && GROUP_AREA_HINT[group_slug]) || ['hotel-property', 'accommodation', 'roots', 'jungle-spa'];
  const { data } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, caption, alt_text, property_area, qc_score')
    .eq('status', 'approved')
    .in('property_area', areas)
    .not('caption', 'is', null)
    .order('qc_score', { ascending: false, nullsFirst: false })
    .limit(3);
  const rows = (data as Array<{ asset_id: string; caption: string | null; alt_text: string | null; property_area: string | null }> | null) ?? [];
  return rows
    .filter(r => r.caption && r.caption.trim().length > 0)
    .map(r => ({ asset_id: r.asset_id, caption: (r.caption ?? '').trim(), alt_text: r.alt_text, property_area: r.property_area }));
}

function assembleUserPrompt(
  body: ProposeBody,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  photos: PhotoPick[],
  vedaCritique?: string | null,
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

  if (photos.length > 0) {
    parts.push('');
    parts.push('### LIAM · PHOTO ANCHOR SUGGESTIONS (real photos from our library — pick ONE for your sensory anchor)');
    for (const p of photos) parts.push(`- [${p.property_area ?? '—'}] "${p.caption}"${p.alt_text ? ` · alt: ${p.alt_text}` : ''}`);
    parts.push('(Do not include the URLs of these photos in the email body — the send layer attaches the hero separately.)');
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

  if (vedaCritique) {
    parts.push('');
    parts.push('### VEDA · REVIEW OF YOUR PREVIOUS DRAFT — rewrite to fix these issues');
    parts.push(vedaCritique);
  }

  return parts.join('\n');
}

async function callAnthropic(system: string, userPrompt: string, maxTokens = 1600): Promise<string> {
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

type SayaDraft = { subject: string; body_md: string; goal_tag: string | null };

async function sayaDraft(system: string, userPrompt: string): Promise<SayaDraft> {
  const text = await callAnthropic(system, userPrompt, 1600);
  const parsed = JSON.parse(text);
  return {
    subject: String(parsed.subject || '').slice(0, 120),
    body_md: String(parsed.body_md || ''),
    goal_tag: parsed.goal_tag ? String(parsed.goal_tag).slice(0, 80) : null,
  };
}

type VedaResult = { score: number; issues: string[]; critique: string };

const VEDA_SYSTEM = [
  'You are Veda, editorial critic for The Namkhan newsletter team.',
  'You score drafts against a rubric (each 0-20, sum 0-100):',
  '  1. sensory_anchor · does it open with ONE specific Namkhan sensory detail (kingfisher, wood-fire, ginger tea, river light, boat engine, etc)? Not a summary.',
  '  2. forbidden_absent · no "We are excited/delighted", no "Book now/Reserve", no "Amazing/Incredible", no emojis, no ALL CAPS, no more than one !.',
  '  3. url_discipline · every URL matches an entry in the LINK CATALOG (or there are no URLs when policy blocks them).',
  '  4. signature_present · closes with a real signature ("Warm regards · The Namkhan Team" or a named person + role + address for OTA-safe).',
  '  5. voice_match · calm, understated, warm, written by someone who knows the property.',
  'Return STRICT JSON: { "score": <0-100>, "issues": [<short strings>], "critique": "<one paragraph of what to fix, worded as instruction to the writer>" }',
  'If score >= 80, "critique" can be empty. If score < 60, be very specific about fixes.',
].join('\n');

async function vedaScore(draft: SayaDraft, contextSummary: string, plainText: boolean, blockLinks: boolean): Promise<VedaResult> {
  const userPrompt = [
    `POLICY: plain_text=${plainText} · block_links=${blockLinks}`,
    '',
    'CONTEXT SUMMARY (what Saya was given):',
    contextSummary,
    '',
    'DRAFT SUBJECT:',
    draft.subject,
    '',
    'DRAFT BODY:',
    draft.body_md,
  ].join('\n');
  const text = await callAnthropic(VEDA_SYSTEM, userPrompt, 700);
  try {
    const parsed = JSON.parse(text);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8).map((s: unknown) => String(s).slice(0, 200)) : [],
      critique: String(parsed.critique || '').slice(0, 1500),
    };
  } catch {
    return { score: 50, issues: ['veda_json_unparseable'], critique: '' };
  }
}

function summarizeContext(ctx: Awaited<ReturnType<typeof loadContext>>, photos: PhotoPick[]): string {
  const bits: string[] = [];
  bits.push(`rules=${ctx.rules.length} · links=${ctx.links.length} · retreats=${ctx.retreats.length} · activities=${ctx.activities.length} · goals=${ctx.goals.length} · photos=${photos.length}`);
  if (ctx.policy) bits.push(`policy: plain_text=${ctx.policy.force_plain_text} · block_links=${ctx.policy.block_links} · block_images=${ctx.policy.block_images}`);
  if (ctx.group) bits.push(`group: ${ctx.group.slug} (${ctx.group.voice_type})`);
  if (ctx.links.length > 0) bits.push('valid_urls: ' + ctx.links.map(l => l.url).join(' | '));
  return bits.join('\n');
}

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const seed = String(body.seed_text ?? '').trim();
  if (!seed) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const group_slug = body.group_slug ? String(body.group_slug) : null;
  const sb = getSupabaseAdmin();

  const trace: Array<{ step: string; agent_id: string; latency_ms: number; ok: boolean; note?: string }> = [];

  // Load context (rules, links, retreats, activities, goals, policy, group voice)
  const ctx = await loadContext(sb, group_slug);

  // Enforce group policy · reject a broadcast for an audience that only allows lifecycle
  const requestedKind = body.kind ? String(body.kind) : 'broadcast';
  if (ctx.policy && ctx.policy.allowed_kinds.length > 0 && !ctx.policy.allowed_kinds.includes(requestedKind)) {
    return NextResponse.json({
      ok: false,
      error: `policy_violation: group ${group_slug} only allows [${ctx.policy.allowed_kinds.join(', ')}]`,
    }, { status: 400 });
  }

  // 1. Liam · pick photo anchors
  const tLiam = Date.now();
  let photos: PhotoPick[] = [];
  try { photos = await liamPickPhotos(sb, group_slug); trace.push({ step: 'curator', agent_id: AGENT_LIAM, latency_ms: Date.now() - tLiam, ok: true, note: `picked=${photos.length}` }); }
  catch (e) { trace.push({ step: 'curator', agent_id: AGENT_LIAM, latency_ms: Date.now() - tLiam, ok: false, note: (e as Error).message }); }

  const outputRules = ctx.policy?.force_plain_text ? OUTPUT_PLAIN_RULES : OUTPUT_JSON_RULES;
  const antiSpam = (ctx.policy?.force_plain_text && ctx.policy?.block_links) ? `\n\n${ANTI_SPAM_FILTER_RULES}` : '';
  const sayaSystem = `${IDENTITY}\n\n${outputRules}${antiSpam}`;

  // 2. Saya · first draft
  let draft: SayaDraft;
  const tSaya = Date.now();
  try {
    const userPrompt = assembleUserPrompt(body, ctx, photos);
    draft = await sayaDraft(sayaSystem, userPrompt);
    trace.push({ step: 'writer', agent_id: AGENT_SAYA, latency_ms: Date.now() - tSaya, ok: true });
  } catch (e) {
    trace.push({ step: 'writer', agent_id: AGENT_SAYA, latency_ms: Date.now() - tSaya, ok: false, note: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message, agent_trace: trace }, { status: 500 });
  }

  // 3. Veda · score
  const tVeda = Date.now();
  const ctxSummary = summarizeContext(ctx, photos);
  let veda: VedaResult;
  try {
    veda = await vedaScore(draft, ctxSummary, !!ctx.policy?.force_plain_text, !!ctx.policy?.block_links);
    trace.push({ step: 'critic', agent_id: AGENT_VEDA, latency_ms: Date.now() - tVeda, ok: true, note: `score=${veda.score}` });
  } catch (e) {
    veda = { score: 50, issues: ['veda_failed'], critique: '' };
    trace.push({ step: 'critic', agent_id: AGENT_VEDA, latency_ms: Date.now() - tVeda, ok: false, note: (e as Error).message });
  }

  // 4. Retry once if Veda flagged a real problem — not in refine mode (refine is PBS-directed).
  const isRefine = !!(body.instruction && body.prior);
  if (!isRefine && veda.score < 60 && veda.critique) {
    const tRetry = Date.now();
    try {
      const userPrompt = assembleUserPrompt(body, ctx, photos, veda.critique);
      const retried = await sayaDraft(sayaSystem, userPrompt);
      const vedaRetry = await vedaScore(retried, ctxSummary, !!ctx.policy?.force_plain_text, !!ctx.policy?.block_links);
      if (vedaRetry.score > veda.score) {
        draft = retried;
        veda = vedaRetry;
        trace.push({ step: 'writer_retry', agent_id: AGENT_SAYA, latency_ms: Date.now() - tRetry, ok: true, note: `score=${veda.score}` });
      } else {
        trace.push({ step: 'writer_retry', agent_id: AGENT_SAYA, latency_ms: Date.now() - tRetry, ok: false, note: `no_improvement (${vedaRetry.score} vs ${veda.score})` });
      }
    } catch (e) {
      trace.push({ step: 'writer_retry', agent_id: AGENT_SAYA, latency_ms: Date.now() - tRetry, ok: false, note: (e as Error).message });
    }
  }

  return NextResponse.json({
    ok: true,
    proposal: draft,
    veda: { score: veda.score, issues: veda.issues, critique: veda.critique },
    agent_trace: trace,
    context_used: {
      rules: ctx.rules.length,
      links: ctx.policy?.block_links ? 0 : ctx.links.length,
      retreats: ctx.retreats.length,
      activities: ctx.activities.length,
      goals: ctx.goals.length,
      photos: photos.length,
      policy_applied: !!ctx.policy,
    },
  });
}

// PUT unchanged from v2 · save proposal as guest.campaigns draft
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