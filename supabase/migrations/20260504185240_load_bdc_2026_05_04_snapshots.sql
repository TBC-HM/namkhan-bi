-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504185240
-- Name:    load_bdc_2026_05_04_snapshots
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Load 2026-05-04 snapshot from PBS's Booking.com PDF exports.
-- All numeric values transcribed from the 4 PDFs + 1 CSV.

-- ─── Country insights (Booker insights PDF, 365d window, 337 rooms) ────────
INSERT INTO revenue.bdc_country_insights (snapshot_date, country, my_reservation_pct, my_adr_usd, my_book_window_days, my_cancel_pct, my_los_nights, market_reservation_pct, market_adr_usd, market_book_window_days, market_cancel_pct, market_los_nights) VALUES
('2026-05-04', '_ALL_',          NULL,  197.40, 45.46, 33.07, 2.70,  NULL,  45.25, 29.11, 23.66, 2.34),
('2026-05-04', 'Germany',        13.50, 177.53, 31.45, 27.59, 2.93,  8.65,  48.42, 34.47, 19.87, 2.69),
('2026-05-04', 'France',         11.64, 202.37, 38.71, 17.39, 2.79,  16.09, 39.53, 31.00, 17.21, 2.59),
('2026-05-04', 'United Kingdom', 11.42, 221.43, 87.33, 37.50, 3.47,  10.26, 42.46, 31.60, 19.32, 2.60),
('2026-05-04', 'United States',  8.89,  206.32, 40.19, 35.42, 2.61,  4.80,  63.61, 28.60, 22.46, 2.68),
('2026-05-04', 'Japan',          4.72,  214.74, 58.94, 18.18, 2.39,  3.66,  48.40, 36.76, 24.73, 2.32),
('2026-05-04', 'Singapore',      3.73,  243.86, 34.91, 38.89, 3.09,  1.10,  77.18, 26.59, 25.72, 2.35),
('2026-05-04', 'Vietnam',        3.51,  245.27, 70.33, 20.00, 2.67,  1.90,  46.14, 18.62, 16.07, 2.09),
('2026-05-04', 'Switzerland',    3.29,  246.77, 53.17, 7.69,  2.50,  2.60,  60.71, 28.83, 19.26, 2.62),
('2026-05-04', 'Belgium',        3.18,  155.18, 40.36, 26.67, 2.64,  2.00,  47.38, 31.06, 21.38, 2.30),
('2026-05-04', 'Thailand',       3.07,  167.54, 11.73, 67.65, 2.55,  5.53,  49.52, 23.44, 31.33, 2.10),
('2026-05-04', 'Netherlands',    2.74,  147.68, 20.80, 36.84, 2.50,  3.72,  43.28, 25.95, 21.77, 2.50),
('2026-05-04', 'Israel',         2.20,  261.59, 26.75, 20.00, 2.50,  1.96,  34.79, 17.88, 24.17, 2.17),
('2026-05-04', 'Czech Republic', 2.09,  168.20, 126.67, 25.00, 6.33, 0.56,  46.17, 36.40, 29.90, 2.26),
('2026-05-04', 'Russia',         1.98,  183.46, 82.00, 50.00, 1.80,  0.66,  54.60, 32.21, 26.92, 2.51),
('2026-05-04', 'Laos',           1.65,  127.88, 10.67, 18.18, 1.67,  6.82,  29.65, 5.03,  16.16, 1.75),
('2026-05-04', 'Italy',          1.54,  172.41, 83.29, 58.82, 2.00,  2.37,  42.65, 35.60, 31.50, 2.38),
('2026-05-04', 'Spain',          1.54,  202.09, 41.00, 28.57, 3.50,  2.18,  38.66, 35.43, 19.87, 2.37),
('2026-05-04', 'China',          1.43,  227.66, 20.13, 27.27, 1.63,  2.96,  39.95, 12.89, 32.25, 2.01),
('2026-05-04', 'Australia',      1.43,  164.56, 29.75, 42.86, 3.25,  4.21,  51.81, 38.20, 22.98, 2.56),
('2026-05-04', 'Portugal',       1.32,  158.80, 95.17, 33.33, 2.00,  0.48,  45.19, 37.87, 27.80, 2.37),
('2026-05-04', 'Hong Kong',      1.21,  207.99, 46.33, 0.00,  3.67,  0.41,  78.19, 23.44, 18.15, 2.15),
('2026-05-04', 'Canada',         1.10,  235.69, 21.67, 40.00, 3.33,  1.83,  44.40, 39.66, 23.51, 2.75),
('2026-05-04', 'India',          0.99,  134.56, 25.80, 28.57, 1.80,  0.90,  46.75, 30.28, 29.23, 2.27),
('2026-05-04', 'Austria',        0.99,  97.94,  17.67, 25.00, 3.00,  0.92,  56.66, 35.57, 19.24, 2.56)
ON CONFLICT (snapshot_date, country) DO UPDATE SET
  my_reservation_pct=EXCLUDED.my_reservation_pct, my_adr_usd=EXCLUDED.my_adr_usd,
  my_book_window_days=EXCLUDED.my_book_window_days, my_cancel_pct=EXCLUDED.my_cancel_pct,
  my_los_nights=EXCLUDED.my_los_nights,
  market_reservation_pct=EXCLUDED.market_reservation_pct, market_adr_usd=EXCLUDED.market_adr_usd,
  market_book_window_days=EXCLUDED.market_book_window_days, market_cancel_pct=EXCLUDED.market_cancel_pct,
  market_los_nights=EXCLUDED.market_los_nights;

