-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505161853
-- Name:    phase_3_4_reindex_new_fks
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- =====================================================================
-- PHASE 3.4 — Re-run FK index DO block to cover new property_id FKs
-- added during Phase 3.3 mega-rollout. Idempotent.
-- =====================================================================

DO $$
DECLARE
  rec record;
  idx_name text;
  cmd text;
  total int := 0;
BEGIN
  FOR rec IN
    WITH fks AS (
      SELECT
        con.oid AS con_oid,
        con.conrelid,
        con.conkey::int[] AS conkey_int,
        n.nspname AS schema_name,
        c.relname AS table_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.contype = 'f'
        AND n.nspname NOT IN (
          'pg_catalog','information_schema','auth','storage','realtime',
          'vault','supabase_functions','net','graphql','graphql_public',
          'extensions','pgsodium','pgsodium_masks','supabase_migrations','cron'
        )
    ),
    fks_unindexed AS (
      SELECT f.*
      FROM fks f
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = f.conrelid
          AND (i.indkey::int2[])::int[] @> f.conkey_int
          AND (i.indkey::int2[])[0:array_length(f.conkey_int,1)-1]::int[] = f.conkey_int
      )
    )
    SELECT
      f.schema_name,
      f.table_name,
      string_agg(quote_ident(a.attname), ', ' ORDER BY array_position(f.conkey_int, a.attnum::int)) AS col_list,
      string_agg(a.attname, '_' ORDER BY array_position(f.conkey_int, a.attnum::int)) AS col_concat
    FROM fks_unindexed f
    JOIN pg_attribute a ON a.attrelid = f.conrelid AND a.attnum::int = ANY(f.conkey_int)
    GROUP BY f.con_oid, f.schema_name, f.table_name, f.conkey_int
  LOOP
    idx_name := left(rec.table_name || '_' || rec.col_concat || '_fk_idx', 63);
    cmd := format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s);',
                  idx_name, rec.schema_name, rec.table_name, rec.col_list);
    BEGIN
      EXECUTE cmd;
      total := total + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'SKIP % : %', idx_name, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Created % new indexes', total;
END $$;
