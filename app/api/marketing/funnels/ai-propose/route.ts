// app/api/marketing/funnels/ai-propose/route.ts
// PBS 2026-07-21 v2: dynamic guardrails + hero_asset_id picking.
//
// Rewrite:
//   - Deletes hardcoded BRAND_CONTEXT / SEGMENT_TONE / WELCOME_SPEC / TAG_CHEATSHEET.
//   - Fetches guardrails at request time from:
//       marketing.email_general_rules (via v_marketing_email_general_rules)
//       marketing.facilities          (via v_facilities_lite)
//       marketing.activities_catalog  (via v_activities_catalog)
//       marketing.room_type_content   (via v_room_types_all)
//       documentation.documents       (via v_documents_latest, doc_type IN ('vision_roadmap','claude_md'))
//       v_marketing_media_page        (top ~30 photos: quality_index >= 75 AND primary_tier IN hero/OTA)
//   - Assembles a dynamic system prompt + injects into Claude call.
//   - Adds hero_asset_id per step. Claude picks best matching asset from shortlist.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SegmentKey = 'wellness' | 'couples' | 'culture' | 'welcome';

type FunnelStep = {
  step_no: number;
  delay_days: number;
  subject: string;
  body_md: string;
  click_tag_map: Record<string, string>;
  hero_asset_id: string | null;
};

type Funnel = {
  name: string;
  target_segment_key: string;
  steps: FunnelStep[];
};

const MODEL = 'claude-sonnet-4-6';
const DEFAULT_PROPERTY_ID = 260955;

const SEGMENT_TONE_HINT: Record<SegmentKey, string> = {
  wellness: 'Contemplative, body-aware, sensory. Lead with breath, herbs, water, silence. Speak to guests seeking recovery and rhythm.',
  couples:  'Intimate, warm, low-volume. Emphasise privacy, shared rituals, riverside evenings. Never cliché "romance-package" language.',
  culture:  'Curious, place-rooted. Lead with Luang Prabang, UNESCO old town, Mekong confluence, alms, weaving, cooking. Namkhan is base camp for the region.',
  welcome:  'Warm, unhurried welcome to a first-time guest who just discovered us. Story-first, sell-last.',
};

type RuleRow = { rule_kind: string; rule_text: string };
type FacilityRow = { name: string; category: string | null };
type ActivityRow = { name: string; category: string | null; description: string | null };
type RoomRow = { room_type_name: string | null; max_guests: number | null; base_rate: number | null };
type DocRow = { title: string; content_md: string | null; doc_type: string };
type MediaCandidate = {
  asset_id: string;
  category: string | null;
  sub_category: string | null;
  property_area: string | null;
  alt_text: string | null;
  visual_description: string | null;
  quality_index: number | null;
  primary_tier: string | null;
};

type LinkCatalogRow = {
  url: string;
  title: string | null;
  anchor_hint: string | null;
  section: string | null;
  description: string | null;
};

type TransportRow = { name: string; transport_type: string | null; route_from: string | null; route_to: string | null; duration_min: number | null; capacity_pax: number | null; price_amount: number | null; price_currency: string | null; is_complimentary: boolean | null };
type SpaRow       = { name: string; category: string | null; duration_min: number | null; price_usd: number | null; is_signature: boolean | null; short_description: string | null };
type FnbRow       = { name: string; section: string | null; price_usd: number | null; is_signature: boolean | null; description: string | null };

