// app/api/cockpit/chat-v2/route.ts
// PROMPT 2 — Felix runtime speed. Streaming + DB-driven prompts.
// 2026-05-13 — wired tool loop so route_to_hod / request_peer_consult /
//              other registered tools actually execute. Felix can now
//              hand off to HoDs instead of describing the handoff in prose.
//
// Flow:
//   1. Resolve role from body / @mention / default 'lead' (Felix).
//   2. Load prompt from governance.agent_prompts (system, model, tools_enabled).
//   3. Trivial path (greeting / identity): stream straight from Anthropic, no tools.
//   4. Non-trivial path: send tools, accumulate response, dispatch tool_use blocks.
//        - route_to_hod  → recurse with target's prompt + original user message
//                          (audit-logged via the handler, hop counter enforced).
//        - other tools   → execute, append tool_result, ask model to continue.
//      Hop limit: MAX_HOPS = 3 (defined in lib/agent-tools/handlers/handoff.ts).
//      Final assistant text is streamed back as a single SSE delta so the
//      client keeps the existing decode path.

import { loadPromptByRole, type AgentPrompt } from '@/lib/prompts/load-prompt';
import { asAnthropicTools, getToolSpecs, lookup, type ToolDispatchCtx } from '@/lib/agent-tools/registry';
import { MAX_HOPS } from '@/lib/agent-tools/handlers/handoff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Nickname → role map (kept in sync with /api/cockpit/chat).
const NICKNAME_TO_ROLE: Record<string, string> = {
  felix: 'lead',
  architect: 'lead',
  kit: 'it_manager',
  vector: 'revenue_hod',
  mercer: 'sales_hod',
  lumen: 'marketing_hod',
  forge: 'operations_hod',
  intel: 'finance_hod',
  // Donna HoDs (humans) — fall back to same role-level prompt for now.
  leo: 'marketing_hod',
  sebastian: 'sales_hod',
  toni: 'finance_hod',
};

interface ChatBody {
  message: string;
  role?: string;
  mention?: string;
  property_id?: number;
  conversation_id?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

function parseMention(text: string): string | null {
  const m = text.match(/^@([a-z][a-z0-9_]*)/i);
  if (!m) return null;
  const key = m[1].toLowerCase();
  return NICKNAME_TO_ROLE[key] ?? key;
}

/**
 * Trivial heuristic: short greeting / identity question. Skip tools entirely
 * (faster first token, no hop overhead).
 */
function isTrivial(msg: string): boolean {
  if (msg.length >= 30) return false;
  if (msg.includes('@')) return false;
  if (/\b(why|how|when|where|what is|explain|analyse|analyze|compare|propose|draft|write|generate|show|check|pull|run|fetch|find|list|update|create|delete|route|consult|ask)\b/i.test(msg)) {
    return false;
  }
  return true;
}

// ─── Anthropic content-block types we care about ──────────────────────────
type TextBlock = { type: 'text'; text: string };
type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type ContentBlock = TextBlock | ToolUseBlock | { type: string; [k: string]: unknown };
interface AnthropicResponse {
  id: string;
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | string;
  usage?: { input_tokens: number; output_tokens: number };
}

interface DispatchRequest {
  role: string;
  propertyId: number | undefined;
  conversationId: string | undefined;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  hopCount: number;
  apiKey: string;
}

interface DispatchResult {
  text: string;
  /** Trail of agents that participated (newest last). */
  agentsTouched: Array<{ role: string; display_name: string | null }>;
  /** True if we hit MAX_HOPS before a final answer. */
  hopExhausted: boolean;
}

/**
 * One Anthropic call with the agent's tool set. Returns text + tool_use
 * blocks. Caller decides whether to dispatch tools or finish.
 */
async function callAnthropic(prompt: AgentPrompt, messages: Array<{ role: string; content: unknown }>, apiKey: string): Promise<AnthropicResponse> {
  const toolSpecs = getToolSpecs(prompt.tools_enabled ?? []);
  const tools = toolSpecs.length > 0 ? asAnthropicTools(toolSpecs) : undefined;

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
      ...(tools ? { tools } : {}),
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    throw new Error(`anthropic ${upstream.status}: ${errText.slice(0, 500)}`);
  }
  return (await upstream.json()) as AnthropicResponse;
}

