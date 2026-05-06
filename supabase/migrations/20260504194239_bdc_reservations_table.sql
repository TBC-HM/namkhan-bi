-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504194239
-- Name:    bdc_reservations_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS revenue.bdc_reservations (
  upload_id          uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date      date NOT NULL,
  book_number        bigint NOT NULL,
  booked_at          timestamptz,
  check_in           date,
  check_out          date,
  duration_nights    integer,
  status             text NOT NULL CHECK (status IN ('ok','cancelled_by_guest','cancelled_by_hotel','no_show','unknown')),
  cancellation_date  date,
  rooms              integer,
  adults             integer,
  children           integer,
  price_usd          numeric(12,2),
  commission_pct     numeric(5,2),
  commission_usd     numeric(12,2),
  net_revenue_usd    numeric(12,2) GENERATED ALWAYS AS (COALESCE(price_usd, 0) - COALESCE(commission_usd, 0)) STORED,
  adr_usd            numeric(10,2),
  lead_days          integer,
  booker_country     text,
  travel_purpose     text,
  device             text,
  unit_type          text,
  payment_status     text,
  payment_method     text,
  guest_name         text,
  loaded_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, book_number)
);
CREATE INDEX IF NOT EXISTS ix_bdc_res_checkin ON revenue.bdc_reservations (check_in);
CREATE INDEX IF NOT EXISTS ix_bdc_res_country ON revenue.bdc_reservations (booker_country, status);
CREATE INDEX IF NOT EXISTS ix_bdc_res_status ON revenue.bdc_reservations (status, check_in);
GRANT SELECT ON revenue.bdc_reservations TO service_role;