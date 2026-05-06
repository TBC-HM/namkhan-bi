-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505110401
-- Name:    poster_reconcile_run_v3_per_receipt
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Per-receipt matcher (not per-folio):
-- For each Poster Charge-to-room receipt, find a CB POS line on the same
-- reservation × same day (±2d) where the amount matches order_total within $0.50.
-- That's the strict "this exact receipt landed on the bill" check.
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
  exact_match_amt numeric;
  approx_total numeric;
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
    WHERE payment_method = 'Charge Room / to Folio' AND status = 'Close' AND close_at IS NOT NULL
  LOOP
    cnt_total := cnt_total + 1;
    res_id := NULL; match_kind := NULL; alias_target := NULL;
    exact_match_amt := NULL; approx_total := NULL;

    -- Resolve a candidate reservation_id (guest-name → room-type → alias).
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

      SELECT COUNT(*), MAX(r.reservation_id) INTO occupants, res_id
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

    -- For matched receipts: find an F&B-tagged CB POS line that matches order_total (±$0.50)
    -- on the same reservation × same day (±2d).
    IF res_id IS NOT NULL THEN
      SELECT amount INTO exact_match_amt
      FROM public.mv_classified_transactions
      WHERE property_id = 260955
        AND reservation_id = res_id
        AND usali_dept = 'F&B'
        AND amount > 0
        AND transaction_date::date BETWEEN rec.d - INTERVAL '2 days' AND rec.d + INTERVAL '2 days'
        AND abs(amount - rec.order_total) <= 0.50
      ORDER BY abs(amount - rec.order_total) ASC, abs(transaction_date::date - rec.d) ASC
      LIMIT 1;

      -- Fallback: F&B charge total for that reservation × day (for amber/red bucket)
      SELECT COALESCE(SUM(amount), 0) INTO approx_total
      FROM public.mv_classified_transactions
      WHERE property_id = 260955
        AND reservation_id = res_id
        AND usali_dept = 'F&B'
        AND amount > 0
        AND transaction_date::date BETWEEN rec.d - INTERVAL '1 day' AND rec.d + INTERVAL '1 day';
    END IF;

    status_label := CASE
      WHEN match_kind IS NULL                                    THEN 'no_match'
      WHEN match_kind = 'room_type_ambiguous'                    THEN 'ambiguous_room'
      WHEN exact_match_amt IS NOT NULL                           THEN 'cloudbeds_match'
      WHEN approx_total IS NULL OR approx_total = 0              THEN 'no_cb_lines'
      WHEN approx_total >= rec.order_total * 0.95
       AND approx_total <= rec.order_total * 1.05                THEN 'amount_close'
      ELSE                                                            'amount_mismatch'
    END;

    UPDATE pos.poster_receipts
       SET reconciled       = (status_label = 'cloudbeds_match'),
           reconciled_with  = status_label,
           cb_reservation_id = res_id,
           cb_match_amount  = COALESCE(exact_match_amt, approx_total),
           cb_match_delta   = COALESCE(exact_match_amt, approx_total) - rec.order_total,
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

SELECT * FROM public.poster_reconcile_run();