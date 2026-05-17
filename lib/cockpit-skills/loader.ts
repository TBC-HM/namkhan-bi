// lib/cockpit-skills/loader.ts
// 2026-05-13 — Bridge between cockpit.cap_skills (DB-defined skill registry,
// 67 active skills) and the Anthropic chat tool_use lifecycle.
//
// Audit finding (2026-05-13): `app/api/cockpit/chat/route.ts` was calling
// Anthropic with no `tools=[...]` in chat-mode, so every persona prompt
// telling Felix/Intel/etc. to "use query_supabase_view" was dead code — the
// LLM had nothing to invoke. This loader closes that gap by reading the
// per-role skill grants from `cockpit.cap_agent_skills` and shaping them as
// Anthropic tool definitions.
//
// All reads are SERVER-SIDE only (service-role Supabase client). The result
// is memoised per role within a single request via a tiny LRU.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AnthropicToolDef = {
  /** Anthropic tool name (also the cap_skills.name). */
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type LoadedSkill = AnthropicToolDef & {
  /** Internal — used by the dispatcher to look up the handler + audit row. */
  skill_id: number;
  handler: string;
  implementation_type: 'ts_handler' | 'sql_function' | string;
  /** Pulled from cap_skills.estimated_cost_usd_milli — used by the budget gate. */
  estimated_cost_usd_milli: number;
  requires_pbs_approval: boolean;
  authority_level: string;
};

type LoaderRow = {
  enabled: boolean;
  cap_skills:
    | {
        id: number;
        name: string;
        description: string;
        input_schema: Record<string, unknown> | null;
        handler: string;
        implementation_type: string | null;
        estimated_cost_usd_milli: number | null;
        requires_pbs_approval: boolean;
        authority_level: string | null;
        active: boolean;
        archived_at: string | null;
      }
    | Array<{
        id: number;
        name: string;
        description: string;
        input_schema: Record<string, unknown> | null;
        handler: string;
        implementation_type: string | null;
        estimated_cost_usd_milli: number | null;
        requires_pbs_approval: boolean;
        authority_level: string | null;
        active: boolean;
        archived_at: string | null;
      }>;
};

// Per-request micro-cache (process-local; fresh module per cold start).
// Keyed by role; expires after CACHE_TTL_MS so long-running serverless workers
// don't serve stale skill rosters after a skill is toggled in the DB.
const CACHE = new Map<string, { at: number; skills: LoadedSkill[] }>();
const CACHE_TTL_MS = 15_000;

function client(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('cockpit-skills/loader: SUPABASE env missing');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Ensure the JSON Schema we pass to Anthropic is well-formed. Anthropic
 * requires `type: "object"` with `properties` and (optionally) `required`.
 * Skills that were authored with looser shapes get wrapped here so the API
 * call doesn't 400.
 */
function normaliseInputSchema(raw: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    return { type: 'object', properties: {}, required: [] };
  }
  if (raw.type === 'object' && raw.properties && typeof raw.properties === 'object') {
    // Already in Anthropic shape.
    return raw;
  }
  // Fallback: wrap whatever we got under `properties` (best-effort).
  return {
    type: 'object',
    properties: raw,
    required: Array.isArray((raw as { required?: unknown }).required)
      ? ((raw as { required: string[] }).required)
      : [],
  };
}

/**
 * Load every active skill granted to `role`, shaped as Anthropic tool defs.
 *
 * Reads from `public.cockpit_agent_skills` + `public.cockpit_agent_role_skills`
 * — the supabase-js client cannot select() into the `cockpit` schema without
 * additional setup, and these public views already join through to the
 * canonical `cockpit.cap_*` tables (verified 2026-05-13 via pg_class).
 *
 * Skills are filtered to: enabled=true AND active=true AND archived_at IS NULL.
 */
export async function loadAgentSkills(role: string): Promise<LoadedSkill[]> {
  if (!role || typeof role !== 'string') return [];
  const now = Date.now();
  const cached = CACHE.get(role);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.skills;
  }

  const supa = client();
  // `cockpit_agent_role_skills` joins to `cockpit_agent_skills` (both views
  // over cockpit.cap_* tables). PostgREST relationship name = the target view.
  const { data, error } = await supa
    .from('cockpit_agent_role_skills')
    .select(
      'enabled, cap_skills:cockpit_agent_skills!inner(id, name, description, input_schema, handler, implementation_type, estimated_cost_usd_milli, requires_pbs_approval, authority_level, active, archived_at)',
    )
    .eq('role', role)
    .eq('enabled', true);

  if (error) {
    console.error(`[cockpit-skills/loader] load failed for role=${role}: ${error.message}`);
    return [];
  }

  const skills: LoadedSkill[] = ((data ?? []) as LoaderRow[])
    .map((row) => {
      const s = Array.isArray(row.cap_skills) ? row.cap_skills[0] : row.cap_skills;
      if (!s) return null;
      if (!s.active || s.archived_at) return null;
      return {
        skill_id: s.id,
        name: s.name,
        description: s.description,
        input_schema: normaliseInputSchema(s.input_schema),
        handler: s.handler,
        implementation_type: (s.implementation_type ?? 'ts_handler') as LoadedSkill['implementation_type'],
        estimated_cost_usd_milli: s.estimated_cost_usd_milli ?? 0,
        requires_pbs_approval: !!s.requires_pbs_approval,
        authority_level: s.authority_level ?? 'l1_read',
      } as LoadedSkill;
    })
    .filter((s): s is LoadedSkill => s !== null);

  CACHE.set(role, { at: now, skills });
  return skills;
}

/** Strip dispatcher-only fields so the array can be passed directly to Anthropic. */
export function toAnthropicTools(skills: LoadedSkill[]): AnthropicToolDef[] {
  return skills.map((s) => ({
    name: s.name,
    description: s.description,
    input_schema: s.input_schema,
  }));
}

/** Look up a single skill by name within a role's roster (used by dispatcher). */
export function findSkill(skills: LoadedSkill[], name: string): LoadedSkill | undefined {
  return skills.find((s) => s.name === name);
}
