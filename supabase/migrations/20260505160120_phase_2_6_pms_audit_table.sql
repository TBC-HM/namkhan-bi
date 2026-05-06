-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505160120
-- Name:    phase_2_6_pms_audit_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 2.6 — Cloudbeds-coupling audit table
-- Living inventory of every place that hardcodes Cloudbeds.
-- When Mews integration starts, work through this list.
-- =====================================================================

CREATE TABLE IF NOT EXISTS core.pms_coupling_audit (
  audit_id      BIGSERIAL PRIMARY KEY,
  object_type   TEXT NOT NULL CHECK (object_type IN ('function','view','materialized_view','column','policy','edge_function')),
  object_name   TEXT NOT NULL,
  coupling_kind TEXT NOT NULL,       -- 'native_id_column','provider_literal','field_mapping','api_call','other'
  notes         TEXT,
  refactor_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (refactor_status IN ('pending','tagged','provider_agnostic','dropped','wontfix')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE core.pms_coupling_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY pms_coupling_audit_read ON core.pms_coupling_audit
  FOR SELECT TO authenticated USING (true);
CREATE POLICY pms_coupling_audit_service_write ON core.pms_coupling_audit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER pms_coupling_audit_set_updated_at
  BEFORE UPDATE ON core.pms_coupling_audit
  FOR EACH ROW EXECUTE FUNCTION core.tg_set_updated_at();

-- Seed with what we found in the audit scan
INSERT INTO core.pms_coupling_audit (object_type, object_name, coupling_kind, notes) VALUES
-- Functions
('function','public.cb_auth_header','api_call','Cloudbeds API auth header builder. Need Mews equivalent or generalize.'),
('function','public.cb_invoke_sync','api_call','Cloudbeds invoke sync. Mews uses different invocation model.'),
('function','public.cb_sync_recent_reservations','api_call','Cloudbeds reservation sync. Replace with provider-routed adapter.'),
('function','public.cloudbeds_link','provider_literal','Cloudbeds-specific deep link generator.'),
('function','public.f_derive_guests','provider_literal','References cloudbeds in derivation logic. Must check for source filtering.'),
('function','public.get_secret','api_call','Probably retrieves Cloudbeds secret. Generalize via core.pms_credentials + Vault.'),
('function','public.invoke_sync','api_call','Generic sync entry-point. Audit for Cloudbeds-only assumptions.'),
('function','public.parity_check_internal','provider_literal','Parity logic — likely Cloudbeds-only.'),
('function','public.poster_reconcile_run','provider_literal','Reconciles POS with Cloudbeds revenue.'),
('function','public.poster_reconcile_summary','provider_literal','Same.'),
('function','public.poster_report_findings','provider_literal','Same.'),
-- Views
('view','catalog.v_rooms_compilable','provider_literal','References Cloudbeds room data.'),
('view','gl.v_cb_qb_reconciliation','provider_literal','Cloudbeds <-> QuickBooks reconciliation. Will need Mews variant.'),
('view','marketing.v_room_catalog','provider_literal','Cloudbeds-sourced room catalog.'),
('view','marketing.v_settings_sections','provider_literal','Cloudbeds settings.'),
('view','public.v_guests_linked','provider_literal','Cloudbeds guest linkage.'),
('view','public.v_reservations_linked','provider_literal','Cloudbeds reservation linkage.'),
-- Columns (native ID dependencies)
('column','activities.bookings.cloudbeds_charge_id','native_id_column','Hard reference to Cloudbeds charge. Add mews_charge_id when needed.'),
('column','book.bookings.cloudbeds_reservation_id','native_id_column','Hard reference to Cloudbeds reservation. Consider provider+native_id pair.'),
('column','frontoffice.arrivals.cloudbeds_reservation_id','native_id_column','Same.'),
('column','frontoffice.upsell_offers.cloudbeds_charge_id','native_id_column','Same.'),
('column','gl.accounts.cloudbeds_category','field_mapping','Cloudbeds chart-of-accounts mapping. Need Mews accounting category mapping.'),
('column','plan.account_map.cloudbeds_subdept','field_mapping','Cloudbeds department mapping.'),
('column','pos.poster_receipts.cb_match_amount','field_mapping','Poster<->Cloudbeds matching field.'),
('column','pos.poster_receipts.cb_match_delta','field_mapping','Same.'),
('column','pos.poster_receipts.cb_reservation_id','native_id_column','Same.'),
('column','pos.poster_room_type_alias.cb_room_type_name','field_mapping','Cloudbeds room type alias.'),
('column','public.reservations.cb_guest_id','native_id_column','Hard reference to Cloudbeds guest_id.'),
('column','sales.proposals.cb_reservation_id','native_id_column','Hard reference to Cloudbeds reservation.'),
('column','spa.treatment_bookings.cloudbeds_charge_id','native_id_column','Hard reference to Cloudbeds charge.');

COMMENT ON TABLE core.pms_coupling_audit IS 'Inventory of Cloudbeds-coupled DB objects. When Mews integration begins, refactor each entry to provider-agnostic and update refactor_status.';
