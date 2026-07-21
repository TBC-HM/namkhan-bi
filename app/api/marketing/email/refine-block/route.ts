// app/api/marketing/email/refine-block/route.ts
// PBS 2026-07-21 Part D (generalized 2026-07-21 pm):
//   ONE AI-refine endpoint used by BOTH sequence steps AND newsletter campaigns.
//
// POST — dry-run. Body:
//   {
//     kind: 'sequence_step' | 'sequence_all' | 'newsletter_campaign',
//     id: string                // step_id (sequence_step) | funnel_id (sequence_all) | campaign_id (newsletter_campaign)
//     instruction: string       // operator's plain-English refine directive
//   }
//   Returns { ok, proposal } — object for single-target modes, array for sequence_all.
//
// PUT — accept + persist. Body:
//   { kind, updates: [ { step_id?, campaign_id?, subject?, body_md?, hero_asset_id?, click_tag_map? } ] }
//   Dispatches to fn_funnel_step_update (sequence) or fn_campaign_body_update (newsletter).
//
// Guardrails come from marketing.email_general_rules (via v_marketing_email_general_rules)
// so BOTH surfaces obey the same rules with zero divergence.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-6';
const DEFAULT_PROPERTY_ID = 260955;

type Kind = 'sequence_step' | 'sequence_all' | 'newsletter_campaign';

type StepRow = {
  step_id: string; step_no: number | null; subject: string | null;
  body_md: string | null; hero_asset_id: string | null; hero_public_url: string | null;
  click_tag_map: Record<string, unknown> | null;
};

type CampaignRow = {
  campaign_id: string; subject: string | null; body_md: string | null;
  blocks_json: unknown; from_name: string | null; from_email: string | null;
};

type RuleRow = { rule_kind: string; rule_text: string };

type MediaRow = {
  asset_id: string; category: string | null; sub_category: string | null;
  property_area: string | null; alt_text: string | null; visual_description: string | null;
  quality_index: number | null; primary_tier: string | null; public_url: string | null;
};

type ProposalStep = {
  step_id: string;
  step_no: number | null;
  subject: string | null;
  body_md: string | null;
  hero_asset_id: string | null;
  hero_public_url: string | null;
  click_tag_map: Record<string, string> | null;
};

type ProposalCampaign = {
  campaign_id: string;
  subject: string | null;
  body_md: string | null;
  blocks_json?: unknown;
};

async function loadRules(propertyId: number): Promise<RuleRow[]> {
  const sb = getSupabaseAdmin();
  const r = await sb.from('v_marketing_email_general_rules')
    .select('rule_kind, rule_text')
    .or(`property_id.eq.${propertyId},property_id.is.null`);
  return (r.data as RuleRow[] | null) ?? [];
}

async function loadMediaCandidates(propertyId: number): Promise<MediaRow[]> {
  const sb = getSupabaseAdmin();
  const r = await sb.from('v_marketing_media_page')
    .select('asset_id, category, sub_category, property_area, alt_text, visual_description, quality_index, primary_tier, public_url')
    .eq('property_id', propertyId)
    .gte('quality_index', 75)
    .in('primary_tier', ['tier_ota_profile','tier_website_hero'])
    .order('quality_index', { ascending: false })
    .limit(30);
  return (r.data as MediaRow[] | null) ?? [];
}

function rulesBlock(rules: RuleRow[]): string {
  if (!rules.length) return '(no explicit rules; default to unhurried brand voice, no "discount", plain-text link)';
  return rules.map(r => `[${r.rule_kind}] ${r.rule_text}`).join('\n');
}

function mediaBlock(media: MediaRow[]): string {
  if (!media.length) return '(no hero candidates)';
  return media.map(c => {
    const bits = [c.category, c.sub_category, c.property_area].filter(Boolean).join(' / ');
    const desc = (c.visual_description ?? c.alt_text ?? '').slice(0, 140);
    return `  - ${c.asset_id} | ${bits || 'uncategorised'} | q=${c.quality_index ?? '?'} | ${desc}`;
  }).join('\n');
}

