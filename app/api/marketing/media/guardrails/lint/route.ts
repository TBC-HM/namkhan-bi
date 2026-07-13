// app/api/marketing/media/guardrails/lint/route.ts
// Iris skill handler: enforce_guardrails.
// POST { asset_id } — deterministic lint against all 7 guardrail tables.
// Read-only. No Anthropic. No writes.
// PBS 2026-07-14 — Media QA v2.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Check = { pass: boolean | null; detail?: string; violations?: string[] };

function deriveRegex(pattern: string): RegExp {
  let src = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  src = src.replace(/YYYYMMDD/g, '\\d{8}')
           .replace(/YYYY/g, '\\d{4}')
           .replace(/MM/g, '\\d{2}')
           .replace(/DD/g, '\\d{2}')
           .replace(/XX/g, '[A-Za-z]{2}')
           .replace(/[A-Z][a-zA-Z]+/g, '[A-Za-z][A-Za-z0-9]+');
  return new RegExp('^' + src + '(\\.[A-Za-z0-9]+)?$');
}

function checkNaming(filename: string | null, rule: any): Check {
  if (!rule || !filename) return { pass: null, detail: rule ? 'no filename' : 'no rule' };
  const stem = filename.replace(/\.[A-Za-z0-9]+$/, '');
  let re: RegExp;
  try { re = rule.regex ? new RegExp(rule.regex) : deriveRegex(rule.pattern); }
  catch { re = deriveRegex(rule.pattern); }
  const matched = re.test(stem) || re.test(filename);
  return matched
    ? { pass: true, detail: 'matches ' + rule.pattern }
    : { pass: false, detail: 'expected ' + rule.pattern, violations: ['pattern_mismatch'] };
}

function checkCaption(caption: string | null, rule: any): Check {
  if (!rule) return { pass: null, detail: 'no rule' };
  if (!caption) return { pass: false, detail: 'caption missing', violations: ['missing'] };
  const words = caption.trim().split(/\s+/).length;
  const violations: string[] = [];
  if (rule.min_words && words < rule.min_words) violations.push(`too_short(${words}<${rule.min_words})`);
  if (rule.max_words && words > rule.max_words) violations.push(`too_long(${words}>${rule.max_words})`);
  const lc = caption.toLowerCase();
  for (const banned of rule.banned_phrases ?? []) {
    if (lc.includes(String(banned).toLowerCase())) violations.push(`banned:${banned}`);
  }
  for (const kw of rule.must_include_keywords ?? []) {
    if (!lc.includes(String(kw).toLowerCase())) violations.push(`missing_keyword:${kw}`);
  }
  return violations.length
    ? { pass: false, detail: `${words} words`, violations }
    : { pass: true, detail: `${words} words · in range` };
}

function checkAltText(alt: string | null, subjectHints: string[], rule: any): Check {
  if (!rule) return { pass: null, detail: 'no rule' };
  if (!alt) return { pass: false, detail: 'alt_text missing', violations: ['missing'] };
  const violations: string[] = [];
  const chars = alt.length;
  if (rule.min_chars && chars < rule.min_chars) violations.push(`too_short(${chars}<${rule.min_chars})`);
  if (rule.max_chars && chars > rule.max_chars) violations.push(`too_long(${chars}>${rule.max_chars})`);
  const lc = alt.toLowerCase();
  for (const banned of rule.banned_words ?? []) {
    if (lc.includes(String(banned).toLowerCase())) violations.push(`banned:${banned}`);
  }
  if (rule.must_include_subject) {
    const hasSubject = subjectHints.some(h => h && lc.includes(String(h).toLowerCase()));
    if (!hasSubject) violations.push('no_subject_word');
  }
  return violations.length
    ? { pass: false, detail: `${chars} chars`, violations }
    : { pass: true, detail: `${chars} chars` };
}

function checkAspect(width: number | null, height: number | null, tierChannel: string | null, aspectRules: any[]): Check {
  if (!width || !height) return { pass: null, detail: 'no dimensions' };
  if (!tierChannel) return { pass: null, detail: 'no channel to check against' };
  const rule = aspectRules.find(r => r.channel === tierChannel);
  if (!rule) return { pass: null, detail: `no rule for channel ${tierChannel}` };
  const actual = width / height;
  const [rn, rd] = String(rule.ratio ?? '16:9').split(':').map(Number);
  const expected = rd ? rn / rd : rn;
  const off = Math.abs(actual - expected) / expected;
  const violations: string[] = [];
  if (off > 0.02) violations.push(`ratio_off(${actual.toFixed(3)} vs ${expected.toFixed(3)})`);
  if (rule.min_width_px && width < rule.min_width_px) violations.push(`min_width(${width}<${rule.min_width_px})`);
  if (rule.min_height_px && height < rule.min_height_px) violations.push(`min_height(${height}<${rule.min_height_px})`);
  return violations.length
    ? { pass: false, detail: `${width}x${height} · ${rule.ratio}`, violations }
    : { pass: true, detail: `${width}x${height} · ${rule.ratio}` };
}

