-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503145700
-- Name:    phase5_import_stly_2025
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Source: 26 NK sheet, "STLY 2025" rows in Forecast 26 tab
-- Pre-clear in case of re-runs
DELETE FROM plan.drivers 
WHERE scenario_id = '47676c4a-1440-44a6-b14d-d76beb11c5e9';

INSERT INTO plan.drivers (scenario_id, period_year, period_month, driver_key, value_numeric, notes)
VALUES
  -- Room Revenue 2025 (USD)
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 1,  'revenue_rooms_usd', 81202,  'STLY from 26 NK sheet'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 2,  'revenue_rooms_usd', 84992,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 3,  'revenue_rooms_usd', 36409,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 4,  'revenue_rooms_usd', 38276,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 5,  'revenue_rooms_usd', 29331,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 6,  'revenue_rooms_usd', 21672,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 7,  'revenue_rooms_usd', 23672,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 8,  'revenue_rooms_usd', 15031,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 9,  'revenue_rooms_usd', 21835,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 10, 'revenue_rooms_usd', 66977,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 11, 'revenue_rooms_usd', 75059,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 12, 'revenue_rooms_usd', 79860,  'STLY'),

  -- Total Revenue 2025
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 1,  'revenue_total_usd', 108232, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 2,  'revenue_total_usd', 111452, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 3,  'revenue_total_usd', 52195,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 4,  'revenue_total_usd', 56644,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 5,  'revenue_total_usd', 41252,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 6,  'revenue_total_usd', 31646,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 7,  'revenue_total_usd', 33092,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 8,  'revenue_total_usd', 21611,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 9,  'revenue_total_usd', 32149,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 10, 'revenue_total_usd', 116009, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 11, 'revenue_total_usd', 105678, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 12, 'revenue_total_usd', 113541, 'STLY'),

  -- Ancillary 2025
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 1,  'revenue_ancillary_usd', 27030, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 2,  'revenue_ancillary_usd', 26460, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 3,  'revenue_ancillary_usd', 15786, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 4,  'revenue_ancillary_usd', 18368, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 5,  'revenue_ancillary_usd', 11921, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 6,  'revenue_ancillary_usd', 9974,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 7,  'revenue_ancillary_usd', 9420,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 8,  'revenue_ancillary_usd', 6580,  'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 9,  'revenue_ancillary_usd', 10314, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 10, 'revenue_ancillary_usd', 49032, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 11, 'revenue_ancillary_usd', 30619, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 12, 'revenue_ancillary_usd', 33681, 'STLY'),

  -- Occupancy 2025 (%)
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 1,  'occupancy_pct', 50, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 2,  'occupancy_pct', 62, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 3,  'occupancy_pct', 30, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 4,  'occupancy_pct', 30, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 5,  'occupancy_pct', 26, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 6,  'occupancy_pct', 23, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 7,  'occupancy_pct', 23, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 8,  'occupancy_pct', 27, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 9,  'occupancy_pct', 13, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 10, 'occupancy_pct', 23, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 11, 'occupancy_pct', 41, 'STLY'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 12, 'occupancy_pct', 42, 'STLY'),

  -- Room Nights 2025 (derived: total annual 2992 spread by occ%)
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 1,  'room_nights', 465,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 2,  'room_nights', 521,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 3,  'room_nights', 279,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 4,  'room_nights', 270,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 5,  'room_nights', 242,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 6,  'room_nights', 207,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 7,  'room_nights', 214,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 8,  'room_nights', 251,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 9,  'room_nights', 117,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 10, 'room_nights', 214,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 11, 'room_nights', 369,  'STLY derived'),
  ('47676c4a-1440-44a6-b14d-d76beb11c5e9', 2025, 12, 'room_nights', 391,  'STLY derived');
