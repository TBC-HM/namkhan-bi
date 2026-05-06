-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192851
-- Name:    bdc_layer3_history_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Layer 3 — analytical views over the v2 fact tables.
-- Naming: _latest = most recent snapshot, _history = full time series,
-- _change = latest snapshot vs prior snapshot deltas.
-- Replaces the older v_bdc_* views (which still exist for backward compat).

-- Drop old single-snapshot views and rebuild against v2 tables
DROP VIEW IF EXISTS public.v_bdc_country_insights CASCADE;
DROP VIEW IF EXISTS public.v_bdc_book_window_insights CASCADE;
DROP VIEW IF EXISTS public.v_bdc_demand_insights CASCADE;
DROP VIEW IF EXISTS public.v_bdc_genius_monthly CASCADE;
DROP VIEW IF EXISTS public.v_bdc_pace_monthly CASCADE;
DROP VIEW IF EXISTS public.v_bdc_pace_room_rate CASCADE;
DROP VIEW IF EXISTS public.v_bdc_ranking_snapshot CASCADE;

-- ─── _latest (used by current "Now" tab) ────────────────────────────────────
CREATE VIEW public.v_bdc_country_insights AS
SELECT * FROM revenue.bdc_country_insights_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_country_insights_v2);

CREATE VIEW public.v_bdc_book_window_insights AS
SELECT * FROM revenue.bdc_book_window_insights_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_book_window_insights_v2)
ORDER BY window_min_days;

CREATE VIEW public.v_bdc_genius_monthly AS
SELECT * FROM revenue.bdc_genius_monthly_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_genius_monthly_v2)
ORDER BY period_month;

CREATE VIEW public.v_bdc_pace_monthly AS
SELECT * FROM revenue.bdc_pace_monthly_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_pace_monthly_v2)
ORDER BY stay_month;

CREATE VIEW public.v_bdc_pace_room_rate AS
SELECT * FROM revenue.bdc_pace_room_rate_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_pace_room_rate_v2);

CREATE VIEW public.v_bdc_ranking_snapshot AS
SELECT * FROM revenue.bdc_ranking_snapshot_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_ranking_snapshot_v2);

CREATE VIEW public.v_bdc_demand_insights AS
SELECT * FROM revenue.bdc_demand_insights_v2
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_demand_insights_v2);

CREATE OR REPLACE VIEW public.v_bdc_self_summary AS
SELECT * FROM revenue.bdc_self_summary
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_self_summary);

-- ─── _history (full time series — for Trend tab + agents) ───────────────────
CREATE OR REPLACE VIEW public.v_bdc_country_insights_history AS
SELECT * FROM revenue.bdc_country_insights_v2;

CREATE OR REPLACE VIEW public.v_bdc_book_window_insights_history AS
SELECT * FROM revenue.bdc_book_window_insights_v2;

CREATE OR REPLACE VIEW public.v_bdc_genius_monthly_history AS
SELECT * FROM revenue.bdc_genius_monthly_v2;

CREATE OR REPLACE VIEW public.v_bdc_pace_monthly_history AS
SELECT * FROM revenue.bdc_pace_monthly_v2;

CREATE OR REPLACE VIEW public.v_bdc_ranking_snapshot_history AS
SELECT * FROM revenue.bdc_ranking_snapshot_v2;

-- ─── _change (latest vs prior — agent-friendly) ─────────────────────────────
CREATE OR REPLACE VIEW public.v_bdc_country_insights_change AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY country ORDER BY snapshot_date DESC) AS rn
  FROM revenue.bdc_country_insights_v2
)
SELECT
  curr.country,
  curr.snapshot_date  AS this_snapshot,
  prev.snapshot_date  AS prior_snapshot,
  curr.my_reservation_pct,
  prev.my_reservation_pct      AS prior_my_reservation_pct,
  (curr.my_reservation_pct - prev.my_reservation_pct)         AS my_share_delta_pp,
  curr.market_reservation_pct,
  prev.market_reservation_pct  AS prior_market_reservation_pct,
  (curr.market_reservation_pct - prev.market_reservation_pct) AS market_share_delta_pp,
  curr.my_adr_usd,
  prev.my_adr_usd              AS prior_my_adr_usd,
  curr.my_cancel_pct,
  prev.my_cancel_pct           AS prior_my_cancel_pct
FROM ranked curr
LEFT JOIN ranked prev
  ON prev.country = curr.country AND prev.rn = curr.rn + 1
WHERE curr.rn = 1;

CREATE OR REPLACE VIEW public.v_bdc_ranking_change AS
WITH ranked AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY snapshot_date DESC) AS rn
  FROM revenue.bdc_ranking_snapshot_v2
)
SELECT
  curr.snapshot_date  AS this_snapshot,
  prev.snapshot_date  AS prior_snapshot,
  curr.search_views,        prev.search_views        AS prior_search_views,
  curr.page_views,          prev.page_views          AS prior_page_views,
  curr.bookings,            prev.bookings            AS prior_bookings,
  curr.search_to_page_pct,  prev.search_to_page_pct  AS prior_search_to_page_pct,
  curr.page_to_book_pct,    prev.page_to_book_pct    AS prior_page_to_book_pct,
  curr.cancel_pct,          prev.cancel_pct          AS prior_cancel_pct,
  curr.review_score,        prev.review_score        AS prior_review_score
FROM ranked curr
LEFT JOIN ranked prev ON prev.rn = curr.rn + 1
WHERE curr.rn = 1;

GRANT SELECT ON
  public.v_bdc_country_insights, public.v_bdc_book_window_insights,
  public.v_bdc_demand_insights, public.v_bdc_genius_monthly,
  public.v_bdc_pace_monthly, public.v_bdc_pace_room_rate,
  public.v_bdc_ranking_snapshot, public.v_bdc_self_summary,
  public.v_bdc_country_insights_history, public.v_bdc_book_window_insights_history,
  public.v_bdc_genius_monthly_history, public.v_bdc_pace_monthly_history,
  public.v_bdc_ranking_snapshot_history,
  public.v_bdc_country_insights_change, public.v_bdc_ranking_change
TO authenticated, anon, service_role;