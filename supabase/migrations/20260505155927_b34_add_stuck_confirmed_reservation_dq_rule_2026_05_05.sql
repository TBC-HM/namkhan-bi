-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505155927
-- Name:    b34_add_stuck_confirmed_reservation_dq_rule_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B34: Add DQ rule R-028 for "stuck confirmed" reservations
-- (a confirmed reservation whose check-in date is in the past — staff forgot to update status)

INSERT INTO dq.rules (rule_id, rule_name, category, severity, description, is_active)
VALUES (
  'R-028',
  'Confirmed reservations past check-in date',
  'Operational',
  'WARNING',
  'Reservation status is "confirmed" but check-in date has passed. Front desk likely forgot to mark as checked_in or no_show. Should be ≤2 such cases at any time.',
  true
)
ON CONFLICT (rule_id) DO NOTHING;

-- Patch dq.run_all to include R-028
CREATE OR REPLACE FUNCTION dq.run_all()
RETURNS TABLE(rule_id text, severity text, count bigint)
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public', 'dq'
AS $function$
DECLARE
  v_run_id bigint;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
  v_run_started timestamptz := now();
BEGIN
  INSERT INTO dq.run_log (started_at, status) VALUES (v_run_started, 'running') RETURNING run_id INTO v_run_id;

  UPDATE dq.violations
  SET resolved_at = v_run_started, resolved_by = 'auto_supersede',
      resolution_notes = 'Auto-superseded by run #' || v_run_id
  WHERE resolved_at IS NULL;

  -- R-001
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-001', 'WARNING', 'pipeline',
    jsonb_build_object('hours_since_last_modify', ROUND(EXTRACT(EPOCH FROM (now() - MAX(updated_at))) / 3600, 1))
  FROM public.reservations
  HAVING MAX(updated_at) < now() - interval '6 hours';

  -- R-002
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-002', 'WARNING', 'pipeline',
    jsonb_build_object('hours_since_last_txn', ROUND(EXTRACT(EPOCH FROM (now() - MAX(transaction_date))) / 3600, 1))
  FROM public.transactions
  HAVING MAX(transaction_date) < now() - interval '24 hours';

  -- R-003
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-003', 'CRITICAL', 'daily_metrics', v_yesterday::text, jsonb_build_object('missing_date', v_yesterday)
  WHERE NOT EXISTS (SELECT 1 FROM public.daily_metrics WHERE metric_date = v_yesterday);

  -- R-004
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-004', 'WARNING', 'reservation', r.reservation_id::text,
    jsonb_build_object('total_amount', r.total_amount, 'status', r.status, 'check_in', r.check_in_date)
  FROM public.reservations r
  LEFT JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
  WHERE r.status NOT IN ('canceled','no_show') AND r.is_cancelled = false AND r.check_in_date >= v_today - 30
  GROUP BY r.reservation_id, r.total_amount, r.status, r.check_in_date
  HAVING COUNT(rr.id) = 0 LIMIT 100;

  -- R-006
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-006', 'CRITICAL', 'reservation_room', rr.id::text,
    jsonb_build_object('rate', rr.rate, 'reservation_id', rr.reservation_id, 'night_date', rr.night_date)
  FROM public.reservation_rooms rr WHERE rr.rate < 0 LIMIT 100;

  -- R-007
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-007', 'CRITICAL', 'reservation', reservation_id::text,
    jsonb_build_object('check_in', check_in_date, 'check_out', check_out_date)
  FROM public.reservations WHERE check_in_date > check_out_date LIMIT 100;

  -- R-008
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-008', 'WARNING', 'reservation', reservation_id::text,
    jsonb_build_object('nights', (check_out_date - check_in_date),
                       'check_in', check_in_date, 'check_out', check_out_date, 'total', total_amount)
  FROM public.reservations
  WHERE (check_out_date - check_in_date) > 30 AND status NOT IN ('canceled','no_show')
    AND is_cancelled = false AND check_in_date >= v_today - 365 LIMIT 100;

  -- R-009
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-009', 'WARNING', 'transaction', transaction_id::text,
    jsonb_build_object('transaction_date', transaction_date, 'amount', amount)
  FROM public.transactions WHERE transaction_date > now() + interval '1 day' LIMIT 100;

  -- R-010
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-010', 'INFO', 'pos_quality', jsonb_build_object('count_missing', COUNT(*))
  FROM public.transactions WHERE item_category_name IS NULL OR item_category_name = ''
  HAVING COUNT(*) > 50;

  -- R-013/R-014
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT
    CASE WHEN ABS(adjusted_gap_pct) > 15 THEN 'R-014' ELSE 'R-013' END,
    CASE WHEN ABS(adjusted_gap_pct) > 15 THEN 'CRITICAL' ELSE 'WARNING' END,
    'reconciliation', period_year || '-' || lpad(period_month::text, 2, '0'),
    jsonb_build_object('cb_gross', cb_gross_usd, 'cb_net_implied', cb_net_implied_usd,
                       'qb_net', qb_net_usd, 'gap_pct', adjusted_gap_pct)
  FROM gl.v_cb_qb_reconciliation_vat_adj
  WHERE reconciliation_status IN ('INVESTIGATE','MINOR_GAP') AND ABS(adjusted_gap_pct) > 5
    AND NOT (period_year = EXTRACT(YEAR FROM v_today)::int AND period_month = EXTRACT(MONTH FROM v_today)::int);

  -- R-015
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-015', 'CRITICAL', 'daily_metrics', metric_date::text,
    jsonb_build_object('occupancy', occupancy_pct, 'rooms_sold', rooms_sold, 'rooms_available', rooms_available)
  FROM public.daily_metrics WHERE occupancy_pct > 100 LIMIT 100;

  -- R-016
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-016', 'WARNING', 'daily_metrics', metric_date::text,
    jsonb_build_object('occupancy', occupancy_pct, 'rooms_sold', rooms_sold)
  FROM public.daily_metrics
  WHERE occupancy_pct = 0 AND metric_date BETWEEN v_today - 30 AND v_today - 1
    AND EXTRACT(DOW FROM metric_date) BETWEEN 1 AND 5 AND is_actual = true LIMIT 100;

  -- R-018
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-018', 'CRITICAL', 'monthly_revenue', period_year || '-' || lpad(period_month::text, 2, '0'),
    jsonb_build_object('current', amount_usd, 'previous', prev_amount,
                       'pct_change', ROUND((amount_usd - prev_amount) / NULLIF(prev_amount,0) * 100, 2))
  FROM (
    SELECT period_year, period_month, amount_usd,
      LAG(amount_usd) OVER (ORDER BY period_year, period_month) AS prev_amount
    FROM (
      SELECT EXTRACT(YEAR FROM metric_date)::int AS period_year,
             EXTRACT(MONTH FROM metric_date)::int AS period_month, SUM(rooms_revenue) AS amount_usd
      FROM public.daily_metrics WHERE rooms_revenue > 0 AND is_actual = true GROUP BY 1, 2
    ) m
  ) m2
  WHERE prev_amount > 0 AND (amount_usd - prev_amount) / prev_amount < -0.50
    AND NOT (period_year = EXTRACT(YEAR FROM v_today)::int AND period_month = EXTRACT(MONTH FROM v_today)::int);

  -- R-021
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-021', 'CRITICAL', 'pnl_snapshot',
    period_year || '-' || lpad(period_month::text,2,'0') || ':' || ps.account_code,
    jsonb_build_object('account_code', ps.account_code, 'amount', ps.amount_usd)
  FROM gl.pnl_snapshot ps LEFT JOIN gl.accounts a ON a.account_id = ps.account_code
  WHERE a.account_id IS NULL LIMIT 100;

  -- R-022
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-022', 'WARNING', 'plan_lines', pl.account_code,
    jsonb_build_object('account_code', pl.account_code,
                       'period', pl.period_year || '-' || lpad(pl.period_month::text,2,'0'))
  FROM plan.lines pl LEFT JOIN gl.accounts a ON a.account_id = pl.account_code
  WHERE a.account_id IS NULL LIMIT 100;

  -- R-023
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-023', 'CRITICAL', 'sync_queue', id::text,
    jsonb_build_object('entity', entity, 'created_at', created_at, 'status', status)
  FROM public.sync_request_queue
  WHERE status IN ('pending','processing','firing') AND created_at < now() - interval '1 hour' LIMIT 100;

  -- R-024
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-024', 'WARNING', 'sync_health',
    jsonb_build_object('error_count', error_count, 'total_count', total,
                       'error_rate_pct', ROUND(error_count::numeric/total*100, 2))
  FROM (
    SELECT COUNT(*) FILTER (WHERE status = 'failed' OR error_msg IS NOT NULL) AS error_count, COUNT(*) AS total
    FROM public.sync_request_queue WHERE created_at >= now() - interval '24 hours'
  ) sq
  WHERE total > 10 AND error_count::numeric/total > 0.10;

  -- R-025
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-025', 'WARNING', 'fx_rates',
    jsonb_build_object('latest_rate_date', MAX(rate_date), 'days_old', CURRENT_DATE - MAX(rate_date))
  FROM gl.fx_rates HAVING MAX(rate_date) < CURRENT_DATE - 7;

  -- R-027
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-027', 'INFO', 'budget_variance', pl_section,
    jsonb_build_object('section', pl_section, 'budget', budget_usd, 'actual', actual_usd, 'var_pct', var_pct)
  FROM plan.snapshot(EXTRACT(YEAR FROM CURRENT_DATE)::int)
  WHERE ABS(COALESCE(var_pct, 0)) > 50 AND budget_usd > 1000;

  -- R-028 (NEW): stuck confirmed reservations past check-in
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-028', 'WARNING', 'reservation', reservation_id::text,
    jsonb_build_object(
      'check_in_date', check_in_date,
      'check_out_date', check_out_date,
      'days_past_check_in', (CURRENT_DATE - check_in_date),
      'guest_name', guest_name,
      'note', 'Status still confirmed but check-in date has passed. Update to checked_in or no_show.'
    )
  FROM public.reservations
  WHERE status = 'confirmed'
    AND check_in_date < CURRENT_DATE
    AND check_in_date >= CURRENT_DATE - 30
    AND COALESCE(is_cancelled, false) = false
  LIMIT 100;

  -- H-001
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'H-001', 'INFO', 'reservation', reservation_id::text,
    jsonb_build_object('check_in', check_in_date, 'check_out', check_out_date, 'total', total_amount)
  FROM public.reservations
  WHERE check_in_date = check_out_date AND check_in_date >= v_today - 90
    AND status NOT IN ('canceled','no_show') LIMIT 100;

  -- H-002
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'H-002', 'WARNING', 'channel_mix',
    jsonb_build_object('source', source_name, 'pct_of_revenue', ROUND(rev_pct*100, 2))
  FROM (
    SELECT COALESCE(s.name, r.source_name, 'Unknown') AS source_name,
      SUM(r.total_amount) / NULLIF(SUM(SUM(r.total_amount)) OVER (), 0) AS rev_pct
    FROM public.reservations r
    LEFT JOIN public.sources s ON s.source_id = r.source
    WHERE r.check_in_date >= CURRENT_DATE - 90 AND r.status NOT IN ('canceled','no_show')
      AND r.is_cancelled = false
    GROUP BY COALESCE(s.name, r.source_name, 'Unknown')
  ) c WHERE rev_pct > 0.70;

  -- H-003
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'H-003', 'WARNING', 'cancellation_rate',
    jsonb_build_object('canceled', canceled, 'total', total,
                       'rate_pct', ROUND(canceled::numeric/total*100, 2))
  FROM (
    SELECT COUNT(*) FILTER (WHERE status = 'canceled' OR is_cancelled = true) AS canceled, COUNT(*) AS total
    FROM public.reservations WHERE check_in_date >= CURRENT_DATE - 90
  ) cc WHERE total > 0 AND canceled::numeric/total > 0.25;

  UPDATE dq.run_log
  SET completed_at = now(), status = 'completed',
      rules_checked = (SELECT COUNT(*) FROM dq.rules WHERE is_active),
      violations_found = (SELECT COUNT(*) FROM dq.violations WHERE detected_at >= v_run_started)
  WHERE run_id = v_run_id;

  RETURN QUERY
  SELECT v.rule_id, v.severity, COUNT(*)
  FROM dq.violations v WHERE v.detected_at >= v_run_started
  GROUP BY v.rule_id, v.severity
  ORDER BY CASE v.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END, v.rule_id;
END;
$function$;