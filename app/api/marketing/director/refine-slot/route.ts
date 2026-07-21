// app/api/marketing/director/refine-slot/route.ts
// PBS 2026-07-22 (Newsletter Engine v2): refine a single director calendar slot with AI.
// POST { slot_id: number, instruction: string }
// Returns { ok, title, subject, body_md, ai_notes }

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

async function callClaude(prompt: string): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
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
    const body = await req.json() as { slot_id?: number; instruction?: string };
    const slotId = Number(body.slot_id);
    const instruction = (body.instruction || '').trim();
    if (!slotId || !instruction) return NextResponse.json({ error: 'slot_id and instruction required' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const slotRes = await sb.from('v_director_calendar').select('*').eq('id', slotId).maybeSingle();
    if (slotRes.error || !slotRes.data) return NextResponse.json({ error: 'slot not found' }, { status: 404 });
    const slot = slotRes.data as { property_id: number; slot_date: string; goal_tag: string; title: string; subject: string | null; body_md: string | null; audience_type: string };

    const rulesRes = await sb.from('v_marketing_email_general_rules').select('rule_kind, rule_text').or(`property_id.eq.${slot.property_id},property_id.is.null`);
    const rules = (rulesRes.data as Array<{ rule_kind: string; rule_text: string }> | null) ?? [];

    const prompt = `You are refining ONE editorial slot for a Namkhan newsletter.

OPERATOR INSTRUCTION (highest priority):
${instruction}

GENERAL EMAIL RULES:
${rules.map(r=>`[${r.rule_kind}] ${r.rule_text}`).join('\n') || '(none)'}

CURRENT SLOT:
date: ${slot.slot_date}
audience: ${slot.audience_type}
goal_tag: ${slot.goal_tag}
title: ${slot.title}
subject: ${slot.subject ?? ''}
body_md:
${slot.body_md ?? ''}

Return ONLY valid JSON:
{ "title": string, "subject": string, "body_md": string, "ai_notes": string }
Keep the same goal_tag and slot_date (never change them).`;

    const raw = await callClaude(prompt) as { title?: string; subject?: string; body_md?: string; ai_notes?: string };
    const title = (raw.title ?? slot.title).slice(0, 200);
    const subject = (raw.subject ?? slot.subject ?? title).slice(0, 250);
    const bodyMd = raw.body_md ?? slot.body_md ?? '';
    const notes = (raw.ai_notes ?? `Refined: ${instruction.slice(0, 120)}`).slice(0, 500);

    const { error } = await sb.rpc('fn_director_slot_refine', {
      p_slot_id: slotId,
      p_title: title,
      p_subject: subject,
      p_body_md: bodyMd,
      p_hero_asset_id: null,
      p_ctas: null,
      p_ai_notes: notes,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, title, subject, body_md: bodyMd, ai_notes: notes });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
