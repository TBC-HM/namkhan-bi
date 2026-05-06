-- Migration 5/6 — sales-proposal-builder. APPLIED 2026-05-03.
-- CRITICAL per memory feedback_pgrst_db_schemas_merge.md: ALWAYS merge, NEVER overwrite.
-- Current value READ LIVE 2026-05-03 was:
--   'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc'
-- Target = current + ', sales'.
BEGIN;

ALTER ROLE authenticator SET pgrst.db_schemas TO
  'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc, sales';

GRANT USAGE ON SCHEMA sales TO authenticator, service_role, authenticated, anon;

GRANT SELECT ON sales.proposals, sales.proposal_blocks, sales.ics_files TO anon;
GRANT INSERT ON sales.proposal_view_events, sales.proposal_guest_edits, sales.proposal_sig_events TO anon;
GRANT UPDATE (qty, removable) ON sales.proposal_blocks TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA sales TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sales TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sales TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload config';
