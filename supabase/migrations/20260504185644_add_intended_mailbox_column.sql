-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504185644
-- Name:    add_intended_mailbox_column
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- intended_mailbox = the original recipient at @thenamkhan.com BEFORE forwarding to pb@
-- Values: 'book@thenamkhan.com', 'wm@thenamkhan.com', 'reservations@thenamkhan.com',
--         'pb@thenamkhan.com', 'other', or null until ingest writes it.
ALTER TABLE sales.email_messages
  ADD COLUMN IF NOT EXISTS intended_mailbox text;

CREATE INDEX IF NOT EXISTS email_messages_intended_idx
  ON sales.email_messages (property_id, intended_mailbox, received_at DESC);

-- Backfill the one existing row (smoke test) to keep the col non-null going forward
UPDATE sales.email_messages
SET intended_mailbox = mailbox
WHERE intended_mailbox IS NULL;