/**
 * Recursive dispatcher: model → tool_use → execute → maybe recurse.
 * Returns the final assistant text once the model emits end_turn or hops
 * are exhausted.
 */
async function dispatch(req: DispatchRequest): Promise<DispatchResult> {
  const { role, propertyId, conversationId, userMessage, history, hopCount, apiKey } = req;

  // Pull the agent's prompt.
  let prompt: AgentPrompt;
  try {
    prompt = await loadPromptByRole(role, propertyId);
  } catch (err) {
    return {
      text: `[Agent ${role} prompt not found — ${(err as Error).message}]`,
      agentsTouched: [{ role, display_name: null }],
      hopExhausted: false,
    };
  }

  const agentsTouched = [{ role: prompt.role, display_name: prompt.display_name }];
  let messages: Array<{ role: string; content: unknown }> = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  // Hop budget: each Anthropic round-trip costs one hop. Even if tool_use
  // appears, we cap recursion at MAX_HOPS.
  let localHop = hopCount;
  const ctx: ToolDispatchCtx = {
    role: prompt.role,
    propertyId,
    hopCount: localHop,
    conversationId,
    userMessage,
  };

  for (let turn = 0; turn < MAX_HOPS; turn++) {
    const response = await callAnthropic(prompt, messages, apiKey);

    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as ToolUseBlock[];
    const textBlocks = response.content.filter(b => b.type === 'text') as TextBlock[];
    const textSoFar = textBlocks.map(b => b.text).join('\n').trim();

    // No tools requested — we're done.
    if (toolUseBlocks.length === 0) {
      return { text: textSoFar, agentsTouched, hopExhausted: false };
    }

    // Process each tool_use block. Special-case route_to_hod — it pivots
    // the conversation to the target agent and we recurse with their prompt.
    let routedToOtherAgent = false;
    const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

    for (const tu of toolUseBlocks) {
      const spec = lookup(tu.name);
      if (!spec || !spec.handler) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: 'tool_not_implemented', tool: tu.name }),
        });
        continue;
      }

      try {
        const result = await spec.handler(tu.input as Record<string, unknown>, ctx);

        // route_to_hod success → pivot to target agent. Skip the rest of
        // this turn's tool processing; we hand the conversation over.
        if (tu.name === 'route_to_hod') {
          const r = result as { ok: boolean; target_role?: string; target_display?: string; hop_count?: number; error?: string };
          if (r.ok && r.target_role) {
            const subHop = (r.hop_count ?? localHop + 1);
            if (subHop > MAX_HOPS) {
              return {
                text: textSoFar
                  ? `${textSoFar}\n\n_Routing to ${r.target_display ?? r.target_role} blocked — hop limit reached._`
                  : `Routing to ${r.target_display ?? r.target_role} blocked — hop limit reached.`,
                agentsTouched,
                hopExhausted: true,
              };
            }
            const sub = await dispatch({
              role: r.target_role,
              propertyId,
              conversationId,
              userMessage,
              history,
              hopCount: subHop,
              apiKey,
            });
            const handoffBanner = `_${prompt.display_name ?? prompt.role} → routed to ${r.target_display ?? r.target_role}_`;
            const composed = textSoFar
              ? `${textSoFar}\n\n${handoffBanner}\n\n${sub.text}`
              : `${handoffBanner}\n\n${sub.text}`;
            return {
              text: composed,
              agentsTouched: [...agentsTouched, ...sub.agentsTouched],
              hopExhausted: sub.hopExhausted,
            };
          }
          // route_to_hod failed (unknown target, cross-property, etc.) — feed
          // the error back so the agent can recover.
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          });
          continue;
        }

        // request_peer_consult: handler validates target + counts a hop;
        // model then has to compose the peer question in its reply. We
        // pass the validated peer info back as the tool result. (A future
        // pass can fire the peer Anthropic call inline and inject the
        // answer — keeping the simpler shape for now to avoid runaway hops.)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify({ error: 'tool_handler_error', detail: (err as Error).message }),
        });
      }
    }

    if (routedToOtherAgent) break; // dead branch, kept for clarity

    // Append the assistant's tool_use turn + our tool_result turn, then loop.
    messages = [
      ...messages,
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults },
    ];
    localHop += 1;
    ctx.hopCount = localHop;
  }

  // Hop budget exhausted without a clean end_turn. Best-effort final text.
  return {
    text: '_Hop limit reached without a final answer. Try restating the question._',
    agentsTouched,
    hopExhausted: true,
  };
}

