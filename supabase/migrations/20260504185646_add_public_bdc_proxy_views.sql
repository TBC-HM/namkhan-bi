-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504185646
-- Name:    add_public_bdc_proxy_views
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Public proxy views over revenue.bdc_* (revenue schema not in pgrst.db_schemas).
-- Each view filters to the latest snapshot_date so the front end gets the freshest
-- BDC export without juggling dates. We keep snapshot_date in the projection so
-- the UI can render "Snapshot from YYYY-MM-DD" labels.

DROP VIEW IF EXISTS public.v_bdc_country_insights CASCADE;
CREATE VIEW public.v_bdc_country_insights AS
SELECT *
FROM revenue.bdc_country_insights
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_country_insights);

DROP VIEW IF EXISTS public.v_bdc_book_window_insights CASCADE;
CREATE VIEW public.v_bdc_book_window_insights AS
SELECT *
FROM revenue.bdc_book_window_insights
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_book_window_insights)
ORDER BY sort_order;

DROP VIEW IF EXISTS public.v_bdc_demand_insights CASCADE;
CREATE VIEW public.v_bdc_demand_insights AS
SELECT *
FROM revenue.bdc_demand_insights
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_demand_insights);

DROP VIEW IF EXISTS public.v_bdc_genius_monthly CASCADE;
CREATE VIEW public.v_bdc_genius_monthly AS
SELECT *
FROM revenue.bdc_genius_monthly
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_genius_monthly)
ORDER BY period_month;

DROP VIEW IF EXISTS public.v_bdc_pace_monthly CASCADE;
CREATE VIEW public.v_bdc_pace_monthly AS
SELECT *
FROM revenue.bdc_pace_monthly
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_pace_monthly)
ORDER BY stay_year_month;

DROP VIEW IF EXISTS public.v_bdc_pace_room_rate CASCADE;
CREATE VIEW public.v_bdc_pace_room_rate AS
SELECT *
FROM revenue.bdc_pace_room_rate
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_pace_room_rate);

DROP VIEW IF EXISTS public.v_bdc_ranking_snapshot CASCADE;
CREATE VIEW public.v_bdc_ranking_snapshot AS
SELECT *
FROM revenue.bdc_ranking_snapshot
WHERE snapshot_date = (SELECT max(snapshot_date) FROM revenue.bdc_ranking_snapshot);

GRANT SELECT ON public.v_bdc_country_insights, public.v_bdc_book_window_insights,
                 public.v_bdc_demand_insights, public.v_bdc_genius_monthly,
                 public.v_bdc_pace_monthly, public.v_bdc_pace_room_rate,
                 public.v_bdc_ranking_snapshot
   TO authenticated, anon, service_role;