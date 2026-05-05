-- ROLLBACK — sales-proposal-builder
-- DESTRUCTIVE. Only run if no real proposals have been signed.
-- For soft disable: set FEATURE_PROPOSAL_BUILDER_ENABLED=false in Vercel.
BEGIN;
DROP FUNCTION IF EXISTS public.proposal_available_rooms(DATE, DATE, BIGINT);
DROP FUNCTION IF EXISTS public.proposal_inventory_freshness(BIGINT);
DROP SCHEMA IF EXISTS sales CASCADE;
ALTER ROLE authenticator SET pgrst.db_schemas TO
  'public, graphql_public, marketing, governance, guest, gl, suppliers, fa, inv, proc';
COMMIT;
NOTIFY pgrst, 'reload config';
