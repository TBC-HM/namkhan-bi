// lib/agent-tools/handlers/dataAccess.ts
// Read-only tool handlers Felix + HoDs use to look at the actual data.
// All use the service-role Supabase client — RLS bypass is fine here
// because the dashboard itself is password-gated and these tools are
// only invoked from inside a Felix conversation.
//
// 2026-05-13 PBS: first pass — wire query_supabase_view + read_knowledge_base
// + list_recent_tickets. Other tools in lib/agent-tools/registry.ts still
// return tool_not_implemented until they get a handler here.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type LooseClient = SupabaseClient<any, any, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

let _client: LooseClient | null = null;
function client(): LooseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('supabase env missing for tool dispatch');
  _client = createClient(url, key, { auth: { persistSession: false } }) as LooseClient;
  return _client;
}

// ─── query_supabase_view ──────────────────────────────────────────────────
// Whitelist guards what the model can read. Anything outside this list
// returns view_not_allowed. Each entry maps a logical name → (schema, view).
// Keep this list narrow — the model has plenty of dashboard surface area
// already; this is for ad-hoc lookups inside a conversation.

const VIEW_WHITELIST: Record<string, { schema: string; view: string; defaultLimit: number }> = {
  // Revenue
  mv_kpi_daily:              { schema: 'public', view: 'mv_kpi_daily',              defaultLimit: 30 },
  mv_classified_transactions:{ schema: 'public', view: 'mv_classified_transactions',defaultLimit: 50 },
  mv_channel_perf:           { schema: 'public', view: 'mv_channel_perf',           defaultLimit: 30 },
  mv_rate_inventory_calendar:{ schema: 'public', view: 'mv_rate_inventory_calendar',defaultLimit: 30 },
  mv_pace_otb:               { schema: 'public', view: 'mv_pace_otb',               defaultLimit: 30 },
  mv_aged_ar:                { schema: 'public', view: 'mv_aged_ar',                defaultLimit: 30 },
  v_kpi_daily:               { schema: 'public', view: 'v_kpi_daily',               defaultLimit: 30 },

  // Finance (gl wrappers, anon-readable after this session's migrations)
  pl_section_monthly:        { schema: 'gl',     view: 'pl_section_monthly',        defaultLimit: 30 },
  v_usali_house_summary:     { schema: 'gl',     view: 'v_usali_house_summary',     defaultLimit: 30 },
  v_usali_dept_summary:      { schema: 'gl',     view: 'v_usali_dept_summary',      defaultLimit: 50 },
  mv_usali_pl_monthly:       { schema: 'gl',     view: 'mv_usali_pl_monthly',       defaultLimit: 50 },
  v_budget_lines:            { schema: 'gl',     view: 'v_budget_lines',            defaultLimit: 50 },
  v_ly_lines:                { schema: 'gl',     view: 'v_ly_lines',                defaultLimit: 50 },
  v_forecast_lines:          { schema: 'gl',     view: 'v_forecast_lines',          defaultLimit: 50 },
  v_scenario_stack:          { schema: 'gl',     view: 'v_scenario_stack',          defaultLimit: 50 },
  v_cash_forecast_13w:       { schema: 'gl',     view: 'v_cash_forecast_13w',       defaultLimit: 13 },
  v_drivers_stack:           { schema: 'gl',     view: 'v_drivers_stack',           defaultLimit: 30 },
  v_freshness_summary:       { schema: 'gl',     view: 'v_freshness_summary',       defaultLimit: 1  },
  v_dq_summary:              { schema: 'gl',     view: 'v_dq_summary',              defaultLimit: 1  },

  // Ops
  v_supplier_overview:       { schema: 'gl',     view: 'v_supplier_overview',       defaultLimit: 30 },
  v_payroll_summary:         { schema: 'gl',     view: 'v_payroll_summary',         defaultLimit: 12 },
  v_payroll_dept_monthly:    { schema: 'ops',    view: 'v_payroll_dept_monthly',    defaultLimit: 30 },
  v_staff_register_extended: { schema: 'public', view: 'v_staff_register_extended', defaultLimit: 50 },

  // Governance
  v_stuck_runs:              { schema: 'governance', view: 'v_stuck_runs',          defaultLimit: 20 },
  dq_v_alerts_active:        { schema: 'governance', view: 'dq_v_alerts_active',    defaultLimit: 30 },
};

