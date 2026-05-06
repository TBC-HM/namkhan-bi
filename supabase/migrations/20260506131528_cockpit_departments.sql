-- Cockpit departments + agent_prompts.department column.
-- Purpose: enable Captain Kit to spawn entire new departments (Marketing,
--          Sales, Revenue, etc.) via the create_department skill. Each
--          department has a chief role + workers + shared skills.
-- Method:  cockpit_departments table (slug-keyed) + new department column
--          on cockpit_agent_prompts (default 'it'). Existing 13 agents
--          all live in dept 'it'.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_departments).

CREATE TABLE IF NOT EXISTS public.cockpit_departments (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  chief_role  TEXT NOT NULL,
  description TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_from_ticket_id BIGINT REFERENCES public.cockpit_tickets(id) ON DELETE SET NULL
);

ALTER TABLE public.cockpit_departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.cockpit_agent_prompts
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'it';

INSERT INTO public.cockpit_departments (slug, name, chief_role, description, active) VALUES
('it', 'IT Department', 'it_manager',
 'Builds, fixes, and maintains the Namkhan BI app. Owns deploys, incidents, schema, code review, design system.',
 true)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_agent_prompts_dept_active
  ON public.cockpit_agent_prompts(department, active) WHERE active=true;
