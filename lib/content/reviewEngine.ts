// lib/content/reviewEngine.ts
// QUALITY GATE v1 — ADR-177 Phase 0 (PBS 2026-07-28: "finish building the
// loop, meaning adding the quality gate").
//
// Runs a validator registry over a campaign and persists the verdict to
// marketing.content_reviews (via public.fn_content_review_insert). The
// enqueue functions REFUSE recipients for any campaign whose latest verdict
// is 'fail' — this module is the only writer of those verdicts.
//
// Validators (PBS list → v1 mapping):
//   deterministic: links (dead + policy), images-vs-policy, hero-required,
//                  unresolved placeholders, subject/body formatting, dates,
//                  CTA presence
//   LLM (one call): spelling · grammar · brand tone vs group voice ·
//                   legal wording · factual red flags
// fail = would damage guests/brand/deliverability. warn = fix soon, send OK.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface ReviewIssue {
  validator: string;
  severity: 'fail' | 'warn';
  message: string;
}
export interface ReviewResult {
  verdict: 'pass' | 'warn' | 'fail';
  score: number;
  issues: ReviewIssue[];
}

const KNOWN_PLACEHOLDERS = new Set(['first_name', 'full_name', 'last_name', 'booking_code', 'booking_url']);

let __key: string | null = null;
async function anthropicKey(): Promise<string> {
  if (__key) return __key;
  let key = process.env.ANTHROPIC_API_KEY || '';
  try {
    const { data, error } = await getSupabaseAdmin().rpc('fn_get_secret', { p_name: 'ANTHROPIC_API_KEY' });
    if (!error && typeof data === 'string' && data.length > 20) key = data;
  } catch { /* env fallback */ }
  if (!key) throw new Error('anthropic_api_key_missing');
  __key = key;
  return key;
}

interface CampaignRow {
  campaign_id: string; property_id: number; name: string; subject: string | null;
  body_md: string | null; campaign_kind: string | null; group_slug: string | null;
  booking_url: string | null; booking_code: string | null; hero_asset_id: string | null;
  planned_date: string | null;
}
interface PolicyRow { force_plain_text: boolean | null; block_links: boolean | null; block_images: boolean | null }
interface VoiceRow { voice_type: string | null; voice_summary: string | null }

function extractUrls(md: string): string[] {
  const urls = new Set<string>();
  for (const m of md.matchAll(/https?:\/\/[^\s)\]>"']+/g)) urls.add(m[0].replace(/[.,;]+$/, ''));
  return Array.from(urls);
}

async function checkLink(url: string): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    return r.status;
  } catch { return null; } // network failure → unknown, not fail
}

