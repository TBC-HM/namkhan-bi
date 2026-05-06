-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504163319
-- Name:    2026_05_04_v_compset_rate_plans_latest
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Public view for the deep-view RATE PLANS LIVE section.
-- Returns the most-recent shop_date's plans per (comp_id, channel, stay_date).
CREATE OR REPLACE VIEW public.v_compset_rate_plans_latest AS
WITH latest_per_cell AS (
  SELECT comp_id, channel, stay_date, MAX(shop_date) AS last_shop
  FROM revenue.competitor_rate_plans
  WHERE scrape_status = 'success' AND rate_usd IS NOT NULL
  GROUP BY comp_id, channel, stay_date
)
SELECT rp.plan_id, rp.comp_id, rp.channel, rp.shop_date, rp.stay_date,
       rp.raw_label, rp.raw_room_type, rp.rate_usd, rp.is_refundable,
       rp.prepayment_required, rp.cancellation_deadline_days,
       rp.meal_plan, rp.has_strikethrough, rp.strikethrough_rate_usd,
       rp.discount_pct, rp.promo_label, rp.is_member_only,
       rp.los_nights
FROM revenue.competitor_rate_plans rp
JOIN latest_per_cell l
  ON l.comp_id  = rp.comp_id
 AND l.channel  = rp.channel
 AND l.stay_date = rp.stay_date
 AND l.last_shop = rp.shop_date
WHERE rp.scrape_status = 'success' AND rp.rate_usd IS NOT NULL
ORDER BY rp.comp_id, rp.stay_date, rp.rate_usd;

GRANT SELECT ON public.v_compset_rate_plans_latest TO anon, authenticated, service_role;
