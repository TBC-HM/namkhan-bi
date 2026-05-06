-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504194554
-- Name:    add_reservations_export_to_ota_uploads_check
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER TABLE revenue.ota_uploads DROP CONSTRAINT IF EXISTS ota_uploads_file_kind_check;
ALTER TABLE revenue.ota_uploads ADD CONSTRAINT ota_uploads_file_kind_check
  CHECK (file_kind IN ('booker_insights','book_window','demand','pace_monthly','pace_room_rate','genius_timeline','ranking','rates','reviews','promo','search_visibility','reservations_export','other'));

INSERT INTO revenue.ota_uploads (id, ota_source, file_kind, file_name, snapshot_date, parser_version, status, period_from, period_to, notes)
VALUES ('11111111-2222-3333-4444-555555555555'::uuid, 'Booking.com', 'reservations_export', 'Check-in_2025-05-04_to_2026-05-05.xls', '2026-05-04', 'bdc-v1', 'parsed', '2025-05-04', '2026-05-05', '12 months reservation-level data')
ON CONFLICT (id) DO NOTHING;