async function fetchGuardrails(propertyId: number) {
  const sb = getSupabaseAdmin();
  const [rules, facilities, activities, rooms, docs, mediaCandidates, linkCatalog, transport, spa, fnb] = await Promise.all([
    sb.from('v_marketing_email_general_rules').select('rule_kind, rule_text')
      .or(`property_id.eq.${propertyId},property_id.is.null`),
    sb.from('v_facilities_lite').select('name, category').eq('property_id', propertyId).limit(60),
    sb.from('v_activities_catalog').select('name, category, description').eq('property_id', propertyId).eq('is_active', true).limit(60),
    sb.from('v_room_types_all').select('room_type_name, max_guests, base_rate').eq('property_id', propertyId).limit(20),
    sb.from('v_documents_latest').select('title, content_md, doc_type').in('doc_type', ['vision_roadmap','claude_md']).limit(2),
    sb.from('v_marketing_media_page').select('asset_id, category, sub_category, property_area, alt_text, visual_description, quality_index, primary_tier')
      .eq('property_id', propertyId)
      .gte('quality_index', 75)
      .in('primary_tier', ['tier_ota_profile','tier_website_hero'])
      .order('quality_index', { ascending: false })
      .limit(30),
    sb.from('v_marketing_internal_link_catalog').select('url, title, anchor_hint, section, description')
      .eq('property_id', propertyId),
    sb.from('v_transport_options').select('name, transport_type, route_from, route_to, duration_min, capacity_pax, price_amount, price_currency, is_complimentary')
      .eq('property_id', propertyId).eq('is_active', true).limit(20),
    sb.from('v_property_spa_treatments').select('name, category, duration_min, price_usd, is_signature, short_description')
      .eq('property_id', propertyId).eq('is_active', true).limit(30),
    sb.from('v_property_fnb_menu_items').select('name, section, price_usd, is_signature, description')
      .eq('property_id', propertyId).eq('is_active', true).limit(40),
  ]);
  return {
    rules: (rules.data as RuleRow[] | null) ?? [],
    facilities: (facilities.data as FacilityRow[] | null) ?? [],
    activities: (activities.data as ActivityRow[] | null) ?? [],
    rooms: (rooms.data as RoomRow[] | null) ?? [],
    docs: (docs.data as DocRow[] | null) ?? [],
    mediaCandidates: (mediaCandidates.data as MediaCandidate[] | null) ?? [],
    linkCatalog: (linkCatalog.data as LinkCatalogRow[] | null) ?? [],
    transport: (transport.data as TransportRow[] | null) ?? [],
    spa: (spa.data as SpaRow[] | null) ?? [],
    fnb: (fnb.data as FnbRow[] | null) ?? [],
  };
}

function buildUpsellBlock(t: TransportRow[], s: SpaRow[], f: FnbRow[], a: ActivityRow[]): string {
  const tLines = t.length
    ? t.map(x => `  - ${x.name}${x.transport_type ? ` [${x.transport_type}]` : ''}${x.route_from && x.route_to ? ` (${x.route_from} → ${x.route_to})` : ''}${x.duration_min ? `, ${x.duration_min}min` : ''}${x.capacity_pax ? `, ${x.capacity_pax}pax` : ''}${x.is_complimentary ? ' — COMPLIMENTARY' : (x.price_amount ? `, ${x.price_currency ?? 'USD'} ${x.price_amount}` : '')}`).join('\n')
    : '  (none)';
  const sLines = s.length
    ? s.map(x => `  - ${x.name}${x.category ? ` [${x.category}]` : ''}${x.duration_min ? ` (${x.duration_min}min)` : ''}${x.price_usd ? ` — USD ${x.price_usd}` : ''}${x.is_signature ? ' ★signature' : ''}${x.short_description ? `: ${x.short_description.slice(0, 90)}` : ''}`).join('\n')
    : '  (none)';
  const fLines = f.length
    ? f.slice(0, 20).map(x => `  - ${x.name}${x.section ? ` [${x.section}]` : ''}${x.price_usd ? ` — USD ${x.price_usd}` : ''}${x.is_signature ? ' ★signature' : ''}${x.description ? `: ${x.description.slice(0, 80)}` : ''}`).join('\n')
    : '  (none)';
  const aLines = a.length
    ? a.slice(0, 15).map(x => `  - ${x.name}${x.category ? ` [${x.category}]` : ''}${x.description ? `: ${x.description.slice(0, 80)}` : ''}`).join('\n')
    : '  (none)';
  return `TRANSPORT (airport/pick-up options):\n${tLines}\n\nJUNGLE SPA TREATMENTS:\n${sLines}\n\nF&B EXPERIENCES / MENU ITEMS:\n${fLines}\n\nACTIVITIES:\n${aLines}`;
}

function buildLinkCatalogBlock(links: LinkCatalogRow[]): string {
  if (!links.length) return '(no internal links catalogued — you may only use mailto: links)';
  return links.map(l => {
    const bits: string[] = [];
    if (l.section) bits.push(`section=${l.section}`);
    if (l.anchor_hint) bits.push(`anchor="${l.anchor_hint}"`);
    return `  - ${l.url}\n    title: ${l.title ?? ''}\n    ${bits.join(' · ')}${l.description ? `\n    ${l.description}` : ''}`;
  }).join('\n');
}

// Validate that every markdown link URL in body_md is in the catalog or a mailto:.
// Returns list of invalid URLs (empty = clean).
export function findInvalidLinks(bodyMd: string, catalogUrls: Set<string>): string[] {
  const bad: string[] = [];
  const re = /\[[^\]]+\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyMd)) !== null) {
    const url = m[1].trim();
    if (url.startsWith('mailto:')) continue;
    if (catalogUrls.has(url)) continue;
    bad.push(url);
  }
  return bad;
}