-- ─── Book window distribution (Book window info PDF, 90d window, 85 rooms) ──
-- Note: chart shows %share by window, with cancel% from screenshot.
-- ADR + cancel% read from chart approximations + screenshot.
INSERT INTO revenue.bdc_book_window_insights (snapshot_date, window_label, sort_order, my_reservation_pct, my_adr_usd, compset_reservation_pct, compset_adr_usd, my_cancel_pct, compset_cancel_pct) VALUES
('2026-05-04', '0-1 day',     1, 22.0, 134.45, 8.0,  110.85, 8.8, 0.9),
('2026-05-04', '2-3 days',    2, 12.0, 139.50, 8.5,  112.25, 1.1, 0.5),
('2026-05-04', '4-7 days',    3, 13.0, 147.01, 8.0,  139.37, 2.2, 1.0),
('2026-05-04', '8-14 days',   4, 12.0, 154.13, 9.0,  117.62, 6.6, 3.7),
('2026-05-04', '15-30 days',  5, 19.0, 175.10, 16.0, 138.94, 5.5, 8.2),
('2026-05-04', '31-60 days',  6, 6.0,  184.66, 13.0, 167.64, 6.6, 7.5),
('2026-05-04', '61-90 days',  7, 0.0,  137.96, 7.0,  147.92, 0.0, 4.1),
('2026-05-04', '91+ days',    8, 17.0, 181.66, 31.0, 163.52, 6.0, 0.0)
ON CONFLICT (snapshot_date, window_label) DO UPDATE SET
  my_reservation_pct=EXCLUDED.my_reservation_pct, my_adr_usd=EXCLUDED.my_adr_usd,
  compset_reservation_pct=EXCLUDED.compset_reservation_pct, compset_adr_usd=EXCLUDED.compset_adr_usd,
  my_cancel_pct=EXCLUDED.my_cancel_pct, compset_cancel_pct=EXCLUDED.compset_cancel_pct;

-- ─── Genius monthly (Performance timeline CSV) ──────────────────────────────
INSERT INTO revenue.bdc_genius_monthly (snapshot_date, period_month, bookings, bookings_last_year, genius_pct, genius_pct_last_year) VALUES
('2026-05-04', '2025-05', 23, 8,  87.0,  88.0),
('2026-05-04', '2025-06', 32, 6,  84.0,  83.0),
('2026-05-04', '2025-07', 23, 18, 100.0, 61.0),
('2026-05-04', '2025-08', 14, 14, 86.0,  79.0)
ON CONFLICT (snapshot_date, period_month) DO UPDATE SET
  bookings=EXCLUDED.bookings, bookings_last_year=EXCLUDED.bookings_last_year,
  genius_pct=EXCLUDED.genius_pct, genius_pct_last_year=EXCLUDED.genius_pct_last_year;

-- ─── Pace report monthly (Pace report PDF, 365d window) ─────────────────────
INSERT INTO revenue.bdc_pace_monthly (snapshot_date, stay_year_month, rn_current, rn_last_year, rn_diff_pct, revenue_current_usd, revenue_last_year_usd, revenue_diff_pct, adr_current_usd, adr_last_year_usd, adr_diff_pct) VALUES
('2026-05-04', '2026-05', 25, 22, 13.64,    5181.47, 2190.04, 136.59, 207.26, 99.55,  108.20),
('2026-05-04', '2026-06', 6,  9,  -33.33,   1997.10, 1204.78, 65.76,  332.85, 133.86, 148.65),
('2026-05-04', '2026-07', 15, 17, -11.76,   2815.85, 1946.46, 44.66,  187.72, 114.50, 63.95),
('2026-05-04', '2026-08', 10, 21, -52.38,   1887.41, 2679.76, -29.57, 188.74, 127.61, 47.91),
('2026-05-04', '2026-09', 1,  0,  0.00,     245.73,  0.00,    0.00,   245.73, 0.00,   0.00),
('2026-05-04', '2026-10', 6,  9,  -33.33,   1338.12, 2843.70, -52.94, 223.02, 315.97, -29.42),
('2026-05-04', '2026-11', 0,  9,  -100.00,  0.00,    2674.23, -100.00, 0.00,  297.14, -100.00)
ON CONFLICT (snapshot_date, stay_year_month) DO UPDATE SET
  rn_current=EXCLUDED.rn_current, rn_last_year=EXCLUDED.rn_last_year, rn_diff_pct=EXCLUDED.rn_diff_pct,
  revenue_current_usd=EXCLUDED.revenue_current_usd, revenue_last_year_usd=EXCLUDED.revenue_last_year_usd,
  revenue_diff_pct=EXCLUDED.revenue_diff_pct,
  adr_current_usd=EXCLUDED.adr_current_usd, adr_last_year_usd=EXCLUDED.adr_last_year_usd,
  adr_diff_pct=EXCLUDED.adr_diff_pct;

