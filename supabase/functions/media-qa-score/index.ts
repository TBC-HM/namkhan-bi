// supabase/functions/media-qa-score/index.ts
// Media QA scoring engine v11 (PBS 2026-09-09).
//
// v11 changes — METERING. v10 made 5 Anthropic vision calls per asset and
// recorded NONE of them. public.ai_token_meter had five sources and not one was
// media, so all 2,181 Namkhan scorings and the 25-asset Donna pilot were
// invisible spend. The only cost artifact was qa-score-batch's hardcoded
// `cost_milli: scored_ok.length * 15` — a flat $0.015/asset guess, measured at
// ~5.4x under (real ~$0.081/asset at 23k in / 800 out).
//   - every Anthropic response's `usage` block is now captured and summed;
//   - totals are written via public.fn_meter_ai_call(property_id, ...), which
//     prices from costs.price_book_rates and is idempotent on run_ref;
//   - run_ref is `mediaqa:<asset_id>:<scored_at>` so a re-score meters again but
//     a retry of the same run does not double-charge;
//   - tokens + cost_usd are returned to the caller and stamped into qa_notes,
//     so qa-score-batch can stop fabricating a number.
// Metering is best-effort: a metering failure is recorded in the response and
// never fails the scoring run.
//
// v10: MULTI-TENANT (ADR-305). Property identity, categories, caption/alt
//   guardrails and SEO language all come from public.v_media_property_identity
//   and are property-scoped; property_id no longer defaults to 260955 (L22).
// v9: tier bands per ADR-149; image prep renders->master->ai with raw fallback;
//   marketing prompt as a 0-100 gradient.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
const LONG_EDGE_TARGET = 1568;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  };
}

async function getAnthropicKey(admin: any): Promise<string | null> {
  try {
    const { data } = await admin.rpc('fn_get_secret', { p_name: 'ANTHROPIC_API_KEY' });
    if (typeof data === 'string' && data.trim().length > 20) return data.trim();
  } catch (_) {}
  const env = Deno.env.get('ANTHROPIC_API_KEY');
  return env && env.length > 20 ? env : null;
}

async function loadActivePersona(admin: any, role: string): Promise<string> {
  try {
    const { data } = await admin
      .from('cockpit_agent_prompts')
      .select('prompt')
      .eq('role', role)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.prompt) return String(data.prompt).slice(0, 6000);
  } catch (_) {}
  return '';
}

type Identity = {
  property_id: number; trading_name: string; city: string | null; region: string | null;
  country: string | null; brand_slug: string; brand_name_required: string;
  seo_language: string; legacy_brand_tokens: string[]; categories: string[]; category_labels: string[];
};

async function loadIdentity(admin: any, propertyId: number): Promise<Identity | null> {
  const { data } = await admin
    .from('v_media_property_identity')
    .select('property_id, trading_name, city, region, country, brand_slug, brand_name_required, seo_language, legacy_brand_tokens, categories, category_labels')
    .eq('property_id', propertyId)
    .maybeSingle();
  return (data ?? null) as Identity | null;
}

function deriveRegex(pattern: string): RegExp {
  let src = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  src = src.replace(/YYYYMMDD/g, '\\d{8}');
  src = src.replace(/YYYY/g, '\\d{4}');
  src = src.replace(/MM/g, '\\d{2}');
  src = src.replace(/DD/g, '\\d{2}');
  src = src.replace(/XX/g, '[A-Za-z]{2}');
  src = src.replace(/[A-Z][a-zA-Z]+/g, '[A-Za-z][A-Za-z0-9]+');
  return new RegExp('^' + src + '(\\.[A-Za-z0-9]+)?$');
}

function checkNaming(filename: string | null, pattern: string | null, storedRegex: string | null) {
  if (!filename || !pattern) return { expected: pattern ?? null, matched: null, violations: [] as string[] };
  const stem = filename.replace(/\.[A-Za-z0-9]+$/, '');
  let re: RegExp;
  try { re = storedRegex ? new RegExp(storedRegex) : deriveRegex(pattern); }
  catch (_) { re = deriveRegex(pattern); }
  const matched = re.test(stem) || re.test(filename);
  const violations: string[] = [];
  if (!matched) {
    if (!filename.includes('_')) violations.push('filename does not use "_" separators');
    const parts = stem.split('_');
    const expected = pattern.split('_');
    if (parts.length !== expected.length) violations.push(`expected ${expected.length} segments, got ${parts.length}`);
  }
  return { expected: pattern, matched, violations };
}

