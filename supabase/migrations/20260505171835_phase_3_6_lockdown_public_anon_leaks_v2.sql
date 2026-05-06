-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171835
-- Name:    phase_3_6_lockdown_public_anon_leaks_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Drop legacy anon/public_read on confidential public.* tables
DROP POLICY IF EXISTS allow_anon_read ON public.reservations;
DROP POLICY IF EXISTS anon_read_namkhan ON public.reservations;
DROP POLICY IF EXISTS public_read ON public.reservations;
DROP POLICY IF EXISTS read_all_reservations ON public.reservations;
DROP POLICY IF EXISTS allow_anon_read ON public.reservation_rooms;
DROP POLICY IF EXISTS public_read ON public.reservation_rooms;
DROP POLICY IF EXISTS read_all_reservation_rooms ON public.reservation_rooms;
DROP POLICY IF EXISTS allow_anon_read ON public.transactions;
DROP POLICY IF EXISTS public_read ON public.transactions;
DROP POLICY IF EXISTS read_all_transactions ON public.transactions;
DROP POLICY IF EXISTS allow_anon_read ON public.house_accounts;
DROP POLICY IF EXISTS anon_read_namkhan ON public.house_accounts;
DROP POLICY IF EXISTS public_read ON public.house_accounts;
DROP POLICY IF EXISTS allow_anon_read ON public.daily_metrics;
DROP POLICY IF EXISTS public_read ON public.daily_metrics;
DROP POLICY IF EXISTS read_all_daily_metrics ON public.daily_metrics;
DROP POLICY IF EXISTS allow_anon_read ON public.channel_metrics;
DROP POLICY IF EXISTS public_read ON public.channel_metrics;
DROP POLICY IF EXISTS read_all_channel_metrics ON public.channel_metrics;
DROP POLICY IF EXISTS allow_anon_read ON public.operational_overrides;
DROP POLICY IF EXISTS anon_read ON public.operational_overrides;
DROP POLICY IF EXISTS public_read ON public.operational_overrides;
DROP POLICY IF EXISTS allow_anon_read ON public.hotels;
DROP POLICY IF EXISTS public_read ON public.hotels;
DROP POLICY IF EXISTS read_all_hotels ON public.hotels;
DROP POLICY IF EXISTS allow_anon_read ON public.rooms;
DROP POLICY IF EXISTS anon_read_namkhan ON public.rooms;
DROP POLICY IF EXISTS public_read ON public.rooms;
DROP POLICY IF EXISTS read_all_rooms ON public.rooms;
DROP POLICY IF EXISTS allow_anon_read ON public.room_types;
DROP POLICY IF EXISTS anon_read_namkhan ON public.room_types;
DROP POLICY IF EXISTS public_read ON public.room_types;
DROP POLICY IF EXISTS read_all_room_types ON public.room_types;
DROP POLICY IF EXISTS allow_anon_read ON public.rate_plans;
DROP POLICY IF EXISTS anon_read_namkhan ON public.rate_plans;
DROP POLICY IF EXISTS public_read ON public.rate_plans;
DROP POLICY IF EXISTS allow_anon_read ON public.sources;
DROP POLICY IF EXISTS anon_read_namkhan ON public.sources;
DROP POLICY IF EXISTS public_read ON public.sources;
DROP POLICY IF EXISTS read_all_sources ON public.sources;
DROP POLICY IF EXISTS allow_anon_read ON public.usali_category_map;
DROP POLICY IF EXISTS anon_read ON public.usali_category_map;
DROP POLICY IF EXISTS public_read ON public.usali_category_map;
DROP POLICY IF EXISTS allow_anon_read ON public.dq_known_issues;
DROP POLICY IF EXISTS anon_read ON public.dq_known_issues;
DROP POLICY IF EXISTS public_read ON public.dq_known_issues;

-- TENANT POLICIES (tables with property_id)
CREATE POLICY reservations_tenant ON public.reservations
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY reservations_service ON public.reservations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY transactions_tenant ON public.transactions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reservations r WHERE r.reservation_id = transactions.reservation_id AND core.has_property_access(r.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reservations r WHERE r.reservation_id = transactions.reservation_id AND core.has_property_access(r.property_id)));
CREATE POLICY transactions_service ON public.transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY house_accounts_tenant ON public.house_accounts
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY house_accounts_service ON public.house_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY daily_metrics_tenant ON public.daily_metrics
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY daily_metrics_service ON public.daily_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY channel_metrics_tenant ON public.channel_metrics
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY channel_metrics_service ON public.channel_metrics
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY hotels_tenant ON public.hotels
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY hotels_service ON public.hotels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY rooms_tenant ON public.rooms
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY rooms_service ON public.rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY room_types_tenant ON public.room_types
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY room_types_service ON public.room_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY rate_plans_tenant ON public.rate_plans
  FOR ALL TO authenticated
  USING (core.has_property_access(property_id))
  WITH CHECK (core.has_property_access(property_id));
CREATE POLICY rate_plans_service ON public.rate_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- FK-derived (reservation_rooms has no property_id, derive from reservations)
CREATE POLICY reservation_rooms_tenant ON public.reservation_rooms
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.reservations r WHERE r.reservation_id = reservation_rooms.reservation_id AND core.has_property_access(r.property_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.reservations r WHERE r.reservation_id = reservation_rooms.reservation_id AND core.has_property_access(r.property_id)));
CREATE POLICY reservation_rooms_service ON public.reservation_rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No property_id: lock to authenticated-only (single-property today; revisit at Donna onboarding)
CREATE POLICY operational_overrides_authenticated ON public.operational_overrides
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY operational_overrides_service ON public.operational_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Globals: authenticated read, service write
CREATE POLICY sources_authenticated_read ON public.sources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY sources_service ON public.sources
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY usali_category_map_authenticated_read ON public.usali_category_map
  FOR SELECT TO authenticated USING (true);
CREATE POLICY usali_category_map_service ON public.usali_category_map
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY dq_known_issues_authenticated_read ON public.dq_known_issues
  FOR SELECT TO authenticated USING (true);
CREATE POLICY dq_known_issues_service ON public.dq_known_issues
  FOR ALL TO service_role USING (true) WITH CHECK (true);
