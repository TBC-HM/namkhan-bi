-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171331
-- Name:    phase_3_4_drop_dup_indexes_fix_initplan
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Drop 34 duplicate _fk_idx indexes (keep _idx variants)
DROP INDEX IF EXISTS activities.bookings_property_id_fk_idx;
DROP INDEX IF EXISTS activities.catalog_property_id_fk_idx;
DROP INDEX IF EXISTS activities.equipment_property_id_fk_idx;
DROP INDEX IF EXISTS activities.guides_property_id_fk_idx;
DROP INDEX IF EXISTS activities.partners_property_id_fk_idx;
DROP INDEX IF EXISTS activities.schedules_property_id_fk_idx;
DROP INDEX IF EXISTS fb.food_cost_snapshots_property_id_fk_idx;
DROP INDEX IF EXISTS fb.outlets_property_id_fk_idx;
DROP INDEX IF EXISTS fb.recipes_property_id_fk_idx;
DROP INDEX IF EXISTS fb.wastage_log_property_id_fk_idx;
DROP INDEX IF EXISTS governance.agent_runs_property_id_fk_idx;
DROP INDEX IF EXISTS governance.agents_property_id_fk_idx;
DROP INDEX IF EXISTS governance.mandate_breaches_property_id_fk_idx;
DROP INDEX IF EXISTS governance.mandates_property_id_fk_idx;
DROP INDEX IF EXISTS governance.proposals_property_id_fk_idx;
DROP INDEX IF EXISTS guest.journey_events_property_id_fk_idx;
DROP INDEX IF EXISTS guest.loyalty_members_property_id_fk_idx;
DROP INDEX IF EXISTS guest.nps_responses_property_id_fk_idx;
DROP INDEX IF EXISTS guest.recovery_cases_property_id_fk_idx;
DROP INDEX IF EXISTS knowledge.brand_voice_corpus_property_id_fk_idx;
DROP INDEX IF EXISTS knowledge.qa_audits_property_id_fk_idx;
DROP INDEX IF EXISTS knowledge.sop_meta_property_id_fk_idx;
DROP INDEX IF EXISTS ops.connectors_property_id_fk_idx;
DROP INDEX IF EXISTS ops.maintenance_tickets_property_id_fk_idx;
DROP INDEX IF EXISTS ops.preventive_schedule_property_id_fk_idx;
DROP INDEX IF EXISTS ops.shift_templates_property_id_fk_idx;
DROP INDEX IF EXISTS ops.shifts_property_id_fk_idx;
DROP INDEX IF EXISTS spa.consumables_property_id_fk_idx;
DROP INDEX IF EXISTS spa.therapists_property_id_fk_idx;
DROP INDEX IF EXISTS spa.treatment_bookings_property_id_fk_idx;
DROP INDEX IF EXISTS spa.treatments_property_id_fk_idx;
DROP INDEX IF EXISTS training.certifications_property_id_fk_idx;
DROP INDEX IF EXISTS training.modules_property_id_fk_idx;
DROP INDEX IF EXISTS training.sessions_property_id_fk_idx;

-- Fix init-plan on core.user_properties.user_properties_self_read
DROP POLICY IF EXISTS user_properties_self_read ON core.user_properties;
CREATE POLICY user_properties_self_read ON core.user_properties
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
