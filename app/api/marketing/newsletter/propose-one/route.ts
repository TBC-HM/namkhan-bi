// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-22 · One-shot AI-drafted newsletter from a seed sentence.
//
// POST — dry-run propose (returns proposal, does NOT persist).
//   { property_id, seed_text, target_date, audience_type, instruction?, prior? }
//   → { ok, proposal: { subject, body_md, hero_asset_id, hero_public_url, goal_tag } }
//
// PUT  — persist a proposal as a draft campaign.
//   { property_id, target_date, audience_type, subject, body_md, hero_asset_id, goal_tag, name }
//   → { ok, campaign_id }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const MODEL = 'claude-sonnet-4-6';
const DEFAULT_PROPERTY_ID = 260955;

interface ProposeBody {
  property_id?: number;
  seed_text?: string;
  target_date?: string;         // YYYY-MM-DD
  audience_type?: 'b2c' | 'b2b';
  instruction?: string;
  prior?: { subject?: string; body_md?: string };
}

interface SaveBody {
  property_id?: number;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
  subject?: string;
  body_md?: string;
  hero_asset_id?: string | null;
  goal_tag?: string | null;
  name?: string;
}

async function loadGoals(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const r = await sb.from('v_director_goals').select('*').eq('property_id', pid).eq('active', true).order('weight', { ascending: false });
  return (r.data as Array<{ goal_key: string; goal_label: string; weight: number }> | null) ?? [];
}
async function loadRules(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const r = await sb.from('v_marketing_email_general_rules').select('rule_kind, rule_text').or(`property_id.eq.${pid},property_id.is.null`);
  return (r.data as Array<{ rule_kind: string; rule_text: string }> | null) ?? [];
}
async function loadPropertyBackground(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const [t, s, f, a] = await Promise.all([
    sb.from('v_transport_options').select('name, transport_type').eq('property_id', pid).eq('is_active', true).limit(10),
    sb.from('v_property_spa_treatments').select('name, is_signature').eq('property_id', pid).eq('is_active', true).limit(20),
    sb.from('v_property_fnb_menu_items').select('name, section, is_signature').eq('property_id', pid).eq('is_active', true).limit(30),
    sb.from('v_activities_catalog').select('name, category').eq('property_id', pid).eq('is_active', true).limit(20),
  ]);
  return {
    transport: (t.data as Array<{ name: string; transport_type: string | null }> | null) ?? [],
    spa: (s.data as Array<{ name: string; is_signature: boolean | null }> | null) ?? [],
    fnb: (f.data as Array<{ name: string; section: string | null; is_signature: boolean | null }> | null) ?? [],
    activities: (a.data as Array<{ name: string; category: string | null }> | null) ?? [],
  };
}
async function loadLinkCatalog(sb: ReturnType<typeof getSupabaseAdmin>) {
  const r = await sb.from('v_marketing_internal_link_catalog').select('url, title, section').limit(60);
  return (r.data as Array<{ url: string; title: string | null; section: string | null }> | null) ?? [];
}
async function loadDefaultHero(sb: ReturnType<typeof getSupabaseAdmin>, pid: number) {
  const r = await sb.from('v_marketing_property_email_settings')
    .select('default_hero_asset_id, default_hero_public_url')
    .eq('property_id', pid).maybeSingle();
  const d = (r.data as { default_hero_asset_id: string | null; default_hero_public_url: string | null } | null);
  return { asset_id: d?.default_hero_asset_id ?? null, public_url: d?.default_hero_public_url ?? null };
}

