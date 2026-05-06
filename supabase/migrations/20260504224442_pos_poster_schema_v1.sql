-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504224442
-- Name:    pos_poster_schema_v1
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- pos schema for PosterPOS imports.
-- Receipt-level table (not line-item — the export is one row per receipt).
-- Reconciliation against Cloudbeds folios runs from this table.

CREATE SCHEMA IF NOT EXISTS pos;

CREATE TABLE IF NOT EXISTS pos.poster_receipts (
  receipt_id        bigint PRIMARY KEY,
  application       integer,                       -- 0 = web/admin, other = mobile
  order_source      text,                          -- Dine-in / Front office / Groups / Room Service / Mini Bar / Pool Bar / Agents / I-Mekhong / Deliveries / internal
  table_label       text,
  floor_area        text,
  waiter            text,
  open_at           timestamptz,
  close_at          timestamptz,
  total_time_text   text,
  location          text,
  client            text,                          -- guest name when set (e.g. 'NK Invitation' for comps, real names for room-charges)
  customer_group    text,
  customers_count   integer,
  order_total       numeric(14,2),                 -- sum of line items
  paid              numeric(14,2),                 -- actually collected
  cash              numeric(14,2),
  card              numeric(14,2),
  service_charge    numeric(14,2),
  taxes             numeric(14,2),
  order_discount    numeric(14,2),
  order_promotions  numeric(14,2),
  status            text,                          -- Close / Open / Delete / Canceled
  payment_method    text,                          -- Card / Without payment / Charge Room / Internal / Cash / Bank Transfer / Payment through Office / House Account / Combined / Free Breakfast
  -- Reconciliation fields populated later by a join against mv_classified_transactions
  reconciled        boolean DEFAULT false,
  reconciled_with   text,                          -- 'cloudbeds_match' / 'no_match' / 'amount_mismatch' / 'manual_ok'
  cb_reservation_id text,                          -- Cloudbeds res_id when matched
  cb_match_amount   numeric(14,2),                 -- amount on Cloudbeds folio
  cb_match_delta    numeric(14,2),                 -- poster.order_total − cb_match_amount
  reconciled_at     timestamptz,
  loaded_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS poster_receipts_close_at_idx       ON pos.poster_receipts (close_at DESC);
CREATE INDEX IF NOT EXISTS poster_receipts_open_at_idx        ON pos.poster_receipts (open_at DESC);
CREATE INDEX IF NOT EXISTS poster_receipts_payment_method_idx ON pos.poster_receipts (payment_method);
CREATE INDEX IF NOT EXISTS poster_receipts_status_idx         ON pos.poster_receipts (status);
CREATE INDEX IF NOT EXISTS poster_receipts_client_idx         ON pos.poster_receipts (client);
CREATE INDEX IF NOT EXISTS poster_receipts_order_source_idx   ON pos.poster_receipts (order_source);
CREATE INDEX IF NOT EXISTS poster_receipts_reconciled_idx     ON pos.poster_receipts (reconciled);

-- Track every upload batch so we can roll back / dedupe.
CREATE TABLE IF NOT EXISTS pos.poster_uploads (
  upload_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file    text,
  uploaded_by    text,
  uploaded_at    timestamptz DEFAULT now(),
  rows_loaded    integer,
  notes          text
);

GRANT USAGE ON SCHEMA pos TO authenticated, service_role, anon;
GRANT SELECT ON ALL TABLES IN SCHEMA pos TO authenticated, anon;
GRANT ALL    ON ALL TABLES IN SCHEMA pos TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pos GRANT SELECT ON TABLES TO authenticated, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA pos GRANT ALL ON TABLES TO service_role;