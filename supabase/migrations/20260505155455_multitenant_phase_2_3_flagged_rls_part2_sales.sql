-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155455
-- Name:    multitenant_phase_2_3_flagged_rls_part2_sales
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.3b — sales schema: tenant-scoped RLS
-- Strategy: parents (proposals, packages, inquiries) get direct property_id check.
-- Children (proposal_*, package_*, ics_files, agent_runs) inherit via FK.
-- =====================================================================

-- ---------------------------------------------------------------------
-- sales.inquiries  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS inquiries_authed_all ON sales.inquiries;
CREATE POLICY inquiries_tenant ON sales.inquiries
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS inquiries_property_id_idx ON sales.inquiries(property_id);

-- ---------------------------------------------------------------------
-- sales.proposals  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS proposals_authed_all ON sales.proposals;
CREATE POLICY proposals_tenant ON sales.proposals
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS proposals_property_id_idx ON sales.proposals(property_id);

-- ---------------------------------------------------------------------
-- sales.proposal_templates  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS templates_authed_all ON sales.proposal_templates;
CREATE POLICY proposal_templates_tenant ON sales.proposal_templates
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS proposal_templates_property_id_idx ON sales.proposal_templates(property_id);

-- ---------------------------------------------------------------------
-- sales.packages  (already has property_id BIGINT)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS packages_authed_all ON sales.packages;
CREATE POLICY packages_tenant ON sales.packages
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));

CREATE INDEX IF NOT EXISTS packages_property_id_idx ON sales.packages(property_id);

-- ---------------------------------------------------------------------
-- Children of sales.proposals — derive via FK
-- ---------------------------------------------------------------------

-- sales.proposal_blocks
DROP POLICY IF EXISTS blocks_authed_all ON sales.proposal_blocks;
CREATE POLICY proposal_blocks_tenant ON sales.proposal_blocks
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_blocks.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_blocks.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.proposal_versions
DROP POLICY IF EXISTS versions_authed_all ON sales.proposal_versions;
CREATE POLICY proposal_versions_tenant ON sales.proposal_versions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_versions.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_versions.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.proposal_emails
DROP POLICY IF EXISTS emails_authed_all ON sales.proposal_emails;
CREATE POLICY proposal_emails_tenant ON sales.proposal_emails
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_emails.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_emails.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.proposal_view_events
DROP POLICY IF EXISTS view_events_authed_all ON sales.proposal_view_events;
CREATE POLICY proposal_view_events_tenant ON sales.proposal_view_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_view_events.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_view_events.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.proposal_guest_edits
DROP POLICY IF EXISTS guest_edits_authed_all ON sales.proposal_guest_edits;
CREATE POLICY proposal_guest_edits_tenant ON sales.proposal_guest_edits
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_guest_edits.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_guest_edits.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.proposal_sig_events
DROP POLICY IF EXISTS sig_events_authed_all ON sales.proposal_sig_events;
CREATE POLICY proposal_sig_events_tenant ON sales.proposal_sig_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_sig_events.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = proposal_sig_events.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.ics_files (FKs to proposals)
DROP POLICY IF EXISTS ics_authed_all ON sales.ics_files;
CREATE POLICY ics_files_tenant ON sales.ics_files
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = ics_files.proposal_id
      AND core.has_property_access(p.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.proposals p
    WHERE p.id = ics_files.proposal_id
      AND core.has_property_access(p.property_id)
  ));

-- sales.agent_runs (FKs to proposals OR inquiries; allow either)
DROP POLICY IF EXISTS runs_authed_all ON sales.agent_runs;
CREATE POLICY agent_runs_tenant ON sales.agent_runs
  FOR ALL TO authenticated
  USING (
    (proposal_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales.proposals p
      WHERE p.id = agent_runs.proposal_id
        AND core.has_property_access(p.property_id)
    ))
    OR
    (inquiry_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales.inquiries i
      WHERE i.id = agent_runs.inquiry_id
        AND core.has_property_access(i.property_id)
    ))
  )
  WITH CHECK (
    (proposal_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales.proposals p
      WHERE p.id = agent_runs.proposal_id
        AND core.has_property_access(p.property_id)
    ))
    OR
    (inquiry_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM sales.inquiries i
      WHERE i.id = agent_runs.inquiry_id
        AND core.has_property_access(i.property_id)
    ))
  );

-- ---------------------------------------------------------------------
-- Children of sales.packages
-- ---------------------------------------------------------------------

-- sales.package_components
DROP POLICY IF EXISTS comps_authed_all ON sales.package_components;
CREATE POLICY package_components_tenant ON sales.package_components
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.packages pk
    WHERE pk.id = package_components.package_id
      AND core.has_property_access(pk.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.packages pk
    WHERE pk.id = package_components.package_id
      AND core.has_property_access(pk.property_id)
  ));

-- sales.package_costs
DROP POLICY IF EXISTS costs_authed_all ON sales.package_costs;
CREATE POLICY package_costs_tenant ON sales.package_costs
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sales.packages pk
    WHERE pk.id = package_costs.package_id
      AND core.has_property_access(pk.property_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sales.packages pk
    WHERE pk.id = package_costs.package_id
      AND core.has_property_access(pk.property_id)
  ));
