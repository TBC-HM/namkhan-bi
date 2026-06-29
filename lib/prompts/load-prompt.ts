// lib/prompts/load-prompt.ts
// Server-side helper: load the current system prompt for an agent.
//
// PBS 2026-06-29: rewired to call public.fn_load_prompt_by_role (SECURITY
// DEFINER) so the lookup works without exposing cockpit/governance schemas
// via PostgREST. Per claude_md §0.5: PostgREST exposes ONLY public.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type LooseClient = SupabaseClient<any, any, any>;

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

export async function loadPromptByRole(role: string, propertyId?: number): Promise<AgentPrompt> {
  const supa = client();
  const { data, error } = await supa.rpc('fn_load_prompt_by_role', {
    p_role: role,
    p_property_id: propertyId ?? null,
  });
  if (error) throw new Error(`load_prompt: rpc failed: ${error.message}`);
  if (!data) throw new Error(`load_prompt: no prompt for role=${role}`);
  const row = data as any;
  return {
    agent_id: row.agent_id as string,
    role: row.role as string,
    display_name: (row.display_name ?? null) as string | null,
    system_prompt: row.system_prompt as string,
    model_id: row.model_id as string,
    temperature: (row.temperature ?? null) as number | null,
    max_tokens: (row.max_tokens ?? null) as number | null,
    tools_enabled: ((row.tools_enabled ?? []) as string[]),
    property_id: (row.property_id ?? null) as number | null,
  };
}
