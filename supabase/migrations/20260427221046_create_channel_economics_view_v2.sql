-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427221046
-- Name:    create_channel_economics_view_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Channel economics view — fix the subquery scoping
CREATE OR REPLACE VIEW kpi.v_channel_economics AS
WITH commission_rates AS (
  SELECT * FROM (VALUES
    ('Booking.com', 0.15),
    ('Expedia', 0.18),
    ('CTrip', 0.15),
    ('Trip.com', 0.15),
    ('Traveloka', 0.15),
    ('Agoda', 0.15),
    ('Website', 0.0),
    ('Email', 0.0),
    ('Walk-In', 0.0),
    ('Khiri', 0.20),
    ('Retreat', 0.25),
    ('SynXis', 0.10),
    ('Hospitality Solutions', 0.10),
    ('Hilton', 0.0),
    ('Amica', 0.20),
    ('Tripaneer', 0.25)
  ) AS t(channel_keyword, commission_rate)
),
agg AS (
  SELECT 
    COALESCE(s.name, r.source_name, 'Unknown') AS source,
    COUNT(DISTINCT r.reservation_id) AS reservations,
    COUNT(rr.id) AS room_nights,
    ROUND(SUM(rr.rate)::numeric, 2) AS gross_revenue,
    ROUND(AVG(rr.rate)::numeric, 2) AS gross_adr
  FROM public.reservations r
  JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
  LEFT JOIN public.sources s ON s.source_id = r.source
  WHERE rr.night_date >= CURRENT_DATE - 90
    AND rr.night_date < CURRENT_DATE
    AND r.status NOT IN ('canceled','no_show')
    AND r.is_cancelled = false
    AND rr.rate > 0
  GROUP BY COALESCE(s.name, r.source_name, 'Unknown')
  HAVING COUNT(rr.id) >= 3
),
with_commission AS (
  SELECT 
    a.*,
    (SELECT cr.commission_rate 
     FROM commission_rates cr 
     WHERE a.source ILIKE '%' || cr.channel_keyword || '%' 
     ORDER BY length(cr.channel_keyword) DESC LIMIT 1) AS est_commission_pct
  FROM agg a
)
SELECT 
  source,
  reservations,
  room_nights,
  gross_revenue,
  gross_adr,
  ROUND((COALESCE(est_commission_pct, 0.10) * 100)::numeric, 0) AS est_commission_pct,
  ROUND((gross_revenue * COALESCE(est_commission_pct, 0.10))::numeric, 2) AS est_commission_usd,
  ROUND((gross_revenue * (1 - COALESCE(est_commission_pct, 0.10)))::numeric, 2) AS net_revenue,
  ROUND((gross_adr * (1 - COALESCE(est_commission_pct, 0.10)))::numeric, 2) AS net_adr
FROM with_commission
ORDER BY gross_revenue DESC;