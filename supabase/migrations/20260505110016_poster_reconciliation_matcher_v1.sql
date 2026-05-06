-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505110016
-- Name:    poster_reconciliation_matcher_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Charge-to-room reconciliation matcher.
-- For each Poster receipt with payment_method = 'Charge Room / to Folio' and
-- status = 'Close', try to find a Cloudbeds folio match using a tiered strategy:
--
--   Tier 1 — exact guest-name match (lower+trim) on a reservation overlapping close_at
--   Tier 2 — room-type-name match where ONE reservation occupies that room on close_at
--   Tier 3 — room-type-name match where MULTIPLE reservations occupy → ambiguous
--   Tier 4 — nothing → no_match
--
-- Sums CB POS lines (mv_classified_transactions) for the matched reservation × close_at::date ±1d.
-- Compares against receipt order_total → tolerance:
--   ≤ $0.50  → 'cloudbeds_match'  (green ✓)
--   ≤ 5%     → 'amount_close'     (amber ⚠)
--   otherwise → 'amount_mismatch' (red ✗)
--   no CB lines for matched reservation → 'no_cb_lines' (red ✗)

CREATE OR REPLACE FUNCTION public.poster_reconcile_run()
RETURNS TABLE (
  total_processed integer,
  matched_green integer,
  matched_amber integer,
  matched_red integer,
  ambiguous_room integer,
  no_match integer
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
  cnt_total integer := 0;
  cnt_green integer := 0;
  cnt_amber integer := 0;
  cnt_red integer := 0;
  cnt_amb integer := 0;
  cnt_no integer := 0;
BEGIN
  -- Reset all charge-to-room rows so we can re-run.
  UPDATE pos.poster_receipts
     SET reconciled = false,
         reconciled_with = NULL,
         cb_reservation_id = NULL,
         cb_match_amount = NULL,
         cb_match_delta = NULL,
         reconciled_at = NULL
   WHERE payment_method = 'Charge Room / to Folio';

  FOR rec IN
    SELECT receipt_id, client, order_total, close_at::date AS d
    FROM pos.poster_receipts
    WHERE payment_method = 'Charge Room / to Folio'
      AND status = 'Close'
      AND close_at IS NOT NULL
  LOOP
    cnt_total := cnt_total + 1;
    res_id := NULL; match_kind := NULL;

    -- Tier 1: exact guest_name match (only for non-empty, non-room-type clients)
    IF rec.client IS NOT NULL AND length(trim(rec.client)) > 0 THEN
      SELECT r.reservation_id INTO res_id
      FROM public.reservations r
      WHERE r.property_id = 260955
        AND lower(trim(r.guest_name)) = lower(trim(rec.client))
        AND rec.d BETWEEN r.check_in_date AND r.check_out_date
      ORDER BY r.check_in_date DESC
      LIMIT 1;
      IF res_id IS NOT NULL THEN match_kind := 'guest_name'; END IF;
    END IF;

    -- Tier 2/3: room-type match (single vs multiple occupants on that date)
    IF res_id IS NULL AND rec.client IS NOT NULL THEN
      SELECT COUNT(*), MAX(r.reservation_id)
        INTO occupants, res_id
      FROM public.reservations r
      WHERE r.property_id = 260955
        AND lower(trim(r.room_type_name)) = lower(trim(rec.client))
        AND rec.d BETWEEN r.check_in_date AND r.check_out_date - INTERVAL '1 day'
        AND r.is_cancelled IS NOT TRUE;
      IF occupants = 1 THEN
        match_kind := 'room_type_unique';
      ELSIF occupants > 1 THEN
        match_kind := 'room_type_ambiguous';
        res_id := NULL;
      END IF;
    END IF;

    -- Compute Cloudbeds folio total for the matched reservation × close_at ±1 day.
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
                     THEN abs(cb_delta) / rec.order_total * 100
                     ELSE NULL END;
    END IF;

    -- Decide final status_label
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

    -- Bump counters
    IF status_label = 'cloudbeds_match'    THEN cnt_green := cnt_green + 1;
    ELSIF status_label = 'amount_close'    THEN cnt_amber := cnt_amber + 1;
    ELSIF status_label = 'ambiguous_room'  THEN cnt_amb := cnt_amb + 1;
    ELSIF status_label = 'no_match'        THEN cnt_no := cnt_no + 1;
    ELSE                                        cnt_red := cnt_red + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT cnt_total, cnt_green, cnt_amber, cnt_red, cnt_amb, cnt_no;
END;
$$;

GRANT EXECUTE ON FUNCTION public.poster_reconcile_run() TO service_role;

-- Period summary helper (read-only, fast — for the Charge-to-room card).
CREATE OR REPLACE FUNCTION public.poster_reconcile_summary(p_from date, p_to date)
RETURNS TABLE (
  charge_room_n integer,
  matched_green_n integer,
  matched_amber_n integer,
  amount_mismatch_n integer,
  no_cb_lines_n integer,
  ambiguous_room_n integer,
  no_match_n integer,
  charge_room_order_usd numeric,
  matched_green_order_usd numeric,
  cb_total_matched_usd numeric,
  reconciled_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pos, public
AS $$
  SELECT
    COUNT(*)::int                                                                                  AS charge_room_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'cloudbeds_match')::int                                AS matched_green_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'amount_close')::int                                   AS matched_amber_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'amount_mismatch')::int                                AS amount_mismatch_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'no_cb_lines')::int                                    AS no_cb_lines_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'ambiguous_room')::int                                 AS ambiguous_room_n,
    COUNT(*) FILTER (WHERE reconciled_with = 'no_match' OR reconciled_with IS NULL)::int            AS no_match_n,
    COALESCE(SUM(order_total), 0)                                                                   AS charge_room_order_usd,
    COALESCE(SUM(order_total) FILTER (WHERE reconciled_with = 'cloudbeds_match'), 0)                AS matched_green_order_usd,
    COALESCE(SUM(cb_match_amount) FILTER (WHERE reconciled_with IN ('cloudbeds_match', 'amount_close')), 0) AS cb_total_matched_usd,
    MAX(reconciled_at)                                                                              AS reconciled_at
  FROM pos.poster_receipts
  WHERE payment_method = 'Charge Room / to Folio'
    AND status = 'Close'
    AND open_at >= p_from::timestamptz
    AND open_at <  (p_to::timestamptz + interval '1 day');
$$;

GRANT EXECUTE ON FUNCTION public.poster_reconcile_summary(date, date) TO anon, authenticated, service_role;