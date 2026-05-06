-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155938
-- Name:    phase_2_7b_rls_initplan_fixes
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.7b — Fix auth_rls_initplan re-eval-per-row + duplicate indexes
-- Pattern: wrap current_setting() / auth.uid() in (SELECT ...) so PG caches.
-- =====================================================================

-- ---------------------------------------------------------------------
-- core.user_properties (the one I created)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS user_properties_self_read ON core.user_properties;
CREATE POLICY user_properties_self_read ON core.user_properties
  FOR SELECT TO authenticated
  USING (
    user_id = (
      SELECT (
        nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      )::uuid
    )
  );

-- ---------------------------------------------------------------------
-- app.tasks_write
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS tasks_write ON app.tasks;
CREATE POLICY tasks_write ON app.tasks
  FOR INSERT TO authenticated
  WITH CHECK ((created_by = (SELECT auth.uid())) OR app.is_top_level());

-- ---------------------------------------------------------------------
-- sales.proposals_anon_token  (anon guest token access)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS proposals_anon_token ON sales.proposals;
CREATE POLICY proposals_anon_token ON sales.proposals
  FOR SELECT TO anon
  USING (
    public_token IS NOT NULL
    AND public_token = (SELECT current_setting('request.jwt.claim.token', true))
  );

-- ---------------------------------------------------------------------
-- sales.proposal_blocks_anon_via_proposal
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS blocks_anon_via_proposal ON sales.proposal_blocks;
CREATE POLICY blocks_anon_via_proposal ON sales.proposal_blocks
  FOR SELECT TO anon
  USING (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- sales.proposal_blocks_anon_update_qty
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS blocks_anon_update_qty ON sales.proposal_blocks;
CREATE POLICY blocks_anon_update_qty ON sales.proposal_blocks
  FOR UPDATE TO anon
  USING (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- sales.proposal_view_events_anon_insert
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS view_events_anon_insert ON sales.proposal_view_events;
CREATE POLICY view_events_anon_insert ON sales.proposal_view_events
  FOR INSERT TO anon
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- sales.proposal_guest_edits_anon_insert
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS guest_edits_anon_insert ON sales.proposal_guest_edits;
CREATE POLICY guest_edits_anon_insert ON sales.proposal_guest_edits
  FOR INSERT TO anon
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- sales.proposal_sig_events_anon_insert
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS sig_events_anon_insert ON sales.proposal_sig_events;
CREATE POLICY sig_events_anon_insert ON sales.proposal_sig_events
  FOR INSERT TO anon
  WITH CHECK (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- sales.ics_files_anon_via_proposal
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS ics_anon_via_proposal ON sales.ics_files;
CREATE POLICY ics_anon_via_proposal ON sales.ics_files
  FOR SELECT TO anon
  USING (
    proposal_id IN (
      SELECT id FROM sales.proposals
      WHERE public_token = (SELECT current_setting('request.jwt.claim.token', true))
    )
  );

-- ---------------------------------------------------------------------
-- Drop duplicate indexes
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS docs.idx_docs_property;        -- duplicate of documents_property_id_idx
DROP INDEX IF EXISTS public.mv_kpi_today_pk_idx;    -- duplicate of idx_mv_kpi_today_pk
