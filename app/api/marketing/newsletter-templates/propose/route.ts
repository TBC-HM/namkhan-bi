// app/api/marketing/newsletter-templates/propose/route.ts
// PBS 2026-07-21 pm (Add 3): AI-first template proposer + save.
//
// POST → propose: { property_id, seed_text, scope, category? }
//                 → { ok, proposal: {template_key, label, subject, body_md,
//                                    hero_asset_id, category, description} }
// PUT  → save:    { property_id, proposal, scope }
//                 → { ok, template_key }
//
// The propose step reads the property_profile row, active email_general_rules
// (guardrails), the hero image library (best-effort) and any registered link
// catalog (best-effort), then asks Claude sonnet-4-6 to return a structured
// template proposal in strict JSON. The save step upserts it via the existing
// public.fn_upsert_newsletter_template RPC as an inactive draft so it appears
// in /guest/newsletters/templates but doesn't fire automatically until the
// operator toggles is_active.

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM = [
  'You are the marketing writer for The Namkhan, a 30-key riverside boutique retreat',
  'outside Luang Prabang, Laos. Your voice is calm, understated, warm, never salesy.',
  'You are drafting a REUSABLE email template — not a one-off campaign. The template',
  'body should read as an editable draft that any marketer can adapt each time it is',
  'used. Prefer merge tokens like {{first_name}} and {{property_name}} over hard-coded',
  'names, and keep specifics (dates, prices) generic.',
  'Return STRICT JSON with keys:',
  '  template_key   (short slug, lowercase, underscores/hyphens only, <= 40 chars)',
  '  label          (human title, <= 60 chars)',
  '  subject        (email subject, <= 65 chars, no exclamation marks)',
  '  body_md        (plain Markdown, 4-8 short paragraphs, greet with "Dear {{first_name}},")',
  '  hero_asset_id  (string uuid from the provided hero library, or null)',
  '  category       (short slug — usually the scope or a topical bucket like "winback")',
  '  description    (one-sentence description for the templates gallery)',
  'Do not use emojis. Do not fabricate offers. Do not invent prices.',
].join(' ');

type ProposeBody = {
  property_id?: number;
  seed_text?: string;
  scope?: 'newsletter' | 'sequence' | 'both';
  category?: string;
};

type SaveBody = {
  property_id?: number;
  scope?: 'newsletter' | 'sequence' | 'both';
  proposal?: {
    template_key?: string;
    label?: string;
    subject?: string;
    body_md?: string;
    hero_asset_id?: string | null;
    category?: string;
    description?: string;
  };
};

type Proposal = {
  template_key: string;
  label: string;
  subject: string;
  body_md: string;
  hero_asset_id: string | null;
  category: string;
  description: string;
};

function slugify(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
    || 'template';
}

async function callAnthropic(userPrompt: string): Promise<Proposal> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('anthropic_api_key_missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      system: SYSTEM,
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
    template_key: slugify(String(parsed.template_key || parsed.label || 'ai_template')),
    label:        String(parsed.label || '').slice(0, 120) || 'AI template',
    subject:      String(parsed.subject || '').slice(0, 120),
    body_md:      String(parsed.body_md || ''),
    hero_asset_id: parsed.hero_asset_id ? String(parsed.hero_asset_id) : null,
    category:     String(parsed.category || '').slice(0, 40) || 'marketing',
    description:  String(parsed.description || '').slice(0, 400),
  };
}

