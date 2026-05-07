-- =============================================================================
-- Migration: Mirror 4 missing revenue agents into cockpit_agent_prompts
-- + seed base skills into cockpit_agent_role_skills
-- =============================================================================
-- PRE-CONDITION CHECK: governance.agent_prompts must have current=true rows
-- for all 4 agent_codes below. Run this SELECT first to verify:
--
-- SELECT agent_code, current FROM governance.agent_prompts
-- WHERE agent_code IN ('compset_proposer','reputation_analyst','shop_calendar_builder','lead_scoring_agent')
-- AND current = true;
--
-- Expected: 4 rows. If fewer, stop and notify PBS before proceeding.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Insert missing agents into cockpit_agent_prompts
--          Pull system_prompt from governance.agent_prompts WHERE current=true
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.cockpit_agent_prompts
  (role, department, status, version, system_prompt, active)
SELECT
  g.agent_code  AS role,
  'revenue'     AS department,
  'active'      AS status,
  1             AS version,
  g.system_prompt,
  true          AS active
FROM governance.agent_prompts g
WHERE g.agent_code IN (
  'compset_proposer',
  'reputation_analyst',
  'shop_calendar_builder',
  'lead_scoring_agent'
)
AND g.current = true
ON CONFLICT (role) DO NOTHING;   -- idempotent; won't overwrite if re-run

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Seed base 6 skills for every newly inserted revenue agent
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.cockpit_agent_role_skills (role, skill_name, enabled)
SELECT
  r.role,
  s.skill_name,
  true AS enabled
FROM
  (VALUES
    ('compset_proposer'),
    ('reputation_analyst'),
    ('shop_calendar_builder'),
    ('lead_scoring_agent')
  ) AS r(role)
CROSS JOIN
  (VALUES
    ('query_supabase_view'),
    ('read_audit_log'),
    ('read_knowledge_base'),
    ('read_knowledge_base_semantic'),
    ('read_property_settings'),
    ('list_team_members')
  ) AS s(skill_name)
ON CONFLICT (role, skill_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Agent-specific additional skills
-- ─────────────────────────────────────────────────────────────────────────────

-- compset_proposer: needs web_fetch (external rate scraping) + supabase_execute_sql
INSERT INTO public.cockpit_agent_role_skills (role, skill_name, enabled)
VALUES
  ('compset_proposer', 'web_fetch',              true),
  ('compset_proposer', 'supabase_execute_sql',   true)
ON CONFLICT (role, skill_name) DO NOTHING;

-- reputation_analyst: needs web_fetch (review platform reads)
INSERT INTO public.cockpit_agent_role_skills (role, skill_name, enabled)
VALUES
  ('reputation_analyst', 'web_fetch', true)
ON CONFLICT (role, skill_name) DO NOTHING;

-- shop_calendar_builder: base 6 only (PBS to confirm if extras needed)
-- lead_scoring_agent: base 6 only (PBS to confirm if extras needed)
-- → Placeholder rows can be appended here once confirmed by governance spec.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Smoke-test assertions (run after COMMIT in a separate tx)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT role, department, status, version
-- FROM public.cockpit_agent_prompts
-- WHERE role IN ('compset_proposer','reputation_analyst','shop_calendar_builder','lead_scoring_agent');
-- Expected: 4 rows, all status='active'

-- SELECT role, COUNT(*) AS skill_count
-- FROM public.cockpit_agent_role_skills
-- WHERE role IN ('compset_proposer','reputation_analyst','shop_calendar_builder','lead_scoring_agent')
-- GROUP BY role;
-- Expected:
--   compset_proposer       → 8 skills (6 base + web_fetch + supabase_execute_sql)
--   reputation_analyst     → 7 skills (6 base + web_fetch)
--   shop_calendar_builder  → 6 skills
--   lead_scoring_agent     → 6 skills

COMMIT;
