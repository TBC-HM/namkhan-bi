-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504140422
-- Name:    f_channel_econ_for_range_v3_with_commission
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- v3: join with sources.commission_pct (deduped to MAX per name) so the
-- channels page commission tile gets a real STLY delta instead of returning 0.
-- sources can have duplicate name entries with different rates — take MAX as
-- the conservative (worst-case-cost) estimate. mv_channel_economics likely
-- uses similar logic; matches the 8.8% commission % the page shows today.
CREATE OR REPLACE FUNCTION public.f_channel_econ_for_range(p_from date, p_to date)
RETURNS TABLE (
  property_id bigint,
  source_name text,
  window_days int,
  bookings bigint,
  canceled bigint,
  gross_revenue numeric,
  roomnights bigint,
  commission_pct numeric,
  commission_usd numeric,
  net_revenue numeric,
  adr numeric,
  cancel_pct numeric,
  avg_lead_days numeric,
  avg_los numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  WITH src_comm AS (
    SELECT name, MAX(commission_pct)::numeric AS commission_pct
    FROM public.sources
    WHERE commission_pct IS NOT NULL
    GROUP BY name
  ),
  agg AS (
    SELECT
      r.source_name,
      COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') AS bookings,
      COUNT(*) FILTER (WHERE r.status ILIKE '%cancel%') AS canceled,
      COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS gross_revenue,
      COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::bigint AS roomnights,
      AVG((r.check_in_date - r.booking_date::date)::numeric)::numeric AS avg_lead_days,
      AVG(r.nights)::numeric AS avg_los,
      COUNT(*) AS total_with_cancel
    FROM public.reservations r
    WHERE r.property_id = 260955
      AND r.check_in_date BETWEEN p_from AND p_to
      AND r.source_name IS NOT NULL
      AND r.source_name <> ''
    GROUP BY r.source_name
    HAVING COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') > 0
  )
  SELECT
    260955::bigint AS property_id,
    a.source_name,
    0::int AS window_days,
    a.bookings,
    a.canceled,
    a.gross_revenue,
    a.roomnights,
    COALESCE(s.commission_pct, 0)::numeric AS commission_pct,
    (a.gross_revenue * COALESCE(s.commission_pct, 0) / 100)::numeric AS commission_usd,
    (a.gross_revenue - a.gross_revenue * COALESCE(s.commission_pct, 0) / 100)::numeric AS net_revenue,
    CASE WHEN a.roomnights > 0 THEN a.gross_revenue / a.roomnights::numeric ELSE 0 END AS adr,
    CASE WHEN a.total_with_cancel > 0
         THEN a.canceled::numeric / a.total_with_cancel::numeric * 100
         ELSE 0 END AS cancel_pct,
    a.avg_lead_days,
    a.avg_los
  FROM agg a
  LEFT JOIN src_comm s ON s.name = a.source_name
  ORDER BY a.gross_revenue DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_econ_for_range(date, date) TO anon, authenticated, service_role;