// Small helpers to fetch context best-effort (never fail the whole request).
async function safeSelect(sb: ReturnType<typeof getSupabaseAdmin>, table: string, cols: string, pid: number, limit = 20): Promise<Array<Record<string, unknown>>> {
  try {
    const { data } = await sb.from(table).select(cols).eq('property_id', pid).limit(limit);
    return ((data as unknown) as Array<Record<string, unknown>>) ?? [];
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const property_id = Number(body.property_id);
  const seed = String(body.seed_text ?? '').trim();
  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  if (!seed) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const scope    = (body.scope === 'sequence' || body.scope === 'both') ? body.scope : 'newsletter';
  const category = String(body.category || scope).slice(0, 40);

  const sb = getSupabaseAdmin();
  // Best-effort context — never throw on missing bridge views.
  const [profile, guardrails, heroes, links] = await Promise.all([
    safeSelect(sb, 'v_property_profile', 'property_name, city, country, tagline, key_facts', property_id, 1),
    safeSelect(sb, 'v_email_general_rules', 'rule_key, rule_text', property_id, 40),
    safeSelect(sb, 'v_marketing_hero_library', 'asset_id, label, description, tags', property_id, 30),
    safeSelect(sb, 'v_marketing_link_catalog', 'label, url, category', property_id, 30),
  ]);

  const parts: string[] = [];
  parts.push('Scope: ' + scope + ' · Category hint: ' + category);
  parts.push('Seed brief: ' + seed);
  parts.push('');
  if (profile.length) {
    parts.push('Property profile:');
    parts.push(JSON.stringify(profile[0]).slice(0, 2000));
  }
  if (guardrails.length) {
    parts.push('');
    parts.push('Active email guardrails (must respect):');
    for (const g of guardrails) parts.push('- ' + String((g as { rule_text?: string }).rule_text ?? '').slice(0, 300));
  }
  if (heroes.length) {
    parts.push('');
    parts.push('Hero image library (pick ONE asset_id if a hero fits, else null):');
    for (const h of heroes) parts.push('- ' + JSON.stringify(h).slice(0, 200));
  }
  if (links.length) {
    parts.push('');
    parts.push('Link catalog (reference these URLs where relevant, do not invent new URLs):');
    for (const l of links) parts.push('- ' + JSON.stringify(l).slice(0, 200));
  }
  const userPrompt = parts.join('\n');

  try {
    const proposal = await callAnthropic(userPrompt);
    return NextResponse.json({ ok: true, proposal });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  let body: SaveBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const property_id = Number(body.property_id);
  const p = body.proposal || {};
  if (!Number.isFinite(property_id) || property_id <= 0) {
    return NextResponse.json({ ok: false, error: 'property_id_required' }, { status: 400 });
  }
  const template_key = slugify(String(p.template_key || p.label || ''));
  const label   = String(p.label   || '').slice(0, 120) || template_key;
  const subject = String(p.subject || '').slice(0, 200);
  const body_md = String(p.body_md || '');
  if (!body_md || !subject) {
    return NextResponse.json({ ok: false, error: 'subject_and_body_required' }, { status: 400 });
  }
  const category = String(p.category || 'marketing').slice(0, 40);
  const description = String(p.description || '').slice(0, 400);
  const hero_asset_id = p.hero_asset_id ? String(p.hero_asset_id) : null;

  const sb = getSupabaseAdmin();

  // Resolve hero_asset_id -> public URL when possible via fn_asset_public_url
  // (introduced in the earlier newsletters cockpit). If the RPC is missing, we
  // just leave hero_image_url NULL — the template editor still opens fine.
  let hero_image_url: string | null = null;
  if (hero_asset_id) {
    try {
      const r = await sb.rpc('fn_asset_public_url', { p_asset_id: hero_asset_id });
      if (r.data && typeof r.data === 'string') hero_image_url = r.data;
    } catch { /* ignore — optional enrichment */ }
  }

  // Upsert the template. Kept inactive so the operator vets it in the editor
  // before turning it on. Uses the same RPC that /templates/[key] uses on save.
  const { error } = await sb.rpc('fn_upsert_newsletter_template', {
    p_template_key: template_key,
    p_property_id: property_id,
    p_label: label,
    p_description: description,
    p_subject: subject,
    p_category: category,
    p_hero_image_url: hero_image_url,
    p_blocks_json: [],
    p_body_md: body_md,
    p_variants_json: {},
    p_trigger_kind: 'manual',
    p_trigger_days: null,
    p_audience_hint: '',
    p_is_active: false,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message || 'upsert_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, template_key });
}
