-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260428001115
-- Name:    fix_actions_ambiguous_severity
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Just need to qualify dq.violations.severity in the data quality block
-- Re-create with table alias
DROP FUNCTION IF EXISTS kpi.actions(text);

CREATE FUNCTION kpi.actions(p_period text DEFAULT 'last_30')
RETURNS TABLE(
  severity text, category text, headline text, detail text,
  metric_current numeric, metric_baseline numeric, delta_pct numeric,
  drill_hint text, drill_param text
)
LANGUAGE plpgsql STABLE
AS $func$
DECLARE
  v_from date;
  v_to date;
  v_days int;
  v_is_forward boolean := p_period LIKE 'next_%';
  v_stly_from date;
  v_stly_to date;
BEGIN
  SELECT date_from, date_to INTO v_from, v_to FROM kpi.period_range(p_period);
  v_days := (v_to - v_from + 1);
  v_stly_from := v_from - INTERVAL '1 year';
  v_stly_to := v_to - INTERVAL '1 year';

  IF NOT v_is_forward THEN
    -- 1. Occupancy collapse vs STLY
    RETURN QUERY
    WITH cur AS (
      SELECT AVG(occupancy_pct) AS occ FROM public.daily_metrics
      WHERE metric_date BETWEEN v_from AND v_to
    ),
    stly AS (
      SELECT AVG(occupancy_pct) AS occ FROM public.daily_metrics
      WHERE metric_date BETWEEN v_stly_from AND v_stly_to
    )
    SELECT 'act_now'::text, 'demand'::text,
      'Occupancy collapsing vs same period last year'::text,
      format('Occ %s%% vs STLY %s%% (%s pts gap). Drop BAR or open discount channels now.', 
             ROUND(cur.occ, 1), ROUND(stly.occ, 1), ROUND(cur.occ - stly.occ, 1))::text,
      ROUND(cur.occ::numeric, 2), ROUND(stly.occ::numeric, 2),
      ROUND(((cur.occ - stly.occ) / NULLIF(stly.occ, 0) * 100)::numeric, 2),
      'timeseries'::text, NULL::text
    FROM cur, stly WHERE cur.occ < stly.occ * 0.80 AND stly.occ > 5;

    -- 2. ADR weakening
    RETURN QUERY
    WITH cur AS (SELECT AVG(NULLIF(adr,0)) AS adr FROM public.daily_metrics WHERE metric_date BETWEEN v_from AND v_to),
    stly AS (SELECT AVG(NULLIF(adr,0)) AS adr FROM public.daily_metrics WHERE metric_date BETWEEN v_stly_from AND v_stly_to)
    SELECT 'review'::text, 'pricing'::text,
      'ADR weakening vs last year'::text,
      format('ADR $%s vs STLY $%s. Check rate parity and channel mix.', ROUND(cur.adr, 0), ROUND(stly.adr, 0))::text,
      ROUND(cur.adr::numeric, 2), ROUND(stly.adr::numeric, 2),
      ROUND(((cur.adr - stly.adr) / NULLIF(stly.adr, 0) * 100)::numeric, 2),
      'source'::text, NULL::text
    FROM cur, stly WHERE cur.adr < stly.adr * 0.90 AND stly.adr > 0;

    -- 3. Underperforming rooms
    RETURN QUERY
    WITH room_perf AS (
      SELECT 
        COALESCE(ar.room_name, '(unknown)') AS room_name,
        ar.room_id,
        COUNT(rr.id) AS rn,
        100.0 * COUNT(rr.id) / GREATEST(v_days, 1) AS utilization
      FROM (
        SELECT room_id, room_name FROM public.rooms WHERE is_active
        UNION
        SELECT DISTINCT rr2.room_id, '(phantom)' FROM public.reservation_rooms rr2
        LEFT JOIN public.rooms r ON r.room_id = rr2.room_id
        WHERE r.room_id IS NULL AND rr2.room_id IS NOT NULL
      ) ar
      LEFT JOIN public.reservation_rooms rr ON rr.room_id = ar.room_id 
        AND rr.night_date BETWEEN v_from AND v_to AND rr.rate > 0
      LEFT JOIN public.reservations res ON res.reservation_id = rr.reservation_id AND NOT res.is_cancelled
      GROUP BY ar.room_id, ar.room_name
    ),
    bad AS (SELECT *, row_number() OVER (ORDER BY utilization ASC) AS rk FROM room_perf WHERE utilization < 30)
    SELECT 'review'::text, 'inventory'::text,
      format('%s underperforming rooms below 30%% utilization', COUNT(*))::text,
      format('Worst: %s. Promote or pull from channels.', 
             string_agg(room_name, ', ' ORDER BY rk) FILTER (WHERE rk <= 3))::text,
      ROUND(AVG(utilization)::numeric, 1), 30::numeric, NULL::numeric,
      'room'::text, NULL::text
    FROM bad HAVING COUNT(*) > 0;

    -- 4. Booking.com concentration
    RETURN QUERY
    WITH src AS (
      SELECT COALESCE(s.name, r.source_name, 'Unknown') AS source_name, SUM(rr.rate) AS rev, COUNT(rr.id) AS rn
      FROM public.reservations r
      JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN public.sources s ON s.source_id = r.source
      WHERE rr.night_date BETWEEN v_from AND v_to AND NOT r.is_cancelled
        AND r.status NOT IN ('canceled','no_show') AND rr.rate > 0
      GROUP BY 1
    ),
    total AS (SELECT SUM(rev) AS t FROM src),
    booking AS (SELECT s.rn, s.rev, s.rev / t.t AS pct FROM src s, total t WHERE s.source_name ILIKE '%booking.com%'),
    direct_adr AS (
      SELECT AVG(rr.rate) AS adr FROM public.reservation_rooms rr
      JOIN public.reservations r ON r.reservation_id = rr.reservation_id
      LEFT JOIN public.sources s ON s.source_id = r.source
      WHERE rr.night_date BETWEEN v_from AND v_to AND NOT r.is_cancelled AND rr.rate > 0
        AND (COALESCE(s.name, r.source_name, '') ILIKE '%website%' 
          OR COALESCE(s.name, r.source_name, '') ILIKE '%email%'
          OR COALESCE(s.name, r.source_name, '') ILIKE '%direct%')
    )
    SELECT 'review'::text, 'channel'::text,
      'Booking.com dependency creating cost drag'::text,
      format('Booking.com = %s%% of revenue at $%s ADR (net $%s after 15%% commission). Direct ADR $%s. Shift 25%% to direct = +$%s.', 
             ROUND(booking.pct * 100, 0), ROUND(booking.rev / NULLIF(booking.rn, 0), 0),
             ROUND(booking.rev / NULLIF(booking.rn, 0) * 0.85, 0), ROUND(direct_adr.adr, 0),
             ROUND(booking.rn * 0.25 * (direct_adr.adr - booking.rev / NULLIF(booking.rn, 0) * 0.85), 0))::text,
      ROUND((booking.pct * 100)::numeric, 2), 30::numeric, NULL::numeric,
      'source'::text, 'Booking.com'::text
    FROM booking, direct_adr
    WHERE booking.pct > 0.30 AND direct_adr.adr > booking.rev / NULLIF(booking.rn, 0) * 0.85;

    -- 5. Cancellation rate
    RETURN QUERY
    WITH canc AS (
      SELECT COUNT(*) FILTER (WHERE is_cancelled OR status = 'canceled') AS canc, COUNT(*) AS total
      FROM public.reservations WHERE check_in_date BETWEEN v_from AND v_to
    )
    SELECT 'review'::text, 'demand'::text,
      'Cancellation rate above healthy band'::text,
      format('%s%% cancelled (%s of %s). Healthy <20%%. Tighten policy or check rate dumping.', 
             ROUND(canc::numeric / total * 100, 1), canc, total)::text,
      ROUND((canc::numeric / total * 100)::numeric, 2), 20::numeric, NULL::numeric,
      'segment'::text, NULL::text
    FROM canc WHERE total > 10 AND canc::numeric / total > 0.25;

    -- 6. DOW spread opportunity
    RETURN QUERY
    WITH dow_perf AS (
      SELECT EXTRACT(DOW FROM metric_date)::int AS dow, trim(to_char(metric_date, 'Day')) AS dow_name, AVG(occupancy_pct) AS avg_occ
      FROM public.daily_metrics WHERE metric_date BETWEEN v_from AND v_to AND is_actual = true GROUP BY 1, 2
    ),
    spread AS (
      SELECT MAX(avg_occ) - MIN(avg_occ) AS rng,
             (SELECT dow_name FROM dow_perf ORDER BY avg_occ ASC LIMIT 1) AS weakest,
             (SELECT avg_occ FROM dow_perf ORDER BY avg_occ ASC LIMIT 1) AS weakest_val,
             (SELECT dow_name FROM dow_perf ORDER BY avg_occ DESC LIMIT 1) AS strongest,
             (SELECT avg_occ FROM dow_perf ORDER BY avg_occ DESC LIMIT 1) AS strongest_val
      FROM dow_perf
    )
    SELECT 'opportunity'::text, 'pricing'::text,
      format('%s is weakest day — %s%% occ vs %s at %s%%', trim(weakest), ROUND(weakest_val,1), trim(strongest), ROUND(strongest_val,1))::text,
      format('Run a midweek package or DOW-priced rate to lift %s.', trim(weakest))::text,
      ROUND(weakest_val::numeric, 2), ROUND(strongest_val::numeric, 2),
      ROUND(((weakest_val - strongest_val) / NULLIF(strongest_val, 0) * 100)::numeric, 2),
      'dow'::text, NULL::text
    FROM spread WHERE rng > 15;

    -- 7. Lead time shortening
    RETURN QUERY
    WITH lead_now AS (
      SELECT AVG(check_in_date - booking_date::date) AS lt FROM public.reservations
      WHERE check_in_date BETWEEN v_from AND v_to AND booking_date IS NOT NULL
        AND NOT is_cancelled AND status NOT IN ('canceled','no_show')
    ),
    lead_stly AS (
      SELECT AVG(check_in_date - booking_date::date) AS lt FROM public.reservations
      WHERE check_in_date BETWEEN v_stly_from AND v_stly_to AND booking_date IS NOT NULL
        AND NOT is_cancelled AND status NOT IN ('canceled','no_show')
    )
    SELECT 'review'::text, 'demand'::text,
      'Lead time shrinking — last-minute pricing power'::text,
      format('Avg lead %s days vs STLY %s days. Late demand = raise BAR for arrivals < 14 days.', 
             ROUND(lead_now.lt, 0), ROUND(lead_stly.lt, 0))::text,
      ROUND(lead_now.lt::numeric, 1), ROUND(lead_stly.lt::numeric, 1),
      ROUND(((lead_now.lt - lead_stly.lt) / NULLIF(lead_stly.lt, 0) * 100)::numeric, 2),
      'lead_time'::text, NULL::text
    FROM lead_now, lead_stly
    WHERE lead_now.lt < lead_stly.lt * 0.75 AND lead_stly.lt > 0;

  ELSE
    -- FORWARD
    -- 1. Pace gap
    RETURN QUERY
    WITH cur AS (SELECT SUM(rooms_sold) AS rs, AVG(occupancy_pct) AS occ FROM public.daily_metrics WHERE metric_date BETWEEN v_from AND v_to),
    stly AS (SELECT SUM(rooms_sold) AS rs, AVG(occupancy_pct) AS occ FROM public.daily_metrics WHERE metric_date BETWEEN v_stly_from AND v_stly_to AND is_actual = true)
    SELECT 'act_now'::text, 'demand'::text,
      format('Pace gap: %s rooms behind same window last year', COALESCE((stly.rs - cur.rs), 0))::text,
      format('OTB %s RN at %s%% occ vs STLY %s RN at %s%%. Open soft channels, push promos to past guests.',
             COALESCE(cur.rs, 0), ROUND(COALESCE(cur.occ, 0), 1),
             COALESCE(stly.rs, 0), ROUND(COALESCE(stly.occ, 0), 1))::text,
      COALESCE(cur.rs, 0)::numeric, COALESCE(stly.rs, 0)::numeric,
      ROUND(((cur.rs - stly.rs)::numeric / NULLIF(stly.rs, 0) * 100), 2),
      'timeseries'::text, NULL::text
    FROM cur, stly WHERE cur.rs < stly.rs * 0.80 AND stly.rs > 0;

    -- 2. Empty rooms
    RETURN QUERY
    WITH unsold AS (
      SELECT ar.room_id, COALESCE(ar.room_name, '(unknown)') AS room_name, v_days - COUNT(rr.id) AS empty_nights
      FROM (SELECT room_id, room_name FROM public.rooms WHERE is_active) ar
      LEFT JOIN public.reservation_rooms rr ON rr.room_id = ar.room_id
        AND rr.night_date BETWEEN v_from AND v_to AND rr.rate > 0
      LEFT JOIN public.reservations res ON res.reservation_id = rr.reservation_id AND NOT res.is_cancelled
      GROUP BY ar.room_id, ar.room_name
      HAVING (v_days - COUNT(rr.id)) > v_days * 0.7
    ),
    ranked AS (SELECT *, row_number() OVER (ORDER BY empty_nights DESC) AS rk FROM unsold)
    SELECT 'act_now'::text, 'inventory'::text,
      format('%s rooms have >70%% empty nights in window', COUNT(*))::text,
      format('Worst empty: %s. Total empty room-nights: %s. Targeted promotions, lower rate floor.', 
             string_agg(room_name, ', ' ORDER BY rk) FILTER (WHERE rk <= 3), SUM(empty_nights))::text,
      SUM(empty_nights)::numeric, 0::numeric, NULL::numeric,
      'room'::text, NULL::text
    FROM ranked HAVING COUNT(*) > 0;

    -- 3. Forward ADR low
    RETURN QUERY
    WITH cur AS (SELECT AVG(NULLIF(adr,0)) AS adr FROM public.daily_metrics WHERE metric_date BETWEEN v_from AND v_to AND rooms_sold > 0),
    stly AS (SELECT AVG(NULLIF(adr,0)) AS adr FROM public.daily_metrics WHERE metric_date BETWEEN v_stly_from AND v_stly_to AND is_actual = true AND rooms_sold > 0)
    SELECT 'review'::text, 'pricing'::text,
      'Forward ADR booking below last year''s actual'::text,
      format('OTB ADR $%s vs STLY $%s. Either rate strategy off or wholesale-heavy mix.', 
             ROUND(cur.adr, 0), ROUND(stly.adr, 0))::text,
      ROUND(cur.adr::numeric, 2), ROUND(stly.adr::numeric, 2),
      ROUND(((cur.adr - stly.adr) / NULLIF(stly.adr, 0) * 100)::numeric, 2),
      'source'::text, NULL::text
    FROM cur, stly WHERE cur.adr < stly.adr * 0.90 AND stly.adr > 0;

    -- 4. Peak days opportunity
    RETURN QUERY
    WITH peaks AS (SELECT metric_date, occupancy_pct, adr FROM public.daily_metrics WHERE metric_date BETWEEN v_from AND v_to AND occupancy_pct >= 80)
    SELECT 'opportunity'::text, 'pricing'::text,
      format('%s upcoming days already at 80%%+ occupancy', COUNT(*))::text,
      format('Earliest: %s. Avg rate locked at $%s. Lift BAR on remaining open inventory.', MIN(metric_date), ROUND(AVG(adr), 0))::text,
      COUNT(*)::numeric, 0::numeric, NULL::numeric,
      'timeseries'::text, NULL::text
    FROM peaks HAVING COUNT(*) > 0;

    -- 5. Forward direct mix thin
    RETURN QUERY
    WITH src AS (
      SELECT COALESCE(s.name, r.source_name, 'Unknown') AS source_name, SUM(rr.rate) AS rev
      FROM public.reservations r
      JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
      LEFT JOIN public.sources s ON s.source_id = r.source
      WHERE rr.night_date BETWEEN v_from AND v_to AND NOT r.is_cancelled
        AND r.status NOT IN ('canceled','no_show') AND rr.rate > 0
      GROUP BY 1
    ),
    total AS (SELECT SUM(rev) AS t FROM src),
    direct AS (
      SELECT SUM(s.rev) AS rev, t.t AS total_rev FROM src s, total t
      WHERE s.source_name ILIKE '%website%' OR s.source_name ILIKE '%email%' 
         OR s.source_name ILIKE '%direct%' OR s.source_name ILIKE '%walk%'
      GROUP BY t.t
    )
    SELECT 'review'::text, 'channel'::text,
      'Forward direct mix below 30%'::text,
      format('Direct = %s%% of forward revenue. Push past-guest re-targeting and direct rate offers.', 
             ROUND(direct.rev / NULLIF(direct.total_rev, 0) * 100, 0))::text,
      ROUND((direct.rev / NULLIF(direct.total_rev, 0) * 100)::numeric, 2), 30::numeric, NULL::numeric,
      'source'::text, 'Website/Direct'::text
    FROM direct WHERE direct.rev / NULLIF(direct.total_rev, 0) < 0.30;

    -- 6. Country concentration
    RETURN QUERY
    WITH ctry AS (
      SELECT COALESCE(NULLIF(r.guest_country,''), 'Unknown') AS country, SUM(rr.rate) AS rev
      FROM public.reservations r
      JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
      WHERE rr.night_date BETWEEN v_from AND v_to AND NOT r.is_cancelled
        AND r.status NOT IN ('canceled','no_show') AND rr.rate > 0
      GROUP BY 1
    ),
    total AS (SELECT SUM(rev) AS t FROM ctry),
    top_ctry AS (SELECT c.country, c.rev / t.t AS pct FROM ctry c, total t ORDER BY c.rev DESC LIMIT 1)
    SELECT 'opportunity'::text, 'mix'::text,
      format('%s = %s%% of forward demand', country, ROUND(pct * 100, 0))::text,
      format('Lean into %s — targeted ads, language-specific offers, agent partnerships.', country)::text,
      ROUND((pct * 100)::numeric, 2), 0::numeric, NULL::numeric,
      'country'::text, country
    FROM top_ctry WHERE pct > 0.40;

  END IF;

  -- Data quality always shown (qualified to avoid ambiguous severity)
  RETURN QUERY
  SELECT 'review'::text, 'data'::text,
    format('%s critical data quality issue%s open', COUNT(*), CASE WHEN COUNT(*) = 1 THEN '' ELSE 's' END)::text,
    'Reconciliation gaps or missing categories may distort numbers above. Review before acting.'::text,
    COUNT(*)::numeric, 0::numeric, NULL::numeric,
    'data_quality'::text, NULL::text
  FROM dq.violations v
  WHERE v.resolved_at IS NULL AND v.severity = 'CRITICAL'
  HAVING COUNT(*) > 0;

END;
$func$;

GRANT EXECUTE ON FUNCTION kpi.actions(text) TO anon, authenticated;