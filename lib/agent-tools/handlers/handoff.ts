// lib/agent-tools/handlers/handoff.ts
// Prompt 4 — agent-to-agent handoff handlers.
//
// route_to_hod      : hand the conversation to a target HoD; conversation continues with target.
// request_peer_consult : ask peer for a one-shot opinion; conversation stays with original agent.
//
// Both validate property scope and the 3-hop ceiling, and write a row to
// public.cockpit_audit_log (view over cockpit.aud_audit_log).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type LooseClient = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAX_HOPS = 3;

export interface HandoffContext {
  /** Role of the agent invoking the tool. */
  agent_role: string;
  /** Property-scope at the time of invocation; null for holding-scope. */
  property_id: number | null;
  /** Number of hops already taken on the current user message (0-indexed). */
  hop_count: number;
  /** Conversation id (UUID) if conversation persistence is in place. */
  conversation_id?: string;
  /** Original user message — propagated to the target agent. */
  user_message: string;
}

export interface HandoffResult {
  ok: boolean;
  error?: 'unknown_target' | 'cross_property_forbidden' | 'hop_limit_exceeded' | 'self_route' | 'no_user_message';
  target_role?: string;
  target_display?: string;
  hop_count?: number;
}

let _client: LooseClient | null = null;
function client(): LooseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase env missing');
  _client = createClient(url, key, { auth: { persistSession: false } }) as LooseClient;
  return _client;
}

async function lookupTarget(targetRole: string) {
  const supa = client();
  const { data, error } = await supa
    .schema('cockpit')
    .from('id_agents')
    .select('role, display_name, property_id, agent_id, status')
    .eq('role', targetRole)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`lookup_target: ${error.message}`);
  return data;
}

async function audit(action: 'route_to_hod' | 'request_peer_consult', ctx: HandoffContext, target: string, success: boolean, reason?: string) {
  const supa = client();
  await supa.from('cockpit_audit_log').insert({
    agent: ctx.agent_role,
    action,
    target,
    success,
    reasoning: reason ?? '',
    metadata: {
      hop_count: ctx.hop_count,
      next_hop: ctx.hop_count + 1,
      conversation_id: ctx.conversation_id ?? null,
      property_id: ctx.property_id,
      user_message_excerpt: ctx.user_message.slice(0, 200),
    },
  });
}

/**
 * route_to_hod — handle off the conversation to a target HoD/agent. The
 * target will answer the user's original message; the calling agent steps
 * aside. Hop counter increments by 1.
 */
export async function route_to_hod(
  input: { target_role: string; framing?: string; reason?: string },
  ctx: HandoffContext,
): Promise<HandoffResult> {
  // 1. Self-route is a no-op (and prevents an infinite loop)
  if (input.target_role === ctx.agent_role) {
    await audit('route_to_hod', ctx, input.target_role, false, 'self_route');
    return { ok: false, error: 'self_route' };
  }

  // 2. Hop ceiling
  if (ctx.hop_count >= MAX_HOPS) {
    await audit('route_to_hod', ctx, input.target_role, false, 'hop_limit_exceeded');
    return { ok: false, error: 'hop_limit_exceeded' };
  }

  // 3. User-message validity
  if (!ctx.user_message || !ctx.user_message.trim()) {
    await audit('route_to_hod', ctx, input.target_role, false, 'no_user_message');
    return { ok: false, error: 'no_user_message' };
  }

  // 4. Target exists + property scope OK
  const target = await lookupTarget(input.target_role);
  if (!target) {
    await audit('route_to_hod', ctx, input.target_role, false, 'unknown_target');
    return { ok: false, error: 'unknown_target' };
  }
  if (target.property_id !== null && ctx.property_id !== null && target.property_id !== ctx.property_id) {
    await audit('route_to_hod', ctx, input.target_role, false, 'cross_property_forbidden');
    return { ok: false, error: 'cross_property_forbidden' };
  }

  // 5. Success — caller is responsible for actually invoking the target agent
  //    (typically: another /api/cockpit/chat-v2 call with role=target.role
  //    and hop_count+=1).
  await audit('route_to_hod', ctx, input.target_role, true, input.reason ?? input.framing ?? '');
  return {
    ok: true,
    target_role: target.role as string,
    target_display: (target.display_name ?? target.role) as string,
    hop_count: ctx.hop_count + 1,
  };
}

/**
 * request_peer_consult — ask peer for a one-shot opinion. Conversation
 * STAYS with the original agent. Caller should append the peer's answer as
 * a quoted block in the original agent's next message. Counts as a hop.
 */
export async function request_peer_consult(
  input: { peer_role: string; question: string },
  ctx: HandoffContext,
): Promise<HandoffResult & { question?: string }> {
  if (input.peer_role === ctx.agent_role) {
    await audit('request_peer_consult', ctx, input.peer_role, false, 'self_route');
    return { ok: false, error: 'self_route' };
  }

  if (ctx.hop_count >= MAX_HOPS) {
    await audit('request_peer_consult', ctx, input.peer_role, false, 'hop_limit_exceeded');
    return { ok: false, error: 'hop_limit_exceeded' };
  }

  const peer = await lookupTarget(input.peer_role);
  if (!peer) {
    await audit('request_peer_consult', ctx, input.peer_role, false, 'unknown_target');
    return { ok: false, error: 'unknown_target' };
  }
  if (peer.property_id !== null && ctx.property_id !== null && peer.property_id !== ctx.property_id) {
    await audit('request_peer_consult', ctx, input.peer_role, false, 'cross_property_forbidden');
    return { ok: false, error: 'cross_property_forbidden' };
  }

  await audit('request_peer_consult', ctx, input.peer_role, true, input.question.slice(0, 200));
  return {
    ok: true,
    target_role: peer.role as string,
    target_display: (peer.display_name ?? peer.role) as string,
    hop_count: ctx.hop_count + 1,
    question: input.question,
  };
}
