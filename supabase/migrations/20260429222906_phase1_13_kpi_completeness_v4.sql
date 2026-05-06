-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260429222906
-- Name:    phase1_13_kpi_completeness_v4
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE SCHEMA IF NOT EXISTS kpi;

-- K1
DROP TABLE IF EXISTS kpi.daily_snapshots CASCADE;
CREATE TABLE kpi.daily_snapshots (
  snapshot_id   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   bigint      NOT NULL DEFAULT 260955,
  snapshot_date date        NOT NULL,
  taken_at      timestamptz NOT NULL DEFAULT now(),
  payload       jsonb       NOT NULL,
  total_rooms       integer,
  in_house          integer,
  arrivals_today    integer,
  departures_today  integer,
  occupied_tonight  integer,
  otb_next_90d      integer,
  cancellation_pct_90d numeric(6,3),
  no_show_pct_90d   numeric(6,3),
  rooms_sold        integer,
  occupancy_pct     numeric(6,3),
  adr_usd           numeric(12,2),
  revpar_usd        numeric(12,2),
  trevpar_usd       numeric(12,2),
  rooms_revenue_usd numeric(14,2),
  fnb_revenue_usd   numeric(14,2),
  spa_revenue_usd   numeric(14,2),
  activity_revenue_usd numeric(14,2),
  total_ancillary_revenue_usd numeric(14,2),
  CONSTRAINT uq_daily_snapshot UNIQUE (property_id, snapshot_date)
);
CREATE INDEX idx_kpi_snap_date ON kpi.daily_snapshots(snapshot_date DESC);
CREATE INDEX idx_kpi_snap_property ON kpi.daily_snapshots(property_id, snapshot_date DESC);
ALTER TABLE kpi.daily_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_snap_read ON kpi.daily_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY kpi_snap_top  ON kpi.daily_snapshots FOR ALL    TO authenticated USING (app.is_top_level()) WITH CHECK (app.is_top_level());

CREATE OR REPLACE FUNCTION kpi.snapshot_today()
RETURNS kpi.daily_snapshots LANGUAGE plpgsql AS $$
DECLARE r kpi.daily_snapshots%ROWTYPE;
        t public.mv_kpi_today%ROWTYPE;
        d public.mv_kpi_daily%ROWTYPE;
BEGIN
  PERFORM public.refresh_bi_views();
  SELECT * INTO t FROM public.mv_kpi_today WHERE property_id = 260955 LIMIT 1;
  SELECT * INTO d FROM public.mv_kpi_daily WHERE property_id = 260955 AND night_date = current_date LIMIT 1;

  INSERT INTO kpi.daily_snapshots (
    property_id, snapshot_date, taken_at, payload,
    total_rooms, in_house, arrivals_today, departures_today, occupied_tonight, otb_next_90d,
    cancellation_pct_90d, no_show_pct_90d,
    rooms_sold, occupancy_pct, adr_usd, revpar_usd, trevpar_usd,
    rooms_revenue_usd, fnb_revenue_usd, spa_revenue_usd, activity_revenue_usd, total_ancillary_revenue_usd
  ) VALUES (
    260955, current_date, now(),
    jsonb_build_object('mv_kpi_today', to_jsonb(t), 'mv_kpi_daily', to_jsonb(d)),
    coalesce(t.total_rooms, d.total_rooms),
    t.in_house::int, t.arrivals_today::int, t.departures_today::int, t.occupied_tonight::int, t.otb_next_90d::int,
    t.cancellation_pct_90d, t.no_show_pct_90d,
    d.rooms_sold::int, d.occupancy_pct, d.adr, d.revpar, d.trevpar,
    d.rooms_revenue, d.fnb_revenue, d.spa_revenue, d.activity_revenue, d.total_ancillary_revenue
  )
  ON CONFLICT (property_id, snapshot_date) DO UPDATE SET
    taken_at=EXCLUDED.taken_at, payload=EXCLUDED.payload,
    total_rooms=EXCLUDED.total_rooms, in_house=EXCLUDED.in_house,
    arrivals_today=EXCLUDED.arrivals_today, departures_today=EXCLUDED.departures_today,
    occupied_tonight=EXCLUDED.occupied_tonight, otb_next_90d=EXCLUDED.otb_next_90d,
    cancellation_pct_90d=EXCLUDED.cancellation_pct_90d, no_show_pct_90d=EXCLUDED.no_show_pct_90d,
    rooms_sold=EXCLUDED.rooms_sold, occupancy_pct=EXCLUDED.occupancy_pct,
    adr_usd=EXCLUDED.adr_usd, revpar_usd=EXCLUDED.revpar_usd, trevpar_usd=EXCLUDED.trevpar_usd,
    rooms_revenue_usd=EXCLUDED.rooms_revenue_usd, fnb_revenue_usd=EXCLUDED.fnb_revenue_usd,
    spa_revenue_usd=EXCLUDED.spa_revenue_usd, activity_revenue_usd=EXCLUDED.activity_revenue_usd,
    total_ancillary_revenue_usd=EXCLUDED.total_ancillary_revenue_usd
  RETURNING * INTO r;
  RETURN r;
