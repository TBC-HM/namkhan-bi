-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505175939
-- Name:    poster_finding_receipts_v2_with_room_no
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP FUNCTION IF EXISTS public.poster_finding_receipts(text, integer);
CREATE FUNCTION public.poster_finding_receipts(p_kind text, p_limit integer DEFAULT 200)
RETURNS TABLE (
  receipt_id        bigint,
  open_at           timestamptz,
  close_at          timestamptz,
  order_source      text,
  table_label       text,
  poster_client     text,
  order_total       numeric,
  status            text,
  payment_method    text,
  cb_reservation_id text,
  cb_guest_name     text,
  cb_room_type      text,
  cb_room_no        text,           -- NEW: physical room number ("Suite 11", "Villa 9", "Tent 3")
  cb_check_in       date,
  cb_check_out      date,
  in_house_at_close boolean,
  reconciled_with   text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
DECLARE
  pred text;
BEGIN
  pred := CASE p_kind
    WHEN 'unmatchable'      THEN E'pr.payment_method = ''Charge Room / to Folio'' AND pr.status = ''Close'' AND (pr.reconciled_with IS NULL OR pr.reconciled_with = ''no_match'')'
    WHEN 'ambiguous_room'   THEN E'pr.payment_method = ''Charge Room / to Folio'' AND pr.status = ''Close'' AND pr.reconciled_with = ''ambiguous_room'''
    WHEN 'amount_mismatch'  THEN E'pr.payment_method = ''Charge Room / to Folio'' AND pr.status = ''Close'' AND pr.reconciled_with = ''amount_mismatch'''
    WHEN 'no_cb_lines'      THEN E'pr.payment_method = ''Charge Room / to Folio'' AND pr.status = ''Close'' AND pr.reconciled_with = ''no_cb_lines'''
    WHEN 'open_receipts'    THEN E'pr.status = ''Open'''
    WHEN 'deleted_receipts' THEN E'pr.status IN (''Delete'',''Canceled'')'
    WHEN 'without_payment'  THEN E'pr.status = ''Close'' AND pr.payment_method = ''Without payment'''
    WHEN 'internal'         THEN E'pr.status = ''Close'' AND pr.payment_method = ''Internal  (Bfast,Mgmt/Staff,IMekong)'''
    ELSE NULL
  END;
  IF pred IS NULL THEN RETURN; END IF;

  RETURN QUERY EXECUTE
    'SELECT pr.receipt_id, pr.open_at, pr.close_at, pr.order_source, pr.table_label, '
    '       pr.client AS poster_client, pr.order_total, pr.status, pr.payment_method, '
    '       pr.cb_reservation_id, '
    '       r.guest_name AS cb_guest_name, '
    '       r.room_type_name AS cb_room_type, '
    '       (r.raw->''rooms''->0->>''roomName'')::text AS cb_room_no, '
    '       r.check_in_date AS cb_check_in, '
    '       r.check_out_date AS cb_check_out, '
    '       (r.reservation_id IS NOT NULL '
    '         AND COALESCE(pr.close_at, pr.open_at)::date >= r.check_in_date '
    '         AND COALESCE(pr.close_at, pr.open_at)::date <  r.check_out_date) AS in_house_at_close, '
    '       pr.reconciled_with '
    'FROM pos.poster_receipts pr '
    'LEFT JOIN public.reservations r ON r.reservation_id = pr.cb_reservation_id AND r.property_id = 260955 '
    'WHERE ' || pred || ' '
    'ORDER BY pr.open_at DESC NULLS LAST '
    'LIMIT $1' USING p_limit;
END;
$$;
GRANT EXECUTE ON FUNCTION public.poster_finding_receipts(text, integer) TO anon, authenticated, service_role;

-- Verify
SELECT receipt_id, poster_client, cb_guest_name, cb_room_type, cb_room_no, in_house_at_close
FROM public.poster_finding_receipts('amount_mismatch', 5);