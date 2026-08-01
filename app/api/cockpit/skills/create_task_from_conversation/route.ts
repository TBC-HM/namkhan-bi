// app/api/cockpit/skills/create_task_from_conversation/route.ts
// SKILL: create_task_from_conversation
// Called by agents (Felix, Kit) when a conversation identifies work that needs formal tracking.
// Inserts a cockpit_tickets row classified by Claude from the conversation context.
// Skill = the tool. Task = the record it creates. These are different things.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { callAnthropic, isLlmOk } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ARMS = ['chat', 'dev', 'marketing', 'ops', 'newsletter', 'it', 'revenue', 'sales', 'operations'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    task_description?: string;
    conversation_summary?: string;
    arm?: string;
    priority?: string;
    agent_handle?: string;
    property_id?: number;
  };

  const rawText = (body.task_description ?? body.conversation_summary ?? '').trim();
  if (!rawText) return NextResponse.json({ error: 'task_description or conversation_summary required' }, { status: 400 });

  // Classify and structure the task with Claude
  const sys = 'You are a task classifier for The Namkhan hotel operations cockpit. Extract structured ticket fields from a task description. Be specific and actionable. Return ONLY valid JSON.';
  const usr = 'Classify this task and extract ticket fields:\n\n"' + rawText + '"\n\nValid arms: ' + VALID_ARMS.join(', ') + '\n\nReturn: {"arm":"string","intent":"action title max 80 chars starting with verb","parsed_summary":"2-3 sentences: what needs to be done, why, and what done looks like","priority":"high|medium|low","tags":["tag1","tag2"]}';

  const llm = await callAnthropic({ systemPrompt: sys, userPrompt: usr, maxTokens: 400 });

  let fields: Record<string, unknown> = {};
  if (isLlmOk(llm)) {
    try {
      const m = llm.text.match(/\{[\s\S]*\}/);
      if (m) fields = JSON.parse(m[0]);
    } catch { /* fallback below */ }
  }

  const arm = String(body.arm ?? fields.arm ?? 'dev');
  const validArm = VALID_ARMS.includes(arm) ? arm : 'dev';

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('cockpit_tickets').insert({
    source: 'skill:create_task_from_conversation',
    arm: validArm,
    intent: String(fields.intent ?? rawText.slice(0, 80)),
    status: 'open',
    parsed_summary: String(fields.parsed_summary ?? rawText),
    notes: body.agent_handle ? 'Created by agent: ' + body.agent_handle : 'Created via skill',
    metadata: {
      priority: String(fields.priority ?? body.priority ?? 'medium'),
      tags: fields.tags ?? [],
      raw_input: rawText.slice(0, 500),
      classified_by: 'claude',
      agent_handle: body.agent_handle ?? null,
    },
    project_id: body.property_id ?? null,
  }).select('id, arm, intent, status, parsed_summary').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    ticket: data,
    message: 'Task created — visible in IT2 → Ops → Tasks · arm: ' + validArm,
  });
}
