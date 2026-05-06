-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145813
-- Name:    phase7_channel_mix_categorized
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Wrap v_channel_mix_30d with channel-category bucketing for the bar
CREATE OR REPLACE VIEW public.v_channel_mix_categorized_30d AS
WITH base AS (
  SELECT * FROM public.v_channel_mix_30d
),
categorized AS (
  SELECT 
    CASE
      WHEN source ILIKE ANY (ARRAY['%Booking.com%','%Expedia%','%Agoda%','%Airbnb%','%CTrip%','%Trip.com%','%Hotels.com%']) THEN 'OTA'
      WHEN source ILIKE ANY (ARRAY['%Website%','%Booking Engine%','%SynXis%','%Direct%','%Email%','%Phone%','%Walk-In%']) THEN 'Direct'
      WHEN source ILIKE ANY (ARRAY['%Khiri%','%Tiger%','%Mood%','%Travel%','%Wholesale%','%DMC%','%Tour%']) THEN 'Wholesale'
      WHEN source ILIKE '%Group%' THEN 'Group'
      ELSE 'Other'
    END AS category,
    bookings, room_nights, gross_revenue, net_revenue
  FROM base
)
SELECT 
  category,
  SUM(bookings)       AS bookings,
  SUM(room_nights)    AS room_nights,
  ROUND(SUM(gross_revenue), 2) AS gross_revenue,
  ROUND(SUM(net_revenue), 2)   AS net_revenue,
  ROUND(100.0 * SUM(net_revenue) / NULLIF(SUM(SUM(net_revenue)) OVER (), 0), 1) AS net_revenue_pct,
  ROUND(SUM(gross_revenue) - SUM(net_revenue), 2) AS commission_leak
FROM categorized
GROUP BY category
ORDER BY net_revenue DESC;

GRANT SELECT ON public.v_channel_mix_categorized_30d TO anon, authenticated;
