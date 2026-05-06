-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504144338
-- Name:    commentary_drafts_anon_read
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Allow anon to read commentary drafts so /finance/pnl can render the LLM body
-- via the existing supabaseGl (anon) client. Insert/update remains authenticated/service-role only.
CREATE POLICY commentary_drafts_anon_read
  ON gl.commentary_drafts FOR SELECT
  TO anon
  USING (true);
