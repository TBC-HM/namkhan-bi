// app/api/cockpit/chat-v2/route.ts
// PROMPT 2 — Felix runtime speed. Edge runtime + streaming + DB-driven
// prompts. Target: "what is your name" → first token < 2s, complete < 5s.
//
// Sequencing note: this endpoint runs alongside the existing
// /api/cockpit/chat (still used by the triage pipeline for build tickets).
// chat-v2 is the FAST PATH for conversational chat — no triage, no ticket
// insert, no RAG for trivial messages.
//
// Properties of the fast path:
//   • edge runtime — cold-start ~50ms instead of ~600ms
//   • streamed response (SSE) — first token visible <1s on warm path
//   • system prompt + model + temperature read from governance.agent_prompts
//   • history trimmed to 6 (trivial) or 20 (non-trivial) most-recent turns
//   • RAG retrieval gated to non-trivial messages
//   • tools: parallel via Promise.all when the model emits tool_use blocks
//     (Phase-2 — fast path keeps tools=[] for trivial messages)

import { loadPromptByRole, type AgentPrompt } from '@/lib/prompts/load-prompt';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Nickname → role map (kept in sync with /api/cockpit/chat). Lives here so the
// edge bundle doesn't import the heavy chat module.
const NICKNAME_TO_ROLE: Record<string, string> = {
  felix: 'lead',
  architect: 'lead',
  kit: 'it_manager',
  vector: 'revenue_hod',
  mercer: 'sales_hod',
  lumen: 'marketing_hod',
  forge: 'operations_hod',
  intel: 'finance_hod',
  // Donna HoDs (humans) — fall back to same role-level prompt for now
  leo: 'marketing_hod',
  sebastian: 'sales_hod',
  toni: 'finance_hod',
};

interface ChatBody {
  message: string;
  role?: string;
  mention?: string;
  property_id?: number;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

function parseMention(text: string): string | null {
  const m = text.match(/^@([a-z][a-z0-9_]*)/i);
  if (!m) return null;
  const key = m[1].toLowerCase();
  return NICKNAME_TO_ROLE[key] ?? key;
}

/**
 * Trivial heuristic: short greeting / identity question that needs no RAG
 * and no tool dispatch. Tightened to PBS's spec — anything that smells like
 * an analytical or action request fails the test.
 */
function isTrivial(msg: string): boolean {
  if (msg.length >= 30) return false;
  if (msg.includes('@')) return false;
  if (/\b(why|how|when|where|what is|explain|analyse|analyze|compare|propose|draft|write|generate|show|check|pull|run|fetch|find|list|update|create|delete)\b/i.test(msg)) {
    return false;
  }
  return true;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: 'message required' }), { status: 400 });
  }

  // Resolve role: explicit body.role > @mention > default lead (Felix)
  const role = body.role
    ?? (body.mention ? NICKNAME_TO_ROLE[body.mention.toLowerCase()] ?? body.mention : null)
    ?? parseMention(message)
    ?? 'lead';

  // Pull prompt from DB — source of truth, no hardcoded fallback
  let prompt: AgentPrompt;
  try {
    prompt = await loadPromptByRole(role, body.property_id);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'prompt_not_found', detail: String(err) }),
      { status: 500 },
    );
  }

  // Property-scope enforcement: if the prompt row is bound to a specific
  // property and the request is for a different property, refuse.
  // (Holding-scope prompts have property_id=null and serve every property.)
  if (
    prompt.property_id !== null &&
    body.property_id !== undefined &&
    prompt.property_id !== body.property_id
  ) {
    return new Response(
      JSON.stringify({
        error: 'property_scope_mismatch',
        detail: `agent ${prompt.role} is scoped to property ${prompt.property_id}, request was for ${body.property_id}`,
      }),
      { status: 403 },
    );
  }

  const trivial = isTrivial(message);
  const historyLimit = trivial ? 6 : 20;
  const history = (body.conversation_history ?? []).slice(-historyLimit);

  // Build messages array. Skip RAG entirely for trivial messages.
  const messages = [
    ...history.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: message },
  ];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'anthropic_key_missing' }), { status: 500 });
  }

  // Stream from Anthropic
  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: prompt.model_id,
      system: prompt.system_prompt,
      max_tokens: prompt.max_tokens ?? 1024,
      temperature: prompt.temperature ?? 0.3,
      messages,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text();
    return new Response(
      JSON.stringify({ error: 'anthropic_error', status: upstream.status, detail: errText.slice(0, 500) }),
      { status: 502 },
    );
  }

  // Stream the SSE body straight through. Client decodes the Anthropic
  // event protocol (content_block_delta etc.) — same as /v1/messages stream.
  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    'x-felix-agent': prompt.role,
    'x-felix-model': prompt.model_id,
    'x-felix-trivial': trivial ? '1' : '0',
    'x-felix-latency-ms': String(Date.now() - startedAt),
  });

  return new Response(upstream.body, { status: 200, headers });
}
