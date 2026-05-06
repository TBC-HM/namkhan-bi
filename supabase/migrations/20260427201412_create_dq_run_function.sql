-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427201412
-- Name:    create_dq_run_function
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION dq.run_all()
RETURNS TABLE(rule_id text, severity text, count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  v_run_id bigint;
  v_today date := CURRENT_DATE;
  v_yesterday date := CURRENT_DATE - 1;
BEGIN
  INSERT INTO dq.run_log (started_at, status) VALUES (now(), 'running') RETURNING run_id INTO v_run_id;

  -- Clear unresolved violations from this run if re-running
  -- (we keep historical, just mark current as superseded)

  -- R-001: No reservations modified in last 6 hours
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-001', 'WARNING', 'pipeline',
    jsonb_build_object('hours_since_last_modify', 
      EXTRACT(EPOCH FROM (now() - MAX(modified))) / 3600)
  FROM public.reservations
  HAVING MAX(modified) < now() - interval '6 hours';

  -- R-002: No transactions in last 24h
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-002', 'WARNING', 'pipeline',
    jsonb_build_object('hours_since_last_txn', 
      EXTRACT(EPOCH FROM (now() - MAX(transaction_date))) / 3600)
  FROM public.transactions
  HAVING MAX(transaction_date) < now() - interval '24 hours';

  -- R-003: daily_metrics missing for yesterday
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-003', 'CRITICAL', 'daily_metrics', v_yesterday::text,
    jsonb_build_object('missing_date', v_yesterday)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.daily_metrics WHERE metric_date = v_yesterday
  );

  -- R-004: Reservation has no rooms
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-004', 'WARNING', 'reservation', r.reservation_id::text,
    jsonb_build_object('total_amount', r.total_amount, 'status', r.status)
  FROM public.reservations r
  LEFT JOIN public.reservation_rooms rr ON rr.reservation_id = r.reservation_id
  WHERE r.status NOT IN ('canceled','no_show')
  GROUP BY r.reservation_id, r.total_amount, r.status
  HAVING COUNT(rr.id) = 0
  LIMIT 100;

  -- R-006: Negative or zero rate
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-006', 'CRITICAL', 'reservation_room', rr.id::text,
    jsonb_build_object('rate', rr.rate, 'reservation_id', rr.reservation_id)
  FROM public.reservation_rooms rr
  WHERE rr.rate < 0
  LIMIT 100;

  -- R-007: Check-in after check-out
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-007', 'CRITICAL', 'reservation', reservation_id::text,
    jsonb_build_object('check_in', check_in_date, 'check_out', check_out_date)
  FROM public.reservations
  WHERE check_in_date > check_out_date
  LIMIT 100;

  -- R-008: Stay > 30 nights
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-008', 'WARNING', 'reservation', reservation_id::text,
    jsonb_build_object('nights', (check_out_date - check_in_date), 
                       'check_in', check_in_date, 'check_out', check_out_date)
  FROM public.reservations
  WHERE (check_out_date - check_in_date) > 30
    AND status NOT IN ('canceled','no_show')
  LIMIT 100;

  -- R-009: Future-dated transaction (post date in future)
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-009', 'WARNING', 'transaction', transaction_id::text,
    jsonb_build_object('transaction_date', transaction_date, 'amount', amount)
  FROM public.transactions
  WHERE transaction_date > now() + interval '1 day'
  LIMIT 100;

  -- R-013, R-014: Reconciliation gaps from VAT-adjusted view
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 
    CASE 
      WHEN ABS(adjusted_gap_pct) > 15 THEN 'R-014'
      ELSE 'R-013'
    END AS rule_id,
    CASE 
      WHEN ABS(adjusted_gap_pct) > 15 THEN 'CRITICAL'
      ELSE 'WARNING'
    END AS severity,
    'reconciliation',
    period_year || '-' || lpad(period_month::text, 2, '0'),
    jsonb_build_object(
      'cb_gross', cb_gross_usd, 'cb_net_implied', cb_net_implied_usd,
      'qb_net', qb_net_usd, 'gap_pct', adjusted_gap_pct
    )
  FROM gl.v_cb_qb_reconciliation_vat_adj
  WHERE reconciliation_status IN ('INVESTIGATE','MINOR_GAP')
    AND ABS(adjusted_gap_pct) > 5;

  -- R-015: Occupancy > 100%
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-015', 'CRITICAL', 'daily_metrics', metric_date::text,
    jsonb_build_object('occupancy', occupancy_pct, 'rooms_sold', rooms_sold, 'rooms_available', rooms_available)
  FROM public.daily_metrics
  WHERE occupancy_pct > 1.0
  LIMIT 100;

  -- R-016: Zero occupancy on weekday past dates only
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-016', 'WARNING', 'daily_metrics', metric_date::text,
    jsonb_build_object('occupancy', occupancy_pct, 'rooms_sold', rooms_sold)
  FROM public.daily_metrics
  WHERE occupancy_pct = 0 
    AND metric_date BETWEEN v_today - 30 AND v_today - 1
    AND EXTRACT(DOW FROM metric_date) BETWEEN 1 AND 5
    AND is_actual = true
  LIMIT 100;

  -- R-018: Revenue drop > 50% MoM 
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-018', 'CRITICAL', 'monthly_revenue', 
    period_year || '-' || lpad(period_month::text, 2, '0'),
    jsonb_build_object('current', amount_usd, 'previous', prev_amount, 
                       'pct_change', ROUND((amount_usd - prev_amount) / NULLIF(prev_amount,0) * 100, 2))
  FROM (
    SELECT 
      period_year,
      period_month,
      amount_usd,
      LAG(amount_usd) OVER (ORDER BY period_year, period_month) AS prev_amount
    FROM (
      SELECT 
        EXTRACT(YEAR FROM metric_date)::int AS period_year,
        EXTRACT(MONTH FROM metric_date)::int AS period_month,
        SUM(rooms_revenue) AS amount_usd
      FROM public.daily_metrics
      WHERE rooms_revenue > 0 AND is_actual = true
      GROUP BY 1, 2
    ) m
  ) m2
  WHERE prev_amount > 0 
    AND (amount_usd - prev_amount) / prev_amount < -0.50
    -- Exclude current partial month
    AND NOT (period_year = EXTRACT(YEAR FROM CURRENT_DATE) 
             AND period_month = EXTRACT(MONTH FROM CURRENT_DATE));

  -- R-021: QB transaction with unknown account_code
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-021', 'CRITICAL', 'pnl_snapshot', period_year || '-' || lpad(period_month::text,2,'0') || ':' || ps.account_code,
    jsonb_build_object('account_code', ps.account_code, 'amount', ps.amount_usd)
  FROM gl.pnl_snapshot ps
  LEFT JOIN gl.accounts a ON a.account_code = ps.account_code
  WHERE a.account_code IS NULL
  LIMIT 100;

  -- R-022: plan.lines orphan account
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-022', 'WARNING', 'plan_lines', pl.account_code,
    jsonb_build_object('account_code', pl.account_code, 'period', pl.period_year || '-' || lpad(pl.period_month::text,2,'0'))
  FROM plan.lines pl
  LEFT JOIN gl.accounts a ON a.account_code = pl.account_code
  WHERE a.account_code IS NULL
  LIMIT 100;

  -- R-023: Sync queue stuck > 1 hour (using sync_request_queue)
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-023', 'CRITICAL', 'sync_queue', id::text,
    jsonb_build_object('endpoint', endpoint, 'created_at', created_at, 'status', status)
  FROM public.sync_request_queue
  WHERE status IN ('pending','processing') AND created_at < now() - interval '1 hour'
  LIMIT 100;

  -- R-025: FX rate stale
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'R-025', 'WARNING', 'fx_rates',
    jsonb_build_object('latest_rate_date', MAX(rate_date), 'days_old', CURRENT_DATE - MAX(rate_date))
  FROM gl.fx_rates
  HAVING MAX(rate_date) < CURRENT_DATE - 7;

  -- R-027: Budget vs Actual variance > 50% YTD
  INSERT INTO dq.violations (rule_id, severity, entity_type, entity_id, details)
  SELECT 'R-027', 'INFO', 'budget_variance', pl_section,
    jsonb_build_object('section', pl_section, 'budget', budget_usd, 'actual', actual_usd, 'var_pct', var_pct)
  FROM plan.snapshot(EXTRACT(YEAR FROM CURRENT_DATE)::int)
  WHERE ABS(COALESCE(var_pct, 0)) > 50
    AND budget_usd > 1000;

  -- R-030: LAK GL row missing FX rate (placeholder, gl.transactions empty for now)
  -- skipped until gl.transactions loaded
  
  -- H-002: OTA channel concentration > 70%
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'H-002', 'WARNING', 'channel_mix',
    jsonb_build_object('source', source_name, 'pct_of_revenue', ROUND(rev_pct*100, 2))
  FROM (
    SELECT 
      s.name AS source_name,
      SUM(r.total_amount) / NULLIF(SUM(SUM(r.total_amount)) OVER (), 0) AS rev_pct
    FROM public.reservations r
    JOIN public.sources s ON s.id = r.source_id
    WHERE r.check_in_date >= CURRENT_DATE - 90
      AND r.status NOT IN ('canceled','no_show')
    GROUP BY s.name
  ) c
  WHERE rev_pct > 0.70;

  -- H-003: Cancellation rate > 25%
  INSERT INTO dq.violations (rule_id, severity, entity_type, details)
  SELECT 'H-003', 'WARNING', 'cancellation_rate',
    jsonb_build_object('canceled', canceled, 'total', total, 'rate_pct', ROUND(canceled::numeric/total*100, 2))
  FROM (
    SELECT 
      COUNT(*) FILTER (WHERE status = 'canceled') AS canceled,
      COUNT(*) AS total
    FROM public.reservations
    WHERE check_in_date >= CURRENT_DATE - 90
  ) cc
  WHERE total > 0 AND canceled::numeric/total > 0.25;

  -- Finalize run
  UPDATE dq.run_log 
  SET completed_at = now(), 
      status = 'completed',
      rules_checked = (SELECT COUNT(*) FROM dq.rules WHERE is_active),
      violations_found = (SELECT COUNT(*) FROM dq.violations WHERE detected_at >= (SELECT started_at FROM dq.run_log WHERE run_id = v_run_id))
  WHERE run_id = v_run_id;

  RETURN QUERY 
  SELECT v.rule_id, v.severity, COUNT(*) 
  FROM dq.violations v
  WHERE v.detected_at >= (SELECT started_at FROM dq.run_log WHERE run_id = v_run_id)
  GROUP BY v.rule_id, v.severity
  ORDER BY 
    CASE v.severity WHEN 'CRITICAL' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
    v.rule_id;
END;
$$;