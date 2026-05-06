-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260501202504
-- Name:    phase2_00b_dmc_contracts_public_view
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Expose DMC contracts via public schema so REST API picks it up without
-- needing to add 'governance' to API-exposed schemas.

CREATE OR REPLACE VIEW public.v_dmc_contracts AS
SELECT * FROM governance.v_dmc_contracts_listing;

GRANT SELECT ON public.v_dmc_contracts TO anon, authenticated;
GRANT SELECT ON governance.dmc_contracts TO anon, authenticated;
GRANT SELECT ON governance.v_dmc_contracts_listing TO anon, authenticated;