export async function query_supabase_view(
  input: { view: string; filters?: Record<string, string | number | boolean>; limit?: number },
): Promise<unknown> {
  const cfg = VIEW_WHITELIST[input.view];
  if (!cfg) {
    return {
      ok: false,
      error: 'view_not_allowed',
      allowed: Object.keys(VIEW_WHITELIST).sort(),
      requested: input.view,
    };
  }

  const limit = Math.min(Math.max(input.limit ?? cfg.defaultLimit, 1), 100);
  let q = client().schema(cfg.schema).from(cfg.view).select('*').limit(limit);

  // Apply simple equality filters. PostgREST-style operators (gt., lte.) are
  // honored via .filter(); plain values use .eq(). Keep narrow — we don't
  // want a model crafting unbounded scans.
  if (input.filters) {
    for (const [k, v] of Object.entries(input.filters)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && /^(gt|gte|lt|lte|like|ilike|neq)\./.test(v)) {
        const [op, val] = v.split(/\.(.+)/);
        q = q.filter(k, op, val);
      } else {
        q = q.eq(k, v);
      }
    }
  }

  const { data, error } = await q;
  if (error) return { ok: false, error: 'query_failed', detail: error.message };
  return {
    ok: true,
    view: `${cfg.schema}.${cfg.view}`,
    row_count: (data ?? []).length,
    rows: data ?? [],
  };
}

// ─── read_knowledge_base ──────────────────────────────────────────────────
// Lookup curated KB entries by topic match (substring on `topics` array OR
// content). Returns top N by importance × confidence × recency tie-break.

export async function read_knowledge_base(
  input: { topic: string; limit?: number },
): Promise<unknown> {
  if (!input.topic || !input.topic.trim()) {
    return { ok: false, error: 'topic_required' };
  }
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
  const supa = client();
  const topic = input.topic.trim();

  // Topics is text[]. Use .contains() for exact match, otherwise fall back
  // to content ilike. Try contains first for precision.
  const { data: byTopic, error: topicErr } = await supa
    .schema('cockpit')
    .from('kn_agent_memory')
    .select('id, memory_type, content, topics, importance, confidence, created_at, agent_handle')
    .contains('topics', [topic])
    .eq('active', true)
    .order('importance', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (topicErr) return { ok: false, error: 'kb_query_failed', detail: topicErr.message };

  let rows = byTopic ?? [];
  if (rows.length === 0) {
    // Fallback: content ilike match
    const { data: byContent, error: contentErr } = await supa
      .schema('cockpit')
      .from('kn_agent_memory')
      .select('id, memory_type, content, topics, importance, confidence, created_at, agent_handle')
      .ilike('content', `%${topic}%`)
      .eq('active', true)
      .order('importance', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (contentErr) return { ok: false, error: 'kb_query_failed', detail: contentErr.message };
    rows = byContent ?? [];
  }

  return {
    ok: true,
    topic,
    row_count: rows.length,
    entries: rows,
  };
}

// ─── list_recent_tickets ──────────────────────────────────────────────────
// Surface the latest cockpit_tickets so an agent can answer "what's open".

export async function list_recent_tickets(
  input: { limit?: number },
): Promise<unknown> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const supa = client();
  const { data, error } = await supa
    .from('cockpit_tickets')
    .select('id, title, status, priority, created_at, updated_at, dept, author')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: 'query_failed', detail: error.message };
  return { ok: true, row_count: (data ?? []).length, tickets: data ?? [] };
}
