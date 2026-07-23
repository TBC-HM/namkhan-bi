// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-23 · Grounded proposer v4 — deterministic envelope + Saya → Veda chain.
//
// v3 drafted the whole email freehand from a local 60-word identity prompt.
// v4 changes:
//   1. System prompt = buildEmailSystemPrompt() from lib/emailWritingRules —
//      one source of truth for voice / Namkhan canon / kind hints / OTA overlay —
//      plus a route-level SLOT output contract (Saya returns prose slots, not a
//      full email).
//   2. marketing.compose_newsletter_email runs BEFORE Saya (via the service_role-
//      only bridge public.fn_compose_newsletter_email). It returns the
//      deterministic envelope: hero photo, product blocks (name + link + photo),
//      greeting, department signature. Saya writes PROSE ONLY for slots
//      03_opening / 04_practical / 06_closing + subject + one blurb per product.
//      Products, links, hero and signature are never AI-written.
//   3. Photos are single-sourced from the envelope (its area taxonomy is the
//      correct one). A slim fallback query runs ONLY when the envelope returns
//      zero photos.
//   4. Veda (critic) receives the SAME assembled user prompt Saya received plus
//      the assembled draft. JSON parsing hardened at both parse sites (code-fence
//      strip); an unparseable Veda response is retried once, then the request
//      fails with a clear error — no silent score-50 pass.
//   5. loadContext checks .error on every surface and reports per-surface ok/fail
//      in context_used.surfaces. New grounding surfaces: v_reality_profile,
//      v_room_grounding, v_facility_grounding, v_transport_options, v_boat_cruises.
//      Link catalog: active only, pinned first, no 20-row cap.
//   6. SLOT CONCEPT (plan v3): when the request carries a concept — explicit
//      body.concept, or a short prior.body_md that is the accepted slot's
//      creative brief (draft campaigns created from Director slots carry the
//      concept as body_md) — it is injected at the TOP of Saya's user prompt
//      as a creative brief and takes precedence as the composer's p_seed_text
//      so product/photo matching keys off the concept.
//
// Backward-compatible: still returns { ok, proposal: { subject, body_md, goal_tag } }.
// PUT (save-as-draft) unchanged except it now accepts an optional hero_asset_id.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildEmailSystemPrompt, normaliseKind, type EmailKind } from '@/lib/emailWritingRules';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';
export const maxDuration = 90;

const NAMKHAN_ID = 260955;

const AGENT_LIAM = 'e4178c65-7314-4be6-aab3-8aa008b73e0f';
const AGENT_SAYA = '6eb7653c-1db1-4ccf-b688-04327c433111';
const AGENT_VEDA = '5dc1d7ab-a671-4946-8f09-3d08d3602dbc';

// Route-level output contract. buildEmailSystemPrompt() ends with a generic
// subject/body_md OUTPUT section — this contract overrides it because the
// envelope (greeting, products, links, hero, signature) is deterministic here.
const SLOT_OUTPUT_CONTRACT = [
  'ROUTE OUTPUT CONTRACT — this OVERRIDES the OUTPUT section above.',
  'You do NOT write the full email. Greeting, product links, hero photo and signature are assembled deterministically by the system from the DETERMINISTIC ENVELOPE in your context.',
  'You write PROSE ONLY. Return STRICT JSON with keys:',
  '  subject         (string · <= 65 chars · no exclamation marks · no ALL CAPS)',
  '  opening_md      (string · slot 03_opening · 1-2 short paragraphs · open with ONE specific sensory Namkhan anchor, never a summary)',
  '  practical_md    (string · slot 04_practical · 0-2 short paragraphs of practical or seasonal notes · "" when nothing practical is needed)',
  '  product_blurbs  (array of strings · EXACTLY one 1-sentence blurb per product listed in the DETERMINISTIC ENVELOPE, same order · reason first, never salesy · [] when no products)',
  '  closing_md      (string · slot 06_closing · one short warm closing paragraph · no sign-off, no "Warm regards")',
  '  goal_tag        (short slug like "green-season-family" · optional)',
  'HARD RULES:',
  '- Do NOT write any greeting ("Hi {{first_name}}") — the system adds it.',
  '- Do NOT write any signature — the system adds the department signature.',
  '- Do NOT include any URL anywhere in your prose or blurbs. Product links are attached deterministically.',
  '- Do NOT invent products. Reference only products listed in the DETERMINISTIC ENVELOPE.',
  'Return ONLY the JSON object. No code fences, no preamble.',
].join('\n');

