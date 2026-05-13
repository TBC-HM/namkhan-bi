// lib/agent-tools/registry.ts
// Prompt 3 (agent-chat-spawn) — central map: skill name → handler.
//
// The model receives a subset of these as `tools` in the Anthropic call,
// where the subset = `governance.agent_prompts.tools_enabled` for that
// agent. Unknown names are skipped with a console warning (do NOT throw —
// agent rosters drift faster than handler scaffolds).
//
// 2026-05-12 — this is a SCAFFOLD. Real handlers live elsewhere (lib/cockpit-tools.ts,
// app/api/cockpit/skills/*). For now we just expose the JSONSchema metadata so
// the model knows the tool contract; tool_use blocks are caught and replied
// to with a structured `tool_not_implemented` result. Implementing each
// handler is per-skill work tracked separately.

import { route_to_hod, request_peer_consult, type HandoffContext, MAX_HOPS } from './handlers/handoff';
import { query_supabase_view, read_knowledge_base, list_recent_tickets } from './handlers/dataAccess';

// Inline Tool / InputSchema shapes — we hit Anthropic via raw fetch, not the
// SDK, so the type doesn't need to come from @anthropic-ai/sdk.
export interface AnthropicInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicInputSchema;
}

export interface ToolDispatchCtx {
  propertyId?: number;
  role: string;
  /** Live hop counter — chat-v2 increments this when it recurses. */
  hopCount?: number;
  /** The original user message that started the current dispatch chain. */
  userMessage?: string;
  /** Conversation UUID for audit-trail correlation, optional. */
  conversationId?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: AnthropicInputSchema;
  /** Optional handler. If absent, tool calls return tool_not_implemented. */
  handler?: (input: Record<string, unknown>, ctx: ToolDispatchCtx) => Promise<unknown>;
}

const REG: Record<string, ToolSpec> = {
  // ─── Read-only reference & data ─────────────────────────────────────────
  query_supabase_view: {
    name: 'query_supabase_view',
    description: 'Run a read-only SELECT against a whitelisted Supabase view. Filters use PostgREST operators (gt./gte./lt./lte./like./ilike./neq.) or plain equality. Returns at most 100 rows.',
    input_schema: {
      type: 'object',
      properties: {
        view: { type: 'string', description: 'View name (must be in the allowed list — try query_supabase_view with view="_help" or a wrong name to see options)' },
        filters: { type: 'object', description: 'PostgREST-style filter object (e.g. { property_id: 260955, night_date: "gte.2026-04-01" })' },
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['view'],
    },
    handler: async (input) => query_supabase_view(input as { view: string; filters?: Record<string, string | number | boolean>; limit?: number }),
  },
  read_knowledge_base: {
    name: 'read_knowledge_base',
    description: 'Look up curated KB entries by topic. Returns top entries (max 20) sorted by importance × recency.',
    input_schema: {
      type: 'object',
      properties: { topic: { type: 'string' }, limit: { type: 'integer' } },
      required: ['topic'],
    },
    handler: async (input) => read_knowledge_base(input as { topic: string; limit?: number }),
  },
  read_knowledge_base_semantic: {
    name: 'read_knowledge_base_semantic',
    description: 'Semantic search across the KB using embeddings.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer' } },
      required: ['query'],
    },
  },
  read_doc: {
    name: 'read_doc',
    description: 'Read a documentation.documents row by id or title.',
    input_schema: {
      type: 'object',
      properties: { doc_id: { type: 'string' }, title: { type: 'string' } },
    },
  },
  list_recent_tickets: {
    name: 'list_recent_tickets',
    description: 'List the most recent cockpit_tickets (newest first, max 50).',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50 } },
    },
    handler: async (input) => list_recent_tickets(input as { limit?: number }),
  },
  read_audit_log: {
    name: 'read_audit_log',
    description: 'Read recent cockpit_audit_log entries.',
    input_schema: {
      type: 'object',
      properties: { agent: { type: 'string' }, limit: { type: 'integer' } },
    },
  },
  web_search: {
    name: 'web_search',
    description: 'Search the public web. Returns top results with snippets.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' }, limit: { type: 'integer' } },
      required: ['query'],
    },
  },
  web_fetch: {
    name: 'web_fetch',
    description: 'Fetch a public URL and return its main content as text.',
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },

  // ─── Coordination / routing ─────────────────────────────────────────────
  route_to_hod: {
    name: 'route_to_hod',
    description: `Hand the conversation to a department HoD. The target answers the user's original message; you step aside. Max ${MAX_HOPS} hops per user message. Property-scoped agents can only route to agents in the same property or holding-scope agents.`,
    input_schema: {
      type: 'object',
      properties: {
        target_role: { type: 'string', enum: ['revenue_hod','sales_hod','marketing_hod','operations_hod','finance_hod','it_manager'] },
        reason: { type: 'string', description: 'One-sentence reason for the handoff' },
      },
      required: ['target_role', 'reason'],
    },
    handler: async (input, ctx) => {
      const handoffCtx: HandoffContext = {
        agent_role: ctx.role,
        property_id: ctx.propertyId ?? null,
        hop_count: ctx.hopCount ?? 0,
        conversation_id: ctx.conversationId,
        user_message: ctx.userMessage ?? '',
      };
      return route_to_hod(input as { target_role: string; reason?: string }, handoffCtx);
    },
  },
  request_peer_consult: {
    name: 'request_peer_consult',
    description: `Ask a peer agent for a one-shot opinion without handing off the conversation. Peer's answer comes back as a quoted block in your reply. Max ${MAX_HOPS} hops per user message.`,
    input_schema: {
      type: 'object',
      properties: {
        peer_role: { type: 'string' },
        question: { type: 'string' },
      },
      required: ['peer_role', 'question'],
    },
    handler: async (input, ctx) => {
      const handoffCtx: HandoffContext = {
        agent_role: ctx.role,
        property_id: ctx.propertyId ?? null,
        hop_count: ctx.hopCount ?? 0,
        conversation_id: ctx.conversationId,
        user_message: ctx.userMessage ?? '',
      };
      return request_peer_consult(input as { peer_role: string; question: string }, handoffCtx);
    },
  },
  open_pbs_ticket: {
    name: 'open_pbs_ticket',
    description: 'Open an intake ticket addressed to PBS (the human owner). Use sparingly.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        priority: { type: 'string', enum: ['low','normal','high','urgent'] },
      },
      required: ['title', 'body'],
    },
  },
  create_subticket: {
    name: 'create_subticket',
    description: 'Create a child cockpit_ticket linked to the current conversation.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        assignee_role: { type: 'string' },
      },
      required: ['title', 'body'],
    },
  },
  propose_kpi_target: {
    name: 'propose_kpi_target',
    description: 'Propose a target value for a KPI in the catalog. Goes to PBS as a proposal.',
    input_schema: {
      type: 'object',
      properties: {
        kpi_code: { type: 'string' },
        target_value: { type: 'number' },
        rationale: { type: 'string' },
      },
      required: ['kpi_code', 'target_value'],
    },
  },
};

export function getToolSpecs(names: string[] | null | undefined): ToolSpec[] {
  if (!names || names.length === 0) return [];
  return names
    .map((n) => REG[n])
    .filter((spec): spec is ToolSpec => {
      if (!spec) return false;
      return true;
    });
}

/**
 * Convert ToolSpecs to the shape Anthropic's API expects.
 */
export function asAnthropicTools(specs: ToolSpec[]): AnthropicTool[] {
  return specs.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.input_schema,
  }));
}

export function lookup(name: string): ToolSpec | undefined {
  return REG[name];
}
