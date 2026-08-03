// lib/chat/conversation-store.ts
// central-chat-v1 · V5 conversation store WIRING (round 5, §0.G2 objection).
//
// The store DDL (cockpit.conversations + cockpit.messages + public.v_chat_*
// bridge views) was PBS-approved and applied 2026-07-30 (migration
// 20260730152424) but sat empty — /api/cockpit/chat persisted only via the
// legacy cockpit_tickets thread. This module is the write path.
//
// Design (per db/proposed/build-central-chat/001_cockpit_conversations.sql):
//   • one conversation row per thread; property/mode/module_scope-scoped
//   • one messages row per turn with per-message metering
//     (provider/model/tier/tokens/latency/cost — ADR-169 cost-to-serve)
//   • legacy_ticket_ids collects the cockpit_tickets rows that carried the
//     same turns during the v1→v2 migration window (dual-write)
//   • reads go through public.v_chat_conversations / v_chat_messages
//     (PostgREST bridge law §5); writes go through this server-side module
//     with the service role ('cockpit' is in pgrst.db_schemas)
//
// Failure posture: the ticket thread remains the rendering path in v1, so
// every function here is non-throwing — a store failure logs a warning and
// the chat turn proceeds. No user-facing dependency until the UI reads from
// the store.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://build-placeholder.supabase.co",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "build-placeholder-key",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

export type ChatMode = "second-brain" | "general";

export interface EnsureConversationArgs {
  /** Client-provided id to continue an existing conversation (uuid). */
  conversationId?: string | null;
  mode: ChatMode;
  moduleScope?: string | null;
  propertyId?: number | null;
  /** First user message — used to derive the title on insert. */
  firstMessage: string;
}

/**
 * Resolve the conversation row for this turn: reuse the client-provided id
 * when it exists AND matches the request's mode (scopes never mix — a
 * conversation_id replayed across a mode switch gets a fresh row), else
 * insert a new conversation. Returns null on store failure (chat proceeds
 * on the ticket thread).
 */
export async function ensureConversation(args: EnsureConversationArgs): Promise<string | null> {
  try {
    const sb = admin().schema("cockpit");
    const wanted = (args.conversationId ?? "").trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(wanted)) {
      const { data } = await sb
        .from("conversations")
        .select("id, mode")
        .eq("id", wanted)
        .maybeSingle();
      if (data?.id && data.mode === args.mode) return data.id as string;
    }
    const title = args.firstMessage.replace(/^@[a-z][a-z0-9_]*\s*/i, "").slice(0, 120).trim() || "(untitled)";
    const { data, error } = await sb
      .from("conversations")
      .insert({
        mode: args.mode,
        module_scope: args.moduleScope?.trim() || null,
        property_id: args.propertyId ?? null,
        title,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("[conversation-store] insert conversation failed:", error.message);
      return null;
    }
    return (data?.id as string) ?? null;
  } catch (e) {
    console.warn("[conversation-store] ensureConversation failed:", e);
    return null;
  }
}

/** Persist the user turn. Non-throwing; awaited so the row exists before the LLM loop (V9 posture). */
export async function recordUserMessage(conversationId: string | null, content: string): Promise<void> {
  if (!conversationId) return;
  try {
    const { error } = await admin().schema("cockpit").from("messages").insert({
      conversation_id: conversationId,
      turn_role: "user",
      content_md: content,
    });
    if (error) console.warn("[conversation-store] user message insert failed:", error.message);
  } catch (e) {
    console.warn("[conversation-store] recordUserMessage failed:", e);
  }
}

export interface AssistantMessageArgs {
  conversationId: string | null;
  content: string;
  /** cockpit.id_agents role of the answering persona; 'lead' = Felix. Null in general mode. */
  agentRole?: string | null;
  provider: string;
  modelId: string;
  modelTier: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs?: number | null;
  /** USD (not milli-USD) — column is numeric(10,6). */
  costUsd: number;
  /** Tool/skill call trail for the turn (doc: Tool Calls). */
  toolCalls?: Array<{ skill: string; status: string; ms: number }>;
  /** cockpit_tickets row that carried this turn on the legacy thread (dual-write window). */
  legacyTicketId?: number | null;
}

/**
 * Persist the assistant turn + bump the conversation (last_turn_at,
 * legacy_ticket_ids). Round-6 hardening (§0.V6 finding 2): the insert is
 * retried once, and a final failure writes a cockpit_audit_log row
 * (action=chat_store_persist_failed) so a dropped persist is never silent.
 * Callers must AWAIT this (a `void` call on a serverless runtime can be
 * frozen mid-flight after the response returns — the 2026-08-02 22:53 UTC
 * dropped turn). Still non-throwing: a store failure never breaks the reply.
 */
