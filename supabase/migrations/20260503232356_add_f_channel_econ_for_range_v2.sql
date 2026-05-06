-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503232356
-- Name:    add_f_channel_econ_for_range_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

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
  SELECT
    260955::bigint AS property_id,
    r.source_name,
    0::int AS window_days,
    COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') AS bookings,
    COUNT(*) FILTER (WHERE r.status ILIKE '%cancel%') AS canceled,
    COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS gross_revenue,
    COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::bigint AS roomnights,
    0::numeric AS commission_pct,
    0::numeric AS commission_usd,
    COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric AS net_revenue,
    CASE WHEN COALESCE(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0) > 0
         THEN COALESCE(SUM(r.total_amount) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric
              / NULLIF(SUM(r.nights) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%'), 0)::numeric
         ELSE 0::numeric
    END AS adr,
    CASE WHEN COUNT(*) > 0
         THEN (COUNT(*) FILTER (WHERE r.status ILIKE '%cancel%'))::numeric / COUNT(*)::numeric * 100
         ELSE 0::numeric
    END AS cancel_pct,
    -- date - date returns integer days directly in Postgres
    AVG((r.check_in_date - r.booking_date::date)::numeric)::numeric AS avg_lead_days,
    AVG(r.nights)::numeric AS avg_los
  FROM public.reservations r
  WHERE r.property_id = 260955
    AND r.check_in_date BETWEEN p_from AND p_to
    AND r.source_name IS NOT NULL
    AND r.source_name <> ''
  GROUP BY r.source_name
  HAVING COUNT(*) FILTER (WHERE r.status NOT ILIKE '%cancel%' AND r.status NOT ILIKE '%no_show%') > 0
  ORDER BY 6 DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.f_channel_econ_for_range(date, date) TO anon, authenticated, service_role;