const ANTI_SPAM_FILTER_RULES = [
  'Constraints for maximum inbox deliverability (OTA-sourced address filters):',
  '- Do NOT use marketing verbs: book, reserve, buy, order, offer, discount, save, exclusive, limited, hurry, act now, click, tap, register, subscribe.',
  '- Do NOT include prices, promo codes, percentages, currency symbols, or the words "free", "gift", "bonus".',
  '- Do NOT use ALL CAPS words, multiple exclamation marks, or multiple question marks.',
  '- Do NOT mention the OTA brand (Booking.com, Airbnb, Expedia, Agoda, Ctrip, etc.) by name.',
  '- Do NOT include tracking pixels, unsubscribe text, or any URL — the send layer adds compliance footer separately.',
  '- Use short warm sentences. Indicative mood, not imperative.',
  '- The signature is the department (Reservations / Customer Service) + hotel physical address — never a personal name.',
  "- Reference the guest's stay dates naturally where relevant. Do not say \"your reservation\".",
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
  concept?: string;
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
  hero_asset_id?: string | null;
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

type PhotoPick = { caption: string; alt_text: string | null; property_area: string | null; asset_id: string };

type RealityRow = {
  location: string | null; region: string | null;
  landscape: string[] | null; palette: string[] | null; forbidden: string[] | null;
  vibe: string | null; brand_voice: string | null; positioning: string | null;
};
type RoomRow = { room_type_name: string; short_pitch: string | null; positioning_label: string | null; view_type: string | null };
type FacilityRow = { facility_name: string; category: string | null; ai_description: string | null; facility_description: string | null };
type TransportRow = { name: string; transport_type: string | null; route_from: string | null; route_to: string | null; duration_min: number | null; is_complimentary: boolean | null };
type CruiseRow = { name: string; cruise_type: string | null; route_from: string | null; route_to: string | null; duration_min: number | null };

async function loadContext(sb: ReturnType<typeof getSupabaseAdmin>, group_slug: string | null) {
  const [rulesR, linksR, retreatsR, activitiesR, sendersR, goalsR, policyR, groupR, realityR, roomsR, facilitiesR, transportR, cruisesR] = await Promise.all([
    sb.from('v_marketing_email_general_rules').select('rule_type, rule_text, group_slug').limit(50),
    sb.from('v_marketing_internal_link_catalog')
      .select('section, anchor_hint, url, title, description, is_pinned')
      .eq('property_id', NAMKHAN_ID).eq('active', true)
      .order('is_pinned', { ascending: false }),
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
    sb.from('v_reality_profile').select('location, region, landscape, palette, forbidden, vibe, brand_voice, positioning').eq('property_id', NAMKHAN_ID).maybeSingle(),
    sb.from('v_room_grounding').select('room_type_name, short_pitch, positioning_label, view_type').eq('property_id', NAMKHAN_ID).eq('active', true).order('sort_order', { ascending: true }).limit(12),
    sb.from('v_facility_grounding').select('facility_name, category, ai_description, facility_description').eq('property_id', NAMKHAN_ID).eq('active', true).order('sort_order', { ascending: true }).limit(20),
    sb.from('v_transport_options').select('name, transport_type, route_from, route_to, duration_min, is_complimentary').eq('property_id', NAMKHAN_ID).eq('is_active', true).order('display_order', { ascending: true }).limit(8),
    sb.from('v_boat_cruises').select('name, cruise_type, route_from, route_to, duration_min').eq('property_id', NAMKHAN_ID).eq('is_active', true).order('display_order', { ascending: true }).limit(8),
  ]);

  // Per-surface ok/fail — surfaced in context_used.surfaces so a broken view is
  // visible instead of silently emptying the prompt.
  const surfaces: Record<string, boolean> = {
    rules: !rulesR.error,
    links: !linksR.error,
    retreats: !retreatsR.error,
    activities: !activitiesR.error,
    sender: !sendersR.error,
    goals: !goalsR.error,
    policy: !policyR.error,
    group: !groupR.error,
    reality_profile: !realityR.error,
    rooms: !roomsR.error,
    facilities: !facilitiesR.error,
    transport: !transportR.error,
    cruises: !cruisesR.error,
  };

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
    links: (linksR.data as Array<{ section: string; anchor_hint: string; url: string; title: string | null; description: string | null; is_pinned: boolean | null }> | null) ?? [],
    retreats: (retreatsR.data as Array<{ name: string; short_description: string | null; focus_notes: string | null }> | null) ?? [],
    activities: (activitiesR.data as Array<{ activity_name: string; short_description: string | null; price_incl_taxes_usd: number | null }> | null) ?? [],
    sender: (sendersR.data as { from_name: string | null; from_email: string | null; footer_text: string | null; unsubscribe_url: string | null } | null) ?? null,
    goals,
    policy,
    group,
    reality: (realityR.data as RealityRow | null) ?? null,
    rooms: (roomsR.data as RoomRow[] | null) ?? [],
    facilities: (facilitiesR.data as FacilityRow[] | null) ?? [],
    transport: (transportR.data as TransportRow[] | null) ?? [],
    cruises: (cruisesR.data as CruiseRow[] | null) ?? [],
    surfaces,
  };
}

