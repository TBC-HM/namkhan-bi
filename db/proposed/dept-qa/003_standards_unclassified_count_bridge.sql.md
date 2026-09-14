# 003_standards_unclassified_count_bridge — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
migration name `standards_unclassified_count_bridge`, on 2026-09-14. Audit copy only —
`supabase/migrations/` is dead, nothing here ever runs.

## Why this exists

Post-review finding on Task 2: `sb.rpc('fn_standards_atoms_for_classification')` in
`scripts/seed-discharge-modes.mjs` goes through PostgREST, which applies a project-wide
`db-max-rows` cap. A short read (fewer rows than the true atom count) completes
silently — the script would print a cheerful count and exit 0 having classified only
part of `standards.atoms`. This repo has been bitten by exactly this before (commit
`a5a62df8`: a merge route read 1,000 of 1,880 requirements and said nothing).

`fn_standards_unclassified_count()` returns a scalar `integer`, not a row set, so it is
**not** subject to the same row-capping. The seed script now calls it after the write
and fails loudly (`process.exit(1)`) if the count is above zero, instead of silently
succeeding on a truncated run.

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_unclassified_count()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
  SELECT count(*)::integer FROM standards.atoms WHERE discharge_mode IS NULL;
$$;

REVOKE ALL ON FUNCTION public.fn_standards_unclassified_count() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_unclassified_count() TO authenticated, service_role;
```

Verified post-apply: `SELECT public.fn_standards_unclassified_count();` returns `0`
(all 2,164 atoms are classified as of this migration). Grants confirmed via
`has_function_privilege`: anon EXECUTE = false, authenticated = true, service_role = true.
