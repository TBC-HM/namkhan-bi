// app/api/marketing/director/refine-slot/route.ts
// PBS 2026-07-23 · Slot-level AI refine (Proposal calendar inline editing).
// Body: { slot_id, instruction, subject_override?, body_md_override? }
//
// Two modes:
//   1. subject_override / body_md_override present (client Regenerate flow):
//      persist the provided copy directly — no AI hop.
//   2. instruction only: ONE Anthropic call rewrites { title, concept },
//      obeying the instruction precisely, grounded in the group's voice
//      (v_subscriber_groups voice_type/voice_summary), the slot's goal label
//      and the owner's original direction (ai_notes). Unparseable output is
//      retried once, then 502 with a clear error. Subject is always enforced
//      server-side as title + ' — The Namkhan'.
//
// Persistence: public.fn_director_slot_refine (SECURITY DEFINER RPC) — updates
// title/subject/body_md by slot id, sets status='refined'. COALESCE guards
// mean null params keep existing values.
// Response: { ok, slot_id, title, subject, body_md } (body_md = concept).

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Body = {
  slot_id?: number;
  instruction?: string;
  subject_override?: string;
  body_md_override?: string;
};

type SlotCtx = {
  id: number;
  property_id: number;
  slot_date: string;
  title: string | null;
  subject: string | null;
  body_md: string | null;
  goal_tag: string;
  group_slug: string | null;
  ai_notes: string | null;
};

type GroupVoice = { slug: string; name: string; voice_type: string | null; voice_summary: string | null };

