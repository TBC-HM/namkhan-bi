-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504192610
-- Name:    bdc_layer1_uploads_table
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Layer 1 — generic OTA uploads registry. Same row owns all facts produced
-- by parsing the file. Re-parsing same blob with a new parser_version
-- writes new fact rows tied to the same upload_id (audit trail preserved).

CREATE TABLE IF NOT EXISTS revenue.ota_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ota_source      text NOT NULL CHECK (ota_source IN ('Booking.com','Expedia','Agoda','Airbnb','Ctrip','Trip.com','Hotels.com','Traveloka','Other')),
  file_kind       text NOT NULL CHECK (file_kind IN (
                    'booker_insights','book_window','demand','pace_monthly','pace_room_rate',
                    'genius_timeline','ranking','rates','reviews','promo','search_visibility','other')),
  file_name       text,
  storage_path    text,                              -- ota-raw/<source>/<date>/<kind>.<ext>
  snapshot_date   date NOT NULL,
  period_from     date,
  period_to       date,
  uploaded_by     text DEFAULT 'PBS',
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  parser_version  text NOT NULL DEFAULT 'bdc-v1',
  status          text NOT NULL DEFAULT 'parsed' CHECK (status IN ('pending','parsed','failed','superseded')),
  parse_error     text,
  row_counts      jsonb,
  notes           text
);

CREATE INDEX IF NOT EXISTS ix_ota_uploads_source_kind_date
  ON revenue.ota_uploads (ota_source, file_kind, snapshot_date DESC);

GRANT SELECT ON revenue.ota_uploads TO service_role;