-- ─── Pace by room × rate plan (Pace report PDF p2) ──────────────────────────
INSERT INTO revenue.bdc_pace_room_rate (snapshot_date, room_type, rate_plan, room_nights, revenue_usd, adr_usd) VALUES
('2026-05-04', 'Art Deluxe Room',           'Advance Purchase',   10, 2233.44, 223.34),
('2026-05-04', 'Art Deluxe Room',           'Semi - Flex Rate',   2,  326.70,  163.35),
('2026-05-04', 'Art Deluxe Room',           'Standard Rate',      16, 2887.38, 180.46),
('2026-05-04', 'Art Deluxe Family Room',    'Advance Purchase',   5,  1160.20, 232.04),
('2026-05-04', 'Art Deluxe Family Room',    'Non-refundable',     1,  215.90,  215.90),
('2026-05-04', 'Art Deluxe Family Room',    'Semi - Flex Rate',   5,  1208.65, 241.73),
('2026-05-04', 'Art Deluxe Family Room',    'Standard Rate',      1,  207.90,  207.90),
('2026-05-04', 'Riverview Suite',           'Standard Rate',      9,  2988.90, 332.10),
('2026-05-04', 'Riverfront Suite',          'Standard Rate',      5,  2044.80, 408.96),
('2026-05-04', 'Riverfront Suite',          'Value Add_NRF',      4,  770.00,  192.50),
('2026-05-04', 'Riverfront Glamping',       'Advance Purchase',   2,  418.88,  209.44),
('2026-05-04', 'Riverfront Glamping',       'Semi - Flex Rate',   4,  1005.48, 251.37),
('2026-05-04', 'Riverfront Glamping',       'Standard Rate',      2,  405.72,  202.86),
('2026-05-04', 'Explorer Glamping',         'Semi - Flex Rate',   2,  290.70,  145.35),
('2026-05-04', 'Explorer Glamping',         'Standard Rate',      5,  590.40,  118.08),
('2026-05-04', 'Sunset Namkhan Villa',      'Semi - Flex Rate',   4,  1795.50, 448.88),
('2026-05-04', 'Sunset Namkhan Villa',      'Standard Rate',      3,  2145.00, 715.00),
('2026-05-04', 'Sunset Luang Prabang Villa','Semi - Flex Rate',   4,  1561.52, 390.38),
('2026-05-04', 'Sunset Luang Prabang Villa','Value Add_NRF',      3,  1080.00, 360.00),
('2026-05-04', 'Art Deluxe Suite',          'Standard Rate',      5,  496.91,  99.38)
ON CONFLICT (snapshot_date, room_type, rate_plan) DO UPDATE SET
  room_nights=EXCLUDED.room_nights, revenue_usd=EXCLUDED.revenue_usd, adr_usd=EXCLUDED.adr_usd;

-- ─── Ranking dashboard snapshot (from screenshot, last 90d) ─────────────────
INSERT INTO revenue.bdc_ranking_snapshot (snapshot_date, search_views, page_views, bookings, search_to_page_pct, page_to_book_pct, search_score, search_score_max, better_than_pct_in_city, conversion_pct, area_avg_conversion_pct, cancel_pct, area_avg_cancel_pct, review_score, area_avg_review_score) VALUES
('2026-05-04', 290689, 79815, 135, 27.46, 0.17, 58, 375, 84.0, 0.17, NULL, 32.0, 24.3, 9.4, 8.6)
ON CONFLICT (snapshot_date) DO UPDATE SET
  search_views=EXCLUDED.search_views, page_views=EXCLUDED.page_views, bookings=EXCLUDED.bookings,
  search_to_page_pct=EXCLUDED.search_to_page_pct, page_to_book_pct=EXCLUDED.page_to_book_pct,
  search_score=EXCLUDED.search_score, search_score_max=EXCLUDED.search_score_max,
  better_than_pct_in_city=EXCLUDED.better_than_pct_in_city,
  conversion_pct=EXCLUDED.conversion_pct, cancel_pct=EXCLUDED.cancel_pct,
  area_avg_cancel_pct=EXCLUDED.area_avg_cancel_pct, review_score=EXCLUDED.review_score,
  area_avg_review_score=EXCLUDED.area_avg_review_score;