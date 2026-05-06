-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171650
-- Name:    phase1_16_decision_queue
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_16_decision_queue.sql
-- Gap 8 — Decision queue persistence with 4-eyes CHECK constraint.

CREATE TABLE IF NOT EXISTS governance.decision_queue (
  decision_id    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  source_agent   text          NOT NULL,
  source_run_id  uuid          REFERENCES governance.agent_runs,
  scope_section  text          NOT NULL,
  scope_tab      text          NOT NULL,
  title          text          NOT NULL,
  impact_usd     numeric(12,2) NOT NULL,
  confidence_pct numeric(5,2)  NOT NULL,
  velocity       text          NOT NULL,
  meta           jsonb         NOT NULL DEFAULT '{}',
  status         text          NOT NULL DEFAULT 'pending',
  approved_by    uuid          REFERENCES auth.users,
  approved_at    timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decision_queue_lookup
  ON governance.decision_queue (scope_section, scope_tab, status, impact_usd DESC);

-- 4-eyes rule: GL touches >= $1k must carry approver list in meta.four_eyes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema='governance' AND table_name='decision_queue'
      AND constraint_name='four_eyes_required'
  ) THEN
    ALTER TABLE governance.decision_queue
      ADD CONSTRAINT four_eyes_required CHECK (
        NOT (impact_usd >= 1000 AND meta->>'writes_to' = 'gl' AND meta->'four_eyes' IS NULL)
      );
  END IF;
END $$;

ALTER TABLE governance.decision_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS decision_queue_read ON governance.decision_queue;
CREATE POLICY decision_queue_read ON governance.decision_queue FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS decision_queue_write ON governance.decision_queue;
CREATE POLICY decision_queue_write ON governance.decision_queue FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

COMMENT ON TABLE governance.decision_queue IS 'Phase1_16 — Gap 8: persistent decision queue across all sections.';

-- DOWN:
-- DROP TABLE IF EXISTS governance.decision_queue;