// ── Deterministic envelope (marketing.compose_newsletter_email) ──────────────

type EnvPhoto = { asset_id: string | null; primary_render: string | null; caption: string | null; alt_text: string | null; property_area: string | null };
type EnvProduct = EnvPhoto & { product_name: string | null; link_url: string | null; link_anchor: string | null; section: string | null };
type EnvSignature = { role: string; org: string; address_lines: string[]; email: string; website: string };
type Envelope = { hero: EnvPhoto | null; products: EnvProduct[]; greeting: string; signature: EnvSignature };

function defaultSignature(kind: EmailKind): EnvSignature {
  return {
    role: kind === 'after_checkout' ? 'Customer Service' : 'Reservations',
    org: 'The Namkhan',
    address_lines: ['Ban Xieng Lom', 'Luang Prabang, Laos'],
    email: 'gm@thenamkhan.com',
    website: 'thenamkhan.com',
  };
}

function parseEnvelope(raw: unknown, kind: EmailKind): Envelope {
  const def = defaultSignature(kind);
  const empty: Envelope = { hero: null, products: [], greeting: 'Hi {{first_name}},', signature: def };
  if (!raw || typeof raw !== 'object') return empty;
  const sections = (raw as { sections?: Record<string, unknown> }).sections;
  if (!sections || typeof sections !== 'object') return empty;

  const heroRaw = sections['01_hero'];
  const hero = (heroRaw && typeof heroRaw === 'object' && (heroRaw as EnvPhoto).asset_id) ? (heroRaw as EnvPhoto) : null;

  const prodRaw = sections['05_products'];
  const products = (Array.isArray(prodRaw) ? (prodRaw as EnvProduct[]) : []).filter(p => p && typeof p === 'object' && !!p.link_url);

  const greetingObj = sections['02_greeting'] as { text?: string } | undefined;
  const sigRaw = sections['07_signature'] as Partial<EnvSignature> | undefined;
  const addressLines = (sigRaw && Array.isArray(sigRaw.address_lines)) ? sigRaw.address_lines.map(x => String(x)) : def.address_lines;

  return {
    hero,
    products,
    greeting: (greetingObj && greetingObj.text) || 'Hi {{first_name}},',
    signature: {
      role: (sigRaw && sigRaw.role) || def.role,
      org: (sigRaw && sigRaw.org) || def.org,
      address_lines: addressLines,
      email: (sigRaw && sigRaw.email) || def.email,
      website: (sigRaw && sigRaw.website) || def.website,
    },
  };
}

