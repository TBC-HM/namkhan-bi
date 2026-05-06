-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506150852
-- Name:    cockpit_agent_lifecycle_columns
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Cockpit agent lifecycle columns (status / archived_at / archived_reason / can_be_reactivated).
-- Purpose: enable soft-archive of agents per Phase 0 spec; HARD DELETION FORBIDDEN.
-- Method:  add 4 columns to public.cockpit_agent_prompts. Status enum
--          includes 'deleted_PROHIBITED' as a tripwire — it should never
--          be set; if it appears in audit log it indicates a violation.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_agent_lifecycle_columns).

DO $$ BEGIN
  CREATE TYPE public.cockpit_agent_status_enum AS ENUM (
    'active','deprecated','archived','deleted_PROHIBITED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.cockpit_agent_prompts
  ADD COLUMN IF NOT EXISTS status public.cockpit_agent_status_enum NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason TEXT,
  ADD COLUMN IF NOT EXISTS can_be_reactivated BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill existing active rows.
UPDATE public.cockpit_agent_prompts SET status='active' WHERE active=true AND status IS NULL;

-- KB: forbid hard-deletion forever.
INSERT INTO public.cockpit_knowledge_base (topic, key_fact, scope, source, confidence) VALUES
('forbidden actions LOCKED — agent deletion',
 'Hard deletion of agents in cockpit_agent_prompts is FORBIDDEN. All retirements use soft archive (set status=''archived'' + archived_at + archived_reason; can_be_reactivated controls future restoration). Audit history preserved forever via document_versions-style append-only pattern. The status enum value ''deleted_PROHIBITED'' is a tripwire — its presence in any row indicates a policy violation that must trigger an incident. Hard DELETE statements against cockpit_agent_prompts MUST be rejected. Hard rule applies to: cockpit_agent_prompts, cockpit_agent_identity, cockpit_agent_skills, cockpit_agent_role_skills, cockpit_knowledge_base, cockpit_audit_log.',
 'global', 'system', 'high'),
('phase 0 reconciliation — outcome',
 'Phase 0 reconciliation completed 2026-05-06: PR #4 squash-merged. main HEAD = 1444448 = v0-post-reconciliation tag. Vercel production rebuilt as dpl_EE5Xovnj6jHWN99MQzjU3UUZCpEe from new main. 16 Cowork migrations now in supabase/migrations/. 7 concurrent migrations remain in CONCURRENT_MIGRATIONS_TODO.md awaiting supabase db pull (Phase 1 blocker for Architect). Pre-reconciliation baseline preserved at v0-pre-reconciliation-{local,github} tags + working-tree tarball.',
 'global', 'system', 'high');

SELECT
  COUNT(*) as total_agent_rows,
  SUM(CASE WHEN active=true THEN 1 ELSE 0 END) as active_agents,
  SUM(CASE WHEN status='archived' THEN 1 ELSE 0 END) as archived_agents
FROM public.cockpit_agent_prompts;