export async function reviewCampaign(campaignId: string, triggeredBy: string): Promise<ReviewResult> {
  const sb = getSupabaseAdmin();
  const { data: campRaw, error } = await sb.schema('guest').from('campaigns')
    .select('campaign_id, property_id, name, subject, body_md, campaign_kind, group_slug, booking_url, booking_code, hero_asset_id, planned_date')
    .eq('campaign_id', campaignId).maybeSingle();
  if (error || !campRaw) throw new Error(`campaign_load_failed: ${error?.message ?? 'not found'}`);
  const camp = campRaw as CampaignRow;
  const body = camp.body_md ?? '';
  const issues: ReviewIssue[] = [];

  // Group policy + voice
  let policy: PolicyRow | null = null;
  let voice: VoiceRow | null = null;
  if (camp.group_slug) {
    const [{ data: p }, { data: g }] = await Promise.all([
      sb.schema('marketing').from('group_email_policy').select('force_plain_text, block_links, block_images').eq('group_slug', camp.group_slug).maybeSingle(),
      sb.schema('marketing').from('subscriber_groups').select('voice_type, voice_summary').eq('slug', camp.group_slug).maybeSingle(),
    ]);
    policy = (p ?? null) as PolicyRow | null;
    voice = (g ?? null) as VoiceRow | null;
  }

  // 1 · Unresolved placeholders
  for (const m of body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (!KNOWN_PLACEHOLDERS.has(m[1])) {
      issues.push({ validator: 'placeholders', severity: 'fail', message: `Unknown merge field {{${m[1]}}} — would render literally in the guest's inbox` });
    }
  }
  if (/TODO|TBD|\[insert|lorem ipsum/i.test(body)) {
    issues.push({ validator: 'placeholders', severity: 'fail', message: 'Draft marker (TODO/TBD/[insert/lorem) present in body' });
  }

  // 2 · Links vs policy + dead links
  const urls = extractUrls(body);
  if (policy?.block_links && urls.length > 0) {
    issues.push({ validator: 'links', severity: 'fail', message: `Group policy forbids links (deliverability) but body contains ${urls.length}: ${urls.slice(0, 3).join(' · ')}` });
  } else {
    for (const u of urls.slice(0, 10)) {
      const status = await checkLink(u);
      if (status != null && status >= 400) {
        const isBooking = camp.booking_url != null && u.includes(camp.booking_url);
        issues.push({ validator: 'links', severity: isBooking ? 'fail' : 'warn', message: `Link returns ${status}: ${u}` });
      }
    }
  }

  // 3 · Images vs policy · hero-required rule (the "no pics" class)
  const hasInlineImg = /!\[[^\]]*\]\(|<img\s/i.test(body);
  if ((policy?.force_plain_text || policy?.block_images) && hasInlineImg) {
    issues.push({ validator: 'images', severity: 'fail', message: 'Group policy is plain-text/no-images but body embeds an image' });
  }
  const plainGroup = Boolean(policy?.force_plain_text || policy?.block_images);
  if (!plainGroup && !camp.hero_asset_id && !hasInlineImg) {
    issues.push({ validator: 'images', severity: 'warn', message: 'No hero image attached and no inline image — brand rule expects visual content for this audience' });
  }

  // 4 · Subject / formatting
  const subject = (camp.subject ?? '').trim();
  if (!subject) issues.push({ validator: 'formatting', severity: 'fail', message: 'Empty subject line' });
  else if (subject.length > 90) issues.push({ validator: 'formatting', severity: 'warn', message: `Subject ${subject.length} chars — will truncate in most clients (keep ≤ 78)` });
  if (body.trim().length < 200) issues.push({ validator: 'formatting', severity: 'warn', message: 'Body under 200 characters — likely incomplete' });

  // 5 · Dates in the past
  for (const m of body.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) {
    if (new Date(m[0]) < new Date(new Date().toISOString().slice(0, 10))) {
      issues.push({ validator: 'dates', severity: 'warn', message: `Past date in body: ${m[0]}` });
    }
  }

  // 6 · CTA (broadcast only — lifecycle/OTA may deliberately have none)
  if (camp.campaign_kind === 'broadcast' && !camp.booking_url && !camp.booking_code && urls.length === 0) {
    issues.push({ validator: 'cta', severity: 'warn', message: 'Broadcast with no booking URL/code and no link — no measurable CTA' });
  }

  // 7 · LLM pass: spelling · grammar · tone vs voice · legal · factual red flags
  try {
    const key = await anthropicKey();
    const sys = [
      'You are the quality reviewer for guest-facing hotel emails (The Namkhan, Luang Prabang — SLH member).',
      'Return STRICT JSON only: {"spelling":[..],"grammar":[..],"tone_ok":bool,"tone_notes":"..","legal_flags":[..],"factual_flags":[..]}.',
      'legal_flags: guarantees/claims that create liability (e.g. "guaranteed refund", medical claims, superlatives stated as fact like "the best hotel in Laos").',
      'factual_flags: concrete claims a hotel email should not invent (prices, opening hours, distances) — flag them for verification, do not assume wrong.',
      voice?.voice_summary ? `Audience voice (${voice.voice_type ?? 'b2c'}): ${voice.voice_summary.slice(0, 1200)}` : '',
    ].filter(Boolean).join('\n');
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 800, system: sys,
        messages: [{ role: 'user', content: `SUBJECT: ${subject}\n\nBODY:\n${body.slice(0, 6000)}` }],
      }),
    });
    if (res.ok) {
      const j = await res.json() as { content?: Array<{ text?: string }> };
      const text = j.content?.[0]?.text ?? '{}';
      const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
        spelling?: string[]; grammar?: string[]; tone_ok?: boolean; tone_notes?: string;
        legal_flags?: string[]; factual_flags?: string[];
      };
      for (const s of (parsed.spelling ?? []).slice(0, 5)) issues.push({ validator: 'spelling', severity: 'warn', message: s });
      for (const g of (parsed.grammar ?? []).slice(0, 5)) issues.push({ validator: 'grammar', severity: 'warn', message: g });
      if (parsed.tone_ok === false) issues.push({ validator: 'brand-tone', severity: 'warn', message: parsed.tone_notes ?? 'Off brand voice' });
      for (const l of (parsed.legal_flags ?? []).slice(0, 5)) issues.push({ validator: 'legal', severity: 'fail', message: l });
      for (const f of (parsed.factual_flags ?? []).slice(0, 5)) issues.push({ validator: 'factual', severity: 'warn', message: `Verify: ${f}` });
    }
  } catch (e) {
    issues.push({ validator: 'llm', severity: 'warn', message: `LLM review unavailable: ${e instanceof Error ? e.message : String(e)} — deterministic checks only` });
  }

  const fails = issues.filter((i) => i.severity === 'fail').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const verdict: ReviewResult['verdict'] = fails > 0 ? 'fail' : warns > 0 ? 'warn' : 'pass';
  const score = Math.max(0, 100 - fails * 25 - warns * 5);

  await sb.rpc('fn_content_review_insert', {
    p_campaign_id: campaignId, p_verdict: verdict, p_score: score,
    p_issues: issues as unknown as Record<string, unknown>[], p_triggered_by: triggeredBy,
  });

  return { verdict, score, issues };
}
