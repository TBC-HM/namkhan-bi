-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171742
-- Name:    b22_dedupe_rls_policies_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B22: Dedupe stacked RLS policies. Keep one canonical "allow_anon_read" SELECT policy per table.
-- Drop redundant duplicates. They all USING (true) so behavior is unchanged.
-- Property-scoped policies (anon_read_namkhan with USING property_id=260955) are kept ONLY where
-- they are not defeated by another USING(true) policy on the same table — but since we want behavior
-- preserved exactly, we drop the property-scoped ones too (they were already defeated and are noise).

DO $$
DECLARE
  r record;
BEGIN
  -- Drop duplicate "always true" SELECT policies, keeping only allow_anon_read
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polcmd = 'r'
      AND p.polpermissive = true
      AND p.polname IN ('public_read', 'anon_read', 'anon_read_namkhan')
      AND pg_get_expr(p.polqual, p.polrelid) IN ('true', '(property_id = 260955)')
      -- Only drop if there's another USING(true) policy that already grants read
      AND EXISTS (
        SELECT 1 FROM pg_policy p2 
        WHERE p2.polrelid = p.polrelid 
          AND p2.polcmd = 'r' 
          AND p2.polpermissive = true
          AND p2.polname = 'allow_anon_read'
          AND pg_get_expr(p2.polqual, p2.polrelid) = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.polname, r.sch, r.tbl);
    RAISE NOTICE 'Dropped %.%.%', r.sch, r.tbl, r.polname;
  END LOOP;

  -- Drop duplicate read_all_* policies that exist alongside allow_anon_read
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl, p.polname
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND p.polcmd = 'r'
      AND p.polpermissive = true
      AND p.polname LIKE 'read_all_%'
      AND pg_get_expr(p.polqual, p.polrelid) = 'true'
      AND EXISTS (
        SELECT 1 FROM pg_policy p2 
        WHERE p2.polrelid = p.polrelid 
          AND p2.polcmd = 'r' 
          AND p2.polpermissive = true
          AND p2.polname = 'allow_anon_read'
          AND pg_get_expr(p2.polqual, p2.polrelid) = 'true'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.polname, r.sch, r.tbl);
    RAISE NOTICE 'Dropped %.%.%', r.sch, r.tbl, r.polname;
  END LOOP;
END$$;