async function callClaude(prompt: string): Promise<unknown> {
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
  return JSON.parse(text.slice(start, end + 1));
}

// ---------- sequence refine ----------

async function refineSequence(kind: 'sequence_step' | 'sequence_all', id: string, instruction: string) {
  const sb = getSupabaseAdmin();
  // For sequence_step, `id` is step_id; look up funnel_id.
  // For sequence_all,  `id` is funnel_id.
  const [rules, media] = await Promise.all([loadRules(DEFAULT_PROPERTY_ID), loadMediaCandidates(DEFAULT_PROPERTY_ID)]);

  let steps: StepRow[] = [];
  if (kind === 'sequence_step') {
    const r = await sb.from('v_marketing_funnel_detail')
      .select('funnel_id, step_id, step_no, subject, body_md, hero_asset_id, hero_public_url, click_tag_map')
      .eq('step_id', id);
    steps = ((r.data as Array<StepRow & { funnel_id: string }> | null) ?? []).filter(s => s.step_id);
  } else {
    const r = await sb.from('v_marketing_funnel_detail')
      .select('step_id, step_no, subject, body_md, hero_asset_id, hero_public_url, click_tag_map')
      .eq('funnel_id', id)
      .order('step_no', { ascending: true });
    steps = ((r.data as StepRow[] | null) ?? []).filter(s => s.step_id);
  }
  if (!steps.length) throw new Error('no steps found');

  const stepsBlock = steps.map(s => `--- STEP ${s.step_no} (step_id=${s.step_id}) ---
subject: ${s.subject ?? ''}
hero_asset_id: ${s.hero_asset_id ?? 'null'}
click_tag_map: ${JSON.stringify(s.click_tag_map ?? {})}
body_md:
${s.body_md ?? ''}
`).join('\n');

  const mode = kind === 'sequence_all' ? 'ALL steps' : 'ONE step';
  const jsonShape = kind === 'sequence_all'
    ? `{ "steps": [ { "step_id": string, "step_no": number, "subject": string, "body_md": string, "hero_asset_id": string|null, "click_tag_map": { [slug: string]: string } } ] }`
    : `{ "step_id": string, "step_no": number, "subject": string, "body_md": string, "hero_asset_id": string|null, "click_tag_map": { [slug: string]: string } }`;

  const prompt = `You are refining ${mode} of an email sequence for The Namkhan.

OPERATOR INSTRUCTION (highest priority):
${instruction}

GENERAL EMAIL RULES (must still be satisfied after refinement):
${rulesBlock(rules)}

HERO PHOTO SHORTLIST:
${mediaBlock(media)}

CURRENT ${kind === 'sequence_all' ? 'STEPS' : 'STEP'}:
${stepsBlock}

Return ONLY valid JSON:
${jsonShape}
Preserve step_id and step_no exactly. hero_asset_id MUST be one of the asset_id values above, or null.`;

  const raw = await callClaude(prompt);
  const urlMap = new Map(media.map(m => [m.asset_id, m.public_url]));
  if (kind === 'sequence_all') {
    const arr = (raw as { steps?: ProposalStep[] }).steps ?? [];
    return arr.map(p => ({ ...p, hero_public_url: p.hero_asset_id ? (urlMap.get(p.hero_asset_id) ?? null) : null }));
  }
  const one = raw as ProposalStep;
  return { ...one, hero_public_url: one.hero_asset_id ? (urlMap.get(one.hero_asset_id) ?? null) : null };
}

// ---------- newsletter refine ----------

