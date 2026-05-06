-- Migration 4/6 — sales-proposal-builder. APPLIED 2026-05-03.
-- Anon path = via public_token in JWT claim. Authed = full access. Service-role = ALL.
-- 41 policies across 14 tables.
BEGIN;

-- proposals
ALTER TABLE sales.proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposals_anon_token ON sales.proposals;
CREATE POLICY proposals_anon_token ON sales.proposals FOR SELECT TO anon
  USING (public_token IS NOT NULL AND public_token = current_setting('request.jwt.claim.token', true));
DROP POLICY IF EXISTS proposals_authed_all ON sales.proposals;
CREATE POLICY proposals_authed_all ON sales.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS proposals_service_all ON sales.proposals;
CREATE POLICY proposals_service_all ON sales.proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- proposal_blocks (anon SELECT + UPDATE qty/removable via token)
ALTER TABLE sales.proposal_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS blocks_anon_via_proposal ON sales.proposal_blocks;
CREATE POLICY blocks_anon_via_proposal ON sales.proposal_blocks FOR SELECT TO anon
  USING (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));
DROP POLICY IF EXISTS blocks_anon_update_qty ON sales.proposal_blocks;
CREATE POLICY blocks_anon_update_qty ON sales.proposal_blocks FOR UPDATE TO anon
  USING (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));
DROP POLICY IF EXISTS blocks_authed_all ON sales.proposal_blocks;
CREATE POLICY blocks_authed_all ON sales.proposal_blocks FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS blocks_service_all ON sales.proposal_blocks;
CREATE POLICY blocks_service_all ON sales.proposal_blocks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- view/edit/sig events: anon INSERT-only via token
ALTER TABLE sales.proposal_view_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS view_events_anon_insert ON sales.proposal_view_events;
CREATE POLICY view_events_anon_insert ON sales.proposal_view_events FOR INSERT TO anon
  WITH CHECK (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));
DROP POLICY IF EXISTS view_events_authed_all ON sales.proposal_view_events;
CREATE POLICY view_events_authed_all ON sales.proposal_view_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS view_events_service_all ON sales.proposal_view_events;
CREATE POLICY view_events_service_all ON sales.proposal_view_events FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.proposal_guest_edits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guest_edits_anon_insert ON sales.proposal_guest_edits;
CREATE POLICY guest_edits_anon_insert ON sales.proposal_guest_edits FOR INSERT TO anon
  WITH CHECK (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));
DROP POLICY IF EXISTS guest_edits_authed_all ON sales.proposal_guest_edits;
CREATE POLICY guest_edits_authed_all ON sales.proposal_guest_edits FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS guest_edits_service_all ON sales.proposal_guest_edits;
CREATE POLICY guest_edits_service_all ON sales.proposal_guest_edits FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.proposal_sig_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sig_events_anon_insert ON sales.proposal_sig_events;
CREATE POLICY sig_events_anon_insert ON sales.proposal_sig_events FOR INSERT TO anon
  WITH CHECK (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));
DROP POLICY IF EXISTS sig_events_authed_all ON sales.proposal_sig_events;
CREATE POLICY sig_events_authed_all ON sales.proposal_sig_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sig_events_service_all ON sales.proposal_sig_events;
CREATE POLICY sig_events_service_all ON sales.proposal_sig_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authed + service only: inquiries, emails, versions, ics_files, agent_runs, templates
ALTER TABLE sales.inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inquiries_authed_all ON sales.inquiries;
CREATE POLICY inquiries_authed_all ON sales.inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS inquiries_service_all ON sales.inquiries;
CREATE POLICY inquiries_service_all ON sales.inquiries FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.proposal_emails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS emails_authed_all ON sales.proposal_emails;
CREATE POLICY emails_authed_all ON sales.proposal_emails FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS emails_service_all ON sales.proposal_emails;
CREATE POLICY emails_service_all ON sales.proposal_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.proposal_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS versions_authed_all ON sales.proposal_versions;
CREATE POLICY versions_authed_all ON sales.proposal_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS versions_service_all ON sales.proposal_versions;
CREATE POLICY versions_service_all ON sales.proposal_versions FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.ics_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ics_authed_all ON sales.ics_files;
CREATE POLICY ics_authed_all ON sales.ics_files FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ics_service_all ON sales.ics_files;
CREATE POLICY ics_service_all ON sales.ics_files FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ics_anon_via_proposal ON sales.ics_files;
CREATE POLICY ics_anon_via_proposal ON sales.ics_files FOR SELECT TO anon
  USING (proposal_id IN (SELECT id FROM sales.proposals WHERE public_token = current_setting('request.jwt.claim.token', true)));

ALTER TABLE sales.agent_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS runs_authed_all ON sales.agent_runs;
CREATE POLICY runs_authed_all ON sales.agent_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS runs_service_all ON sales.agent_runs;
CREATE POLICY runs_service_all ON sales.agent_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.proposal_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS templates_authed_all ON sales.proposal_templates;
CREATE POLICY templates_authed_all ON sales.proposal_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS templates_service_all ON sales.proposal_templates;
CREATE POLICY templates_service_all ON sales.proposal_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Activity catalog: AUTHED READ only (NOT anon)
ALTER TABLE sales.activity_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS catalog_authed_read ON sales.activity_catalog;
CREATE POLICY catalog_authed_read ON sales.activity_catalog FOR SELECT TO authenticated USING (status = 'active');
DROP POLICY IF EXISTS catalog_service_all ON sales.activity_catalog;
CREATE POLICY catalog_service_all ON sales.activity_catalog FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.activity_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partners_authed_read ON sales.activity_partners;
CREATE POLICY partners_authed_read ON sales.activity_partners FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS partners_service_all ON sales.activity_partners;
CREATE POLICY partners_service_all ON sales.activity_partners FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.activity_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cats_authed_read ON sales.activity_categories;
CREATE POLICY cats_authed_read ON sales.activity_categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cats_service_all ON sales.activity_categories;
CREATE POLICY cats_service_all ON sales.activity_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Packages tables (deferred to v1.1, but lock down now)
ALTER TABLE sales.packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS packages_authed_all ON sales.packages;
CREATE POLICY packages_authed_all ON sales.packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS packages_service_all ON sales.packages;
CREATE POLICY packages_service_all ON sales.packages FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.package_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comps_authed_all ON sales.package_components;
CREATE POLICY comps_authed_all ON sales.package_components FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS comps_service_all ON sales.package_components;
CREATE POLICY comps_service_all ON sales.package_components FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE sales.package_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS costs_authed_all ON sales.package_costs;
CREATE POLICY costs_authed_all ON sales.package_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS costs_service_all ON sales.package_costs;
CREATE POLICY costs_service_all ON sales.package_costs FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