function checkTextPolicy(detected: string | null, tier: string | null, policy: any): Check {
  if (!policy) return { pass: null, detail: 'no policy' };
  if (!detected) return { pass: true, detail: 'no text detected' };
  const isHero = tier === 'tier_website_hero';
  if (isHero && policy.allow_on_hero === false) {
    return { pass: false, detail: 'text on hero not allowed', violations: ['text_on_hero'] };
  }
  return { pass: true, detail: 'text policy ok' };
}

function checkTier(quality: number | null, tier: string | null, thresholds: any[]): Check {
  if (quality == null) return { pass: null, detail: 'not scored' };
  if (!tier) return { pass: null, detail: 'no tier' };
  const rule = thresholds.find(t => t.tier === tier);
  if (!rule) return { pass: null, detail: `no threshold for ${tier}` };
  return quality >= rule.min_quality_index
    ? { pass: true, detail: `${quality} ≥ ${rule.min_quality_index}` }
    : { pass: false, detail: `${quality} < ${rule.min_quality_index}`, violations: ['below_threshold'] };
}

function tierToChannel(tier: string | null): string | null {
  if (!tier) return null;
  if (tier === 'tier_website_hero') return 'web_hero';
  if (tier === 'tier_ota_profile')  return 'ota_gallery';
  if (tier === 'tier_social_pool')  return 'social_square';
  return null;
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }

  const asset_id: string = body?.asset_id;
  if (!asset_id || !UUID_RE.test(asset_id)) {
    return NextResponse.json({ ok: false, error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const { data: asset, error: aErr } = await sb.from('v_marketing_media_page')
    .select('asset_id, property_id, original_filename, caption, alt_text, primary_tier, property_area, width_px, height_px, detected_text, quality_index, room_type_id')
    .eq('asset_id', asset_id)
    .maybeSingle();
  if (aErr || !asset) return NextResponse.json({ ok: false, error: 'asset_not_found' }, { status: 404 });

  const pid = asset.property_id;
  const [naming, caption, alt, tier, aspect, text_policy] = await Promise.all([
    sb.from('v_media_naming_conventions').select('pattern, regex, active, property_id, scope').or(`property_id.eq.${pid},property_id.is.null`).eq('active', true).eq('scope','photo').maybeSingle(),
    sb.from('v_media_caption_rules').select('min_words, max_words, banned_phrases, must_include_keywords, tone, active, property_id').or(`property_id.eq.${pid},property_id.is.null`).eq('active', true).maybeSingle(),
    sb.from('v_media_alt_text_rules').select('min_chars, max_chars, must_be_descriptive, must_include_subject, banned_words, active, property_id').or(`property_id.eq.${pid},property_id.is.null`).eq('active', true).maybeSingle(),
    sb.from('v_media_tier_thresholds').select('tier, min_quality_index, requires_model_release, active').eq('active', true),
    sb.from('v_media_aspect_ratio_rules').select('channel, ratio, min_width_px, min_height_px, active').eq('active', true),
    sb.from('v_media_text_policy').select('allow_on_hero, allow_on_ota, allow_on_social, max_text_area_pct, blocklist_words, active').eq('active', true).maybeSingle(),
  ]);

  const subjectHints = [asset.property_area ?? '', 'room', 'pool', 'lobby', 'restaurant', 'terrace', 'garden', 'river'];
  const channel = tierToChannel(asset.primary_tier);

  const checks = {
    naming: checkNaming(asset.original_filename, naming.data),
    caption: checkCaption(asset.caption, caption.data),
    alt: checkAltText(asset.alt_text, subjectHints, alt.data),
    aspect: checkAspect(asset.width_px, asset.height_px, channel, aspect.data ?? []),
    text_policy: checkTextPolicy(asset.detected_text, asset.primary_tier, text_policy.data),
    brand_palette: { pass: null, detail: 'skipped (v1 — needs colour analysis)' } as Check,
    tier: checkTier(asset.quality_index, asset.primary_tier, tier.data ?? []),
  };

  const failed = Object.entries(checks).filter(([, c]) => c.pass === false).map(([k]) => k);
  const output = { asset_id, primary_tier: asset.primary_tier, checks, failed };

  try {
    await sb.rpc('fn_log_skill_call', {
      p_role: pid === 1000001 ? 'mkt_qa_photo_donna' : 'mkt_qa_photo',
      p_skill: 'enforce_guardrails',
      p_status: 'ok',
      p_duration_ms: Date.now() - t0,
      p_cost_milli: 0,
      p_input: { asset_id },
      p_output: { failed },
    });
  } catch {}

  return NextResponse.json({ ok: true, data: output });
}
