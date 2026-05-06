-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504194225
-- Name:    bdc_promotions_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE TABLE IF NOT EXISTS revenue.bdc_promotions (
  upload_id      uuid NOT NULL REFERENCES revenue.ota_uploads(id) ON DELETE CASCADE,
  snapshot_date  date NOT NULL,
  name           text NOT NULL,
  discount_pct   numeric(5,2),
  bookable_from  date,
  bookable_to    date,
  stay_dates_raw text,
  bookings       integer,
  room_nights    integer,
  adr_usd        numeric(10,2),
  revenue_usd    numeric(12,2),
  canceled_room_nights integer,
  status         text NOT NULL CHECK (status IN ('active','inactive')),
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  promo_seq      integer NOT NULL,
  PRIMARY KEY (upload_id, promo_seq)
);
CREATE INDEX IF NOT EXISTS ix_bdc_promo_status ON revenue.bdc_promotions (status, snapshot_date DESC);
GRANT SELECT ON revenue.bdc_promotions TO service_role;