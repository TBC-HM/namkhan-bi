-- Cockpit knowledge base + cost tracking on audit log.
-- Purpose: persistent learnings the team carries between tickets +
--          per-run cost capture (tokens in/out, USD-milli, duration).
-- Method:  cockpit_knowledge_base table (versioned via active flag,
--          scoped global/role/arm) + new columns on cockpit_audit_log.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_knowledge_base_and_cost_tracking).

CREATE TABLE IF NOT EXISTS public.cockpit_knowledge_base (
  id            BIGSERIAL PRIMARY KEY,
  topic         TEXT NOT NULL,
  key_fact      TEXT NOT NULL,
  scope         TEXT NOT NULL DEFAULT 'global',
  source        TEXT NOT NULL DEFAULT 'manual',
  source_ticket_id BIGINT REFERENCES public.cockpit_tickets(id) ON DELETE SET NULL,
  confidence    TEXT NOT NULL DEFAULT 'medium',
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kb_topic
  ON public.cockpit_knowledge_base USING gin (to_tsvector('english', topic || ' ' || key_fact));
CREATE INDEX IF NOT EXISTS idx_kb_scope_active
  ON public.cockpit_knowledge_base (scope, active) WHERE active=true;
ALTER TABLE public.cockpit_knowledge_base ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cockpit_audit_log
  ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
  ADD COLUMN IF NOT EXISTS cost_usd_milli INTEGER,
  ADD COLUMN IF NOT EXISTS tool_trace JSONB,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

COMMENT ON TABLE public.cockpit_knowledge_base IS
  'Persistent facts the team carries between tickets. Read by agents via the read_knowledge_base skill. Written by agents (it_manager, lead, researcher, documentarian, security) via add_knowledge_base_entry.';