END;
$$;

DO $$ BEGIN
  PERFORM cron.unschedule('hourly-refresh');
  PERFORM cron.schedule('hourly-refresh', '0 * * * *', 'SELECT public.cb_hourly_refresh();');
EXCEPTION WHEN OTHERS THEN NULL; END$$;
DO $$ BEGIN
  BEGIN PERFORM cron.unschedule('kpi-daily-snapshot'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('kpi-daily-snapshot', '30 22 * * *', 'SELECT kpi.snapshot_today();');
END$$;

-- K4
DROP TABLE IF EXISTS kpi.freshness_log CASCADE;
CREATE TABLE kpi.freshness_log (
  log_id            bigserial PRIMARY KEY,
  checked_at        timestamptz NOT NULL DEFAULT now(),
  matview           text NOT NULL,
  last_refresh      timestamptz,
  staleness_minutes numeric,
  is_stale          boolean,
  threshold_minutes numeric NOT NULL DEFAULT 30
);
CREATE INDEX idx_kpi_freshness_checked ON kpi.freshness_log(checked_at DESC);
ALTER TABLE kpi.freshness_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY kpi_fresh_read ON kpi.freshness_log FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION kpi.check_freshness(p_threshold_minutes int DEFAULT 30)
RETURNS TABLE(matview text, staleness_minutes numeric, is_stale boolean) LANGUAGE plpgsql AS $$
DECLARE v_last_refresh timestamptz; v_mv record; v_stale_count int := 0; v_global_refresh timestamptz;
BEGIN
  SELECT max(end_time) INTO v_global_refresh
  FROM cron.job_run_details d JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'refresh_bi_views_15min' AND d.status = 'succeeded';

  FOR v_mv IN SELECT schemaname||'.'||matviewname AS mv FROM pg_matviews WHERE schemaname='public' LOOP
    SELECT greatest(
      (SELECT last_analyze     FROM pg_stat_all_tables WHERE relid = v_mv.mv::regclass),
      (SELECT last_autoanalyze FROM pg_stat_all_tables WHERE relid = v_mv.mv::regclass),
      v_global_refresh
    ) INTO v_last_refresh;

    INSERT INTO kpi.freshness_log (matview, last_refresh, staleness_minutes, is_stale, threshold_minutes)
    VALUES (
      v_mv.mv, v_last_refresh,
      EXTRACT(EPOCH FROM (now() - coalesce(v_last_refresh, now() - interval '999 hours')))/60,
      coalesce(now() - v_last_refresh, interval '999 hours') > make_interval(mins => p_threshold_minutes),
      p_threshold_minutes
    );

    IF coalesce(now() - v_last_refresh, interval '999 hours') > make_interval(mins => p_threshold_minutes) THEN
      v_stale_count := v_stale_count + 1;
    END IF;

    RETURN QUERY SELECT v_mv.mv,
      EXTRACT(EPOCH FROM (now() - coalesce(v_last_refresh, now() - interval '999 hours')))/60,
      coalesce(now() - v_last_refresh, interval '999 hours') > make_interval(mins => p_threshold_minutes);
  END LOOP;

  IF v_stale_count > 0 THEN
    INSERT INTO alerts.sent (channel_id, severity, subject, body, sent_at)
    SELECT (SELECT channel_id FROM alerts.channels LIMIT 1),
           'high',
           format('KPI freshness alert: %s matviews stale', v_stale_count),
           format('At %s, %s materialized views exceeded %s-minute threshold.', now(), v_stale_count, p_threshold_minutes),
           now()
    WHERE EXISTS (SELECT 1 FROM alerts.channels);
  END IF;
END;
$$;
DO $$ BEGIN
  BEGIN PERFORM cron.unschedule('kpi-freshness-check'); EXCEPTION WHEN OTHERS THEN NULL; END;
  PERFORM cron.schedule('kpi-freshness-check', '*/30 * * * *', 'SELECT kpi.check_freshness(30);');
END$$;

-- K5: per-segment matview (use rr.rate not rr.adr)
DROP MATERIALIZED VIEW IF EXISTS public.mv_kpi_daily_by_segment CASCADE;
CREATE MATERIALIZED VIEW public.mv_kpi_daily_by_segment AS
WITH cap AS (SELECT capacity_selling AS keys FROM public.v_property_totals LIMIT 1),
nightly AS (
  SELECT
    rr.night_date AS metric_date,
    coalesce(NULLIF(r.market_segment, ''), 'Unknown')                       AS segment,
    coalesce(NULLIF(r.source_name, ''), NULLIF(r.source, ''), 'Direct')     AS channel,
    CASE
      WHEN r.source_name ILIKE '%booking.com%' OR r.source ILIKE '%booking.com%' THEN 'OTA'
      WHEN r.source_name ILIKE '%expedia%'     OR r.source ILIKE '%expedia%'     THEN 'OTA'
      WHEN r.source_name ILIKE '%agoda%'       OR r.source ILIKE '%agoda%'       THEN 'OTA'
      WHEN r.source_name ILIKE '%airbnb%'      OR r.source ILIKE '%airbnb%'      THEN 'OTA'
      WHEN r.source_name ILIKE '%hotels.com%'                                     THEN 'OTA'
      WHEN r.source_name ILIKE '%trip.com%'                                       THEN 'OTA'
      WHEN r.source_name ILIKE '%slh%'         OR r.source ILIKE '%slh%'         THEN 'Brand'
      WHEN r.source_name ILIKE '%direct%'      OR r.source ILIKE '%direct%'
        OR r.source_name ILIKE '%website%'     OR r.source ILIKE '%website%'      THEN 'Direct'
      WHEN r.source_name ILIKE '%agent%'       OR r.source ILIKE '%agent%'
        OR r.market_segment ILIKE '%TA%'       OR r.market_segment ILIKE '%agent%' THEN 'TA'
      WHEN r.market_segment ILIKE '%corp%'                                         THEN 'Corp'
      WHEN r.market_segment ILIKE '%group%'                                        THEN 'Group'
      ELSE 'Other'
    END AS channel_group,
    coalesce(rr.rate, 0) AS adr_usd
  FROM public.reservation_rooms rr
  LEFT JOIN public.reservations r ON r.reservation_id = rr.reservation_id
  WHERE r.is_cancelled = false
    AND rr.night_date >= current_date - interval '730 days'
    AND rr.night_date <= current_date + interval '365 days'
)
SELECT
  metric_date, segment, channel, channel_group,
  count(*)                                                                   AS rooms_sold,
  round(avg(adr_usd)::numeric, 2)                                            AS adr_usd,
  round(sum(adr_usd)::numeric, 2)                                            AS revenue_usd,
  round((sum(adr_usd) / nullif((SELECT keys FROM cap), 0))::numeric, 2)      AS revpar_usd,
  round((100.0 * count(*) / nullif((SELECT keys FROM cap), 0))::numeric, 2)  AS occupancy_pct
FROM nightly
GROUP BY metric_date, segment, channel, channel_group;

CREATE UNIQUE INDEX idx_mv_kpi_seg_unique ON public.mv_kpi_daily_by_segment (metric_date, segment, channel, channel_group);
CREATE INDEX idx_mv_kpi_seg_date  ON public.mv_kpi_daily_by_segment (metric_date DESC);
CREATE INDEX idx_mv_kpi_seg_group ON public.mv_kpi_daily_by_segment (channel_group, metric_date DESC);
GRANT SELECT ON public.mv_kpi_daily_by_segment TO authenticated, anon;

-- Update refresh function to include the segment matview
CREATE OR REPLACE FUNCTION public.refresh_bi_views()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_classified_transactions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_daily_by_segment;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_revenue_by_usali_dept;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_perf;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_pace_otb;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_arrivals_departures_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_aged_ar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_capture_rates;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_rate_inventory_calendar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_guest_profiles;
END;
$function$;

-- K2
INSERT INTO governance.agent_triggers (agent_id, trigger_type, cron_expr, is_active, notes)
SELECT a.agent_id, 'cron',
  CASE a.code
    WHEN 'snapshot_agent'    THEN '0 0-16 * * *'
    WHEN 'pricing_agent'     THEN '5 0-16 * * *'
    WHEN 'forecast_agent'    THEN '0 */6 * * *'
    WHEN 'variance_agent'    THEN '0 0 * * *'
    WHEN 'cashflow_agent'    THEN '15 0 * * *'
  END,
  true,
  'Auto-seeded via phase1_13'
FROM governance.agents a
WHERE a.status='active' AND a.code IN ('snapshot_agent','pricing_agent','forecast_agent','variance_agent','cashflow_agent')
  AND NOT EXISTS (SELECT 1 FROM governance.agent_triggers gt WHERE gt.agent_id=a.agent_id AND gt.trigger_type='cron');

INSERT INTO governance.agent_triggers (agent_id, trigger_type, event_kind, webhook_path, is_active, notes)
SELECT a.agent_id, 'webhook',
  CASE a.code WHEN 'review_agent' THEN 'reviews.new' WHEN 'lead_scoring_agent' THEN 'email.received' END,
  CASE a.code WHEN 'review_agent' THEN '/webhooks/reviews' WHEN 'lead_scoring_agent' THEN '/webhooks/inbound-email' END,
  true, 'Auto-seeded via phase1_13'
FROM governance.agents a
WHERE a.status='active' AND a.code IN ('review_agent','lead_scoring_agent')
  AND NOT EXISTS (SELECT 1 FROM governance.agent_triggers gt WHERE gt.agent_id=a.agent_id AND gt.trigger_type='webhook');

CREATE OR REPLACE FUNCTION governance.queue_agent_run(p_agent_code text)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_agent_id uuid; v_prompt_id uuid; v_run_id uuid;
BEGIN
  SELECT a.agent_id, ap.prompt_id INTO v_agent_id, v_prompt_id
  FROM governance.agents a
  LEFT JOIN governance.agent_prompts ap ON ap.agent_id=a.agent_id AND ap.is_current=true
  WHERE a.code=p_agent_code AND a.status='active';
  IF v_agent_id IS NULL THEN RETURN NULL; END IF;
  INSERT INTO governance.agent_runs (agent_id, prompt_id, property_id, status, started_at)
  VALUES (v_agent_id, v_prompt_id, 260955, 'queued', now()) RETURNING run_id INTO v_run_id;
  RETURN v_run_id;
END;
$$;

DO $$ DECLARE r record;
BEGIN
  FOR r IN
    SELECT a.code, gt.cron_expr
    FROM governance.agents a
    JOIN governance.agent_triggers gt ON gt.agent_id=a.agent_id
    WHERE gt.trigger_type='cron' AND gt.is_active AND gt.cron_expr IS NOT NULL
  LOOP
    BEGIN PERFORM cron.unschedule('agent-' || r.code); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM cron.schedule('agent-' || r.code, r.cron_expr, format('SELECT governance.queue_agent_run(%L);', r.code));
  END LOOP;
END$$;

GRANT EXECUTE ON FUNCTION governance.queue_agent_run(text) TO service_role;
GRANT EXECUTE ON FUNCTION kpi.snapshot_today() TO service_role;
GRANT EXECUTE ON FUNCTION kpi.check_freshness(int) TO service_role;

-- Backfill: snapshot today + run freshness check
SELECT kpi.snapshot_today();
SELECT count(*) FROM kpi.check_freshness(30);
