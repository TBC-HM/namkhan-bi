-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163003
-- Name:    2026_05_04_compset_log_rate_plan_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Unique constraint so re-runs upsert instead of duplicating
ALTER TABLE revenue.competitor_rate_plans
  DROP CONSTRAINT IF EXISTS uq_comp_rate_plans;

ALTER TABLE revenue.competitor_rate_plans
  ADD CONSTRAINT uq_comp_rate_plans
  UNIQUE NULLS NOT DISTINCT (comp_id, channel, stay_date, shop_date, raw_label, los_nights);

-- RPC the EF will call once per detected rate plan
CREATE OR REPLACE FUNCTION public.compset_log_rate_plan(p jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'revenue'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO revenue.competitor_rate_plans (
    comp_id, channel, shop_date, stay_date,
    raw_label, raw_room_type,
    rate_usd, rate_native, native_currency,
    is_refundable, prepayment_required,
    cancellation_deadline_days, meal_plan,
    has_strikethrough, strikethrough_rate_usd, discount_pct, promo_label,
    is_member_only, los_nights, geo_market,
    raw, agent_run_id, scrape_status
  ) VALUES (
    (p->>'comp_id')::uuid,
    p->>'channel',
    COALESCE((p->>'shop_date')::date, CURRENT_DATE),
    (p->>'stay_date')::date,
    p->>'raw_label',
    p->>'raw_room_type',
    (p->>'rate_usd')::numeric,
    (p->>'rate_native')::numeric,
    p->>'native_currency',
    (p->>'is_refundable')::boolean,
    (p->>'prepayment_required')::boolean,
    (p->>'cancellation_deadline_days')::int,
    p->>'meal_plan',
    (p->>'has_strikethrough')::boolean,
    (p->>'strikethrough_rate_usd')::numeric,
    (p->>'discount_pct')::numeric,
    p->>'promo_label',
    (p->>'is_member_only')::boolean,
    COALESCE((p->>'los_nights')::smallint, 1),
    COALESCE(p->>'geo_market', 'US'),
    COALESCE(p->'raw', '{}'::jsonb),
    (p->>'agent_run_id')::uuid,
    COALESCE(p->>'scrape_status', 'success')
  )
  ON CONFLICT ON CONSTRAINT uq_comp_rate_plans DO UPDATE SET
    rate_usd                   = EXCLUDED.rate_usd,
    rate_native                = EXCLUDED.rate_native,
    is_refundable              = EXCLUDED.is_refundable,
    prepayment_required        = EXCLUDED.prepayment_required,
    cancellation_deadline_days = EXCLUDED.cancellation_deadline_days,
    meal_plan                  = EXCLUDED.meal_plan,
    has_strikethrough          = EXCLUDED.has_strikethrough,
    strikethrough_rate_usd     = EXCLUDED.strikethrough_rate_usd,
    discount_pct               = EXCLUDED.discount_pct,
    promo_label                = EXCLUDED.promo_label,
    raw                        = EXCLUDED.raw,
    agent_run_id               = EXCLUDED.agent_run_id,
    scrape_status              = EXCLUDED.scrape_status
  RETURNING plan_id INTO v_id;
  RETURN v_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.compset_log_rate_plan(jsonb) TO service_role;
GRANT SELECT ON revenue.competitor_rate_plans TO anon, authenticated;

-- Anon read policy on competitor_rate_plans (table has RLS on per pattern)
DO $$
BEGIN
  IF (SELECT relrowsecurity FROM pg_class WHERE oid='revenue.competitor_rate_plans'::regclass) THEN
    DROP POLICY IF EXISTS anon_read_compset ON revenue.competitor_rate_plans;
    CREATE POLICY anon_read_compset ON revenue.competitor_rate_plans
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
