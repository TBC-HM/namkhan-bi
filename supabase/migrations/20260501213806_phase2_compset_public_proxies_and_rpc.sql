-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501213806
-- Name:    phase2_compset_public_proxies_and_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public proxies for revenue.* compset views/tables (PostgREST exposes public only)
-- Plus security-definer RPC for the manual rate-entry server action.

-- Read-side: public proxy views
DROP VIEW IF EXISTS public.v_compset_overview   CASCADE;
CREATE VIEW public.v_compset_overview   AS SELECT * FROM revenue.v_compset_overview;

DROP VIEW IF EXISTS public.v_compset_properties CASCADE;
CREATE VIEW public.v_compset_properties AS SELECT * FROM revenue.v_compset_properties;

DROP VIEW IF EXISTS public.competitor_set      CASCADE;
CREATE VIEW public.competitor_set      AS SELECT * FROM revenue.competitor_set;

DROP VIEW IF EXISTS public.competitor_property CASCADE;
CREATE VIEW public.competitor_property AS SELECT * FROM revenue.competitor_property;

DROP VIEW IF EXISTS public.competitor_rates    CASCADE;
CREATE VIEW public.competitor_rates    AS SELECT * FROM revenue.competitor_rates;

GRANT SELECT ON public.v_compset_overview   TO anon, authenticated;
GRANT SELECT ON public.v_compset_properties TO anon, authenticated;
GRANT SELECT ON public.competitor_set      TO anon, authenticated;
GRANT SELECT ON public.competitor_property TO anon, authenticated;
GRANT SELECT ON public.competitor_rates    TO anon, authenticated;

-- Anon SELECT on the underlying revenue objects so the proxies actually return rows
GRANT USAGE  ON SCHEMA revenue TO anon, authenticated;
GRANT SELECT ON revenue.competitor_set      TO anon, authenticated;
GRANT SELECT ON revenue.competitor_property TO anon, authenticated;
GRANT SELECT ON revenue.competitor_rates    TO anon, authenticated;
GRANT SELECT ON revenue.v_compset_overview  TO anon, authenticated;
GRANT SELECT ON revenue.v_compset_properties TO anon, authenticated;

-- Write-side RPC: server action calls this with service_role; runs as definer.
-- Accepts a JSONB array of {comp_id, stay_date, shop_date, channel, rate_usd,
-- rate_lak, currency, is_available, source}. Upserts on the unique constraint
-- (comp_id, stay_date, shop_date, channel). Returns # rows affected.
CREATE OR REPLACE FUNCTION public.save_competitor_rates(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, revenue
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
    RETURN 0;
  END IF;

  WITH parsed AS (
    SELECT
      (e->>'comp_id')::uuid       AS comp_id,
      (e->>'stay_date')::date     AS stay_date,
      (e->>'shop_date')::date     AS shop_date,
      COALESCE(e->>'channel', 'booking.com') AS channel,
      (e->>'rate_usd')::numeric   AS rate_usd,
      (e->>'rate_lak')::numeric   AS rate_lak,
      COALESCE(e->>'currency', 'USD') AS currency,
      COALESCE((e->>'is_available')::boolean, true) AS is_available,
      COALESCE(e->>'source', 'manual_owner_entry')  AS source
    FROM jsonb_array_elements(p_rows) AS e
  ),
  ins AS (
    INSERT INTO revenue.competitor_rates AS cr
      (comp_id, stay_date, shop_date, channel, rate_usd, rate_lak, currency, is_available, source)
    SELECT comp_id, stay_date, shop_date, channel, rate_usd, rate_lak, currency, is_available, source
    FROM parsed
    ON CONFLICT (comp_id, stay_date, shop_date, channel)
    DO UPDATE SET
      rate_usd     = EXCLUDED.rate_usd,
      rate_lak     = EXCLUDED.rate_lak,
      currency     = EXCLUDED.currency,
      is_available = EXCLUDED.is_available,
      source       = EXCLUDED.source
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM ins;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.save_competitor_rates(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_competitor_rates(jsonb) TO service_role;
-- Intentionally NOT granting EXECUTE to anon — writes only via server action / service_role.

COMMENT ON FUNCTION public.save_competitor_rates(jsonb) IS
  'Upsert manual rate observations. SECURITY DEFINER. service_role only.';