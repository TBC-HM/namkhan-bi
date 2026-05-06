-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504165351
-- Name:    agent_prompt_overrides_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- ============================================================================
-- docs.agent_prompt_overrides — DB-stored overrides for prompts/*.md files.
-- ============================================================================
-- The lib/prompts.ts loader reads this table FIRST. If a row exists for a
-- given prompt key, use the DB version. Otherwise fall back to filesystem.
-- This lets the /settings/agents UI hot-edit prompts without redeploying.

CREATE TABLE IF NOT EXISTS docs.agent_prompt_overrides (
  prompt_key   text PRIMARY KEY,        -- e.g. '_shared/output-style.md'
  content      text NOT NULL,
  description  text,                    -- short label for UI
  category     text,                    -- 'shared' / 'data-agent' / 'doc-classifier' / 'doc-qa'
  edited_by    text,                    -- user name (placeholder until SSO)
  edited_at    timestamptz DEFAULT now(),
  is_active    boolean DEFAULT true
);

-- Audit log — every save creates a snapshot
CREATE TABLE IF NOT EXISTS docs.agent_prompt_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key   text NOT NULL,
  content      text NOT NULL,
  edited_by    text,
  edited_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apo_history_key_idx ON docs.agent_prompt_history (prompt_key, edited_at DESC);

ALTER TABLE docs.agent_prompt_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apo_read ON docs.agent_prompt_overrides;
CREATE POLICY apo_read ON docs.agent_prompt_overrides FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS apo_write ON docs.agent_prompt_overrides;
CREATE POLICY apo_write ON docs.agent_prompt_overrides FOR ALL TO authenticated
  USING (app.is_top_level()) WITH CHECK (app.is_top_level());
GRANT SELECT ON docs.agent_prompt_overrides TO authenticated, anon;

ALTER TABLE docs.agent_prompt_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS aph_read ON docs.agent_prompt_history;
CREATE POLICY aph_read ON docs.agent_prompt_history FOR SELECT TO authenticated USING (app.is_top_level());

-- Trigger: any UPDATE/INSERT to overrides → snapshot to history
CREATE OR REPLACE FUNCTION docs.apo_history_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO docs.agent_prompt_history (prompt_key, content, edited_by)
  VALUES (NEW.prompt_key, NEW.content, NEW.edited_by);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS apo_snapshot_trg ON docs.agent_prompt_overrides;
CREATE TRIGGER apo_snapshot_trg
  AFTER INSERT OR UPDATE ON docs.agent_prompt_overrides
  FOR EACH ROW EXECUTE FUNCTION docs.apo_history_snapshot();

COMMENT ON TABLE docs.agent_prompt_overrides IS
  'Hot-editable agent prompts. /settings/agents UI writes here. lib/prompts.ts reads here first, falls back to prompts/*.md filesystem.';
