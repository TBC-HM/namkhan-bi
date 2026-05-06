-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427235851
-- Name:    build_drilldown_headline_kpis
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Headline KPIs for any period — the top dashboard cards
-- Includes prior-period comparison + STLY (same period last year)
CREATE OR REPLACE FUNCTION kpi.headline(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  metric text,
  current_value numeric,
  prior_value numeric,       -- same length window immediately prior
  prior_pct_change numeric,
  stly_value numeric,        -- same window 1 year ago
  stly_pct_change numeric
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date;
  v_to date;
  v_days int;
  v_prior_from date;
  v_prior_to date;
  v_stly_from date;
  v_stly_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  v_days := (v_to - v_from + 1);
  v_prior_to := v_from - 1;
  v_prior_from := v_from - v_days;
  v_stly_from := v_from - INTERVAL '1 year';
  v_stly_to := v_to - INTERVAL '1 year';

  RETURN QUERY
  WITH 
    cur AS (
      SELECT 
        SUM(rooms_sold) AS rs,
        AVG(occupancy_pct) AS occ,
        AVG(NULLIF(adr,0)) AS adr,
        AVG(revpar) AS revpar,
        SUM(rooms_revenue) AS rooms_rev,
        SUM(fb_revenue) AS fb_rev,
        SUM(other_revenue) AS other_rev,
        SUM(total_revenue) AS total_rev,
        SUM(arrivals) AS arr,
        SUM(cancellations) AS canc
      FROM public.daily_metrics
      WHERE metric_date BETWEEN v_from AND v_to
    ),
    prior AS (
      SELECT 
        SUM(rooms_sold) AS rs,
        AVG(occupancy_pct) AS occ,
        AVG(NULLIF(adr,0)) AS adr,
        AVG(revpar) AS revpar,
        SUM(rooms_revenue) AS rooms_rev,
        SUM(fb_revenue) AS fb_rev,
        SUM(other_revenue) AS other_rev,
        SUM(total_revenue) AS total_rev,
        SUM(arrivals) AS arr,
        SUM(cancellations) AS canc
      FROM public.daily_metrics
      WHERE metric_date BETWEEN v_prior_from AND v_prior_to
    ),
    stly AS (
      SELECT 
        SUM(rooms_sold) AS rs,
        AVG(occupancy_pct) AS occ,
        AVG(NULLIF(adr,0)) AS adr,
        AVG(revpar) AS revpar,
        SUM(rooms_revenue) AS rooms_rev,
        SUM(fb_revenue) AS fb_rev,
        SUM(other_revenue) AS other_rev,
        SUM(total_revenue) AS total_rev,
        SUM(arrivals) AS arr,
        SUM(cancellations) AS canc
      FROM public.daily_metrics
      WHERE metric_date BETWEEN v_stly_from AND v_stly_to
    )
  SELECT * FROM (
    VALUES
      ('rooms_sold',
        ROUND(COALESCE((SELECT rs FROM cur), 0)::numeric, 0),
        ROUND(COALESCE((SELECT rs FROM prior), 0)::numeric, 0),
        ROUND((((SELECT rs FROM cur) - (SELECT rs FROM prior)) / NULLIF((SELECT rs FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT rs FROM stly), 0)::numeric, 0),
        ROUND((((SELECT rs FROM cur) - (SELECT rs FROM stly)) / NULLIF((SELECT rs FROM stly), 0) * 100)::numeric, 2)),
      ('occupancy_pct',
        ROUND(COALESCE((SELECT occ FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT occ FROM prior), 0)::numeric, 2),
        ROUND((((SELECT occ FROM cur) - (SELECT occ FROM prior)) / NULLIF((SELECT occ FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT occ FROM stly), 0)::numeric, 2),
        ROUND((((SELECT occ FROM cur) - (SELECT occ FROM stly)) / NULLIF((SELECT occ FROM stly), 0) * 100)::numeric, 2)),
      ('adr',
        ROUND(COALESCE((SELECT adr FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT adr FROM prior), 0)::numeric, 2),
        ROUND((((SELECT adr FROM cur) - (SELECT adr FROM prior)) / NULLIF((SELECT adr FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT adr FROM stly), 0)::numeric, 2),
        ROUND((((SELECT adr FROM cur) - (SELECT adr FROM stly)) / NULLIF((SELECT adr FROM stly), 0) * 100)::numeric, 2)),
      ('revpar',
        ROUND(COALESCE((SELECT revpar FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT revpar FROM prior), 0)::numeric, 2),
        ROUND((((SELECT revpar FROM cur) - (SELECT revpar FROM prior)) / NULLIF((SELECT revpar FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT revpar FROM stly), 0)::numeric, 2),
        ROUND((((SELECT revpar FROM cur) - (SELECT revpar FROM stly)) / NULLIF((SELECT revpar FROM stly), 0) * 100)::numeric, 2)),
      ('rooms_revenue',
        ROUND(COALESCE((SELECT rooms_rev FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT rooms_rev FROM prior), 0)::numeric, 2),
        ROUND((((SELECT rooms_rev FROM cur) - (SELECT rooms_rev FROM prior)) / NULLIF((SELECT rooms_rev FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT rooms_rev FROM stly), 0)::numeric, 2),
        ROUND((((SELECT rooms_rev FROM cur) - (SELECT rooms_rev FROM stly)) / NULLIF((SELECT rooms_rev FROM stly), 0) * 100)::numeric, 2)),
      ('fb_revenue',
        ROUND(COALESCE((SELECT fb_rev FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT fb_rev FROM prior), 0)::numeric, 2),
        ROUND((((SELECT fb_rev FROM cur) - (SELECT fb_rev FROM prior)) / NULLIF((SELECT fb_rev FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT fb_rev FROM stly), 0)::numeric, 2),
        ROUND((((SELECT fb_rev FROM cur) - (SELECT fb_rev FROM stly)) / NULLIF((SELECT fb_rev FROM stly), 0) * 100)::numeric, 2)),
      ('other_revenue',
        ROUND(COALESCE((SELECT other_rev FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT other_rev FROM prior), 0)::numeric, 2),
        ROUND((((SELECT other_rev FROM cur) - (SELECT other_rev FROM prior)) / NULLIF((SELECT other_rev FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT other_rev FROM stly), 0)::numeric, 2),
        ROUND((((SELECT other_rev FROM cur) - (SELECT other_rev FROM stly)) / NULLIF((SELECT other_rev FROM stly), 0) * 100)::numeric, 2)),
      ('total_revenue',
        ROUND(COALESCE((SELECT total_rev FROM cur), 0)::numeric, 2),
        ROUND(COALESCE((SELECT total_rev FROM prior), 0)::numeric, 2),
        ROUND((((SELECT total_rev FROM cur) - (SELECT total_rev FROM prior)) / NULLIF((SELECT total_rev FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT total_rev FROM stly), 0)::numeric, 2),
        ROUND((((SELECT total_rev FROM cur) - (SELECT total_rev FROM stly)) / NULLIF((SELECT total_rev FROM stly), 0) * 100)::numeric, 2)),
      ('arrivals',
        ROUND(COALESCE((SELECT arr FROM cur), 0)::numeric, 0),
        ROUND(COALESCE((SELECT arr FROM prior), 0)::numeric, 0),
        ROUND((((SELECT arr FROM cur) - (SELECT arr FROM prior)) / NULLIF((SELECT arr FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT arr FROM stly), 0)::numeric, 0),
        ROUND((((SELECT arr FROM cur) - (SELECT arr FROM stly)) / NULLIF((SELECT arr FROM stly), 0) * 100)::numeric, 2)),
      ('cancellations',
        ROUND(COALESCE((SELECT canc FROM cur), 0)::numeric, 0),
        ROUND(COALESCE((SELECT canc FROM prior), 0)::numeric, 0),
        ROUND((((SELECT canc FROM cur) - (SELECT canc FROM prior)) / NULLIF((SELECT canc FROM prior), 0) * 100)::numeric, 2),
        ROUND(COALESCE((SELECT canc FROM stly), 0)::numeric, 0),
        ROUND((((SELECT canc FROM cur) - (SELECT canc FROM stly)) / NULLIF((SELECT canc FROM stly), 0) * 100)::numeric, 2))
  ) AS t(metric, current_value, prior_value, prior_pct_change, stly_value, stly_pct_change);
END;
$func$;