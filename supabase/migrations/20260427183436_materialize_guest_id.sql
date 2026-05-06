-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260427183436
-- Name:    materialize_guest_id
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cb_guest_id text;
UPDATE reservations 
SET cb_guest_id = NULLIF(raw->>'guestID', '') 
WHERE cb_guest_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_res_cb_guest_id ON reservations(cb_guest_id);
CREATE INDEX IF NOT EXISTS idx_res_guest_check_in ON reservations(cb_guest_id, check_in_date) WHERE NOT is_cancelled;
