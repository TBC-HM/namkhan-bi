-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260502191021
-- Name:    gl_phase2_00_rename_legacy_accounts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Path B-Rename: free gl.accounts namespace for v2 USALI schema.
-- The legacy table (account_code PK) is referenced by FKs from
--   plan.account_map, plan.lines, gl.transactions, gl.pnl_snapshot.
-- Postgres tracks FKs by OID, so rename is safe — dependents stay green.
ALTER TABLE gl.accounts RENAME TO accounts_legacy;
COMMENT ON TABLE gl.accounts_legacy IS
  'Legacy CoA (account_code PK). Frozen 2026-05-02 to free gl.accounts namespace for v2 USALI schema. Still referenced by plan.account_map, plan.lines, gl.transactions, gl.pnl_snapshot.';
