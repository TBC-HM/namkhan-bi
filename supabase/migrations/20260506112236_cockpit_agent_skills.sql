-- Cockpit agent skills (tool definitions + role assignments).
-- Purpose: agents call these as Anthropic tools during a worker run. Each
--          row has a JSON schema for input + a server-side handler name
--          dispatched in lib/cockpit-tools.ts.
-- Method:  two tables: cockpit_agent_skills (catalog) + cockpit_agent_role_skills
--          (many-to-many enabled flag). Skills flow to Anthropic Messages API
--          tools array, dispatcher handles tool_use blocks.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_agent_skills).

CREATE TABLE IF NOT EXISTS public.cockpit_agent_skills (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  input_schema JSONB NOT NULL,
  handler      TEXT NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cockpit_agent_role_skills (
  role       TEXT NOT NULL,
  skill_id   BIGINT NOT NULL REFERENCES public.cockpit_agent_skills(id) ON DELETE CASCADE,
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role, skill_id)
);

ALTER TABLE public.cockpit_agent_skills      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cockpit_agent_role_skills ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cockpit_agent_skills_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cockpit_agent_skills_updated_at ON public.cockpit_agent_skills;
CREATE TRIGGER trg_cockpit_agent_skills_updated_at
  BEFORE UPDATE ON public.cockpit_agent_skills
  FOR EACH ROW EXECUTE FUNCTION public.cockpit_agent_skills_set_updated_at();

-- Initial 4 read-only skills (further skills added in later migrations).
INSERT INTO public.cockpit_agent_skills (name, description, input_schema, handler, notes) VALUES
('query_supabase_view',
 'Read up to 100 rows from an allowlisted public view. Returns JSON rows.',
 '{"type":"object","properties":{"view_name":{"type":"string"},"limit":{"type":"integer","default":50,"maximum":100},"filter_column":{"type":"string"},"filter_value":{"type":"string"},"order_by":{"type":"string"}},"required":["view_name"]}'::jsonb,
 'query_supabase_view',
 'Read-only. Allowlist enforced server-side.'),
('read_audit_log',
 'Read recent rows of cockpit_audit_log, optionally filtered by agent or action.',
 '{"type":"object","properties":{"limit":{"type":"integer","default":10,"maximum":50},"agent":{"type":"string"},"action":{"type":"string"}}}'::jsonb,
 'read_audit_log',
 null),
('read_design_doc',
 'Fetch a section of DESIGN_NAMKHAN_BI.md by heading.',
 '{"type":"object","properties":{"section":{"type":"string"}},"required":["section"]}'::jsonb,
 'read_design_doc',
 null),
('list_recent_tickets',
 'List recent cockpit_tickets with status, arm, summary.',
 '{"type":"object","properties":{"limit":{"type":"integer","default":10,"maximum":50},"status":{"type":"string"},"arm":{"type":"string"}}}'::jsonb,
 'list_recent_tickets',
 null);
