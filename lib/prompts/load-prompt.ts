// lib/prompts/load-prompt.ts
// Server-side helper: load the current system prompt for an agent from
// governance.agent_prompts. Source of truth — no hardcoded fallback.
//
// 2026-05-12 PROMPT 2: Felix runtime speed. Replaces the hardcoded
// `personaMap` previously inlined in /api/cockpit/chat/route.ts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// supabase-js generated types only know `public`. We need to query `cockpit`
// and `governance` schemas, so widen the client type to allow any schema arg.
type LooseClient = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface AgentPrompt {
  agent_id: string;
  role: string;
  display_name: string | null;
  system_prompt: string;
  model_id: string;
  temperature: number | null;
  max_tokens: number | null;
  tools_enabled: string[];
  property_id: number | null;
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

/**
 * Look up the agent by role (e.g. 'lead', 'revenue_hod') and return its
 * current prompt + model config. Throws if no row found — caller decides
 * whether to return 500 or fall back.
 */
export async function loadPromptByRole(role: string, propertyId?: number): Promise<AgentPrompt> {
  const supa = client();

  // 1. Resolve role → agent_id
  const { data: agent, error: agentErr } = await supa
    .schema('cockpit')
    .from('id_agents')
    .select('agent_id, role, display_name')
    .eq('role', role)
    .maybeSingle();

  if (agentErr) throw new Error(`load_prompt: id_agents query failed: ${agentErr.message}`);
  if (!agent) throw new Error(`load_prompt: no agent with role=${role}`);

  // 2. Fetch current prompt — prefer property-scoped row if propertyId given
  let q = supa
    .schema('governance')
    .from('agent_prompts')
    .select('system_prompt, model_id, temperature, max_tokens, tools_enabled, property_id')
    .eq('agent_id', agent.agent_id)
    .eq('is_current', true);

  if (propertyId !== undefined) {
    q = q.or(`property_id.eq.${propertyId},property_id.is.null`);
  }

  const { data: prompts, error: promptErr } = await q;
  if (promptErr) throw new Error(`load_prompt: agent_prompts query failed: ${promptErr.message}`);
  if (!prompts || prompts.length === 0) {
    throw new Error(`load_prompt: no current prompt for role=${role}`);
  }

  // Prefer property-scoped row over holding-scope (null) when both present
  const chosen = prompts.find((p) => p.property_id === propertyId) ?? prompts[0];

  return {
    agent_id: agent.agent_id as string,
    role: agent.role as string,
    display_name: (agent.display_name ?? null) as string | null,
    system_prompt: chosen.system_prompt as string,
    model_id: chosen.model_id as string,
    temperature: (chosen.temperature ?? null) as number | null,
    max_tokens: (chosen.max_tokens ?? null) as number | null,
    tools_enabled: ((chosen.tools_enabled ?? []) as string[]),
    property_id: (chosen.property_id ?? null) as number | null,
  };
}
