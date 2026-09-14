# 002_discharge_mode_bridges — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
migration name `standards_discharge_mode_bridges`, on 2026-09-14. Audit copy only —
`supabase/migrations/` is dead, nothing here ever runs.

Two SECURITY DEFINER bridges (invariant 3 recipe) for
`scripts/seed-discharge-modes.mjs`: one reads every atom plus its authority/source
title for classification, one writes the classifier's verdict back — but only onto
rows the seeder still owns. `fn_standards_set_discharge_modes` sets `mode_source =
'seeded'` and filters `COALESCE(a.mode_source, 'seeded') <> 'edited'`, so a row a HoD
has corrected (`mode_source = 'edited'`) is never touched by a re-run of the seeder.
Both bridges are SECURITY DEFINER and therefore bypass RLS by design — neither needs
to filter `property_id` because `standards.atoms` is not tenant-scoped data (it is the
shared compliance corpus, not per-property).

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_atoms_for_classification()
RETURNS TABLE (atom_id uuid, authority text, source_title text, category text,
               requirement_text text, mode_source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
  SELECT a.atom_id,
         (SELECT min(s.authority) FROM standards.atom_sources x
            JOIN standards.requirements r ON r.requirement_id = x.requirement_id
            JOIN standards.sources s ON s.source_id = r.source_id
           WHERE x.atom_id = a.atom_id),
         (SELECT min(s.title) FROM standards.atom_sources x
            JOIN standards.requirements r ON r.requirement_id = x.requirement_id
            JOIN standards.sources s ON s.source_id = r.source_id
           WHERE x.atom_id = a.atom_id),
         a.category, a.requirement_text, a.mode_source
    FROM standards.atoms a;
$$;

CREATE OR REPLACE FUNCTION public.fn_standards_set_discharge_modes(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','standards','pg_temp'
AS $$
DECLARE v int;
BEGIN
  UPDATE standards.atoms a
     SET discharge_mode = e->>'discharge_mode', mode_source = 'seeded'
    FROM jsonb_array_elements(p_rows) e
   WHERE a.atom_id = (e->>'atom_id')::uuid
     AND COALESCE(a.mode_source, 'seeded') <> 'edited';   -- never clobber a HoD fix
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'updated', v);
END $$;

REVOKE ALL ON FUNCTION public.fn_standards_atoms_for_classification() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.fn_standards_set_discharge_modes(jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_atoms_for_classification() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_standards_set_discharge_modes(jsonb) TO authenticated, service_role;
```

Verified post-apply: `anon` has no EXECUTE on either function; `authenticated` and
`service_role` do (checked via `has_function_privilege`).