function buildBrandContext(docs: DocRow[]): string {
  if (!docs.length) {
    return 'Namkhan is a riverside eco-retreat on the Nam Khan river outside Luang Prabang, Laos. Voice: grounded, unhurried, first-person-plural, sensory.';
  }
  // Trim each doc to first ~800 chars to keep prompt bounded but grounded.
  return docs.map(d => `--- ${d.doc_type.toUpperCase()}: ${d.title} ---\n${(d.content_md ?? '').slice(0, 1200)}`).join('\n\n');
}

function buildRulesBlock(rules: RuleRow[]): string {
  if (!rules.length) return 'No explicit rules found — default to unhurried brand voice, no "discount" language, always include a plain-text link.';
  const grouped = new Map<string, string[]>();
  for (const r of rules) {
    if (!grouped.has(r.rule_kind)) grouped.set(r.rule_kind, []);
    grouped.get(r.rule_kind)!.push(r.rule_text);
  }
  const lines: string[] = [];
  for (const [kind, texts] of grouped) {
    lines.push(`[${kind.toUpperCase()}]`);
    for (const t of texts) lines.push(`  - ${t}`);
  }
  return lines.join('\n');
}

function buildFacilitiesBlock(facilities: FacilityRow[], activities: ActivityRow[], rooms: RoomRow[]): string {
  const facLines = facilities.length ? facilities.map(f => `  - ${f.name}${f.category ? ` (${f.category})` : ''}`).join('\n') : '  (none listed)';
  const actLines = activities.length
    ? activities.slice(0, 20).map(a => `  - ${a.name}${a.category ? ` [${a.category}]` : ''}${a.description ? `: ${a.description.slice(0, 100)}` : ''}`).join('\n')
    : '  (none listed)';
  const roomLines = rooms.length
    ? rooms.map(r => `  - ${r.room_type_name ?? '?'}${r.max_guests ? ` (up to ${r.max_guests} guests)` : ''}`).join('\n')
    : '  (none listed)';
  return `FACILITIES:\n${facLines}\n\nACTIVITIES:\n${actLines}\n\nROOM TYPES:\n${roomLines}`;
}

function buildMediaBlock(candidates: MediaCandidate[]): string {
  if (!candidates.length) return 'No hero candidates available — leave hero_asset_id null.';
  return candidates.map(c => {
    const bits = [c.category, c.sub_category, c.property_area].filter(Boolean).join(' / ');
    const desc = (c.visual_description ?? c.alt_text ?? '').slice(0, 140);
    return `  - ${c.asset_id} | ${bits || 'uncategorised'} | q=${c.quality_index ?? '?'} | ${desc}`;
  }).join('\n');
}

function buildPrompt(segment: SegmentKey, customBrief: string | undefined, g: Awaited<ReturnType<typeof fetchGuardrails>>): string {
  const toneLine = SEGMENT_TONE_HINT[segment];
  const specBlock = segment === 'welcome'
    ? `Produce EXACTLY 4 steps for segment=welcome, spaced 0/3/6/10 days.`
    : `Produce 3-5 steps tuned to segment=${segment}. First step delay_days=0. Subsequent delays spaced 3-5 days apart.`;
  const briefBlock = customBrief ? `\nOPERATOR BRIEF (must respect):\n${customBrief}\n` : '';

  return `You are drafting an email sequence for The Namkhan.

BRAND CONTEXT (source of truth — reflect this voice; do not invent facilities/activities not listed):
${buildBrandContext(g.docs)}

GENERAL EMAIL RULES (every step must satisfy every rule):
${buildRulesBlock(g.rules)}

REAL PROPERTY INVENTORY (only reference what exists):
${buildFacilitiesBlock(g.facilities, g.activities, g.rooms)}

HERO PHOTO SHORTLIST (pick ONE hero_asset_id per step from below; match the step's theme; leave null only if truly none fits):
${buildMediaBlock(g.mediaCandidates)}

INTERNAL LINK CATALOG (you MUST use ONLY these URLs for booking/CTA/legal links; never invent, never render raw Cloudbeds URLs — always wrap in the suggested anchor text):
${buildLinkCatalogBlock(g.linkCatalog)}
Rules for choosing a link:
  - retreat email → use the retreat booking URL
  - members/loyalty/returning-guest email → use the members-rate URL
  - all other booking CTAs → use the standard booking URL
  - cancellation/deposit/T&Cs mention → use the Terms & Conditions URL
Any body_md link URL that is NOT in this catalog and NOT a mailto: will be REJECTED at accept time.

AVAILABLE UPSELL PRODUCTS (use REAL product name + duration + price; never invent):
${buildUpsellBlock(g.transport, g.spa, g.fnb, g.activities)}
Pre-arrival emails (segment in welcome / anticipation / booking_confirm / retreat_confirm) MUST weave ≥3 upsell CTAs into the story:
  1. Airport transfer (from TRANSPORT list) — anchor "Reserve your riverside pick-up"
  2. Wellness ritual (from JUNGLE SPA list) — anchor "Book a first-morning ritual"
  3. F&B experience (from F&B list) — anchor "Reserve a private riverside dinner"
  4. (optional) Activity (from ACTIVITIES list) — anchor "Add a Mekong sunset boat"
If no matching internal_link_catalog URL exists for a specific CTA, use the plain-text prompt: "reply to reserve — we can add this to your stay on arrival". NEVER invent a booking URL.

Segment: ${segment}
Tone: ${toneLine}
${briefBlock}
${specBlock}

click_tag_map maps URL slug -> tag key. Cheat-sheet:
  wellness triggers: spa, detox, yoga, wellness, ice-bath, herbal
  couples triggers:  couples, romance, private-villa, intimate, honeymoon
  culture triggers:  unesco, mekong, kayak, cooking, tour, old-town
Every step MUST include a click_tag_map with 3-6 entries drawn from that step's body_md.

Return ONLY valid JSON matching:
{
  "name": string,
  "target_segment_key": "${segment}",
  "steps": [
    { "step_no": number,
      "delay_days": number,
      "subject": string,
      "body_md": string,
      "click_tag_map": { [slug: string]: string },
      "hero_asset_id": string | null
    }
  ]
}
body_md is markdown, 120-260 words per step, sensory, first-person-plural, no "discount" language.
hero_asset_id MUST be one of the asset_id values from the HERO PHOTO SHORTLIST above, or null.
Every markdown link URL MUST come from the INTERNAL LINK CATALOG above (or be a mailto:).`;
}

