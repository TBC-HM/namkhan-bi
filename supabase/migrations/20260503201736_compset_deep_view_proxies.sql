-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503201736
-- Name:    compset_deep_view_proxies
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Public proxies for the compset deep-view (clicked-row expansion).
-- Mirror revenue.* tables/views one-to-one. Read-only. RLS-friendly via revenue's own grants.

-- 1. Property detail (single row by comp_id) — all editable property attributes incl. channel URLs
CREATE OR REPLACE VIEW public.v_compset_competitor_property_detail AS
SELECT
  cp.comp_id,
  cp.set_id,
  cp.property_name,
  cp.is_self,
  cp.scrape_priority,
  cp.star_rating,
  cp.rooms,
  cp.city,
  cp.country,
  cp.room_type_target,
  cp.bdc_url,
  cp.bdc_property_id,
  cp.agoda_url,
  cp.agoda_property_id,
  cp.expedia_url,
  cp.trip_url,
  cp.trip_property_id,
  cp.traveloka_url,
  cp.traveloka_property_id,
  cp.direct_url,
  cp.google_place_id,
  cp.is_active,
  cp.notes,
  cp.created_at,
  cp.updated_at
FROM revenue.competitor_property cp;

-- 2. Room mappings per property
CREATE OR REPLACE VIEW public.v_compset_competitor_room_mapping AS
SELECT
  rm.mapping_id,
  rm.comp_id,
  rm.channel,
  rm.competitor_room_name,
  rm.competitor_room_size_sqm,
  rm.competitor_max_occupancy,
  rm.competitor_bed_config,
  rm.our_room_tier,
  rm.our_room_type_id,
  rm.is_target_room,
  rm.notes,
  rm.verified_at,
  rm.created_at,
  rm.updated_at
FROM revenue.competitor_room_mapping rm;

-- 3. Rate plan mix per property+channel+plan
CREATE OR REPLACE VIEW public.v_compset_competitor_rate_plan_mix AS
SELECT
  rpm.comp_id,
  rpm.property_name,
  rpm.is_self,
  rpm.channel,
  rpm.taxonomy_code,
  rpm.plan_name,
  rpm.category,
  rpm.dates_offered,
  rpm.avg_rate_usd,
  rpm.min_rate_usd,
  rpm.max_rate_usd,
  rpm.avg_discount_pct,
  rpm.has_member_variant,
  rpm.distinct_labels
FROM revenue.competitor_rate_plan_mix rpm;

-- 4. Rate matrix observations (stay_date × channel)
CREATE OR REPLACE VIEW public.v_compset_competitor_rate_matrix AS
SELECT
  rm.comp_id,
  rm.stay_date,
  rm.channel,
  rm.rate_usd,
  rm.is_available,
  rm.is_refundable,
  rm.shop_date,
  rm.scrape_status,
  rm.display_date,
  rm.events,
  rm.event_score
FROM revenue.competitor_rate_matrix rm;

-- 5. Latest platform rankings per comp×channel×sort
CREATE OR REPLACE VIEW public.v_compset_ranking_latest AS
SELECT
  rl.comp_id,
  rl.channel,
  rl.search_destination,
  rl.sort_order,
  rl.position,
  rl.total_results,
  rl.page_number,
  rl.is_above_fold,
  rl.is_first_page,
  rl.has_sponsored_badge,
  rl.has_genius_badge,
  rl.shop_date,
  rl.days_old,
  -- attach movement (delta vs prev shop)
  rmv.prev_position,
  rmv.positions_gained,
  rmv.movement
FROM revenue.ranking_latest rl
LEFT JOIN revenue.ranking_movement rmv
  ON rmv.channel = rl.channel
 AND rmv.search_destination = rl.search_destination
 AND rmv.sort_order = rl.sort_order
 AND rmv.property_name IN (
       SELECT property_name FROM revenue.competitor_property WHERE comp_id = rl.comp_id
     );

-- 6. Reviews summary per property (already has by_channel jsonb)
CREATE OR REPLACE VIEW public.v_compset_competitor_reviews_summary AS
SELECT
  rs.comp_id,
  rs.weighted_score,
  rs.total_reviews,
  rs.channels_with_reviews,
  rs.by_channel
FROM revenue.competitor_reviews_summary rs;

-- Grants — anon + authenticated need SELECT to flow through PostgREST as the
-- service-role client we use server-side; keep them parallel to existing v_compset_* proxies.
GRANT SELECT ON public.v_compset_competitor_property_detail TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_competitor_room_mapping       TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_competitor_rate_plan_mix      TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_competitor_rate_matrix        TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_ranking_latest                TO anon, authenticated, service_role;
GRANT SELECT ON public.v_compset_competitor_reviews_summary    TO anon, authenticated, service_role;
