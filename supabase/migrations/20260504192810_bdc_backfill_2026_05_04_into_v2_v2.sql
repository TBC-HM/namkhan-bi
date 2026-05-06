-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192810
-- Name:    bdc_backfill_2026_05_04_into_v2_v2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DO $$
DECLARE
  u_country uuid := gen_random_uuid();
  u_window  uuid := gen_random_uuid();
  u_genius  uuid := gen_random_uuid();
  u_pace_m  uuid := gen_random_uuid();
  u_pace_rr uuid := gen_random_uuid();
  u_rank    uuid := gen_random_uuid();
BEGIN
  INSERT INTO revenue.ota_uploads (id, ota_source, file_kind, file_name, snapshot_date, parser_version, status, notes) VALUES
    (u_country, 'Booking.com', 'booker_insights',  'booker-insights-country-2026-05-04.pdf', '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill'),
    (u_window,  'Booking.com', 'book_window',      'booker-insights-window-2026-05-04.pdf',  '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill'),
    (u_genius,  'Booking.com', 'genius_timeline',  'performance-timeline-2026-05-04.csv',    '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill'),
    (u_pace_m,  'Booking.com', 'pace_monthly',     'pace-report-monthly-2026-05-04.pdf',     '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill'),
    (u_pace_rr, 'Booking.com', 'pace_room_rate',   'pace-report-room-rate-2026-05-04.pdf',   '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill'),
    (u_rank,    'Booking.com', 'ranking',          'ranking-dashboard-2026-05-04.png',       '2026-05-04', 'bdc-v1-backfill', 'parsed', 'Synthetic backfill');

  -- Self-summary
  INSERT INTO revenue.bdc_self_summary (upload_id, snapshot_date, my_adr_usd, my_book_window_days, my_cancel_pct, my_los_nights, market_adr_usd, market_book_window_days, market_cancel_pct, market_los_nights)
  SELECT u_country, '2026-05-04',
         my_adr_usd, my_book_window_days, my_cancel_pct, my_los_nights,
         market_adr_usd, market_book_window_days, market_cancel_pct, market_los_nights
  FROM revenue.bdc_country_insights
  WHERE country = '_ALL_' AND snapshot_date = '2026-05-04';

  -- Country insights v2
  INSERT INTO revenue.bdc_country_insights_v2 (upload_id, snapshot_date, country, my_reservation_pct, my_adr_usd, my_book_window_days, my_cancel_pct, my_los_nights, market_reservation_pct, market_adr_usd, market_book_window_days, market_cancel_pct, market_los_nights)
  SELECT u_country, snapshot_date, country, my_reservation_pct, my_adr_usd, my_book_window_days, my_cancel_pct, my_los_nights, market_reservation_pct, market_adr_usd, market_book_window_days, market_cancel_pct, market_los_nights
  FROM revenue.bdc_country_insights
  WHERE country != '_ALL_' AND snapshot_date = '2026-05-04';

  -- Book window v2
  INSERT INTO revenue.bdc_book_window_insights_v2 (upload_id, snapshot_date, window_label, window_min_days, window_max_days, sort_order, my_reservation_pct, my_adr_usd, compset_reservation_pct, compset_adr_usd, my_cancel_pct, compset_cancel_pct)
  SELECT
    u_window,
    snapshot_date,
    window_label,
    CASE
      WHEN window_label LIKE '0%' THEN 0
      WHEN window_label LIKE '2%' THEN 2
      WHEN window_label LIKE '4%' THEN 4
      WHEN window_label LIKE '8%' THEN 8
      WHEN window_label LIKE '15%' THEN 15
      WHEN window_label LIKE '31%' THEN 31
      WHEN window_label LIKE '61%' THEN 61
      WHEN window_label LIKE '91%' THEN 91
      ELSE COALESCE(sort_order, 0)
    END,
    CASE
      WHEN window_label LIKE '0%' THEN 1
      WHEN window_label LIKE '2%' THEN 3
      WHEN window_label LIKE '4%' THEN 7
      WHEN window_label LIKE '8%' THEN 14
      WHEN window_label LIKE '15%' THEN 30
      WHEN window_label LIKE '31%' THEN 60
      WHEN window_label LIKE '61%' THEN 90
      WHEN window_label LIKE '91%' THEN NULL
      ELSE NULL
    END,
    sort_order, my_reservation_pct, my_adr_usd, compset_reservation_pct, compset_adr_usd, my_cancel_pct, compset_cancel_pct
  FROM revenue.bdc_book_window_insights
  WHERE snapshot_date = '2026-05-04';

  -- Genius v2 — period_month is 'YYYY-MM'
  INSERT INTO revenue.bdc_genius_monthly_v2 (upload_id, snapshot_date, period_month, bookings, bookings_last_year, genius_pct, genius_pct_last_year)
  SELECT u_genius, snapshot_date, (period_month || '-01')::date, bookings, bookings_last_year, genius_pct, genius_pct_last_year
  FROM revenue.bdc_genius_monthly
  WHERE snapshot_date = '2026-05-04';

  -- Pace monthly v2 — stay_year_month is 'YYYY-MM'
  INSERT INTO revenue.bdc_pace_monthly_v2 (upload_id, snapshot_date, stay_month, rn_current, rn_last_year, rn_diff_pct, revenue_current_usd, revenue_last_year_usd, revenue_diff_pct, adr_current_usd, adr_last_year_usd, adr_diff_pct)
  SELECT u_pace_m, snapshot_date, (stay_year_month || '-01')::date, rn_current, rn_last_year, rn_diff_pct, revenue_current_usd, revenue_last_year_usd, revenue_diff_pct, adr_current_usd, adr_last_year_usd, adr_diff_pct
  FROM revenue.bdc_pace_monthly
  WHERE snapshot_date = '2026-05-04';

  -- Pace room×rate v2
  INSERT INTO revenue.bdc_pace_room_rate_v2 (upload_id, snapshot_date, room_type_raw, room_type_id, rate_plan, room_nights, revenue_usd, adr_usd)
  SELECT u_pace_rr, snapshot_date, room_type, NULL, rate_plan, room_nights, revenue_usd, adr_usd
  FROM revenue.bdc_pace_room_rate
  WHERE snapshot_date = '2026-05-04';

  -- Ranking v2
  INSERT INTO revenue.bdc_ranking_snapshot_v2 (upload_id, snapshot_date, search_views, page_views, bookings, search_to_page_pct, page_to_book_pct, search_score, search_score_max, better_than_pct_in_city, conversion_pct, area_avg_conversion_pct, cancel_pct, area_avg_cancel_pct, review_score, area_avg_review_score)
  SELECT u_rank, snapshot_date, search_views, page_views, bookings, search_to_page_pct, page_to_book_pct, search_score, search_score_max, better_than_pct_in_city, conversion_pct, area_avg_conversion_pct, cancel_pct, area_avg_cancel_pct, review_score, area_avg_review_score
  FROM revenue.bdc_ranking_snapshot
  WHERE snapshot_date = '2026-05-04';
END $$;