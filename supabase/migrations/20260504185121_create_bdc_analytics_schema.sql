-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504185121
-- Name:    create_bdc_analytics_schema
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- BDC (Booking.com) analytics — periodic snapshot tables.
-- Source: PDFs / CSVs exported from Booking.com extranet.
-- Each table is keyed by snapshot_date so we can track trends over time.

CREATE SCHEMA IF NOT EXISTS revenue;

-- 1. Country mix snapshot (Booker insights PDF)
CREATE TABLE IF NOT EXISTS revenue.bdc_country_insights (
  snapshot_date date NOT NULL,
  country text NOT NULL,
  -- us
  my_reservation_pct numeric(5,2),
  my_adr_usd numeric(10,2),
  my_book_window_days numeric(8,2),
  my_cancel_pct numeric(5,2),
  my_los_nights numeric(5,2),
  -- market (peer group on BDC)
  market_reservation_pct numeric(5,2),
  market_adr_usd numeric(10,2),
  market_book_window_days numeric(8,2),
  market_cancel_pct numeric(5,2),
  market_los_nights numeric(5,2),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, country)
);

-- 2. Book window distribution (Book window info PDF)
CREATE TABLE IF NOT EXISTS revenue.bdc_book_window_insights (
  snapshot_date date NOT NULL,
  window_label text NOT NULL,        -- '0-1 day', '2-3 days', '4-7 days', etc
  sort_order int NOT NULL,
  my_reservation_pct numeric(5,2),
  my_adr_usd numeric(10,2),
  compset_reservation_pct numeric(5,2),
  compset_adr_usd numeric(10,2),
  -- cancellation insights overlay
  my_cancel_pct numeric(5,2),
  compset_cancel_pct numeric(5,2),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, window_label)
);

-- 3. Luang Prabang demand insights (Demand data PDF) — multi-dimension
CREATE TABLE IF NOT EXISTS revenue.bdc_demand_insights (
  snapshot_date date NOT NULL,
  dimension text NOT NULL,           -- 'search_window'|'length_of_stay'|'device'|'country'|'traveler_type'|'cancel_policy'|'intl_dom'
  dim_value text NOT NULL,
  sort_order int NOT NULL,
  search_pct numeric(5,2),           -- % of LP searches in this bucket
  my_reservation_pct numeric(5,2),   -- % of OUR reservations in this bucket
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, dimension, dim_value)
);

-- 4. Pace by stay-month (Pace report PDF)
CREATE TABLE IF NOT EXISTS revenue.bdc_pace_monthly (
  snapshot_date date NOT NULL,
  stay_year_month text NOT NULL,     -- 'YYYY-MM'
  rn_current int,
  rn_last_year int,
  rn_diff_pct numeric(8,2),
  revenue_current_usd numeric(12,2),
  revenue_last_year_usd numeric(12,2),
  revenue_diff_pct numeric(8,2),
  adr_current_usd numeric(10,2),
  adr_last_year_usd numeric(10,2),
  adr_diff_pct numeric(8,2),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, stay_year_month)
);

-- 5. Pace breakdown by room × rate plan (Pace report PDF p2)
CREATE TABLE IF NOT EXISTS revenue.bdc_pace_room_rate (
  snapshot_date date NOT NULL,
  room_type text NOT NULL,
  rate_plan text NOT NULL,
  room_nights int,
  revenue_usd numeric(12,2),
  adr_usd numeric(10,2),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, room_type, rate_plan)
);

-- 6. Genius dependency (Performance timeline CSV)
CREATE TABLE IF NOT EXISTS revenue.bdc_genius_monthly (
  snapshot_date date NOT NULL,
  period_month text NOT NULL,        -- 'YYYY-MM'
  bookings int,
  bookings_last_year int,
  genius_pct numeric(5,2),
  genius_pct_last_year numeric(5,2),
  loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_date, period_month)
);

-- 7. Ranking dashboard snapshot
CREATE TABLE IF NOT EXISTS revenue.bdc_ranking_snapshot (
  snapshot_date date PRIMARY KEY,
  search_views int,
  page_views int,
  bookings int,
  search_to_page_pct numeric(5,2),
  page_to_book_pct numeric(5,2),
  search_score int,
  search_score_max int,
  better_than_pct_in_city numeric(5,2),
  conversion_pct numeric(5,2),
  area_avg_conversion_pct numeric(5,2),
  cancel_pct numeric(5,2),
  area_avg_cancel_pct numeric(5,2),
  review_score numeric(3,1),
  area_avg_review_score numeric(3,1),
  loaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON revenue.bdc_country_insights, revenue.bdc_book_window_insights,
                revenue.bdc_demand_insights, revenue.bdc_pace_monthly,
                revenue.bdc_pace_room_rate, revenue.bdc_genius_monthly,
                revenue.bdc_ranking_snapshot
  TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON revenue.bdc_country_insights, revenue.bdc_book_window_insights,
                revenue.bdc_demand_insights, revenue.bdc_pace_monthly,
                revenue.bdc_pace_room_rate, revenue.bdc_genius_monthly,
                revenue.bdc_ranking_snapshot
  TO service_role;