async function refineNewsletter(campaignId: string, instruction: string) {
  const sb = getSupabaseAdmin();
  const [rules, media, r] = await Promise.all([
    loadRules(DEFAULT_PROPERTY_ID),
    loadMediaCandidates(DEFAULT_PROPERTY_ID),
    sb.from('guest.campaigns')
      .select('campaign_id, subject, body_md, blocks_json, from_name, from_email')
      .eq('campaign_id', campaignId).limit(1),
  ]);
  const rows = (r.data as CampaignRow[] | null) ?? [];
  if (!rows.length) throw new Error('campaign not found');
  const c = rows[0];

  const prompt = `You are refining a newsletter campaign for The Namkhan.

OPERATOR INSTRUCTION (highest priority):
${instruction}

GENERAL EMAIL RULES (must still be satisfied):
${rulesBlock(rules)}

HERO PHOTO SHORTLIST (if the user asks to swap the hero, pick the best asset_id and put it as the first line of body_md in ![](public_url) form):
${mediaBlock(media)}

CURRENT CAMPAIGN (campaign_id=${c.campaign_id}):
subject: ${c.subject ?? ''}
from: ${c.from_name ?? ''} <${c.from_email ?? ''}>
body_md:
${c.body_md ?? ''}

Return ONLY valid JSON:
{ "campaign_id": string, "subject": string, "body_md": string }
Preserve campaign_id exactly. body_md is markdown; keep any leading hero image as ![](url) on its own line.`;

  const raw = await callClaude(prompt) as ProposalCampaign;
  // Optional: if the AI referenced a shortlist asset_id in text form, replace with public URL.
  // For now we trust the model to embed the URL itself.
  return raw;
}

// ---------- POST: dry-run proposal ----------

export async function POST(req: NextRequest) {
  let body: { kind?: Kind; id?: string; instruction?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const { kind, id, instruction } = body;
  if (!kind || !id || !instruction) return NextResponse.json({ ok: false, error: 'kind, id, instruction required' }, { status: 400 });
  if (!['sequence_step','sequence_all','newsletter_campaign'].includes(kind)) return NextResponse.json({ ok: false, error: 'invalid kind' }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });

  try {
    let proposal: unknown;
    if (kind === 'newsletter_campaign') {
      proposal = await refineNewsletter(id, instruction);
    } else {
      proposal = await refineSequence(kind, id, instruction);
    }
    return NextResponse.json({ ok: true, kind, proposal });
  } catch (e) {
    const em = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: em }, { status: 502 });
  }
}

// ---------- PUT: accept + persist ----------

export async function PUT(req: NextRequest) {
  let body: { kind?: Kind; updates?: Array<ProposalStep | ProposalCampaign> };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }); }
  const { kind, updates } = body;
  if (!kind || !Array.isArray(updates) || !updates.length) return NextResponse.json({ ok: false, error: 'kind and updates required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  if (kind === 'sequence_step' || kind === 'sequence_all') {
    for (const u of updates as ProposalStep[]) {
      if (!u.step_id) { results.push({ id: '(missing)', ok: false, error: 'step_id missing' }); continue; }
      const { error } = await sb.rpc('fn_funnel_step_update', {
        p_step_id: u.step_id,
        p_subject: u.subject ?? null,
        p_body_md: u.body_md ?? null,
        p_hero_asset_id: u.hero_asset_id ?? null,
        p_click_tag_map: u.click_tag_map ?? null,
        p_clear_hero: false,
      });
      if (error) results.push({ id: u.step_id, ok: false, error: error.message });
      else results.push({ id: u.step_id, ok: true });
    }
  } else if (kind === 'newsletter_campaign') {
    for (const u of updates as ProposalCampaign[]) {
      if (!u.campaign_id) { results.push({ id: '(missing)', ok: false, error: 'campaign_id missing' }); continue; }
      const { error } = await sb.rpc('fn_campaign_body_update', {
        p_campaign_id: u.campaign_id,
        p_subject: u.subject ?? null,
        p_body_md: u.body_md ?? null,
        p_blocks_json: (u.blocks_json ?? null) as unknown,
      });
      if (error) results.push({ id: u.campaign_id, ok: false, error: error.message });
      else results.push({ id: u.campaign_id, ok: true });
    }
  } else {
    return NextResponse.json({ ok: false, error: 'invalid kind' }, { status: 400 });
  }

  const anyErr = results.some(r => !r.ok);
  return NextResponse.json({ ok: !anyErr, results }, { status: anyErr ? 207 : 200 });
}
