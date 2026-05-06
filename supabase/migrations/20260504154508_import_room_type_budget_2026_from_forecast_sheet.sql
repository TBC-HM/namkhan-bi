-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504154508
-- Name:    import_room_type_budget_2026_from_forecast_sheet
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Import per-room-type forecast from "Forecast 26" tab of the 26 NK sheet.
-- Source: https://docs.google.com/spreadsheets/d/1pxu8hXgweHaDQNaky_fJcltHXRd3kzAiYt6qF_KPDXk
-- Loads room_nights + computed occupancy_pct into plan.drivers under
-- Budget 2026 v1 scenario, room_type_id populated (was NULL property-level only).
-- Riverfront Glamping closed Jul-Aug (units=0), so RN=0 and occ=0 for those.

-- Wipe existing room-type-keyed Budget 2026 v1 rows for room_nights and occupancy_pct
-- so re-runs are idempotent. Property-level rows (room_type_id IS NULL) untouched.
DELETE FROM plan.drivers
WHERE scenario_id = '3c5c4ca7-de33-4c01-8d56-f72455339053'
  AND room_type_id IS NOT NULL
  AND driver_key IN ('room_nights','occupancy_pct');

WITH forecast(room_type_id, period_month, rn, units) AS (VALUES
  -- Art Deluxe Family Room (573824) - 1 unit all year
  (573824::bigint,  1, 16, 1), (573824, 2, 15, 1), (573824, 3, 10, 1), (573824, 4, 10, 1),
  (573824, 5,  9, 1), (573824, 6,  7, 1), (573824, 7,  8, 1), (573824, 8,  8, 1),
  (573824, 9,  8, 1), (573824,10, 17, 1), (573824,11, 20, 1), (573824,12, 20, 1),
  -- Art Deluxe Room (511126) - 4 units all year
  (511126,  1, 64, 4), (511126, 2, 62, 4), (511126, 3, 40, 4), (511126, 4, 38, 4),
  (511126,  5, 37, 4), (511126, 6, 26, 4), (511126, 7, 33, 4), (511126, 8, 31, 4),
  (511126,  9, 30, 4), (511126,10, 68, 4), (511126,11, 78, 4), (511126,12, 81, 4),
  -- Art Deluxe Suite (580744) - 2 units all year
  (580744,  1, 32, 2), (580744, 2, 31, 2), (580744, 3, 20, 2), (580744, 4, 19, 2),
  (580744,  5, 19, 2), (580744, 6, 13, 2), (580744, 7, 17, 2), (580744, 8, 16, 2),
  (580744,  9, 15, 2), (580744,10, 34, 2), (580744,11, 39, 2), (580744,12, 40, 2),
  -- Explorer Glamping (511115) - 5 units Jan-May, 7 units Jun-Dec
  (511115,  1, 81, 5), (511115, 2, 77, 5), (511115, 3, 50, 5), (511115, 4, 48, 5),
  (511115,  5, 47, 5), (511115, 6, 46, 7), (511115, 7, 59, 7), (511115, 8, 54, 7),
  (511115,  9, 53, 7), (511115,10,119, 7), (511115,11,137, 7), (511115,12,141, 7),
  -- Riverfront Glamping (508412) - 4 units, CLOSED Jul-Aug (0 units → 0 RN)
  (508412,  1, 64, 4), (508412, 2, 62, 4), (508412, 3, 40, 4), (508412, 4, 38, 4),
  (508412,  5, 37, 4), (508412, 6, 26, 4), (508412, 7,  0, 0), (508412, 8,  0, 0),
  (508412,  9, 30, 4), (508412,10, 68, 4), (508412,11, 78, 4), (508412,12, 81, 4),
  -- Riverfront Suite (555876) - 1 unit all year
  (555876,  1, 16, 1), (555876, 2, 15, 1), (555876, 3, 10, 1), (555876, 4, 10, 1),
  (555876,  5,  9, 1), (555876, 6,  7, 1), (555876, 7,  8, 1), (555876, 8,  8, 1),
  (555876,  9,  8, 1), (555876,10, 17, 1), (555876,11, 20, 1), (555876,12, 20, 1),
  -- Riverview Suite (511120) - 4 units all year
  (511120,  1, 64, 4), (511120, 2, 62, 4), (511120, 3, 40, 4), (511120, 4, 38, 4),
  (511120,  5, 37, 4), (511120, 6, 26, 4), (511120, 7, 33, 4), (511120, 8, 31, 4),
  (511120,  9, 30, 4), (511120,10, 68, 4), (511120,11, 78, 4), (511120,12, 81, 4),
  -- Sunset Luang Prabang Villa (581432) - 1 unit all year
  (581432,  1, 16, 1), (581432, 2, 15, 1), (581432, 3, 10, 1), (581432, 4, 10, 1),
  (581432,  5,  9, 1), (581432, 6,  7, 1), (581432, 7,  8, 1), (581432, 8,  8, 1),
  (581432,  9,  8, 1), (581432,10, 17, 1), (581432,11, 20, 1), (581432,12, 20, 1),
  -- Sunset Namkhan River Villa (555878) - 1 unit all year
  (555878,  1, 16, 1), (555878, 2, 15, 1), (555878, 3, 10, 1), (555878, 4, 10, 1),
  (555878,  5,  9, 1), (555878, 6,  7, 1), (555878, 7,  8, 1), (555878, 8,  8, 1),
  (555878,  9,  8, 1), (555878,10, 17, 1), (555878,11, 20, 1), (555878,12, 20, 1)
),
with_dim AS (
  SELECT
    f.*,
    EXTRACT(DAY FROM (make_date(2026, f.period_month, 1) + INTERVAL '1 month' - INTERVAL '1 day'))::int AS days_in_month
  FROM forecast f
)
INSERT INTO plan.drivers (scenario_id, period_year, period_month, room_type_id, driver_key, value_numeric)
SELECT
  '3c5c4ca7-de33-4c01-8d56-f72455339053'::uuid AS scenario_id,
  2026 AS period_year,
  d.period_month,
  d.room_type_id::text AS room_type_id,
  k.driver_key,
  k.val
FROM with_dim d
CROSS JOIN LATERAL (VALUES
  ('room_nights'::text, d.rn::numeric),
  ('occupancy_pct'::text,
     CASE WHEN d.units = 0 OR d.units IS NULL THEN 0
          ELSE (d.rn::numeric / (d.units * d.days_in_month)::numeric * 100)
     END)
) k(driver_key, val);

-- Sanity: how many rows landed?
SELECT
  count(*) FILTER (WHERE driver_key='room_nights')   AS rn_rows,
  count(*) FILTER (WHERE driver_key='occupancy_pct') AS occ_rows
FROM plan.drivers
WHERE scenario_id = '3c5c4ca7-de33-4c01-8d56-f72455339053'
  AND room_type_id IS NOT NULL;