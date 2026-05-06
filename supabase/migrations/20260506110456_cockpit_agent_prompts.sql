-- Cockpit agent prompts (versioned system prompts for the IT manager + workers).
-- Purpose: store every agent's system prompt as data so refinements can land
--          via /cockpit chat (meta-mode) without code edits or deploys.
-- Method:  versioned rows with active flag; partial unique index ensures only
--          one active version per role. Prior versions kept for audit.
-- Note:    Initial seed populates 8 roles (it_manager + 7 worker roles).
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_agent_prompts).

CREATE TABLE IF NOT EXISTS public.cockpit_agent_prompts (
  id          BIGSERIAL PRIMARY KEY,
  role        TEXT NOT NULL,
  prompt      TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  notes       TEXT,
  source      TEXT NOT NULL DEFAULT 'seed',
  ticket_id   BIGINT REFERENCES public.cockpit_tickets(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cockpit_agent_prompts_role_active
  ON public.cockpit_agent_prompts (role) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cockpit_agent_prompts_role_version
  ON public.cockpit_agent_prompts (role, version DESC);

ALTER TABLE public.cockpit_agent_prompts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cockpit_agent_prompts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_cockpit_agent_prompts_updated_at ON public.cockpit_agent_prompts;
CREATE TRIGGER trg_cockpit_agent_prompts_updated_at
  BEFORE UPDATE ON public.cockpit_agent_prompts
  FOR EACH ROW EXECUTE FUNCTION public.cockpit_agent_prompts_set_updated_at();

COMMENT ON TABLE public.cockpit_agent_prompts IS
  'Versioned system prompts for the cockpit IT Manager + worker roles. Read at request time by the chat route + agent worker. Updates land via meta-mode in /cockpit chat → user approves → new row inserted, prior active flipped to false.';
