// app/api/marketing/newsletter/propose-one/engine.ts
// PBS 2026-07-23 · Shared writer engine — extracted verbatim from route.ts POST so the
// background worker (/api/cron/write-pending-drafts) runs the SAME code path without
// an HTTP self-call. route.ts POST is now a thin wrapper around proposeOne().
// PBS 2026-07-23 · Grounded proposer v4 — deterministic envelope + Saya → Veda chain.
//
// v4.4 (2026-07-23, owner FINAL PASS — "no story, wrong pics, go deeper"):
//   - CONCEPT-DRIVEN DEEP GROUNDING: concept keywords (same stoplist/lexicon as
//     composer v2.3) select the top ~3 entities per domain — activities (full
//     description, price, times), retreats (programme), rooms (long description),
//     facilities (full ai_description) — injected as a DEEP DIVE section above
//     the shallow lists; the story must be built from them with >=2 concrete
//     specifics woven into prose.
//   - LP_CANON (emailWritingRules): Luang Prabang town facts, included for every
//     broadcast or when the concept mentions town/culture/Laos/Luang Prabang.
//   - STORY ARC rule in CORE + matching Veda narrative-thread check.
//   - DB side: marketing.compose_newsletter_email v2.3 — word-boundary keyword
//     matching + signal lexicon + length-ordered cap (fixes the motorbike-farm
//     hero on the green-season river concept, campaign 7c536a7f).
//
// v4.3 (2026-07-23, content-quality loop):
//   - loadContext: retreats + activities selects fixed (previous column names never
//     existed on the views → both surfaces were silently empty in every prod call).
//     NOTE: v_marketing_email_general_rules select is STILL broken the same way
//     (rule_type/group_slug vs actual rule_kind, no group column) — left as-is on
//     purpose: several stored rules (named-person sign-offs, mandatory
//     thenamkhan.com link) directly contradict the newer emailWritingRules canon.
//     PBS to arbitrate before that surface is re-enabled.
//   - assembleDraft: primary CTA only on broadcasts (lifecycle guests already
//     booked); CTA URL picked by context (Members / Retreat / Standard pinned row);
//     signature drops email·website line under OTA block_links/plain policy.
//   - assembleUserPrompt: products not offered to the writer when policy blocks links.
//   - buildEmailSystemPrompt gains a B2B overlay (group voice_type b2b).
//   - VEDA_SYSTEM: render-contract notes ([[CTA]] token, deterministic signature)
//     so the critic stops penalising correct deterministic output.
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
//   7. AUTO-WRITE (accept → written email): POST { campaign_id } loads the
//      campaign row (concept = its body_md), writes the email and PERSISTS
//      subject/body_md/hero_asset_id back onto the row (draft/scheduled only).
//      body_md now carries the render contract: leading ![](hero) + prose +
//      product blocks with photo/link/blurb + department signature — exactly
//      what [campaign_id]/preview and CampaignEditor's renderEmailFrame expect.
//
// Backward-compatible: still returns { ok, proposal: { subject, body_md, goal_tag } }.
// PUT (save-as-draft) unchanged except it now accepts an optional hero_asset_id.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { buildEmailSystemPrompt, normaliseKind, type EmailKind } from '@/lib/emailWritingRules';


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
  '- Do NOT write any email address or web address anywhere in your prose ("gm@..." included). If you want to invite contact, say "simply reply to this note" — replies reach us.',
  '- Use short warm sentences. Indicative mood, not imperative.',
  '- The signature is the department (Reservations / Customer Service) + hotel physical address — never a personal name.',
  "- Reference the guest's stay dates naturally where relevant. Do not say \"your reservation\".",
  '- Keep under ~180 words total. Long emails flag more heavily.',
].join('\n');

