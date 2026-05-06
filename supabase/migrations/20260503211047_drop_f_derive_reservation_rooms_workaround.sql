-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503211047
-- Name:    drop_f_derive_reservation_rooms_workaround
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- v15 of sync-cloudbeds Edge Function fixed the reservation_rooms upsert at the
-- root cause (delete-then-insert pattern instead of broken onConflict columns).
-- The SQL-side workaround function is no longer needed. Remove it + drop from
-- the f_derive_all_extras() wrapper.
DROP FUNCTION IF EXISTS public.f_derive_reservation_rooms(interval);

CREATE OR REPLACE FUNCTION public.f_derive_all_extras()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  start_ts timestamptz := clock_timestamp();
BEGIN
  -- These five derives cover entities the EF doesn't sync at all (guests,
  -- sources) or that the EF currently times out on (add_ons, tax_fee_records,
  -- adjustments — the EF runs add_ons over 76k transactions in JS pagination
  -- and hits its 240s wall before tax_fee_records/adjustments can run).
  -- reservation_rooms removed 2026-05-03 — fixed at the root in EF v15.
  result := result || jsonb_build_object('guests',          public.f_derive_guests());
  result := result || jsonb_build_object('sources',         public.f_derive_sources());
  result := result || jsonb_build_object('add_ons',         public.f_derive_add_ons());
  result := result || jsonb_build_object('tax_fee_records', public.f_derive_tax_fee_records());
  result := result || jsonb_build_object('adjustments',     public.f_derive_adjustments());
  result := result || jsonb_build_object('duration_ms',     (extract(epoch from clock_timestamp() - start_ts) * 1000)::int);
  RETURN result;
END $$;
GRANT EXECUTE ON FUNCTION public.f_derive_all_extras() TO service_role;