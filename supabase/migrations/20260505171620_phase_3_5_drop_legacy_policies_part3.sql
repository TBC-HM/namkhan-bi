-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171620
-- Name:    phase_3_5_drop_legacy_policies_part3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- docs leftovers
DROP POLICY IF EXISTS apo_read ON docs.agent_prompt_overrides;
DROP POLICY IF EXISTS apo_write ON docs.agent_prompt_overrides;
DROP POLICY IF EXISTS aph_read ON docs.agent_prompt_history;
-- docs.tag_catalog.tag_catalog_read kept intentionally (global lookup)
