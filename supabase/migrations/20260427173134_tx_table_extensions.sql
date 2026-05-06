-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427173134
-- Name:    tx_table_extensions
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sub_reservation_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS guest_id text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS room_type_name text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_category_name text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS quantity numeric;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS service_date date;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_name text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_tx_service_date ON transactions(service_date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_tx_item_category ON transactions(item_category_name);
CREATE INDEX IF NOT EXISTS idx_tx_reservation ON transactions(reservation_id);