export type ProposeBody = {
  property_id?: number;
  kind?: string;
  seed_text?: string;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
  group_slug?: string | null;
  instruction?: string;
  prior?: { subject?: string; body_md?: string };
  concept?: string;
  campaign_id?: string;
};

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
    // 2026-07-23 fix: these two views never had the previously-selected columns
    // (42703 → surface silently empty in every prod call). Alias the real columns.
    sb.from('v_property_retreats').select('name:display_name, short_description:short_pitch, focus_notes:ideal_for').eq('property_id', NAMKHAN_ID).eq('is_active', true).limit(10),
    sb.from('v_activities_catalog').select('activity_name:name, short_description:description, price_incl_taxes_usd:price_amount').eq('property_id', NAMKHAN_ID).eq('is_active', true).order('display_order', { ascending: true }).limit(15),
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
// 2026-07-23 tier ladder (owner rule): curated ota/web tiers first; widen to the
// social pool ONLY when the curated pool returns nothing. NEVER archive /
// internal / logos / untiered photos, under any fallback.
async function fallbackPhotoPick(sb: ReturnType<typeof getSupabaseAdmin>): Promise<PhotoPick[]> {
  const query = (tiers: string[]) => sb
    .from('v_marketing_media_page')
    .select('asset_id, caption, alt_text, property_area')
    .eq('property_id', NAMKHAN_ID)
    .in('status', ['ready', 'qc_passed'])
    .in('primary_tier', tiers)
    .not('caption', 'is', null)
    .order('quality_index', { ascending: false, nullsFirst: false })
    .limit(4);
  let { data, error } = await query(['tier_ota_profile', 'tier_website_hero']);
  if (!error && (data ?? []).length === 0) {
    ({ data, error } = await query(['tier_social_pool']));
  }
  if (error) return [];
  const rows = (data as Array<{ asset_id: string; caption: string | null; alt_text: string | null; property_area: string | null }> | null) ?? [];
  return rows
    .filter(r => r.caption && r.caption.trim().length > 0)
    .map(r => ({ asset_id: r.asset_id, caption: (r.caption ?? '').trim(), alt_text: r.alt_text, property_area: r.property_area }));
}

// ── Concept-driven deep grounding (v4.4) ─────────────────────────────────────
// The concept/seed keywords select the top ~3 entities per domain (activities,
// retreats, rooms, facilities) whose FULL detail is injected as a DEEP DIVE
// section — the story is built from these, not from the shallow catalog lists.
// Stoplist + signal lexicon mirror marketing.compose_newsletter_email v2.3 so
// prose grounding and envelope photo/product selection key off the same terms.
const KEYWORD_STOP = new Set(('with from your yours have will they them their when what where which then than been were into over just some more most only very here there about after before while this that these those something anything namkhan luang prabang laos property guest guests ' +
  'stay stays open know make like next come back week weeks year years already until itself enough also ever even each much many other others being feels feel ' +
  'case having yourself feeling choice corner rather almost wider away short fewer fuller deeper considered compromise travelling travel building buildings southeast asia worth means sense invite consider lean describe readers understand story connect frame ideal whether without busier challenge assumption traveller travellers region actually performed every shapes shape chosen tell origin heart beating backdrop world things thing particular different moment moments rare listed landscape texture version postcard honest months month').split(' '));
const KEYWORD_SIGNAL = new Set(('river green jungle rain rains monsoon farm organic harvest garden spa wellness massage sauna yoga retreat retreats roots kitchen dining food dish chef boat cruise mekong pool unesco temple temples monk monks market waterfall kuang phousi villa villas tent tents glamping suite suites family couples romance honeymoon detox mindfulness meditation sunset sunrise morning evening dawn quiet private exclusive buyout group groups workshop workshops corporate offsite partner partners trade bangkok flight flights airport season water fish tea ginger restoration almsgiving').split(' '));