async function callClaude(prompt: string): Promise<Funnel> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j?.content?.[0]?.text ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no json in claude response');
  return JSON.parse(text.slice(start, end + 1)) as Funnel;
}

function validateHeroAssets(funnel: Funnel, candidates: MediaCandidate[]): Funnel {
  const valid = new Set(candidates.map(c => c.asset_id));
  for (const s of funnel.steps) {
    if (s.hero_asset_id && !valid.has(s.hero_asset_id)) s.hero_asset_id = null;
  }
  return funnel;
}

// Scan every step's body_md and image URLs; return a per-step map of violations.
function validateStepLinksAndImages(funnel: Funnel, catalog: LinkCatalogRow[]): Record<number, string[]> {
  const violations: Record<number, string[]> = {};
  const catalogUrls = new Set(catalog.map(l => l.url));
  const imageRe = /!\[[^\]]*\]\(([^)]+)\)/g;
  for (const s of funnel.steps) {
    const problems: string[] = [];
    // link URLs
    const bad = findInvalidLinks(s.body_md ?? '', catalogUrls);
    for (const u of bad) problems.push(`invalid link URL: ${u} (not in internal_link_catalog)`);
    // image URLs — must be a supabase-storage URL for media-raw/media-master/media-ai/media-renders
    let m: RegExpExecArray | null;
    const body = s.body_md ?? '';
    while ((m = imageRe.exec(body)) !== null) {
      const u = m[1].trim();
      if (!/\/storage\/v1\/object\/public\/media-(raw|master|ai|renders)\//.test(u)) {
        problems.push(`invalid image URL: ${u} (must be a supabase media-* public URL)`);
      }
    }
    if (problems.length) violations[s.step_no] = problems;
  }
  return violations;
}

export async function POST(req: NextRequest) {
  let body: { segment?: SegmentKey; custom_brief?: string; property_id?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const segment = body.segment;
  if (!segment || !['wellness', 'couples', 'culture', 'welcome'].includes(segment)) {
    return NextResponse.json({ ok: false, error: 'segment must be wellness|couples|culture|welcome' }, { status: 400 });
  }
  const propertyId = body.property_id ?? DEFAULT_PROPERTY_ID;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  try {
    const guardrails = await fetchGuardrails(propertyId);
    const funnel = await callClaude(buildPrompt(segment, body.custom_brief, guardrails));
    if (!funnel?.steps?.length) throw new Error('empty_funnel');
    const validated = validateHeroAssets(funnel, guardrails.mediaCandidates);
    const violations = validateStepLinksAndImages(validated, guardrails.linkCatalog);
    return NextResponse.json({
      ok: true,
      funnel: validated,
      violations,
      guardrails_summary: {
        rules: guardrails.rules.length,
        facilities: guardrails.facilities.length,
        activities: guardrails.activities.length,
        rooms: guardrails.rooms.length,
        hero_candidates: guardrails.mediaCandidates.length,
        link_catalog: guardrails.linkCatalog.length,
        transport: guardrails.transport.length,
        spa: guardrails.spa.length,
        fnb: guardrails.fnb.length,
      },
    });
  } catch (e) {
    const em = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: em }, { status: 502 });
  }
}
