-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171658
-- Name:    poster_finding_drilldown_v1_simple
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION public.poster_finding_drilldown(p_kind text)
RETURNS TABLE (month_yyyymm text, n integer, usd numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
DECLARE
  pred text;
BEGIN
  pred := CASE p_kind
    WHEN 'unmatchable'      THEN E'payment_method = ''Charge Room / to Folio'' AND status = ''Close'' AND (reconciled_with IS NULL OR reconciled_with = ''no_match'')'
    WHEN 'ambiguous_room'   THEN E'payment_method = ''Charge Room / to Folio'' AND status = ''Close'' AND reconciled_with = ''ambiguous_room'''
    WHEN 'amount_mismatch'  THEN E'payment_method = ''Charge Room / to Folio'' AND status = ''Close'' AND reconciled_with = ''amount_mismatch'''
    WHEN 'no_cb_lines'      THEN E'payment_method = ''Charge Room / to Folio'' AND status = ''Close'' AND reconciled_with = ''no_cb_lines'''
    WHEN 'open_receipts'    THEN E'status = ''Open'''
    WHEN 'deleted_receipts' THEN E'status IN (''Delete'',''Canceled'')'
    WHEN 'without_payment'  THEN E'status = ''Close'' AND payment_method = ''Without payment'''
    WHEN 'internal'         THEN E'status = ''Close'' AND payment_method = ''Internal  (Bfast,Mgmt/Staff,IMekong)'''
    ELSE NULL
  END;
  IF pred IS NULL THEN RETURN; END IF;

  RETURN QUERY EXECUTE
    'SELECT to_char(COALESCE(open_at, close_at)::date, ''YYYY-MM'') AS month_yyyymm, '
    '       COUNT(*)::int AS n, '
    '       COALESCE(SUM(order_total), 0) AS usd '
    'FROM pos.poster_receipts '
    'WHERE ' || pred || ' '
    'GROUP BY 1 '
    'ORDER BY 1 DESC';
END;
$$;
GRANT EXECUTE ON FUNCTION public.poster_finding_drilldown(text) TO anon, authenticated, service_role;

-- Smoke test: drilldown for unmatchable.
SELECT * FROM public.poster_finding_drilldown('unmatchable') LIMIT 5;