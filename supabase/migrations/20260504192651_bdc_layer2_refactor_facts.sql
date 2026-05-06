-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192651
-- Name:    bdc_layer2_refactor_facts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Layer 2 — refactor fact tables to: (a) link to upload_id, (b) replace TEXT
-- date columns with DATE, (c) add structured book-window bounds, (d) split off
-- _ALL_ aggregate row into its own bdc_self_summary table, (e) link pace_room_rate
-- to canonical room_types via room_type_id (nullable for unmapped names).
-- New tables alongside old; old tables dropped after backfill verifies.

-- 1. Self summary (replaces _ALL_ row in bdc_country_insights)
CREATE TABLE IF NOT EXISTS revenue.bdc_self_summary (
  upload_id          uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date      date NOT NULL,
  my_adr_usd                numeric(10,2),
  my_book_window_days       numeric(6,2),
  my_cancel_pct             numeric(6,2),
  my_los_nights             numeric(5,2),
  market_adr_usd            numeric(10,2),
  market_book_window_days   numeric(6,2),
  market_cancel_pct         numeric(6,2),
  market_los_nights         numeric(5,2),
  loaded_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id)
);

-- 2. Country insights v2 (without _ALL_ row, with upload_id, indexed for time-series)
CREATE TABLE IF NOT EXISTS revenue.bdc_country_insights_v2 (
  upload_id              uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date          date NOT NULL,
  country                text NOT NULL,
  country_iso2           text,
  my_reservation_pct     numeric(6,2),
  my_adr_usd             numeric(10,2),
  my_book_window_days    numeric(6,2),
  my_cancel_pct          numeric(6,2),
  my_los_nights          numeric(5,2),
  market_reservation_pct numeric(6,2),
  market_adr_usd         numeric(10,2),
  market_book_window_days numeric(6,2),
  market_cancel_pct      numeric(6,2),
  market_los_nights      numeric(5,2),
  loaded_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, country)
);
CREATE INDEX IF NOT EXISTS ix_bdc_ci_country_date
  ON revenue.bdc_country_insights_v2 (country, snapshot_date DESC);

-- 3. Book window v2 (structured numeric bounds)
CREATE TABLE IF NOT EXISTS revenue.bdc_book_window_insights_v2 (
  upload_id               uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date           date NOT NULL,
  window_label            text NOT NULL,
  window_min_days         integer NOT NULL,
  window_max_days         integer,         -- NULL for open-ended (e.g. 91+)
  sort_order              integer,
  my_reservation_pct      numeric(6,2),
  my_adr_usd              numeric(10,2),
  compset_reservation_pct numeric(6,2),
  compset_adr_usd         numeric(10,2),
  my_cancel_pct           numeric(6,2),
  compset_cancel_pct      numeric(6,2),
  loaded_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, window_min_days)
);

-- 4. Demand insights v2 (CHECK on dimension)
CREATE TABLE IF NOT EXISTS revenue.bdc_demand_insights_v2 (
  upload_id          uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date      date NOT NULL,
  dimension          text NOT NULL CHECK (dimension IN ('search_window','los','device','traveler_type','cancel_policy','arrival_dow','region')),
  dim_value          text NOT NULL,
  sort_order         integer,
  search_pct         numeric(6,2),
  my_reservation_pct numeric(6,2),
  loaded_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, dimension, dim_value)
);

-- 5. Genius monthly v2 (period_month is DATE)
CREATE TABLE IF NOT EXISTS revenue.bdc_genius_monthly_v2 (
  upload_id            uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date        date NOT NULL,
  period_month         date NOT NULL,           -- always day=1
  bookings             integer,
  bookings_last_year   integer,
  rn_total             integer,
  rn_last_year         integer,
  revenue_usd          numeric(12,2),
  revenue_last_year_usd numeric(12,2),
  adr_usd              numeric(10,2),
  adr_last_year_usd    numeric(10,2),
  cancel_pct           numeric(6,2),
  cancel_pct_last_year numeric(6,2),
  genius_pct           numeric(6,2),
  genius_pct_last_year numeric(6,2),
  loaded_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, period_month)
);
CREATE INDEX IF NOT EXISTS ix_bdc_genius_period_snapshot
  ON revenue.bdc_genius_monthly_v2 (period_month, snapshot_date DESC);