async function callClaude(prompt: string, maxTokens = 4000): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const text: string = j?.content?.[0]?.text ?? '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('no json in claude response');
  return JSON.parse(text.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ProposeBody;
    const pid  = body.property_id ?? DEFAULT_PROPERTY_ID;
    const seed = (body.seed_text ?? '').trim();
    const targetDate = body.target_date;
    const aud  = body.audience_type === 'b2b' ? 'b2b' : 'b2c';

    if (!seed && !body.instruction) return NextResponse.json({ ok: false, error: 'seed_text or instruction required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const [goals, rules, bg, links, hero] = await Promise.all([
      loadGoals(sb, pid),
      loadRules(sb, pid),
      loadPropertyBackground(sb, pid),
      loadLinkCatalog(sb),
      loadDefaultHero(sb, pid),
    ]);

    const goalKeys  = goals.map(g => g.goal_key);
    const rulesBlock = rules.length ? rules.map(r => `[${r.rule_kind}] ${r.rule_text}`).join('\n') : '(no explicit rules)';
    const bgBlock = [
      `Retreats/Wellness/Roots restaurant/Eco-farm are the highest-value stories.`,
      `Signature spa treatments: ${bg.spa.filter(x=>x.is_signature).map(x=>x.name).join(', ') || 'n/a'}`,
      `Signature F&B: ${bg.fnb.filter(x=>x.is_signature).map(x=>x.name).join(', ') || 'n/a'}`,
      `Activities: ${bg.activities.map(x=>x.name).slice(0,8).join(', ')}`,
      `Transport touchpoints: ${bg.transport.map(x=>x.name).slice(0,4).join(', ')}`,
    ].join('\n');
    const linksBlock = links.length ? links.slice(0, 30).map(l => `- ${l.url}  →  ${l.title ?? ''} (${l.section ?? '-'})`).join('\n') : '(no catalog)';

    const priorBlock = body.prior && (body.prior.subject || body.prior.body_md)
      ? `\nPRIOR DRAFT (refine this, don't start over):\nSUBJECT: ${body.prior.subject ?? ''}\nBODY:\n${body.prior.body_md ?? ''}\n\nOPERATOR INSTRUCTION: ${body.instruction ?? ''}\n`
      : '';

    const prompt = `You are the AI Editorial Director for The Namkhan, a boutique eco-retreat in Laos. Compose ONE broadcast newsletter based on the operator's seed. Audience: ${aud}. Target send date: ${targetDate ?? 'TBD'}.

SEED: ${seed || '(refining prior draft — see below)'}
${priorBlock}
EDITORIAL GOALS (pick the single best-fit goal_tag from these keys): ${goalKeys.join(', ')}

PROPERTY BACKGROUND:
${bgBlock}

INTERNAL LINK CATALOG (only use URLs from this list in body links):
${linksBlock}

GENERAL EMAIL RULES:
${rulesBlock}

Return ONLY valid JSON in this exact shape:
{
  "subject":  "50-70 char subject line, unhurried voice",
  "body_md":  "2-4 short paragraphs of markdown; weave in ≥1 real product name; ≥1 CTA link from the catalog; no fake discounts",
  "goal_tag": "one of the goal_keys above",
  "hero_hint": "one sentence describing the ideal hero photo (a spa deck at dusk, roots kitchen prep etc)"
}

Rules:
- No 'discount' language; use 'complimentary', 'included', 'thoughtful pricing'.
- Prefer signature items when they naturally fit the seed.
- Body ≤ 220 words. Serif tone. No shouting caps. No bullet hell.
- Do NOT invent URLs; use only ones from the catalog above.`;

    const raw = await callClaude(prompt);
    const j = raw as { subject?: string; body_md?: string; goal_tag?: string; hero_hint?: string };

    return NextResponse.json({
      ok: true,
      proposal: {
        subject: j.subject ?? '',
        body_md: j.body_md ?? '',
        hero_asset_id: hero.asset_id,
        hero_public_url: hero.public_url,
        goal_tag: (j.goal_tag && goalKeys.includes(j.goal_tag)) ? j.goal_tag : (goalKeys[0] ?? null),
        hero_hint: j.hero_hint ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as SaveBody;
    const pid  = body.property_id ?? DEFAULT_PROPERTY_ID;
    if (!body.target_date) return NextResponse.json({ ok: false, error: 'target_date required' }, { status: 400 });
    if (!body.subject && !body.body_md) return NextResponse.json({ ok: false, error: 'subject or body_md required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.rpc('fn_campaign_create_from_proposal', {
      p_property_id:   pid,
      p_target_date:   body.target_date,
      p_audience_type: body.audience_type ?? 'b2c',
      p_name:          body.name ?? (body.subject ?? '').slice(0, 60),
      p_subject:       body.subject ?? '',
      p_body_md:       body.body_md ?? '',
      p_hero_asset_id: body.hero_asset_id ?? null,
      p_goal_tag:      body.goal_tag ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, campaign_id: data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
