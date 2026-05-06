-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427213533
-- Name:    create_pnl_bulk_loader
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Bulk loader for P&L snapshot from JSONB
-- Payload: [[year, month, account_code, amount_usd, is_partial, partial_day], ...]
CREATE OR REPLACE FUNCTION gl.import_pnl_snapshot(
  p_payload jsonb,
  p_source_file text DEFAULT 'manual'
) RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  WITH raw AS (
    SELECT 
      (r->>0)::int AS period_year,
      (r->>1)::int AS period_month,
      (r->>2)::text AS account_code,
      (r->>3)::numeric AS amount_usd,
      COALESCE((r->>4)::boolean, false) AS is_partial,
      NULLIF(r->>5, 'null')::int AS partial_day
    FROM jsonb_array_elements(p_payload) AS r
  )
  INSERT INTO gl.pnl_snapshot 
    (period_year, period_month, account_code, amount_usd, is_partial_month, partial_month_end_day, source_file)
  SELECT period_year, period_month, account_code, amount_usd, is_partial, partial_day, p_source_file
  FROM raw
  ON CONFLICT (period_year, period_month, account_code, source_file) DO UPDATE 
    SET amount_usd = EXCLUDED.amount_usd;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;