async function callAnthropic(system: string, userPrompt: string, maxTokens = 1000): Promise<string> {
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

function stripCodeFences(text: string): string {
  let s = text.trim();
  const fenced = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```\s*$/);
  if (fenced) return fenced[1].trim();
  if (s.startsWith('```')) s = s.replace(/^```[a-zA-Z]*\s*/, '');
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

const REFINE_SYSTEM = [
  'You are the newsletter planning editor for The Namkhan — a 30-key riverside boutique retreat 20 minutes downriver from Luang Prabang, Laos.',
  'You receive ONE campaign slot (title + concept) and ONE editing instruction from the owner. Apply the instruction to the slot.',
  'OBEY THE INSTRUCTION PRECISELY:',
  '- If it targets only the title (e.g. "change the title", "shorter title"), change ONLY the title and return the concept VERBATIM, unchanged.',
  '- If it targets only the concept, change ONLY the concept and return the title verbatim.',
  '- If it is a tone or register shift (e.g. "more transactional", "warmer", "more B2B"), rewrite BOTH title and concept in that register while keeping the underlying angle and subject matter.',
  '- Never invent events, offers, prices or facts not present in the inputs.',
  'TITLE rules: <= 60 chars · specific and evocative · no exclamation marks · no ALL CAPS · no emoji.',
  'CONCEPT rules: 1-2 sentences · it is a creative brief for a copywriter, NOT email copy · name the angle, the hook, and what the reader should feel or do.',
  'Return STRICT JSON only: { "title": "...", "subject": "...", "concept": "..." } where subject = title + " — The Namkhan".',
  'No code fences, no preamble, no trailing text.',
].join('\n');

function buildRefinePrompt(instruction: string, slot: SlotCtx, goalLabel: string, group: GroupVoice | null): string {
  const parts: string[] = [];
  parts.push('### CURRENT SLOT');
  parts.push(`date: ${slot.slot_date}`);
  parts.push(`title: ${slot.title ?? '(none)'}`);
  parts.push(`subject: ${slot.subject ?? '(none)'}`);
  parts.push(`concept: ${slot.body_md ?? '(none)'}`);
  parts.push('');
  parts.push('### CONTEXT');
  parts.push(`editorial goal: ${goalLabel}`);
  if (group) {
    parts.push(`audience group: ${group.name} (${group.slug} · ${group.voice_type ?? 'b2c'})`);
    if (group.voice_summary) parts.push(`group voice: ${group.voice_summary}`);
  } else {
    parts.push('audience group: all subscriber groups (mixed)');
  }
  if (slot.ai_notes) parts.push(`original planning notes (the owner's direction lives here): ${slot.ai_notes}`);
  parts.push('');
  parts.push('### INSTRUCTION FROM THE OWNER (apply this precisely)');
  parts.push(instruction);
  parts.push('');
  parts.push('### OUTPUT');
  parts.push('STRICT JSON: { "title": "...", "subject": "...", "concept": "..." } — subject MUST be title + " — The Namkhan". Nothing else.');
  return parts.join('\n');
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slot_id = Number(body?.slot_id);
  const instruction = String(body?.instruction ?? '').trim().slice(0, 500);
  const subject_override = body?.subject_override ? String(body.subject_override) : null;
  const body_md_override = body?.body_md_override ? String(body.body_md_override) : null;

  if (!slot_id || !Number.isFinite(slot_id)) {
    return NextResponse.json({ ok: false, error: 'slot_id required' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: slotData, error: loadErr } = await sb.from('v_director_calendar')
    .select('id, property_id, slot_date, title, subject, body_md, goal_tag, group_slug, ai_notes')
    .eq('id', slot_id).maybeSingle();
  if (loadErr) return NextResponse.json({ ok: false, error: loadErr.message }, { status: 500 });
  const slot = slotData as SlotCtx | null;
  if (!slot) return NextResponse.json({ ok: false, error: `slot ${slot_id} not found` }, { status: 404 });

  const noteTrail = (extra: string) => `${slot.ai_notes ? slot.ai_notes + ' · ' : ''}${extra}`.slice(-1500);

  // Mode 1 — direct persist (Regenerate flow already carries finished copy).
  if (subject_override || body_md_override) {
    const { error } = await sb.rpc('fn_director_slot_refine', {
      p_slot_id: slot_id,
      p_title: null,
      p_subject: subject_override,
      p_body_md: body_md_override,
      p_hero_asset_id: null,
      p_ctas: null,
      p_ai_notes: instruction ? noteTrail(`refine=${instruction}`) : null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true, slot_id,
      title: slot.title,
      subject: subject_override ?? slot.subject,
      body_md: body_md_override ?? slot.body_md,
    });
  }

  if (!instruction) {
    return NextResponse.json({ ok: false, error: 'instruction required' }, { status: 400 });
  }

  // Context — group voice + goal label (both optional, failures non-fatal).
  let group: GroupVoice | null = null;
  if (slot.group_slug) {
    const { data } = await sb.from('v_subscriber_groups')
      .select('slug, name, voice_type, voice_summary')
      .eq('slug', slot.group_slug).maybeSingle();
    group = (data as GroupVoice | null) ?? null;
  }
  let goalLabel = slot.goal_tag;
  {
    const { data } = await sb.from('v_director_goals')
      .select('goal_label')
      .eq('property_id', slot.property_id).eq('goal_key', slot.goal_tag).limit(1);
    const row = (data as Array<{ goal_label: string }> | null)?.[0];
    if (row?.goal_label) goalLabel = row.goal_label;
  }

  const prompt = buildRefinePrompt(instruction, slot, goalLabel, group);

  // Mode 2 — AI refine. Retry once on unparseable output, then 502.
  let title = '';
  let concept = '';
  let lastError = '';
  for (let attempt = 0; attempt < 2 && (!title || !concept); attempt++) {
    try {
      const text = await callAnthropic(REFINE_SYSTEM, prompt, 1000);
      const parsed = JSON.parse(stripCodeFences(text)) as { title?: unknown; concept?: unknown };
      const t = String(parsed?.title ?? '').trim().slice(0, 120);
      const c = String(parsed?.concept ?? '').trim().slice(0, 600);
      if (!t || !c) throw new Error('refine_json_incomplete');
      title = t; concept = c;
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  if (!title || !concept) {
    return NextResponse.json({ ok: false, error: `refine failed: AI output unusable after retry (${lastError})` }, { status: 502 });
  }

  const subject = `${title} — The Namkhan`;
  const { error: upErr } = await sb.rpc('fn_director_slot_refine', {
    p_slot_id: slot_id,
    p_title: title,
    p_subject: subject,
    p_body_md: concept,
    p_hero_asset_id: null,
    p_ctas: null,
    p_ai_notes: noteTrail(`refine=${instruction}`),
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, slot_id, title, subject, body_md: concept });
}