// Slim fallback — ONLY when the envelope returned zero photos.
async function fallbackPhotoPick(sb: ReturnType<typeof getSupabaseAdmin>): Promise<PhotoPick[]> {
  const { data, error } = await sb
    .from('v_marketing_media_page')
    .select('asset_id, caption, alt_text, property_area')
    .eq('property_id', NAMKHAN_ID)
    .in('status', ['ready', 'qc_passed'])
    .not('caption', 'is', null)
    .order('quality_index', { ascending: false, nullsFirst: false })
    .limit(4);
  if (error) return [];
  const rows = (data as Array<{ asset_id: string; caption: string | null; alt_text: string | null; property_area: string | null }> | null) ?? [];
  return rows
    .filter(r => r.caption && r.caption.trim().length > 0)
    .map(r => ({ asset_id: r.asset_id, caption: (r.caption ?? '').trim(), alt_text: r.alt_text, property_area: r.property_area }));
}

function assembleUserPrompt(
  body: ProposeBody,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  env: Envelope,
  fallbackPhotos: PhotoPick[],
  concept: string,
  vedaCritique?: string | null,
): string {
  const parts: string[] = [];
  if (concept) {
    parts.push('### SLOT CONCEPT — creative brief (follow this)');
    parts.push('This concept was approved at plan level. Your opening, practical notes, blurbs and closing must execute THIS angle — do not drift to a different theme.');
    parts.push(concept);
    parts.push('');
  }
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

  if (ctx.reality) {
    parts.push('');
    parts.push('### PROPERTY REALITY PROFILE (Settings-managed grounding · obey "forbidden" absolutely)');
    if (ctx.reality.location) parts.push(`location: ${ctx.reality.location}${ctx.reality.region ? ` · ${ctx.reality.region}` : ''}`);
    if (ctx.reality.landscape && ctx.reality.landscape.length > 0) parts.push(`landscape: ${ctx.reality.landscape.join(', ')}`);
    if (ctx.reality.palette && ctx.reality.palette.length > 0) parts.push(`palette: ${ctx.reality.palette.join(', ')}`);
    if (ctx.reality.vibe) parts.push(`vibe: ${ctx.reality.vibe}`);
    if (ctx.reality.brand_voice) parts.push(`brand_voice: ${ctx.reality.brand_voice}`);
    if (ctx.reality.positioning) parts.push(`positioning: ${ctx.reality.positioning}`);
    if (ctx.reality.forbidden && ctx.reality.forbidden.length > 0) parts.push(`forbidden (never reference or evoke): ${ctx.reality.forbidden.join(', ')}`);
  }

  parts.push('');
  parts.push('### GUARDRAILS (LOAD-BEARING · you must follow these)');
  if (ctx.rules.length === 0) parts.push('(none loaded)');
  else for (const r of ctx.rules) parts.push(`- [${r.rule_type}] ${r.rule_text}`);

  if (!ctx.policy?.block_links && ctx.links.length > 0) {
    parts.push('');
    parts.push('### LINK CATALOG · the ONLY valid URLs (use anchor_hint text, never raw URL)');
    for (const l of ctx.links) {
      parts.push(`- [${l.section}]${l.is_pinned ? ' [pinned]' : ''} "${l.anchor_hint}" → ${l.url}${l.description ? ` (${l.description})` : ''}`);
    }
  }

  parts.push('');
  parts.push('### DETERMINISTIC ENVELOPE (assembled by the system — write prose around it, never restate it)');
  if (env.hero) {
    parts.push(`hero photo (attached by the send layer · use it as your sensory anchor): "${env.hero.caption ?? ''}"${env.hero.alt_text ? ` · ${env.hero.alt_text}` : ''}${env.hero.property_area ? ` · area: ${env.hero.property_area}` : ''}`);
  } else {
    parts.push('hero photo: none');
  }
  if (env.products.length > 0) {
    parts.push('product blocks (links inserted automatically — write ONE 1-sentence blurb per product, same order, in product_blurbs):');
    env.products.forEach((p, i) => {
      parts.push(`${i + 1}. [${p.section ?? '—'}] ${p.product_name ?? p.link_anchor ?? ''} · anchor "${p.link_anchor ?? ''}"${p.caption ? ` · photo: "${p.caption}"` : ''}`);
    });
  } else {
    parts.push('product blocks: none — return product_blurbs: []');
  }
  parts.push(`signature (deterministic — never write it): ${env.signature.role} · ${env.signature.org}`);

  if (fallbackPhotos.length > 0) {
    parts.push('');
    parts.push('### PHOTO ANCHORS (fallback — the envelope had no photos · pick ONE caption as your sensory anchor)');
    for (const p of fallbackPhotos) parts.push(`- [${p.property_area ?? '—'}] "${p.caption}"${p.alt_text ? ` · alt: ${p.alt_text}` : ''}`);
    parts.push('(Do not include photo URLs in the email body — the send layer attaches imagery separately.)');
  }

  if (ctx.rooms.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · ROOMS (names + one-liners · facts only from here)');
    for (const r of ctx.rooms) {
      parts.push(`- ${r.room_type_name}${r.positioning_label ? ` (${r.positioning_label})` : ''}${r.short_pitch ? ` — ${r.short_pitch}` : ''}`);
    }
  }

  if (ctx.facilities.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · FACILITIES (names + one-liners · facts only from here)');
    for (const f of ctx.facilities) {
      const d = (f.ai_description || f.facility_description || '').replace(/\s+/g, ' ').slice(0, 160);
      parts.push(`- [${f.category ?? '—'}] ${f.facility_name}${d ? ` — ${d}` : ''}`);
    }
  }

  if (ctx.transport.length > 0 || ctx.cruises.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · TRANSPORT & BOAT (facts only from here)');
    for (const t of ctx.transport) {
      parts.push(`- ${t.name}${t.route_from && t.route_to ? ` · ${t.route_from} → ${t.route_to}` : ''}${t.duration_min ? ` · ~${t.duration_min} min` : ''}${t.is_complimentary ? ' · complimentary' : ''}`);
    }
    for (const c of ctx.cruises) {
      parts.push(`- ${c.name}${c.cruise_type ? ` (${c.cruise_type})` : ''}${c.route_from && c.route_to ? ` · ${c.route_from} → ${c.route_to}` : ''}${c.duration_min ? ` · ~${c.duration_min} min` : ''}`);
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

// Both model outputs occasionally arrive wrapped in ```json fences — strip before parsing.
function stripCodeFences(text: string): string {
  let s = text.trim();
  const fenced = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```\s*$/);
  if (fenced) return fenced[1].trim();
  if (s.startsWith('```')) s = s.replace(/^```[a-zA-Z]*\s*/, '');
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

type SayaSlots = {
  subject: string;
  opening_md: string;
  practical_md: string;
  product_blurbs: string[];
  closing_md: string;
  goal_tag: string | null;
};

type SayaDraft = { subject: string; body_md: string; goal_tag: string | null };

async function sayaSlots(system: string, userPrompt: string): Promise<SayaSlots> {
  const text = await callAnthropic(system, userPrompt, 1600);
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(stripCodeFences(text)) as Record<string, unknown>; }
  catch { throw new Error('saya_json_unparseable'); }
  const blurbs = Array.isArray(parsed.product_blurbs)
    ? (parsed.product_blurbs as unknown[]).map(b => String(b ?? '').slice(0, 300))
    : [];
  return {
    subject: String(parsed.subject || '').slice(0, 120),
    opening_md: String(parsed.opening_md || ''),
    practical_md: String(parsed.practical_md || ''),
    product_blurbs: blurbs,
    closing_md: String(parsed.closing_md || ''),
    goal_tag: parsed.goal_tag ? String(parsed.goal_tag).slice(0, 80) : null,
  };
}

// Deterministic assembly: greeting + Saya prose slots + product blocks (exact
// catalog links) + department signature. AI never writes links or the signature.
function assembleDraft(slots: SayaSlots, env: Envelope, policy: Policy | null, kind: EmailKind): SayaDraft {
  const parts: string[] = [env.greeting];
  if (slots.opening_md.trim()) parts.push(slots.opening_md.trim());
  if (slots.practical_md.trim()) parts.push(slots.practical_md.trim());

  if (!policy?.block_links && env.products.length > 0) {
    const lines: string[] = [];
    env.products.forEach((p, i) => {
      if (!p.link_url) return;
      const anchor = p.link_anchor || p.product_name || 'Read more';
      const blurb = (slots.product_blurbs[i] ?? '').trim();
      lines.push(`- [${anchor}](${p.link_url})${blurb ? ` — ${blurb}` : ''}`);
    });
    if (lines.length > 0) {
      if (kind === 'before_checkin') lines.unshift('A few experiences worth holding now:');
      parts.push(lines.join('\n'));
    }
  }

  if (slots.closing_md.trim()) parts.push(slots.closing_md.trim());

  const s = env.signature;
  parts.push(`Warm regards,\n\n${s.role} · ${s.org}\n${s.address_lines.join(', ')}\n${s.email} · ${s.website}`);

  return { subject: slots.subject, body_md: parts.join('\n\n'), goal_tag: slots.goal_tag };
}

type VedaResult = { score: number; issues: string[]; critique: string };

const VEDA_SYSTEM = [
  'You are Veda, editorial critic for The Namkhan newsletter team.',
  'You receive the FULL context prompt the writer received, followed by the assembled draft.',
  'You score the draft against a rubric (each 0-20, sum 0-100):',
  '  1. sensory_anchor · does the first paragraph after the greeting open with ONE specific Namkhan sensory detail (kingfisher, wood-fire, ginger tea, river light, boat engine, etc)? Not a summary.',
  '  2. forbidden_absent · no "We are excited/delighted", no "Book now/Reserve", no "Amazing/Incredible", no emojis, no ALL CAPS, no more than one exclamation mark, nothing from the REALITY PROFILE forbidden list.',
  '  3. url_discipline · every URL matches the LINK CATALOG or the DETERMINISTIC ENVELOPE product blocks (or there are no URLs when policy blocks them).',
  '  4. signature_discipline · closes with the department signature (Reservations or Customer Service · The Namkhan + address + gm@thenamkhan.com + thenamkhan.com). NEVER a personal name.',
  '  5. voice_match · calm, understated, warm, grounded in real property facts from the context — not generic hotel copy.',
  'Return STRICT JSON: { "score": <0-100>, "issues": [<short strings>], "critique": "<one paragraph of what to fix, worded as instruction to the writer>" }',
  'If score >= 80, "critique" can be empty. If score < 60, be very specific about fixes.',
  'Return ONLY the JSON object. No code fences, no preamble.',
].join('\n');

async function vedaScore(draft: SayaDraft, sayaUserPrompt: string, plainText: boolean, blockLinks: boolean): Promise<VedaResult> {
  const userPrompt = [
    `POLICY: plain_text=${plainText} · block_links=${blockLinks}`,
    '',
    'FULL CONTEXT GIVEN TO THE WRITER:',
    sayaUserPrompt,
    '',
    'DRAFT SUBJECT:',
    draft.subject,
    '',
    'DRAFT BODY:',
    draft.body_md,
  ].join('\n');

  // One retry on unparseable JSON, then hard fail — never a silent score-50 pass.
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await callAnthropic(VEDA_SYSTEM, userPrompt, 700);
    try {
      const parsed = JSON.parse(stripCodeFences(text)) as { score?: unknown; issues?: unknown; critique?: unknown };
      return {
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 8).map((s: unknown) => String(s).slice(0, 200)) : [],
        critique: String(parsed.critique || '').slice(0, 1500),
      };
    } catch {
      // fall through to retry
    }
  }
  throw new Error('veda_json_unparseable_after_retry');
}

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const seed = String(body.seed_text ?? '').trim();

  // SLOT CONCEPT (plan v3): explicit body.concept wins; otherwise a short
  // prior.body_md that isn't an assembled email (no signature) is treated as
  // the slot's creative brief — draft campaigns created from accepted Director
  // slots carry the concept as their body_md.
  const explicitConcept = String(body.concept ?? '').trim();
  const priorBody = String(body.prior?.body_md ?? '').trim();
  const priorLooksLikeConcept =
    !explicitConcept &&
    priorBody.length > 0 &&
    priorBody.length <= 600 &&
    !priorBody.includes('Warm regards') &&
    !priorBody.toLowerCase().startsWith('placeholder body');
  const concept = (explicitConcept || (priorLooksLikeConcept ? priorBody : '')).slice(0, 1000);

  if (!seed && !concept) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const group_slug = body.group_slug ? String(body.group_slug) : null;
  const sb = getSupabaseAdmin();

  const trace: Array<{ step: string; agent_id: string; latency_ms: number; ok: boolean; note?: string }> = [];

  // Load context (rules, links, reality profile, rooms, facilities, transport,
  // boat, retreats, activities, goals, policy, group voice)
  const ctx = await loadContext(sb, group_slug);

  // Enforce group policy · reject a broadcast for an audience that only allows lifecycle
  const requestedKind = body.kind ? String(body.kind) : 'broadcast';
  if (ctx.policy && ctx.policy.allowed_kinds.length > 0 && !ctx.policy.allowed_kinds.includes(requestedKind)) {
    return NextResponse.json({
      ok: false,
      error: `policy_violation: group ${group_slug} only allows [${ctx.policy.allowed_kinds.join(', ')}]`,
    }, { status: 400 });
  }

  const emailKind: EmailKind = normaliseKind(body.kind);

  // 1. Deterministic composer — hero photo, product blocks, greeting, signature.
  //    The concept (when present) takes precedence as the seed so product/photo
  //    matching keys off the approved angle.
  const tComposer = Date.now();
  let envelope: Envelope = parseEnvelope(null, emailKind);
  let composerOk = false;
  try {
    const { data, error } = await sb.rpc('fn_compose_newsletter_email', {
      p_campaign_kind: emailKind,
      p_group_slug: group_slug,
      p_seed_text: concept || seed,
      p_target_date: body.target_date ? String(body.target_date).slice(0, 10) : null,
      p_max_products: 4,
      p_requested_by: 'propose-one',
    });
    if (error) throw new Error(error.message);
    envelope = parseEnvelope(data, emailKind);
    composerOk = true;
    trace.push({ step: 'composer', agent_id: AGENT_LIAM, latency_ms: Date.now() - tComposer, ok: true, note: `hero=${envelope.hero ? 1 : 0} products=${envelope.products.length}` });
  } catch (e) {
    trace.push({ step: 'composer', agent_id: AGENT_LIAM, latency_ms: Date.now() - tComposer, ok: false, note: (e as Error).message });
  }

  // 2. Photos are single-sourced from the envelope. Slim fallback only when empty.
  const envelopePhotoCount = (envelope.hero ? 1 : 0) + envelope.products.filter(p => p.caption).length;
  let fallbackPhotos: PhotoPick[] = [];
  if (envelopePhotoCount === 0) {
    const tFb = Date.now();
    fallbackPhotos = await fallbackPhotoPick(sb);
    trace.push({ step: 'photo_fallback', agent_id: AGENT_LIAM, latency_ms: Date.now() - tFb, ok: fallbackPhotos.length > 0, note: `picked=${fallbackPhotos.length}` });
  }

  // 3. System prompt: shared writing rules (voice + canon + kind + OTA overlay)
  //    + route slot contract (+ anti-spam specifics on the OTA path).
  const isOta = !!(ctx.policy?.force_plain_text && ctx.policy?.block_links);
  const sayaSystem = [buildEmailSystemPrompt(emailKind, ctx.policy), SLOT_OUTPUT_CONTRACT]
    .concat(isOta ? [ANTI_SPAM_FILTER_RULES] : [])
    .join('\n\n');

  const userPrompt = assembleUserPrompt(body, ctx, envelope, fallbackPhotos, concept);

  // 4. Saya · prose slots → deterministic assembly
  let draft: SayaDraft;
  const tSaya = Date.now();
  try {
    const slots = await sayaSlots(sayaSystem, userPrompt);
    draft = assembleDraft(slots, envelope, ctx.policy, emailKind);
    trace.push({ step: 'writer', agent_id: AGENT_SAYA, latency_ms: Date.now() - tSaya, ok: true });
  } catch (e) {
    trace.push({ step: 'writer', agent_id: AGENT_SAYA, latency_ms: Date.now() - tSaya, ok: false, note: (e as Error).message });
    return NextResponse.json({ ok: false, error: (e as Error).message, agent_trace: trace }, { status: 500 });
  }

  // 5. Veda · scores the assembled draft against the SAME prompt Saya received.
  //    Unparseable after internal retry → the request fails loudly.
  const tVeda = Date.now();
  let veda: VedaResult;
  try {
    veda = await vedaScore(draft, userPrompt, !!ctx.policy?.force_plain_text, !!ctx.policy?.block_links);
    trace.push({ step: 'critic', agent_id: AGENT_VEDA, latency_ms: Date.now() - tVeda, ok: true, note: `score=${veda.score}` });
  } catch (e) {
    trace.push({ step: 'critic', agent_id: AGENT_VEDA, latency_ms: Date.now() - tVeda, ok: false, note: (e as Error).message });
    return NextResponse.json({ ok: false, error: `veda_failed: ${(e as Error).message}`, agent_trace: trace }, { status: 502 });
  }

  // 6. Retry once if Veda flagged a real problem — not in refine mode (refine is PBS-directed).
  const isRefine = !!(body.instruction && body.prior);
  if (!isRefine && veda.score < 60 && veda.critique) {
    const tRetry = Date.now();
    try {
      const retryPrompt = assembleUserPrompt(body, ctx, envelope, fallbackPhotos, concept, veda.critique);
      const retriedSlots = await sayaSlots(sayaSystem, retryPrompt);
      const retried = assembleDraft(retriedSlots, envelope, ctx.policy, emailKind);
      const vedaRetry = await vedaScore(retried, retryPrompt, !!ctx.policy?.force_plain_text, !!ctx.policy?.block_links);
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
    composer: {
      ok: composerOk,
      hero_asset_id: envelope.hero?.asset_id ?? null,
      hero_caption: envelope.hero?.caption ?? null,
      products: envelope.products.map(p => ({ name: p.product_name, anchor: p.link_anchor, url: p.link_url, section: p.section })),
      fallback_photos_used: fallbackPhotos.length > 0,
    },
    context_used: {
      surfaces: ctx.surfaces,
      rules: ctx.rules.length,
      links: ctx.policy?.block_links ? 0 : ctx.links.length,
      retreats: ctx.retreats.length,
      activities: ctx.activities.length,
      goals: ctx.goals.length,
      rooms: ctx.rooms.length,
      facilities: ctx.facilities.length,
      transport: ctx.transport.length,
      cruises: ctx.cruises.length,
      reality_profile: !!ctx.reality,
      photos: envelopePhotoCount + fallbackPhotos.length,
      policy_applied: !!ctx.policy,
      concept_used: !!concept,
    },
  });
}

// PUT · save proposal as guest.campaigns draft (now carries hero_asset_id when provided)
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
  const hero_asset_id = body.hero_asset_id ? String(body.hero_asset_id) : null;

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
    hero_asset_id,
    audience_type: body.audience_type ?? 'b2c',
    goal_tag: body.goal_tag ?? null,
    created_by: 'propose-newsletter-ai',
  }).select('campaign_id').maybeSingle();

  if (error || !data?.campaign_id) {
    return NextResponse.json({ ok: false, error: error?.message || 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, campaign_id: data.campaign_id });
}