-- 6. Pace monthly v2 (stay_month is DATE)
CREATE TABLE IF NOT EXISTS revenue.bdc_pace_monthly_v2 (
  upload_id           uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date       date NOT NULL,
  stay_month          date NOT NULL,
  rn_current          integer,
  rn_last_year        integer,
  rn_diff_pct         numeric(6,2),
  revenue_current_usd numeric(12,2),
  revenue_last_year_usd numeric(12,2),
  revenue_diff_pct    numeric(6,2),
  adr_current_usd     numeric(10,2),
  adr_last_year_usd   numeric(10,2),
  adr_diff_pct        numeric(6,2),
  loaded_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, stay_month)
);
CREATE INDEX IF NOT EXISTS ix_bdc_pace_stay_snapshot
  ON revenue.bdc_pace_monthly_v2 (stay_month, snapshot_date DESC);

-- 7. Pace room×rate v2 (linked to canonical room_types where mappable)
CREATE TABLE IF NOT EXISTS revenue.bdc_pace_room_rate_v2 (
  upload_id      uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date  date NOT NULL,
  room_type_raw  text NOT NULL,
  room_type_id   text,            -- nullable; mapped via revenue.bdc_rate_map (next phase)
  rate_plan      text NOT NULL,
  room_nights    integer,
  revenue_usd    numeric(12,2),
  adr_usd        numeric(10,2),
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, room_type_raw, rate_plan)
);

-- 8. Ranking snapshot v2 (1 row per upload)
CREATE TABLE IF NOT EXISTS revenue.bdc_ranking_snapshot_v2 (
  upload_id                uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date            date NOT NULL,
  search_views             integer,
  page_views               integer,
  bookings                 integer,
  search_to_page_pct       numeric(6,2),
  page_to_book_pct         numeric(6,2),
  search_score             integer,
  search_score_max         integer,
  better_than_pct_in_city  numeric(6,2),
  conversion_pct           numeric(6,2),
  area_avg_conversion_pct  numeric(6,2),
  cancel_pct               numeric(6,2),
  area_avg_cancel_pct      numeric(6,2),
  review_score             numeric(4,2),
  area_avg_review_score    numeric(4,2),
  loaded_at                timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id)
);
CREATE INDEX IF NOT EXISTS ix_bdc_ranking_snapshot_date
  ON revenue.bdc_ranking_snapshot_v2 (snapshot_date DESC);

-- 9. Agent state — prevents re-firing the same alert every cron tick
CREATE TABLE IF NOT EXISTS revenue.bdc_alert_state (
  agent_key         text NOT NULL,
  dimension_key     text NOT NULL,            -- e.g. 'country=Germany' or 'stay_month=2026-06'
  last_signal_value numeric,
  last_raised_at    timestamptz NOT NULL DEFAULT now(),
  status            text NOT NULL DEFAULT 'open' CHECK (status IN ('open','snoozed','resolved')),
  snooze_until      timestamptz,
  notes             text,
  PRIMARY KEY (agent_key, dimension_key)
);

GRANT SELECT ON revenue.bdc_self_summary, revenue.bdc_country_insights_v2,
                 revenue.bdc_book_window_insights_v2, revenue.bdc_demand_insights_v2,
                 revenue.bdc_genius_monthly_v2, revenue.bdc_pace_monthly_v2,
                 revenue.bdc_pace_room_rate_v2, revenue.bdc_ranking_snapshot_v2,
                 revenue.bdc_alert_state
   TO service_role;