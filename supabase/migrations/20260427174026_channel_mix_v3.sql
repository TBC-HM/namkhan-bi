-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427174026
-- Name:    channel_mix_v3
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Smart channel grouping based on source_name patterns
CREATE OR REPLACE VIEW v_channel_mix AS
WITH last90 AS (
  SELECT 
    r.source_name, rr.rate, rr.night_date,
    CASE 
      -- OTAs (named clearly)
      WHEN r.source_name ILIKE 'booking.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'expedia%' OR r.source_name ILIKE 'hotels.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'agoda%' OR r.source_name ILIKE 'priceline%' THEN 'OTA'
      WHEN r.source_name ILIKE 'ctrip%' OR r.source_name ILIKE 'trip.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'airbnb%' THEN 'OTA'
      WHEN r.source_name ILIKE 'vrbo%' THEN 'OTA'
      WHEN r.source_name ILIKE 'tripadvisor%' THEN 'OTA'
      WHEN r.source_name ILIKE 'traveloka%' THEN 'OTA'
      WHEN r.source_name ILIKE 'glampinghub%' THEN 'OTA'
      WHEN r.source_name ILIKE 'tablet hotels%' THEN 'OTA'
      WHEN r.source_name ILIKE 'siteminder%' OR r.source_name ILIKE 'synxis%' THEN 'OTA'
      WHEN r.source_name ILIKE 'reconline%' OR r.source_name ILIKE 'bakuun%' THEN 'OTA'
      -- Direct (named clearly)
      WHEN r.source_name ILIKE 'website%' OR r.source_name ILIKE 'booking engine%' THEN 'Direct'
      WHEN r.source_name = 'Walk-In' THEN 'Direct'
      WHEN r.source_name = 'Email' OR r.source_name = 'Phone' THEN 'Direct'
      WHEN r.source_name ILIKE '%direct%' THEN 'Direct'
      -- Wholesale / Tour Operators
      WHEN r.source_name ILIKE '%travel%' OR r.source_name ILIKE '%tour%' 
        OR r.source_name ILIKE '%retreat%' OR r.source_name ILIKE '%vigeo%' THEN 'Wholesale/Tour'
      -- Hospitality Solutions (CRS for SLH soft brands)
      WHEN r.source_name ILIKE 'hospitality solutions%' THEN 'CRS'
      WHEN r.source_name ILIKE 'hilton%' THEN 'CRS'
      ELSE 'Other'
    END AS channel_group
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE NOT r.is_cancelled 
    AND rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1
)
SELECT 
  channel_group,
  COALESCE(source_name,'(blank)') AS source_name,
  COUNT(*) AS room_nights,
  ROUND(SUM(rate)::numeric, 0) AS revenue,
  ROUND(AVG(rate)::numeric, 0) AS avg_adr
FROM last90
GROUP BY channel_group, source_name;

-- Channel summary (no source detail)
CREATE OR REPLACE VIEW v_channel_summary AS
WITH last90 AS (
  SELECT 
    CASE 
      WHEN r.source_name ILIKE 'booking.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'expedia%' OR r.source_name ILIKE 'hotels.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'agoda%' OR r.source_name ILIKE 'priceline%' THEN 'OTA'
      WHEN r.source_name ILIKE 'ctrip%' OR r.source_name ILIKE 'trip.com%' THEN 'OTA'
      WHEN r.source_name ILIKE 'airbnb%' THEN 'OTA'
      WHEN r.source_name ILIKE 'vrbo%' THEN 'OTA'
      WHEN r.source_name ILIKE 'tripadvisor%' THEN 'OTA'
      WHEN r.source_name ILIKE 'traveloka%' THEN 'OTA'
      WHEN r.source_name ILIKE 'glampinghub%' THEN 'OTA'
      WHEN r.source_name ILIKE 'tablet hotels%' THEN 'OTA'
      WHEN r.source_name ILIKE 'siteminder%' OR r.source_name ILIKE 'synxis%' THEN 'OTA'
      WHEN r.source_name ILIKE 'reconline%' OR r.source_name ILIKE 'bakuun%' THEN 'OTA'
      WHEN r.source_name ILIKE 'website%' OR r.source_name = 'Walk-In' OR r.source_name IN ('Email','Phone') THEN 'Direct'
      WHEN r.source_name ILIKE '%direct%' THEN 'Direct'
      WHEN r.source_name ILIKE '%travel%' OR r.source_name ILIKE '%tour%' 
        OR r.source_name ILIKE '%retreat%' OR r.source_name ILIKE '%vigeo%' THEN 'Wholesale/Tour'
      WHEN r.source_name ILIKE 'hospitality solutions%' OR r.source_name ILIKE 'hilton%' THEN 'CRS'
      ELSE 'Other'
    END AS channel_group,
    rr.rate
  FROM reservation_rooms rr
  JOIN reservations r ON r.reservation_id = rr.reservation_id
  WHERE NOT r.is_cancelled 
    AND rr.night_date BETWEEN CURRENT_DATE - 90 AND CURRENT_DATE - 1
)
SELECT 
  channel_group,
  COUNT(*) AS room_nights,
  ROUND(SUM(rate)::numeric, 0) AS revenue,
  ROUND(AVG(rate)::numeric, 0) AS avg_adr,
  ROUND(100.0 * SUM(rate) / SUM(SUM(rate)) OVER ()::numeric, 1) AS revenue_pct
FROM last90
GROUP BY channel_group
ORDER BY revenue DESC;
