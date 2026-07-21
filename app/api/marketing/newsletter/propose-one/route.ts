// app/api/marketing/newsletter/propose-one/route.ts
// PBS 2026-07-21 pm (Add 2): AI-first one-shot newsletter proposal + save.
//
// POST  → propose:  { property_id, kind, seed_text, target_date, audience_type,
//                     instruction?, prior? } → { ok, proposal: {subject, body_md, goal_tag} }
// PUT   → save:     { property_id, kind, subject, body_md, target_date, audience_type,
//                     goal_tag, name } → { ok, campaign_id }
//
// `kind` = 'broadcast' | 'lifecycle'  · written to guest.campaigns.campaign_kind.
// Server-side only (uses ANTHROPIC_API_KEY + service-role Supabase).

import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime  = 'nodejs';
export const dynamic  = 'force-dynamic';

const SYSTEM = [
  'You are the marketing writer for The Namkhan, a 30-key riverside boutique retreat',
  'outside Luang Prabang, Laos. Your voice is calm, understated, warm, never salesy.',
  'Write for repeat travellers who value quiet, nature, and craft.',
  'Return STRICT JSON with keys:',
  '  subject  (string, <= 65 chars, no exclamation marks)',
  '  body_md  (string, plain Markdown, 4-8 short paragraphs, greet with "Dear {{first_name}},")',
  '  goal_tag (short slug like "green-season-family" or "birthday-warm-wishes" · optional)',
  'Do not use emojis. Do not fabricate offers. Do not invent prices.',
].join(' ');

type ProposeBody = {
  property_id?: number;
  kind?: 'broadcast' | 'lifecycle';
  seed_text?: string;
  target_date?: string;
  audience_type?: 'b2c' | 'b2b';
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

async function callAnthropic(userPrompt: string): Promise<{ subject: string; body_md: string; goal_tag: string | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('anthropic_api_key_missing');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-7',
      max_tokens: 1400,
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
    subject: String(parsed.subject || '').slice(0, 120),
    body_md: String(parsed.body_md || ''),
    goal_tag: parsed.goal_tag ? String(parsed.goal_tag).slice(0, 80) : null,
  };
}

export async function POST(req: NextRequest) {
  let body: ProposeBody;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  const seed = String(body.seed_text ?? '').trim();
  if (!seed) return NextResponse.json({ ok: false, error: 'seed_text_required' }, { status: 400 });

  const kind = normalizeKind(body.kind);
  const parts: string[] = [];
  parts.push(`Campaign kind: ${kind}. ${kind === 'lifecycle'
    ? 'This is a lifecycle trigger (anticipation, gratitude, birthday, winback) fired automatically for one guest.'
    : 'This is a one-off broadcast to a segment of subscribers.'}`);
  parts.push('Target date: ' + (body.target_date || 'flexible'));
  parts.push('Audience: ' + (body.audience_type || 'b2c'));
  parts.push('Seed: ' + seed);
  if (body.instruction && body.prior) {
    parts.push('');
    parts.push('The following draft was written previously. Refine it per the instruction — keep tone + audience the same.');
    parts.push('Previous subject: ' + (body.prior.subject || ''));
    parts.push('Previous body:');
    parts.push(body.prior.body_md || '');
    parts.push('');
    parts.push('Refine instruction: ' + body.instruction);
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
  // Insert into guest.campaigns as a draft. campaign_kind carries broadcast vs
  // lifecycle so the listing pages filter correctly. schedule_kind='once' keeps
  // it out of the auto-recurring lanes until the operator opens it in the editor.
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