export async function recordAssistantMessage(args: AssistantMessageArgs): Promise<void> {
  if (!args.conversationId) return;
  try {
    const sb = admin().schema("cockpit");
    const row = {
      conversation_id: args.conversationId,
      turn_role: "assistant",
      agent_role: args.agentRole ?? null,
      content_md: args.content,
      tool_calls: args.toolCalls ?? [],
      provider: args.provider,
      model_id: args.modelId,
      model_tier: args.modelTier,
      input_tokens: args.inputTokens,
      output_tokens: args.outputTokens,
      latency_ms: args.latencyMs ?? null,
      cost_usd: Math.round(args.costUsd * 1e6) / 1e6,
    };
    let { error } = await sb.from("messages").insert(row);
    if (error) {
      console.warn("[conversation-store] assistant insert failed, retrying once:", error.message);
      ({ error } = await sb.from("messages").insert(row));
    }
    if (error) {
      console.warn("[conversation-store] assistant message insert failed after retry:", error.message);
      // Loud trail: audit row so the drop is visible (never silent again).
      const { error: auditErr } = await admin().from("cockpit_audit_log").insert({
        agent: args.agentRole ?? "central-chat",
        action: "chat_store_persist_failed",
        target: `conversation:${args.conversationId}`,
        success: false,
        metadata: {
          conversation_id: args.conversationId,
          legacy_ticket_id: args.legacyTicketId ?? null,
          model_id: args.modelId,
          model_tier: args.modelTier,
          error: error.message,
          content_chars: args.content.length,
        },
        reasoning: "conversation-store: assistant message insert failed twice; turn exists in audit/ticket trail but not in cockpit.messages",
      });
      if (auditErr) console.warn("[conversation-store] persist-failure audit row failed too:", auditErr.message);
    }

    // Bump the conversation. Read-modify-write on legacy_ticket_ids is fine
    // at v1 concurrency (one owner, one turn in flight per thread).
    const patch: Record<string, unknown> = { last_turn_at: new Date().toISOString() };
    if (args.legacyTicketId) {
      const { data: conv } = await sb
        .from("conversations")
        .select("legacy_ticket_ids")
        .eq("id", args.conversationId)
        .maybeSingle();
      const existing: number[] = Array.isArray(conv?.legacy_ticket_ids) ? conv.legacy_ticket_ids : [];
      if (!existing.includes(args.legacyTicketId)) {
        patch.legacy_ticket_ids = [...existing, args.legacyTicketId];
      }
    }
    const { error: upErr } = await sb.from("conversations").update(patch).eq("id", args.conversationId);
    if (upErr) console.warn("[conversation-store] conversation bump failed:", upErr.message);
  } catch (e) {
    console.warn("[conversation-store] recordAssistantMessage failed:", e);
  }
}

// ── Read path (public.v_* bridge views, served to the authorized route) ────

export async function listConversations(filter: {
  mode?: string | null;
  moduleScope?: string | null;
  propertyId?: number | null;
  limit?: number;
}): Promise<unknown[]> {
  try {
    let q = admin()
      .from("v_chat_conversations")
      .select("id, property_id, mode, module_scope, title, summary_md, status, started_at, last_turn_at")
      .eq("status", "active")
      .order("last_turn_at", { ascending: false })
      .limit(Math.min(filter.limit ?? 30, 100));
    if (filter.mode) q = q.eq("mode", filter.mode);
    if (filter.moduleScope) q = q.eq("module_scope", filter.moduleScope);
    if (filter.propertyId != null) q = q.eq("property_id", filter.propertyId);
    const { data, error } = await q;
    if (error) {
      console.warn("[conversation-store] listConversations failed:", error.message);
      return [];
    }
    return data ?? [];
  } catch (e) {
    console.warn("[conversation-store] listConversations failed:", e);
    return [];
  }
}

export async function readConversation(conversationId: string): Promise<{ conversation: unknown; messages: unknown[] } | null> {
  try {
    const sb = admin();
    const [{ data: conv, error: cErr }, { data: msgs, error: mErr }] = await Promise.all([
      sb.from("v_chat_conversations").select("*").eq("id", conversationId).maybeSingle(),
      sb
        .from("v_chat_messages")
        .select("id, turn_role, agent_role, content_md, tool_calls, provider, model_id, model_tier, input_tokens, output_tokens, latency_ms, cost_usd, created_at")
        .eq("conversation_id", conversationId)
        .order("id", { ascending: true })
        .limit(500),
    ]);
    if (cErr || !conv) {
      if (cErr) console.warn("[conversation-store] readConversation failed:", cErr.message);
      return null;
    }
    if (mErr) console.warn("[conversation-store] readConversation messages failed:", mErr.message);
    return { conversation: conv, messages: msgs ?? [] };
  } catch (e) {
    console.warn("[conversation-store] readConversation failed:", e);
    return null;
  }
}