// ─── Edge SSE helper: encode one delta then close ─────────────────────────
function sseEncode(payload: object): Uint8Array {
  const text = `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
  return new TextEncoder().encode(text);
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

  // Resolve role: explicit body.role > body.mention > @mention in text > 'lead'
  const role = body.role
    ?? (body.mention ? NICKNAME_TO_ROLE[body.mention.toLowerCase()] ?? body.mention : null)
    ?? parseMention(message)
    ?? 'lead';

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'anthropic_key_missing' }), { status: 500 });
  }

  // Strip leading @mention from the message so the agent sees the substance.
  const cleanMessage = message.replace(/^@[a-z][a-z0-9_]*\s*/i, '').trim() || message;

  const trivial = isTrivial(cleanMessage);
  const historyLimit = trivial ? 6 : 20;
  const history = (body.conversation_history ?? []).slice(-historyLimit);

  // Property-scope pre-check + fast-path trivial streaming (no tools).
  let prompt: AgentPrompt;
  try {
    prompt = await loadPromptByRole(role, body.property_id);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'prompt_not_found', detail: String(err) }),
      { status: 500 },
    );
  }
  if (
    prompt.property_id !== null
    && body.property_id !== undefined
    && prompt.property_id !== body.property_id
  ) {
    return new Response(
      JSON.stringify({
        error: 'property_scope_mismatch',
        detail: `agent ${prompt.role} is scoped to property ${prompt.property_id}, request was for ${body.property_id}`,
      }),
      { status: 403 },
    );
  }

  // FAST PATH — trivial messages, no tools, raw stream pass-through.
  if (trivial) {
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
        max_tokens: prompt.max_tokens ?? 512,
        temperature: prompt.temperature ?? 0.3,
        messages: [
          ...history.map(t => ({ role: t.role, content: t.content })),
          { role: 'user' as const, content: cleanMessage },
        ],
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
    const headers = new Headers({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      'x-felix-agent': prompt.role,
      'x-felix-model': prompt.model_id,
      'x-felix-trivial': '1',
      'x-felix-tools': 'off',
      'x-felix-latency-ms': String(Date.now() - startedAt),
    });
    return new Response(upstream.body, { status: 200, headers });
  }

  // TOOL PATH — non-trivial. Run the dispatch loop, then emit one SSE block
  // with the final text so the client's existing decoder still works.
  let dispatched: DispatchResult;
  try {
    dispatched = await dispatch({
      role,
      propertyId: body.property_id,
      conversationId: body.conversation_id,
      userMessage: cleanMessage,
      history: history.map(t => ({ role: t.role, content: t.content })),
      hopCount: 0,
      apiKey,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'dispatch_failed', detail: (err as Error).message }),
      { status: 502 },
    );
  }

  // Encode the final answer as an Anthropic-style content_block_delta stream
  // so the existing client decoder doesn't need to change.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // message_start
      controller.enqueue(sseEncode({
        type: 'message_start',
        message: { id: 'msg_chatv2', role: 'assistant', model: prompt.model_id, content: [] },
      }));
      // content_block_start
      controller.enqueue(sseEncode({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }));
      // single delta with the final text
      controller.enqueue(sseEncode({
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: dispatched.text },
      }));
      // content_block_stop
      controller.enqueue(sseEncode({
        type: 'content_block_stop',
        index: 0,
      }));
      // message_delta with stop_reason
      controller.enqueue(sseEncode({
        type: 'message_delta',
        delta: { stop_reason: dispatched.hopExhausted ? 'max_tokens' : 'end_turn', stop_sequence: null },
      }));
      // message_stop
      controller.enqueue(sseEncode({ type: 'message_stop' }));
      controller.close();
    },
  });

  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    'x-felix-agent': prompt.role,
    'x-felix-model': prompt.model_id,
    'x-felix-trivial': '0',
    'x-felix-tools': 'on',
    'x-felix-hops': String(dispatched.agentsTouched.length),
    'x-felix-agents': dispatched.agentsTouched.map(a => a.role).join(','),
    'x-felix-latency-ms': String(Date.now() - startedAt),
  });
  return new Response(stream, { status: 200, headers });
}
