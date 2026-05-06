-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260430171706
-- Name:    phase1_17_commentary_drafts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- phase1_17_commentary_drafts.sql
-- Gap 5 — Variance commentary drafts (with audit publish function).

CREATE TABLE IF NOT EXISTS gl.commentary_drafts (
  draft_id        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start    date          NOT NULL,
  period_end      date          NOT NULL,
  tone_preset     text          NOT NULL,
  body            text          NOT NULL,
  composer_run_id uuid          REFERENCES governance.agent_runs,
  status          text          NOT NULL DEFAULT 'draft',
  approved_by     uuid          REFERENCES auth.users,
  approved_at     timestamptz,
  published_to    text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE gl.commentary_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commentary_drafts_read ON gl.commentary_drafts;
CREATE POLICY commentary_drafts_read ON gl.commentary_drafts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS commentary_drafts_write ON gl.commentary_drafts;
CREATE POLICY commentary_drafts_write ON gl.commentary_drafts FOR ALL TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

CREATE OR REPLACE FUNCTION gl.publish_commentary(p_draft uuid, p_to text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE gl.commentary_drafts
     SET status='published',
         published_to=p_to,
         approved_by=auth.uid(),
         approved_at=now(),
         updated_at=now()
   WHERE draft_id=p_draft;
  INSERT INTO app.audit_log(actor_id, entity, entity_id, action, payload)
  VALUES (auth.uid(), 'commentary_draft', p_draft, 'publish', jsonb_build_object('to', p_to));
END $$;

COMMENT ON TABLE gl.commentary_drafts IS 'Phase1_17 — Gap 5: editable variance commentary drafts. Never auto-publish.';

-- DOWN:
-- DROP FUNCTION IF EXISTS gl.publish_commentary(uuid,text);
-- DROP TABLE IF EXISTS gl.commentary_drafts;