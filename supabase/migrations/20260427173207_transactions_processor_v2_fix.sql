-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173207
-- Name:    transactions_processor_v2_fix
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


CREATE OR REPLACE FUNCTION cb_process_transactions()
RETURNS TABLE(transactions_upserted int, pages_processed int) AS $$
DECLARE
  rec record;
  resp jsonb;
  tx jsonb;
  tx_count int := 0;
  p_count int := 0;
BEGIN
  FOR rec IN
    SELECT q.id, q.request_id 
    FROM sync_request_queue q 
    WHERE q.entity = 'transactions_2025' AND q.status = 'received'
    ORDER BY q.page_number
  LOOP
    SELECT r.content::jsonb INTO resp FROM net._http_response r WHERE r.id = rec.request_id;
    FOR tx IN SELECT jsonb_array_elements(resp->'data') LOOP
      INSERT INTO transactions(
        transaction_id, property_id, reservation_id, sub_reservation_id, guest_id,
        transaction_date, transaction_type, category, item_category_name,
        description, amount, quantity, currency, method,
        service_date, room_type_name, user_name, notes, raw, synced_at
      ) VALUES (
        tx->>'transactionID',
        (tx->>'propertyID')::bigint,
        NULLIF(tx->>'reservationID',''),
        NULLIF(tx->>'subReservationID',''),
        NULLIF(tx->>'guestID',''),
        NULLIF(tx->>'transactionDateTimeUTC','')::timestamptz,
        tx->>'transactionType',
        tx->>'transactionCategory',
        tx->>'itemCategoryName',
        tx->>'description',
        NULLIF(tx->>'amount','')::numeric,
        NULLIF(tx->>'quantity','')::numeric,
        tx->>'currency',
        tx->>'cardType',
        NULLIF(tx->>'serviceDate','')::date,
        tx->>'roomTypeName',
        tx->>'userName',
        tx->>'notes',
        tx,
        now()
      )
      ON CONFLICT (transaction_id) DO UPDATE SET
        amount = EXCLUDED.amount,
        category = EXCLUDED.category,
        item_category_name = EXCLUDED.item_category_name,
        description = EXCLUDED.description,
        raw = EXCLUDED.raw,
        synced_at = now();
      tx_count := tx_count + 1;
    END LOOP;
    UPDATE sync_request_queue SET status = 'processed' WHERE id = rec.id;
    p_count := p_count + 1;
  END LOOP;
  RETURN QUERY SELECT tx_count, p_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'process-transactions',
  '45 seconds',
  $$ SELECT cb_process_transactions(); $$
);
