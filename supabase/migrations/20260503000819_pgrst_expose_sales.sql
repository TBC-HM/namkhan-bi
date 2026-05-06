-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503000819
-- Name:    pgrst_expose_sales
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc, sales';

GRANT USAGE ON SCHEMA sales TO authenticator, service_role, authenticated, anon;

GRANT SELECT ON sales.proposals, sales.proposal_blocks, sales.ics_files TO anon;
GRANT INSERT ON sales.proposal_view_events, sales.proposal_guest_edits, sales.proposal_sig_events TO anon;
GRANT UPDATE (qty, removable) ON sales.proposal_blocks TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA sales TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sales TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sales TO authenticated;