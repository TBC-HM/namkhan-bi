-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504160054
-- Name:    add_f_channel_mix_categorized_for_range
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Date-range channel-mix categorized aggregator. Same shape as
-- v_channel_mix_categorized_30d but takes p_from / p_to so Pulse channel mix
-- panel honors the ?win= chip (YTD, L12M, etc.) instead of always showing 30d.
CREATE OR REPLACE FUNCTION public.f_channel_mix_categorized_for_range(p_from date, p_to date)
RETURNS TABLE (
  category text,
  bookings numeric,
  room_nights numeric,
  gross_revenue numeric,
  net_revenue numeric,
  net_revenue_pct numeric,
  commission_leak numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  WITH src_comm AS (
    SELECT name, MAX(commission_pct)::numeric AS commission_pct
    FROM public.sources WHERE commission_pct IS NOT NULL GROUP BY name
  ),
  per_source AS (
    SELECT
      r.source_name,
      COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%')::numeric AS bookings,
      COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'),0)::numeric AS rn,
      COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'),0)::numeric AS gross
    FROM public.reservations r
    WHERE r.property_id = 260955
      AND r.check_in_date BETWEEN p_from AND p_to
      AND r.source_name IS NOT NULL AND r.source_name <> ''
    GROUP BY r.source_name
  ),
  per_source_with_comm AS (
    SELECT ps.*, COALESCE(sc.commission_pct, 0) AS commission_pct
    FROM per_source ps LEFT JOIN src_comm sc ON sc.name = ps.source_name
  ),
  categorized AS (
    SELECT
      CASE
        WHEN source_name ~* '(booking\.com|expedia|agoda|airbnb|ctrip|trip\.com|hotels\.com|traveloka)' THEN 'OTA'
        WHEN source_name ~* '(direct|website|booking engine|email|walk[- ]?in|siteminder|synxis)' THEN 'Direct'
        WHEN source_name ~* '(hotelbeds|gta|tourico|wholesale|bonotel|miki|reseller|khiri|trails of)' THEN 'Wholesale'
        WHEN source_name ~* '(group)' THEN 'Group'
        ELSE 'Other'
      END AS category,
      bookings, rn, gross, commission_pct
    FROM per_source_with_comm
  )
  SELECT
    category,
    SUM(bookings) AS bookings,
    SUM(rn) AS room_nights,
    SUM(gross) AS gross_revenue,
    SUM(gross * (1 - commission_pct / 100))::numeric AS net_revenue,
    -- net_revenue_pct of total
    (SUM(gross * (1 - commission_pct / 100)) / NULLIF((SELECT SUM(gross * (1 - commission_pct / 100)) FROM categorized), 0) * 100)::numeric AS net_revenue_pct,
    SUM(gross * commission_pct / 100)::numeric AS commission_leak
  FROM categorized
  GROUP BY category
  HAVING SUM(gross) > 0
  ORDER BY net_revenue DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_mix_categorized_for_range(date, date) TO anon, authenticated, service_role;