-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171510
-- Name:    phase_3_5_drop_legacy_policies_part1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- DROP all legacy authenticated_select / read / write / top / anon policies
-- Tenant + service_role policies already enforce correct access.

-- book
DROP POLICY IF EXISTS book_authenticated_select ON book.bookings;
DROP POLICY IF EXISTS book_authenticated_select ON book.cancellations;
DROP POLICY IF EXISTS book_authenticated_select ON book.payments;
DROP POLICY IF EXISTS book_authenticated_select ON book.reconcile_alerts;

-- catalog
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.activities;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.addons;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.ceremonies;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.fnb_items;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.fnb_menus;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.spa_treatments;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.transport_options;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.vendor_rate_cards;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.vendors;
DROP POLICY IF EXISTS catalog_authenticated_select ON catalog.workshops;

-- compiler
DROP POLICY IF EXISTS compiler_authenticated_select ON compiler.deploys;
DROP POLICY IF EXISTS compiler_authenticated_select ON compiler.variants;

-- content (anon access on tenant-scoped data — drop, public web should use anon role only on globals)
DROP POLICY IF EXISTS content_anon_select ON content.legal_pages;
DROP POLICY IF EXISTS content_anon_select ON content.series;

-- docs
DROP POLICY IF EXISTS alerts_read ON docs.alerts;
DROP POLICY IF EXISTS bookmarks_read ON docs.bookmarks;
DROP POLICY IF EXISTS bookmarks_top ON docs.bookmarks;
DROP POLICY IF EXISTS chunks_read ON docs.chunks;
DROP POLICY IF EXISTS docs_read ON docs.documents;
DROP POLICY IF EXISTS docs_top ON docs.documents;
DROP POLICY IF EXISTS hr_docs_read ON docs.hr_docs;

-- fb
DROP POLICY IF EXISTS fb_read ON fb.recipe_ingredients;
DROP POLICY IF EXISTS fb_top ON fb.recipe_ingredients;

-- frontoffice (anon + authenticated — drop both, tenant only)
DROP POLICY IF EXISTS agent_runs_read_anon ON frontoffice.agent_runs;
DROP POLICY IF EXISTS agent_runs_read_authenticated ON frontoffice.agent_runs;
DROP POLICY IF EXISTS brand_voice_read_anon ON frontoffice.brand_voice;
DROP POLICY IF EXISTS brand_voice_read_authenticated ON frontoffice.brand_voice;
DROP POLICY IF EXISTS compliance_docs_read_authenticated ON frontoffice.compliance_docs;
DROP POLICY IF EXISTS eta_tracking_read_anon ON frontoffice.eta_tracking;
DROP POLICY IF EXISTS eta_tracking_read_authenticated ON frontoffice.eta_tracking;
DROP POLICY IF EXISTS group_arrival_plans_read_anon ON frontoffice.group_arrival_plans;
DROP POLICY IF EXISTS group_arrival_plans_read_authenticated ON frontoffice.group_arrival_plans;
DROP POLICY IF EXISTS prearrival_messages_read_anon ON frontoffice.prearrival_messages;
DROP POLICY IF EXISTS prearrival_messages_read_authenticated ON frontoffice.prearrival_messages;
DROP POLICY IF EXISTS upsell_offers_read_anon ON frontoffice.upsell_offers;
DROP POLICY IF EXISTS upsell_offers_read_authenticated ON frontoffice.upsell_offers;
DROP POLICY IF EXISTS vip_briefs_read_authenticated ON frontoffice.vip_briefs;

-- governance
DROP POLICY IF EXISTS gov_read ON governance.agent_prompts;
DROP POLICY IF EXISTS gov_top ON governance.agent_prompts;
DROP POLICY IF EXISTS gov_read ON governance.agent_secrets;
DROP POLICY IF EXISTS gov_top ON governance.agent_secrets;
DROP POLICY IF EXISTS gov_read ON governance.agent_triggers;
DROP POLICY IF EXISTS gov_top ON governance.agent_triggers;
DROP POLICY IF EXISTS decision_queue_read ON governance.decision_queue;
DROP POLICY IF EXISTS decision_queue_write ON governance.decision_queue;
DROP POLICY IF EXISTS dmc_contracts_read ON governance.dmc_contracts;
DROP POLICY IF EXISTS dmc_mapping_read ON governance.dmc_reservation_mapping;
DROP POLICY IF EXISTS gov_read ON governance.mandate_rules;
DROP POLICY IF EXISTS gov_top ON governance.mandate_rules;
DROP POLICY IF EXISTS gov_read ON governance.proposal_decisions;
DROP POLICY IF EXISTS gov_top ON governance.proposal_decisions;
DROP POLICY IF EXISTS gov_read ON governance.proposal_outcomes;
DROP POLICY IF EXISTS gov_top ON governance.proposal_outcomes;
DROP POLICY IF EXISTS gov_read ON governance.tools_catalog;
DROP POLICY IF EXISTS gov_top ON governance.tools_catalog;

-- guest
DROP POLICY IF EXISTS guest_read ON guest.review_replies;
DROP POLICY IF EXISTS guest_top ON guest.review_replies;
DROP POLICY IF EXISTS guest_read ON guest.review_themes;
DROP POLICY IF EXISTS guest_top ON guest.review_themes;

-- knowledge
DROP POLICY IF EXISTS knowledge_read ON knowledge.qa_findings;
DROP POLICY IF EXISTS knowledge_top ON knowledge.qa_findings;

-- kpi
DROP POLICY IF EXISTS kpi_fresh_read ON kpi.freshness_log;