function extractConceptKeywords(text: string): string[] {
  const words = (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter(w => !KEYWORD_STOP.has(w));
  return Array.from(new Set(words))
    .sort((a, b) => (Number(KEYWORD_SIGNAL.has(b)) - Number(KEYWORD_SIGNAL.has(a))) || b.length - a.length)
    .slice(0, 16);
}

function keywordScore(text: string, kws: string[]): number {
  const t = ' ' + text.toLowerCase().replace(/[^a-z]+/g, ' ') + ' ';
  let s = 0;
  for (const w of kws) if (t.includes(' ' + w)) s += KEYWORD_SIGNAL.has(w) ? 3 : 1;
  return s;
}

type DeepActivity = { name: string; description: string | null; price_amount: number | null; price_currency: string | null; duration_min: number | null; service_time_from: string | null; service_time_to: string | null };
type DeepRetreat = { display_name: string; short_pitch: string | null; long_description: string | null; ideal_for: unknown; min_nights: number | null; max_nights: number | null };
type DeepRoom = { room_type_name: string; positioning_label: string | null; short_pitch: string | null; long_description: string | null; size_sqm: number | null; view_type: unknown };
type DeepFacility = { facility_name: string; category: string | null; ai_description: string | null; facility_description: string | null; hours: string | null };
type DeepDive = { activities: DeepActivity[]; retreats: DeepRetreat[]; rooms: DeepRoom[]; facilities: DeepFacility[] };

function pickTop<T>(rows: T[] | null | undefined, kws: string[], textOf: (r: T) => string, n = 3): T[] {
  return (rows ?? [])
    .map(r => ({ r, s: keywordScore(textOf(r), kws) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map(x => x.r);
}

async function loadDeepDive(sb: ReturnType<typeof getSupabaseAdmin>, kws: string[]): Promise<DeepDive> {
  const empty: DeepDive = { activities: [], retreats: [], rooms: [], facilities: [] };
  if (kws.length === 0) return empty;
  const [aR, rR, roR, fR] = await Promise.all([
    sb.from('v_activities_catalog').select('name, description, price_amount, price_currency, duration_min, service_time_from, service_time_to').eq('property_id', NAMKHAN_ID).eq('is_active', true).limit(30),
    sb.from('v_property_retreats').select('display_name, short_pitch, long_description, ideal_for, min_nights, max_nights').eq('property_id', NAMKHAN_ID).eq('is_active', true).limit(10),
    sb.from('v_room_grounding').select('room_type_name, positioning_label, short_pitch, long_description, size_sqm, view_type').eq('property_id', NAMKHAN_ID).eq('active', true).limit(12),
    sb.from('v_facility_grounding').select('facility_name, category, ai_description, facility_description, hours').eq('property_id', NAMKHAN_ID).eq('active', true).limit(25),
  ]);
  return {
    activities: pickTop((aR.data as DeepActivity[] | null), kws, r => `${r.name} ${r.description ?? ''}`),
    retreats: pickTop((rR.data as DeepRetreat[] | null), kws, r => `${r.display_name} ${r.short_pitch ?? ''} ${r.long_description ?? ''}`),
    rooms: pickTop((roR.data as DeepRoom[] | null), kws, r => `${r.room_type_name} ${r.positioning_label ?? ''} ${r.short_pitch ?? ''} ${r.long_description ?? ''}`),
    facilities: pickTop((fR.data as DeepFacility[] | null), kws, r => `${r.facility_name} ${r.ai_description ?? ''} ${r.facility_description ?? ''}`),
  };
}

const squash = (s: string | null | undefined, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const arrJoin = (v: unknown) => Array.isArray(v) ? v.map(x => String(x)).join(', ') : '';

function renderDeepDive(deep: DeepDive): string[] {
  const total = deep.activities.length + deep.retreats.length + deep.rooms.length + deep.facilities.length;
  if (total === 0) return [];
  const parts: string[] = [];
  parts.push('');
  parts.push('### DEEP DIVE — write from these specifics (concept-matched property truth)');
  parts.push('The email\'s story must be BUILT from these entities — they are the development of your story arc. Weave AT LEAST 2 concrete specifics (a price, a time, a dish, a room feature, a duration, a distance) naturally into the prose. Never list them; never write a brochure line.');
  parts.push('ACCURACY: attribute every price/time/duration to the EXACT entity it belongs to — never transfer a price across variants (a shared class price is not the private class price). If unsure which variant a number belongs to, leave the number out.');
  for (const a of deep.activities) {
    const bits = [squash(a.description, 400)];
    if (a.price_amount != null) bits.push(`${a.price_currency ?? 'USD'} ${a.price_amount} pp`);
    if (a.duration_min) bits.push(`~${a.duration_min} min`);
    if (a.service_time_from) bits.push(`from ${String(a.service_time_from).slice(0, 5)}${a.service_time_to ? ` to ${String(a.service_time_to).slice(0, 5)}` : ''}`);
    parts.push(`- [activity] ${a.name} — ${bits.filter(Boolean).join(' · ')}`);
  }
  for (const r of deep.retreats) {
    const bits = [squash(r.long_description || r.short_pitch, 450)];
    if (r.min_nights) bits.push(`${r.min_nights}${r.max_nights && r.max_nights !== r.min_nights ? `–${r.max_nights}` : ''} nights`);
    const ideal = arrJoin(r.ideal_for);
    if (ideal) bits.push(`ideal for: ${ideal}`);
    parts.push(`- [retreat] ${r.display_name} — ${bits.filter(Boolean).join(' · ')}`);
  }
  for (const ro of deep.rooms) {
    const bits = [squash(ro.long_description || ro.short_pitch, 400)];
    if (ro.size_sqm) bits.push(`${ro.size_sqm} sqm`);
    const views = arrJoin(ro.view_type);
    if (views) bits.push(`views: ${views}`);
    parts.push(`- [room] ${ro.room_type_name}${ro.positioning_label ? ` (${ro.positioning_label})` : ''} — ${bits.filter(Boolean).join(' · ')}`);
  }
  for (const f of deep.facilities) {
    const bits = [squash(f.ai_description || f.facility_description, 350)];
    if (f.hours) bits.push(`hours: ${squash(f.hours, 60)}`);
    parts.push(`- [facility] ${f.facility_name}${f.category ? ` (${f.category})` : ''} — ${bits.filter(Boolean).join(' · ')}`);
  }
  return parts;
}

function assembleUserPrompt(
  body: ProposeBody,
  ctx: Awaited<ReturnType<typeof loadContext>>,
  env: Envelope,
  fallbackPhotos: PhotoPick[],
  concept: string,
  deep: DeepDive,
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
  // 2026-07-23 fix: when policy blocks links the product blocks can never render —
  // don't ask for blurbs that get discarded (and that the critic then penalises).
  if (env.products.length > 0 && !ctx.policy?.block_links) {
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

  // DEEP DIVE sits ABOVE the shallow catalog lists — the story is built from it.
  parts.push(...renderDeepDive(deep));

  if (ctx.rooms.length > 0) {
    parts.push('');
    parts.push('### PROPERTY · ROOMS (shallow catalog — context only; the story comes from DEEP DIVE)');
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

function mdImage(alt: string | null, url: string): string {
  const a = String(alt ?? '').replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return `![${a}](${url})`;
}

// Deterministic assembly: leading hero image (the render path's hero contract:
// preview + CampaignEditor both take the FIRST ![](url) in body_md as the hero)
// + greeting + Saya prose slots + product blocks (photo + exact catalog link +
// blurb) + department signature. AI never writes links, images or the signature.
type AssembleExtras = {
  goals?: Array<{ goal_key: string; goal_label: string }>;
  pinned?: { url: string; anchor_hint?: string | null; title?: string | null } | null;
};

function assembleDraft(slots: SayaSlots, env: Envelope, policy: Policy | null, kind: EmailKind, extras?: AssembleExtras): SayaDraft {
  const parts: string[] = [];
  const allowImages = !policy?.block_images && !policy?.force_plain_text;
  const usedAssets = new Set<string>();

  if (allowImages && env.hero && env.hero.primary_render) {
    parts.push(mdImage(env.hero.alt_text || env.hero.caption, env.hero.primary_render));
    if (env.hero.asset_id) usedAssets.add(env.hero.asset_id);
  }

  // Eyebrow/kicker from the matched director-goal label (renderer convention ^^...^^)
  const eyebrowLabel = extras?.goals?.find(g => g.goal_key === slots.goal_tag)?.goal_label || null;
  if (eyebrowLabel) parts.push(`^^${eyebrowLabel.toUpperCase()}^^`);

  parts.push(env.greeting);
  if (slots.opening_md.trim()) parts.push(slots.opening_md.trim());
  if (slots.practical_md.trim()) parts.push(slots.practical_md.trim());

  if (!policy?.block_links && env.products.length > 0) {
    const blocks: string[] = [];
    const seenUrls = new Set<string>();
    env.products.forEach((p, i) => {
      if (!p.link_url) return;
      // 2026-07-23 duplicate-offering guard: never a product card that repeats the
      // primary CTA's URL, and never two product cards with the same URL.
      if (extras?.pinned?.url && p.link_url === extras.pinned.url) return;
      if (seenUrls.has(p.link_url)) return;
      seenUrls.add(p.link_url);
      const anchor = p.link_anchor || p.product_name || 'Read more';
      const blurb = (slots.product_blurbs[i] ?? '').trim();
      let img = '';
      if (allowImages && p.primary_render && p.asset_id && !usedAssets.has(p.asset_id)) {
        img = `${mdImage(p.alt_text || p.caption, p.primary_render)}\n\n`;
        usedAssets.add(p.asset_id);
      }
      blocks.push(`${img}**[${anchor}](${p.link_url})**${blurb ? ` — ${blurb}` : ''}`);
    });
    if (blocks.length > 0) {
      parts.push('---');
      if (kind === 'before_checkin') parts.push('A few experiences worth holding now:');
      parts.push(blocks.join('\n\n'));
    }
  }

  if (slots.closing_md.trim()) parts.push(slots.closing_md.trim());

  // THE one primary CTA (renderer convention [[CTA]] → bulletproof button):
  // context-picked pinned catalog row (see pickPinnedCta). Broadcasts only —
  // lifecycle emails (booking_confirm / before_checkin / after_checkout) go to
  // guests who ALREADY booked; a booking button there is tonally wrong and the
  // product cards carry their own links. Never on link-blocked / plain-text policies.
  if (kind === 'broadcast' && !policy?.block_links && !policy?.force_plain_text && extras?.pinned?.url) {
    const ctaLabel = (extras.pinned.anchor_hint || extras.pinned.title || 'Reserve your stay').slice(0, 40);
    parts.push(`[[CTA]] [${ctaLabel}](${extras.pinned.url})`);
  }

  // 2026-07-23 fix: under OTA plain/no-link policy the signature must not carry
  // email/website — those read as links to OTA relay spam filters.
  const s = env.signature;
  const sigContact = (policy?.block_links || policy?.force_plain_text) ? '' : `\n${s.email} · ${s.website}`;
  parts.push(`Warm regards,\n\n${s.role} · ${s.org}\n${s.address_lines.join(', ')}${sigContact}`);

  return { subject: slots.subject, body_md: parts.join('\n\n'), goal_tag: slots.goal_tag };
}

// Context-aware primary-CTA pick from the pinned booking rows:
//   returning-guests / loyalty context → Members rate URL
//   retreat / yoga / wellness context  → Retreat promo URL
//   otherwise                          → Standard booking URL
// (The three pinned booking rows are the ONLY valid booking CTAs per link_hygiene rules.)
type LinkRow = { section: string; anchor_hint: string; url: string; title: string | null; description: string | null; is_pinned: boolean | null };
function pickPinnedCta(links: LinkRow[], group_slug: string | null, seedAndConcept: string): LinkRow | null {
  const pinned = links.filter(l => l.is_pinned && l.url);
  if (pinned.length === 0) return null;
  const booking = pinned.filter(l => l.section === 'booking');
  const txt = `${group_slug ?? ''} ${seedAndConcept}`.toLowerCase();
  const find = (re: RegExp) => booking.find(l => re.test(`${l.title ?? ''} ${l.anchor_hint ?? ''} ${l.url}`.toLowerCase())) ?? null;
  if (group_slug === 'returning-guests' || /\bmembers?\b|loyal|welcome back/.test(txt)) {
    const m = find(/member/); if (m) return m;
  }
  if (/retreat|yoga|wellness|detox|mindfulness/.test(txt)) {
    const r = find(/retreat/); if (r) return r;
  }
  return find(/standard|reserve/) ?? booking[0] ?? pinned[0];
}

type VedaResult = { score: number; issues: string[]; critique: string };

const VEDA_SYSTEM = [
  'You are Veda, editorial critic for The Namkhan newsletter team.',
  'You receive the FULL context prompt the writer received, followed by the assembled draft.',
  'You score the draft against a rubric (each 0-20, sum 0-100):',
  '  1. sensory_anchor · does the first paragraph after the greeting open with ONE specific Namkhan sensory detail (kingfisher, wood-fire, ginger tea, river light, boat engine, etc)? Not a summary.',
  '  2. forbidden_absent · no "We are excited/delighted", no "Book now/Reserve", no "Amazing/Incredible", no emojis, no ALL CAPS, no more than one exclamation mark, nothing from the REALITY PROFILE forbidden list.',
  '  3. url_discipline · every URL matches the LINK CATALOG or the DETERMINISTIC ENVELOPE product blocks (or there are no URLs when policy blocks them).',
  '  4. signature_discipline · closes with the department signature (Reservations or Customer Service · The Namkhan + address + gm@thenamkhan.com + thenamkhan.com). NEVER a personal name. EXCEPTION: under a block_links / plain-text policy the signature correctly omits the email and website lines (they read as links to OTA spam filters) — address-only is the REQUIRED form there, score it full.',
  '  5. voice_match · calm, understated, warm, grounded in real property facts from the context — not generic hotel copy. CRITICAL: does a SINGLE narrative thread run start to finish (opening scene → development built on the DEEP DIVE specifics → an invitation that closes the same story)? Disconnected atmospheric fragments, generic property re-description, or specifics dumped as a list = major deduction. When a DEEP DIVE section exists, at least 2 concrete specifics (a price, a time, a dish, a room feature, a duration, a distance) must be woven into the prose.',
  'RENDER CONTRACT — deterministic tokens you must NOT penalise:',
  '- "[[CTA]] [label](url)" on its own line is a renderer token that becomes THE one primary button. It is correct output, not an artifact.',
  '- "Warm regards," followed by the department signature block is appended deterministically and is the required sign-off format.',
  '- Markdown images and "**[anchor](url)** — blurb" lines are envelope-assembled product cards; their URLs and photos come from the system, not the writer.',
  'Judge the prose slots (opening, practical, blurbs, closing), the subject, and policy compliance — not these deterministic tokens.',
  'B2B AUDIENCES (GROUP VOICE voice_type b2b): sensory_anchor means ONE restrained scene-setting line — score register match (professional, logistics-forward, no perfumed prose, no fabricated commercial specifics) under voice_match instead of demanding B2C sensory writing.',
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

// A body that reads as a plan concept, not an assembled email.
function looksLikeConcept(text: string): boolean {
  return text.length > 0 &&
    text.length <= 600 &&
    !text.includes('Warm regards') &&
    !text.includes('![') &&
    !text.toLowerCase().startsWith('placeholder body');
}

type CampaignRowLite = {
  property_id: number;
  ai_prompt: string | null;
  name: string | null;
  subject: string | null;
  body_md: string | null;
  group_slug: string | null;
  campaign_kind: string | null;
  planned_date: string | null;
  audience_type: string | null;
  status: string | null;
};

export async function proposeOne(body: ProposeBody): Promise<NextResponse> {
  const sb = getSupabaseAdmin();

  // AUTO-WRITE MODE: when campaign_id is given, the route loads the campaign
  // row itself (concept = its body_md when concept-shaped), fills the missing
  // request fields from the row, and PERSISTS the finished email back onto the
  // campaign at the end. This is what Accept-slot auto-write and the
  // Broadcasts "Write email" button call.
  const campaign_id = body.campaign_id ? String(body.campaign_id) : null;
  let campaign: CampaignRowLite | null = null;
  if (campaign_id) {
    const { data, error } = await sb.schema('guest').from('campaigns')
      .select('property_id, ai_prompt, name, subject, body_md, group_slug, campaign_kind, planned_date, audience_type, status')
      .eq('campaign_id', campaign_id).maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: `campaign_load_failed: ${error.message}` }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });
    campaign = data as CampaignRowLite;
    if (campaign.property_id !== NAMKHAN_ID) return NextResponse.json({ ok: false, error: 'campaign_not_found' }, { status: 404 });
    if (!body.group_slug && campaign.group_slug) body.group_slug = campaign.group_slug;
    if (!body.kind && campaign.campaign_kind) body.kind = campaign.campaign_kind;
    if (!body.target_date && campaign.planned_date) body.target_date = campaign.planned_date;
    if (!body.audience_type && campaign.audience_type === 'b2b') body.audience_type = 'b2b';
  }

  const seedRaw = String(body.seed_text ?? '').trim();
  const seed = seedRaw || (campaign ? String(campaign.name ?? campaign.subject ?? '').trim() : '');

  // SLOT CONCEPT (plan v3): explicit body.concept wins; then the campaign's own
  // body_md (draft campaigns created from accepted Director slots carry the
  // concept as body_md); then a concept-shaped prior.body_md from refine mode.
  const explicitConcept = String(body.concept ?? '').trim();
  const campaignBody = String(campaign?.body_md ?? '').trim();
  const priorBody = String(body.prior?.body_md ?? '').trim();
  const concept = (
    explicitConcept ||
    (looksLikeConcept(campaignBody) ? campaignBody : '') ||
    (looksLikeConcept(priorBody) ? priorBody : '')
  ).slice(0, 1000);

  if (!seed && !concept) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const group_slug = body.group_slug ? String(body.group_slug) : null;

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
  const isB2b = ctx.group?.voice_type === 'b2b' || body.audience_type === 'b2b';
  const lpCanon = /\b(town|culture|laos|luang|prabang)\b/i.test(`${concept} ${seed}`);
  const sayaSystem = [buildEmailSystemPrompt(emailKind, ctx.policy, { b2bVoice: isB2b, lpCanon }), SLOT_OUTPUT_CONTRACT]
    .concat(isOta ? [ANTI_SPAM_FILTER_RULES] : [])
    .join('\n\n');

  // Concept-driven deep grounding: full detail for the top concept-matched entities.
  const tDeep = Date.now();
  const conceptKeywords = extractConceptKeywords(concept || seed);
  const deep = await loadDeepDive(sb, conceptKeywords);
  trace.push({ step: 'deep_dive', agent_id: AGENT_LIAM, latency_ms: Date.now() - tDeep, ok: true, note: `kw=${conceptKeywords.length} act=${deep.activities.length} ret=${deep.retreats.length} rooms=${deep.rooms.length} fac=${deep.facilities.length}` });

  const userPrompt = assembleUserPrompt(body, ctx, envelope, fallbackPhotos, concept, deep);

  // 4. Saya · prose slots → deterministic assembly
  const pinnedCta = pickPinnedCta(ctx.links, group_slug, `${concept} ${seed}`);
  let draft: SayaDraft;
  const tSaya = Date.now();
  try {
    const slots = await sayaSlots(sayaSystem, userPrompt);
    draft = assembleDraft(slots, envelope, ctx.policy, emailKind, { goals: ctx.goals, pinned: pinnedCta });
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
      const retryPrompt = assembleUserPrompt(body, ctx, envelope, fallbackPhotos, concept, deep, veda.critique);
      const retriedSlots = await sayaSlots(sayaSystem, retryPrompt);
      const retried = assembleDraft(retriedSlots, envelope, ctx.policy, emailKind, { goals: ctx.goals, pinned: pinnedCta });
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

  // AUTO-WRITE persist: write the finished email back onto the campaign row.
  // Draft/scheduled only — sent campaigns are never overwritten.
  let persisted: { ok: boolean; error?: string } | null = null;
  if (campaign_id) {
    const heroAssetId = (!ctx.policy?.block_images && envelope.hero?.asset_id) ? envelope.hero.asset_id : null;
    // ai_prompt doubles as the refine-instruction trail (style-memory feed):
    // never wipe an accumulated trail; refine instructions append as dated lines, cap 4000.
    const priorPrompt = String(campaign?.ai_prompt ?? '');
    const basePrompt = priorPrompt.includes('[refine') ? priorPrompt : (priorPrompt || (concept || seed).slice(0, 2000));
    const refineTrail = (isRefine && body.instruction)
      ? `\n[refine ${new Date().toISOString().slice(0, 16).replace('T', ' ')}] ${String(body.instruction).slice(0, 500)}`
      : '';
    const nextPrompt = (basePrompt + refineTrail);
    const { error: perr } = await sb.schema('guest').from('campaigns').update({
      subject: draft.subject,
      body_md: draft.body_md,
      hero_asset_id: heroAssetId,
      ai_prompt: nextPrompt.length > 4000 ? nextPrompt.slice(-4000) : nextPrompt,
      ai_model: 'claude-sonnet-4-6',
      updated_at: new Date().toISOString(),
    }).eq('campaign_id', campaign_id).in('status', ['draft', 'scheduled']);
    persisted = perr ? { ok: false, error: perr.message } : { ok: true };
    trace.push({ step: 'persist', agent_id: AGENT_SAYA, latency_ms: 0, ok: !perr, note: perr ? perr.message : `campaign=${campaign_id}` });
  }

  return NextResponse.json({
    ok: true,
    proposal: draft,
    persisted,
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
