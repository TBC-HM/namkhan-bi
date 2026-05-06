-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505110239
-- Name:    poster_reconcile_run_v2_drop_first
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

DROP FUNCTION IF EXISTS public.poster_reconcile_run();
CREATE FUNCTION public.poster_reconcile_run()
RETURNS TABLE (
  total_processed integer,
  matched_green integer,
  matched_amber integer,
  matched_red integer,
  ambiguous_room integer,
  no_match integer,
  unaliased_clients integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pos
AS $$
DECLARE
  rec record;
  res_id text;
  match_kind text;
  cb_amount numeric;
  cb_delta numeric;
  cb_pct numeric;
  status_label text;
  occupants integer;
  alias_target text;
  cnt_total integer := 0;
  cnt_green integer := 0;
  cnt_amber integer := 0;
  cnt_red integer := 0;
  cnt_amb integer := 0;
  cnt_no integer := 0;
  cnt_unaliased integer := 0;
BEGIN
  UPDATE pos.poster_receipts
     SET reconciled = false, reconciled_with = NULL, cb_reservation_id = NULL,
         cb_match_amount = NULL, cb_match_delta = NULL, reconciled_at = NULL
   WHERE payment_method = 'Charge Room / to Folio';

  FOR rec IN
    SELECT receipt_id, client, order_total, close_at::date AS d
    FROM pos.poster_receipts
    WHERE payment_method = 'Charge Room / to Folio'
      AND status = 'Close' AND close_at IS NOT NULL
  LOOP
    cnt_total := cnt_total + 1;
    res_id := NULL; match_kind := NULL; alias_target := NULL;

    IF rec.client IS NOT NULL AND length(trim(rec.client)) > 0 THEN
      SELECT r.reservation_id INTO res_id
      FROM public.reservations r
      WHERE r.property_id = 260955
        AND lower(trim(r.guest_name)) = lower(trim(rec.client))
        AND rec.d BETWEEN r.check_in_date AND r.check_out_date
      ORDER BY r.check_in_date DESC LIMIT 1;
      IF res_id IS NOT NULL THEN match_kind := 'guest_name'; END IF;
    END IF;

    IF res_id IS NULL AND rec.client IS NOT NULL THEN
      SELECT a.cb_room_type_name INTO alias_target
      FROM pos.poster_room_type_alias a
      WHERE lower(trim(a.poster_client)) = lower(trim(rec.client));

      SELECT COUNT(*), MAX(r.reservation_id)
        INTO occupants, res_id
      FROM public.reservations r
      WHERE r.property_id = 260955
        AND lower(trim(r.room_type_name)) = COALESCE(lower(trim(alias_target)), lower(trim(rec.client)))
        AND rec.d BETWEEN r.check_in_date AND r.check_out_date - INTERVAL '1 day'
        AND r.is_cancelled IS NOT TRUE;
      IF occupants = 1 THEN
        match_kind := CASE WHEN alias_target IS NOT NULL THEN 'room_alias_unique' ELSE 'room_type_unique' END;
      ELSIF occupants > 1 THEN
        match_kind := 'room_type_ambiguous'; res_id := NULL;
      ELSE
        IF alias_target IS NULL AND rec.client !~* '^(NK |Hotel Guest|Volunteer)' THEN
          cnt_unaliased := cnt_unaliased + 1;
        END IF;
      END IF;
    END IF;

    cb_amount := NULL; cb_delta := NULL; cb_pct := NULL;
    IF res_id IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO cb_amount
      FROM public.mv_classified_transactions
      WHERE property_id = 260955
        AND reservation_id = res_id
        AND transaction_date::date BETWEEN rec.d - INTERVAL '1 day' AND rec.d + INTERVAL '1 day'
        AND amount > 0;
      cb_delta := COALESCE(rec.order_total, 0) - COALESCE(cb_amount, 0);
      cb_pct := CASE WHEN COALESCE(rec.order_total, 0) > 0
                     THEN abs(cb_delta) / rec.order_total * 100 ELSE NULL END;
    END IF;

    status_label := CASE
      WHEN match_kind IS NULL                        THEN 'no_match'
      WHEN match_kind = 'room_type_ambiguous'        THEN 'ambiguous_room'
      WHEN cb_amount IS NULL OR cb_amount = 0        THEN 'no_cb_lines'
      WHEN abs(cb_delta) <= 0.50                     THEN 'cloudbeds_match'
      WHEN cb_pct IS NOT NULL AND cb_pct <= 5        THEN 'amount_close'
      ELSE                                                'amount_mismatch'
    END;

    UPDATE pos.poster_receipts
       SET reconciled       = (status_label = 'cloudbeds_match'),
           reconciled_with  = status_label,
           cb_reservation_id = res_id,
           cb_match_amount  = cb_amount,
           cb_match_delta   = cb_delta,
           reconciled_at    = now()
     WHERE receipt_id = rec.receipt_id;

    IF status_label = 'cloudbeds_match'    THEN cnt_green := cnt_green + 1;
    ELSIF status_label = 'amount_close'    THEN cnt_amber := cnt_amber + 1;
    ELSIF status_label = 'ambiguous_room'  THEN cnt_amb := cnt_amb + 1;
    ELSIF status_label = 'no_match'        THEN cnt_no := cnt_no + 1;
    ELSE                                        cnt_red := cnt_red + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT cnt_total, cnt_green, cnt_amber, cnt_red, cnt_amb, cnt_no, cnt_unaliased;
END;
$$;

GRANT EXECUTE ON FUNCTION public.poster_reconcile_run() TO service_role;