function fmtList(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return '(none)';
  return arr.map((x) => String(x)).join(', ');
}

async function loadGuardrails(admin: any, propertyId: number) {
  const scope = `property_id.eq.${propertyId},property_id.is.null`;
  const [namingRes, capRes, altRes, tierRes, ratioRes, textRes, palRes] = await Promise.all([
    admin.from('v_media_naming_conventions').select('scope, pattern, regex, examples, active, property_id').or(scope),
    admin.from('v_media_caption_rules').select('min_words, max_words, banned_phrases, must_include_keywords, tone, active, property_id').eq('active', true).or(scope).order('property_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    admin.from('v_media_alt_text_rules').select('min_chars, max_chars, must_be_descriptive, must_include_subject, banned_words, must_include_keywords, active, property_id').eq('active', true).or(scope).order('property_id', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    admin.from('v_media_tier_thresholds').select('tier, min_quality_index, min_technical, min_aesthetic, min_marketing, requires_model_release, active').eq('active', true),
    admin.from('v_media_aspect_ratio_rules').select('channel, ratio, min_width_px, min_height_px, notes, active').eq('active', true),
    admin.from('v_media_text_policy').select('allow_on_social, allow_on_hero, allow_on_ota, max_text_area_pct, blocklist_words, active').eq('id', 1).maybeSingle(),
    admin.from('v_media_brand_palette').select('color_name, hex, role, active, property_id').eq('active', true).or(scope),
  ]);
  return {
    naming: (namingRes.data ?? []) as any[],
    caption: (capRes.data ?? null) as any,
    alt: (altRes.data ?? null) as any,
    tiers: (tierRes.data ?? []) as any[],
    ratios: (ratioRes.data ?? []) as any[],
    textPolicy: (textRes.data ?? null) as any,
    palette: (palRes.data ?? []) as any[],
  };
}

function buildGuardrailsBlock(g: any, id: Identity, scope: 'photo' | 'video' = 'photo'): string {
  const namingForScope = (g.naming ?? []).filter((n: any) => n.scope === scope || n.scope == null)
    .sort((a: any, b: any) => (b.property_id ? 1 : 0) - (a.property_id ? 1 : 0))[0] ?? null;
  const lines: string[] = [];
  lines.push('<current_guardrails>');
  lines.push(`Property: ${id.trading_name} (property_id ${id.property_id})`);
  lines.push(`Naming pattern (${scope}): ${namingForScope?.pattern ?? '(none)'}`);
  if (g.caption) lines.push(`Caption rules: min ${g.caption.min_words ?? '-'} max ${g.caption.max_words ?? '-'} words. Banned: ${fmtList(g.caption.banned_phrases)}. Required: ${fmtList(g.caption.must_include_keywords)}. Tone: ${g.caption.tone ?? '(unset)'}`);
  if (g.alt) lines.push(`Alt text: ${g.alt.min_chars}-${g.alt.max_chars} chars. Banned: ${fmtList(g.alt.banned_words)}. Descriptive: ${g.alt.must_be_descriptive}. IncludeSubject: ${g.alt.must_include_subject}. Required keywords: ${fmtList(g.alt.must_include_keywords)}`);
  if (g.tiers.length) lines.push(`Tier thresholds: ${g.tiers.map((t: any) => `${t.tier}>=${t.min_quality_index ?? '-'}`).join(', ')}`);
  if (g.ratios.length) lines.push(`Aspect ratios: ${g.ratios.map((r: any) => `${r.channel} ${r.ratio}${r.min_width_px ? ' >=' + r.min_width_px + 'x' + (r.min_height_px ?? '?') + 'px' : ''}`).join(', ')}`);
  if (g.textPolicy) lines.push(`Text on image: hero=${g.textPolicy.allow_on_hero}, social=${g.textPolicy.allow_on_social}, ota=${g.textPolicy.allow_on_ota}, max_area_pct=${g.textPolicy.max_text_area_pct}. Blocked words: ${fmtList(g.textPolicy.blocklist_words)}`);
  if (g.palette.length) lines.push(`Brand palette: ${g.palette.map((p: any) => `${p.color_name}=${p.hex}(${p.role})`).join(', ')}`);
  lines.push('');
  const place = [id.city, id.region, id.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  lines.push('<local_seo_hard_rules>');
  lines.push(`Hotel name: ${id.trading_name}.`);
  lines.push(`Location: ${place}.`);
  lines.push(`Output language: ${id.seo_language === 'en' ? 'ENGLISH' : id.seo_language.toUpperCase()}.`);
  lines.push(`seo_target_filename MUST contain the token "${id.brand_slug}" (lowercase, kebab-case). Example: ${id.brand_slug}-{area}-{subject}.webp`);
  lines.push(`seo_title_text MUST contain "${id.brand_name_required}".`);
  lines.push(`seo_alt_text MUST mention BOTH "${id.brand_name_required}" AND "${id.city ?? id.region ?? ''}" and be 125-160 characters.`);
  if (id.legacy_brand_tokens?.length) {
    lines.push(`LEGACY BRAND — the property owns these assets, but the previous brand must never appear in generated text. Never emit any of: ${id.legacy_brand_tokens.join(', ')}. Strip them (and any shoot prefix such as "MW_") before deriving any SEO field. original_filename is immutable provenance and is never rewritten.`);
  }
  lines.push('</local_seo_hard_rules>');
  lines.push('');
  lines.push('When scoring, note each violated rule as { rule_type, rule_detail, severity } in qa_notes.failures[]. Do NOT emit rule_type="naming"; the backend auto-applies seo_target_filename as the working filename.');
  lines.push('</current_guardrails>');
  return lines.join('\n');
}

// v11: returns the parsed JSON AND the usage block, so spend can be metered.
type CallResult = { parsed: any; usage: { input: number; cached: number; output: number } };

async function callAnthropicVisionB64(apiKey: string, systemPrompt: string, userPrompt: string, imageBase64: string, mediaType: string): Promise<CallResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 900,
      system: systemPrompt || 'You are a hotel photo QA scorer. Return ONLY valid JSON, no prose, no markdown fences.',
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: userPrompt },
      ] }],
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${JSON.stringify(j).slice(0, 400)}`);

  const usage = {
    input:  Number(j?.usage?.input_tokens ?? 0),
    cached: Number(j?.usage?.cache_read_input_tokens ?? 0),
    output: Number(j?.usage?.output_tokens ?? 0),
  };

  const text: string = j?.content?.[0]?.text ?? '';
  const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return { parsed: JSON.parse(cleaned), usage }; }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return { parsed: JSON.parse(m[0]), usage };
    // The tokens were still spent — surface them on the error so the caller meters.
    const err: any = new Error('anthropic returned non-JSON: ' + cleaned.slice(0, 200));
    err.usage = usage;
    throw err;
  }
}

function tierFromScores(t: number, a: number, _m: number): string | null {
  const q = t * 0.5 + a * 0.5;
  if (q >= 90) return 'tier_website_hero';
  if (q >= 80) return 'tier_ota_profile';
  if (q >= 70) return 'tier_social_pool';
  if (q >= 60) return 'tier_internal';
  if (q >= 40) return 'tier_archive';
  return null;
}

function uint8ToBase64(buf: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

function stripLegacy(s: string | null, tokens: string[]): string | null {
  if (!s || !tokens?.length) return s;
  let out = s;
  for (const t of tokens) {
    if (!t) continue;
    out = out.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
  }
  out = out.replace(/\bMW[_-]/gi, '').replace(/[-_]{2,}/g, '-').replace(/^[-_\s]+|[-_\s]+$/g, '').replace(/\s{2,}/g, ' ');
  return out.length ? out : s;
}

function enforceLocalSeo(seo: { filename: string | null; title: string | null; alt: string | null }, id: Identity) {
  let { filename, title, alt } = seo;
  const tokens = id.legacy_brand_tokens ?? [];
  filename = stripLegacy(filename, tokens);
  title = stripLegacy(title, tokens);
  alt = stripLegacy(alt, tokens);

  const slug = id.brand_slug;
  const brand = id.brand_name_required;
  const place = id.city ?? id.region ?? '';

  if (filename && slug && !new RegExp(slug, 'i').test(filename)) {
    filename = `${slug}-${filename.replace(/^[-_]+/, '')}`;
  }
  if (title && brand && !new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(title)) {
    title = `${title.trim().replace(/[.\s]+$/, '')} at ${brand}`;
  }
  if (alt) {
    let a = alt.trim();
    if (brand && !new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(a)) a = `${a} — ${brand}`;
    if (place && !new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(a)) a = `${a}, ${place}`;
    if (a.length > 160) a = a.slice(0, 157).trimEnd() + '...';
    alt = a;
  }
  return { filename, title, alt };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders() });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders() });

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: corsHeaders() }); }

  const asset_id: string | undefined = body?.asset_id;
  if (!asset_id) return new Response(JSON.stringify({ error: 'asset_id_required' }), { status: 400, headers: corsHeaders() });

  const admin = createClient(SB_URL, SB_SVC, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: asset, error: aErr } = await admin
    .from('v_marketing_media_page')
    .select('asset_id, original_filename, raw_path, master_path, mime_type, asset_type, property_area, room_type_id, property_id')
    .eq('asset_id', asset_id)
    .maybeSingle();
  if (aErr || !asset) return new Response(JSON.stringify({ error: 'asset_not_found', detail: aErr?.message }), { status: 404, headers: corsHeaders() });

  const propertyId: number | null = asset.property_id ?? null;
  if (!propertyId) return new Response(JSON.stringify({ error: 'property_scope_missing', detail: 'asset has no property_id; refusing to default (L22)' }), { status: 400, headers: corsHeaders() });

  if (asset.asset_type !== 'photo') {
    return new Response(JSON.stringify({ error: 'not_a_photo', asset_type: asset.asset_type }), { status: 400, headers: corsHeaders() });
  }

  const identity = await loadIdentity(admin, propertyId);
  if (!identity) return new Response(JSON.stringify({ error: 'property_identity_missing', property_id: propertyId, detail: 'no row in v_media_property_identity' }), { status: 500, headers: corsHeaders() });
  if (!identity.categories?.length) {
    return new Response(JSON.stringify({ error: 'no_categories_configured', property_id: propertyId, detail: 'seed media.media_categories in Property Settings before scoring' }), { status: 400, headers: corsHeaders() });
  }

  const role = propertyId === 1000001 ? 'mkt_qa_photo_donna' : 'mkt_qa_photo';
  const persona = await loadActivePersona(admin, role);

  const guardrails = await loadGuardrails(admin, propertyId);
  const guardrailsBlock = buildGuardrailsBlock(guardrails, identity, 'photo');
  const namingForPhoto = (guardrails.naming ?? []).filter((n: any) => n.scope === 'photo' || n.scope == null)
    .sort((a: any, b: any) => (b.property_id ? 1 : 0) - (a.property_id ? 1 : 0))[0] ?? null;

  const { data: reality } = await admin
    .from('v_reality_profile')
    .select('palette, materials, forbidden, landscape, architecture, region, location')
    .eq('property_id', propertyId)
    .maybeSingle();
  const palette = Array.isArray(reality?.palette) ? reality!.palette.join(', ') : '';
  const forbidden = Array.isArray(reality?.forbidden) ? reality!.forbidden.join(', ') : '';
  const materials = Array.isArray(reality?.materials) ? reality!.materials.join(', ') : '';
  const landscape = Array.isArray(reality?.landscape) ? reality!.landscape.join(', ') : '';
  const architecture = Array.isArray(reality?.architecture) ? reality!.architecture.join(', ') : '';

  let roomCtx = '';
  if (asset.room_type_id) {
    const { data: rt } = await admin.from('v_room_grounding')
      .select('room_type_name, description_clean').eq('property_id', propertyId).eq('room_type_id', asset.room_type_id).maybeSingle();
    if (rt) roomCtx = `Room: ${rt.room_type_name}. ${rt.description_clean ?? ''}`.slice(0, 400);
  }
  const propertyArea = asset.property_area ?? '(no property area assigned)';

  let imageBase64 = '';
  let mediaType = 'image/jpeg';
  let dims = '';
  {
    const candidates: Array<[string, string]> = asset.master_path
      ? [['media-renders', asset.master_path], ['media-master', asset.master_path], ['media-ai', asset.master_path]]
      : (asset.raw_path ?? '').startsWith('branding/')
        ? [['branding', (asset.raw_path ?? '').replace(/^branding\//, '')]]
        : [['media-raw', asset.raw_path ?? '']];
    let lastErr = 'no_candidate';
    let got = false;
    for (const [bucket, path] of candidates) {
      if (!path) continue;
      for (const useTransform of [true, false]) {
        try {
          const opts: any = useTransform ? { transform: { width: LONG_EDGE_TARGET, height: LONG_EDGE_TARGET, resize: 'contain', quality: 82 } } : undefined;
          const { data: signed, error: sErr } = await admin.storage.from(bucket).createSignedUrl(path, 900, opts);
          if (sErr || !signed?.signedUrl) { lastErr = sErr?.message ?? 'sign_failed'; continue; }
          const img = await fetch(signed.signedUrl);
          if (!img.ok) { lastErr = `image fetch ${img.status} (${bucket}${useTransform ? '/transform' : '/raw'})`; continue; }
          const buf = new Uint8Array(await img.arrayBuffer());
          const b64 = uint8ToBase64(buf);
          if (b64.length > 4500000) { lastErr = `too_large ${b64.length} (${bucket}${useTransform ? '/transform' : '/raw'})`; continue; }
          let ct = 'image/jpeg';
          const hct = img.headers.get('content-type');
          if (hct && /^image\//.test(hct)) ct = hct.split(';')[0].trim();
          if (!/^image\/(jpeg|png|webp|gif)$/.test(ct)) { lastErr = `unsupported_media_type ${ct} (${bucket})`; continue; }
          imageBase64 = b64; mediaType = ct;
          dims = `bytes=${buf.length} src=${bucket}${useTransform ? '' : '/raw'}`;
          got = true; break;
        } catch (e: any) { lastErr = e?.message ?? 'fetch_error'; }
      }
      if (got) break;
    }
    if (!got) return new Response(JSON.stringify({ error: 'image_prep_failed', detail: lastErr }), { status: 500, headers: corsHeaders() });
  }

  const apiKey = await getAnthropicKey(admin);
  if (!apiKey) return new Response(JSON.stringify({ error: 'anthropic_key_missing' }), { status: 500, headers: corsHeaders() });

  const systemPrompt = (persona || 'You are a hotel photo QA scorer. Return ONLY valid JSON, no prose, no markdown fences.') + '\n\n' + guardrailsBlock;

  const technicalPrompt = `Score this hotel photograph for TECHNICAL quality on a 0-100 scale.\nCheck against the <current_guardrails> block in the system prompt.\nReturn JSON exactly:\n{\n  "score": <int 0-100>,\n  "sharpness": { "value": <int 0-100>, "detail": "<one sentence>" },\n  "exposure":  { "value": <int 0-100>, "detail": "<one sentence>" },\n  "noise":     { "value": <int 0-100>, "detail": "<one sentence>" },\n  "failures": [ { "rule_type": "<aspect_ratio|text_policy|palette>", "rule_detail": "<what was violated>", "severity": "<minor|major|blocker>" } ]\n}`;

  const aestheticPrompt = `Score this hotel photograph for AESTHETIC composition on a 0-100 scale.\nProperty: ${identity.trading_name}, ${[identity.city, identity.region, identity.country].filter(Boolean).join(', ')}.\nPalette: ${palette || '(unset)'} · Materials: ${materials || '(unset)'} · Architecture: ${architecture || '(unset)'} · Landscape: ${landscape || '(unset)'}\nForbidden subjects for this property: ${forbidden || '(none)'}\nArea: ${propertyArea}\n${roomCtx ? roomCtx + '\n' : ''}Check against the <current_guardrails> block in the system prompt.\nReturn JSON exactly:\n{\n  "score": <int 0-100>,\n  "horizon":  { "value": <int 0-100>, "detail": "<one sentence>" },\n  "clutter":  { "value": <int 0-100>, "detail": "<one sentence>" },\n  "lighting": { "value": <int 0-100>, "detail": "<one sentence>" },\n  "failures": [ { "rule_type": "<palette|tone|composition>", "rule_detail": "<what was violated>", "severity": "<minor|major|blocker>" } ]\n}`;

  const marketingPrompt = `Score this hotel photograph for MARKETING suitability on a 0-100 GRADIENT.\nProperty: ${identity.trading_name}. Context: ${propertyArea}. ${roomCtx}\nThis is a general marketing-suitability score, NOT a "does it show a bookable room" flag. ANY subject can score high if it is compelling marketing content — rooms, pool, beach, spa, F&B / food plating, exterior, grounds, lifestyle, staff, art, or local surroundings. Judge desirability, storytelling and channel usefulness.\nAnchors: 85-100 = campaign / hero-worthy; 70-84 = strong social or OTA gallery image; 55-69 = usable supporting image; 40-54 = weak, filler only; 20-39 = poor marketing value; 0-19 = unusable (corrupt, accidental, pure documentation/screenshot).\nDo NOT give 0 merely because the subject is not a guest room. Reserve scores under 20 for genuinely unusable frames.\nCheck against the <current_guardrails> block in the system prompt.\nReturn JSON exactly:\n{\n  "score": <int 0-100>,\n  "subject_appeal":    { "value": <int 0-100>, "detail": "<one sentence>" },\n  "commercial_polish": { "value": <int 0-100>, "detail": "<one sentence>" },\n  "channel_fit":       { "value": <int 0-100>, "detail": "<one sentence>" },\n  "failures": [ { "rule_type": "<tier_threshold|marketing_polish>", "rule_detail": "<what was violated>", "severity": "<minor|major|blocker>" } ]\n}`;

  const detectedTextPrompt = `Extract visible text (signage, menus, prices, watermarks, logos).\nCross-check against the <current_guardrails> Text on image + Blocked words rules.\nReturn JSON exactly:\n{ "detected_text": "<text joined with | separators, empty if none>", "has_prices": <bool>, "has_pii": <bool>, "has_logos": <bool>, "violates_blocklist": <bool>, "exceeds_text_area": <bool> }`;

  const catList = identity.categories.map((slug, i) => `${slug}${identity.category_labels?.[i] ? ` (${identity.category_labels[i]})` : ''}`).join(' | ');
  const classifyPrompt = `Classify this image for the ${identity.trading_name} media library and produce SEO metadata.\nHotel: "${identity.brand_name_required}". Location: ${[identity.city, identity.region, identity.country].filter(Boolean).join(', ')}.\nWrite every SEO field in ${identity.seo_language === 'en' ? 'ENGLISH' : identity.seo_language.toUpperCase()}.\ncategory MUST be exactly one of these slugs configured for this property — never invent one:\n${catList}\n${identity.legacy_brand_tokens?.length ? `Never emit these legacy brand tokens in any field: ${identity.legacy_brand_tokens.join(', ')}.\n` : ''}Return JSON exactly:\n{\n  "is_hotel_property": <bool>,\n  "category": "<one slug from the list above>",\n  "sub_category": "<free text refining category>",\n  "seo_target_filename": "<kebab-case lowercase .webp, MUST include '${identity.brand_slug}'>",\n  "seo_title_text": "<4-8 word CTA phrase, MUST include '${identity.brand_name_required}'>",\n  "seo_alt_text": "<125-160 chars, descriptive not decorative, MUST include BOTH '${identity.brand_name_required}' AND '${identity.city ?? identity.region ?? ''}'>"\n}`;

  let technical: any = { score: 0 }, aesthetic: any = { score: 0 }, marketing: any = { score: 0 };
  let detected: any = { detected_text: '' }, classify: any = {};
  const errors: string[] = [];

  // v11 — every call's usage is banked, including on failures (the tokens were
  // still spent). tally is what gets metered.
  const tally = { input: 0, cached: 0, output: 0, calls: 0 };
  const bank = (u?: { input: number; cached: number; output: number }) => {
    if (!u) return;
    tally.input += u.input; tally.cached += u.cached; tally.output += u.output; tally.calls += 1;
  };

  await Promise.all([
    callAnthropicVisionB64(apiKey, systemPrompt, technicalPrompt, imageBase64, mediaType)
      .then(r => { technical = r.parsed; bank(r.usage); })
      .catch(e => { errors.push('tech: ' + e.message); bank(e?.usage); }),
    callAnthropicVisionB64(apiKey, systemPrompt, aestheticPrompt, imageBase64, mediaType)
      .then(r => { aesthetic = r.parsed; bank(r.usage); })
      .catch(e => { errors.push('aes: ' + e.message); bank(e?.usage); }),
    callAnthropicVisionB64(apiKey, systemPrompt, marketingPrompt, imageBase64, mediaType)
      .then(r => { marketing = r.parsed; bank(r.usage); })
      .catch(e => { errors.push('mkt: ' + e.message); bank(e?.usage); }),
    callAnthropicVisionB64(apiKey, systemPrompt, detectedTextPrompt, imageBase64, mediaType)
      .then(r => { detected = r.parsed; bank(r.usage); })
      .catch(e => { errors.push('txt: ' + e.message); bank(e?.usage); }),
    callAnthropicVisionB64(apiKey, systemPrompt, classifyPrompt, imageBase64, mediaType)
      .then(r => { classify = r.parsed; bank(r.usage); })
      .catch(e => { errors.push('cls: ' + e.message); bank(e?.usage); }),
  ]);

  const scoredAt = new Date().toISOString();

  // Meter BEFORE the early return on total failure — the tokens were spent
  // either way, and unmetered spend is the defect this version exists to fix.
  let metering: any = null;
  if (tally.input > 0 || tally.output > 0) {
    try {
      const { data: mres, error: mErr } = await admin.rpc('fn_meter_ai_call', {
        p_property_id:   propertyId,
        p_agent_handle:  role,
        p_model:         ANTHROPIC_MODEL,
        p_tokens_in:     tally.input,
        p_tokens_cached: tally.cached,
        p_tokens_out:    tally.output,
        p_source:        'media-qa-score',
        p_run_ref:       `mediaqa:${asset_id}:${scoredAt}`,
      });
      metering = mErr ? { ok: false, error: mErr.message } : mres;
    } catch (e: any) {
      metering = { ok: false, error: e?.message ?? 'meter_failed' };
    }
  }

  if (errors.length === 5) {
    return new Response(JSON.stringify({ error: 'all_scoring_failed', detail: errors, dims, tokens: tally, metering }), { status: 502, headers: corsHeaders() });
  }

  const naming = checkNaming(asset.original_filename ?? null, namingForPhoto?.pattern ?? null, namingForPhoto?.regex ?? null);

  const tScore = Math.max(0, Math.min(100, Math.round(Number(technical?.score ?? 0))));
  const aScore = Math.max(0, Math.min(100, Math.round(Number(aesthetic?.score ?? 0))));
  const mScore = Math.max(0, Math.min(100, Math.round(Number(marketing?.score ?? 0))));

  const isHotel: boolean | null = typeof classify?.is_hotel_property === 'boolean' ? classify.is_hotel_property : null;
  let category: string | null = typeof classify?.category === 'string' ? classify.category : null;
  const categoryValid = category ? identity.categories.includes(category) : null;
  if (category && !categoryValid) {
    const byLabel = identity.category_labels?.findIndex((l) => l?.toLowerCase() === category!.toLowerCase()) ?? -1;
    category = byLabel >= 0 ? identity.categories[byLabel] : null;
  }
  const subCategory: string | null = typeof classify?.sub_category === 'string' ? classify.sub_category : null;
  const rawSeoFilename: string | null = typeof classify?.seo_target_filename === 'string' ? classify.seo_target_filename : null;
  const rawSeoTitle: string | null = typeof classify?.seo_title_text === 'string' ? classify.seo_title_text : null;
  const rawSeoAlt: string | null = typeof classify?.seo_alt_text === 'string' ? classify.seo_alt_text : null;
  const enforcedSeo = enforceLocalSeo({ filename: rawSeoFilename, title: rawSeoTitle, alt: rawSeoAlt }, identity);

  const failures: any[] = [];
  for (const src of [technical, aesthetic, marketing]) {
    if (Array.isArray(src?.failures)) {
      for (const f of src.failures) if (f && typeof f === 'object') {
        if (typeof f.rule_type === 'string' && f.rule_type.toLowerCase().startsWith('naming')) continue;
        failures.push(f);
      }
    }
  }
  if (detected?.violates_blocklist) failures.push({ rule_type: 'text_policy', rule_detail: 'detected_text contains blocklist term', severity: 'major' });
  if (detected?.exceeds_text_area) failures.push({ rule_type: 'text_policy', rule_detail: 'text covers more than max_text_area_pct of frame', severity: 'major' });
  if (categoryValid === false) failures.push({ rule_type: 'category', rule_detail: `model returned a category not configured for property ${propertyId}`, severity: 'major' });
  for (const t of identity.legacy_brand_tokens ?? []) {
    const blob = [enforcedSeo.filename, enforcedSeo.title, enforcedSeo.alt, subCategory].filter(Boolean).join(' ');
    if (t && new RegExp(t, 'i').test(blob)) failures.push({ rule_type: 'legacy_brand', rule_detail: `legacy brand token "${t}" survived into a generated field`, severity: 'blocker' });
  }

  const notes = {
    technical, aesthetic, marketing,
    naming_convention: naming,
    detected_flags: {
      has_prices: Boolean(detected?.has_prices),
      has_pii: Boolean(detected?.has_pii),
      has_logos: Boolean(detected?.has_logos),
      violates_blocklist: Boolean(detected?.violates_blocklist),
      exceeds_text_area: Boolean(detected?.exceeds_text_area),
    },
    classification: { is_hotel_property: isHotel, category, sub_category: subCategory, category_valid: categoryValid },
    seo: { target_filename: enforcedSeo.filename, title_text: enforcedSeo.title, alt_text: enforcedSeo.alt, raw_filename: rawSeoFilename, raw_title: rawSeoTitle, raw_alt: rawSeoAlt, language: identity.seo_language },
    property: { property_id: propertyId, trading_name: identity.trading_name, brand_slug: identity.brand_slug },
    failures,
    auto_tier: isHotel === false ? null : tierFromScores(tScore, aScore, mScore),
    scored_at: scoredAt,
    payload_bytes: imageBase64.length,
    persona_len: persona.length,
    persona_role: role,
    guardrails_len: guardrailsBlock.length,
    engine_version: 'v11',
    tokens: tally,
    metering,
    errors: errors.length ? errors : undefined,
  };

  const { data: rpcRes, error: rpcErr } = await admin.rpc('fn_media_asset_qa_score_v2', {
    p_asset_id: asset_id,
    p_technical: tScore,
    p_aesthetic: aScore,
    p_marketing: mScore,
    p_notes: notes,
    p_model: ANTHROPIC_MODEL,
    p_detected_text: typeof detected?.detected_text === 'string' ? detected.detected_text.slice(0, 4000) : null,
    p_is_hotel_property: isHotel,
    p_category: category,
    p_sub_category: subCategory,
    p_seo_target_filename: enforcedSeo.filename,
    p_seo_title_text: enforcedSeo.title,
    p_seo_alt_text: enforcedSeo.alt,
  });
  if (rpcErr) return new Response(JSON.stringify({ error: 'db_persist_failed', detail: rpcErr.message, notes }), { status: 500, headers: corsHeaders() });

  return new Response(JSON.stringify({
    ok: true,
    engine_version: 'v11',
    asset_id,
    property_id: propertyId,
    property: identity.trading_name,
    persona_role: role,
    persona_loaded: persona.length > 0,
    technical_score: tScore,
    aesthetic_score: aScore,
    marketing_score: mScore,
    quality_index: Math.round((tScore * 0.5 + aScore * 0.5)),
    auto_tier: notes.auto_tier,
    naming_convention: naming,
    failures,
    is_hotel_property: isHotel,
    category,
    category_valid: categoryValid,
    sub_category: subCategory,
    seo_target_filename: enforcedSeo.filename,
    seo_title_text: enforcedSeo.title,
    seo_alt_text: enforcedSeo.alt,
    dims,
    guardrails_len: guardrailsBlock.length,
    tokens: tally,
    cost_usd: metering?.cost_usd ?? null,
    metering,
    rpc: rpcRes,
    errors: errors.length ? errors : undefined,
  }), { status: 200, headers: corsHeaders() });
});
