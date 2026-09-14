# 008_coverable_procedure_only — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
two migrations, both on 2026-09-15: `fn_standards_payload_coverable_procedure_only`
and `fn_dept_qa_payload_coverable_procedure_only`. Audit copy only —
`supabase/migrations/` is dead, nothing here ever runs.

## Why this exists — CRITICAL 2, final whole-branch review

Both `fn_standards_payload` and `fn_dept_qa_payload` derived `covered` from
`standards.sop_coverage` for EVERY discharge mode, then set
`coverable = discharge_mode IN ('procedure','evidence')`. `ops.sustainability_evidence`
— the store the spec names for the evidence mode — is read nowhere in either
function. Result: the Standard page printed "evidence 1,202 · 215 covered · 17.9%"
and the department page painted 1,202 obligations (55% of the corpus) green "Held"
or red "Missing" purely on whether an SOP happens to mention it — a more confident
wrong number than the 12% category error this whole project exists to replace.

Per the review brief: do NOT wire `ops.sustainability_evidence` (a separate brief).
Fix by refusing to claim: `coverable` is now `(discharge_mode = 'procedure')` only,
in both functions. `ops.sustainability_evidence` is still read nowhere — the schema
change to actually source evidence coverage is out of scope here.

Both functions were re-emitted from their LIVE `pg_get_functiondef` (fetched
immediately before each migration, 2026-09-15) — not from memory or from the task
brief's prose — because each had already been modified several times since this
project started. Only the `by_mode.coverable` predicate changed in each; every other
line is the live definition verbatim.

## Verification (live, 2026-09-15)

```sql
SELECT jsonb_object_keys(public.fn_standards_payload(260955,NULL)->'totals');
```
Returns exactly: `atoms, covered, exact, declared, suggested, multi_source, shared,
requirements, sources, authorities, sops, sop_docs, sop_unwritten, by_mode` — all 14
keys present, unchanged shape.

```sql
SELECT public.fn_standards_payload(260955,NULL)->'totals'->'by_mode';
```
```json
[
  {"mode":"evidence",    "atoms":1202, "covered":215, "coverable":false},
  {"mode":"procedure",   "atoms":584,  "covered":32,  "coverable":true},
  {"mode":"observation", "atoms":289,  "covered":0,   "coverable":false},
  {"mode":"rule",        "atoms":89,   "covered":16,  "coverable":false}
]
```
`evidence.coverable` is now `false` (was `true`) — the page can no longer print a
percentage for it. `procedure` is the only `coverable: true` mode.

```sql
SELECT public.fn_dept_qa_payload(260955,'boat')->'by_mode';
```
```json
[{"mode":"procedure","atoms":4,"covered":0,"coverable":true}]
```
Boat has one mode group (all 4 obligations classified 'procedure' as of this
verification) — see 009-adjacent code fix in `DepartmentQa.tsx` (IMPORTANT 1) for
what happens when a HoD reclassifies one of them to a mode this payload has no row
for.

Grants unchanged: `anon` EXECUTE = false on both functions; `authenticated` and
`service_role` = true (re-applied by each migration's REVOKE/GRANT pair, confirmed
via `has_function_privilege`).

## SQL

Both migrations re-emit the full live function body with only the `coverable`
predicate changed:

```sql
-- fn_standards_payload: inside 'totals' -> 'by_mode'
'by_mode', (
  SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
    SELECT COALESCE(a.discharge_mode,'procedure') AS mode,
           count(*) AS atoms,
           count(*) FILTER (WHERE a.covered) AS covered,
           (COALESCE(a.discharge_mode,'procedure') = 'procedure') AS coverable   -- was: IN ('procedure','evidence')
      FROM a GROUP BY 1) x
)

-- fn_dept_qa_payload: top-level 'by_mode'
'by_mode', (
  SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
    SELECT discharge_mode AS mode, count(*) AS atoms,
           count(*) FILTER (WHERE covered) AS covered,
           (discharge_mode = 'procedure') AS coverable   -- was: IN ('procedure','evidence')
      FROM a GROUP BY 1) x
)
```

Full function bodies (as applied) are in the migration history
(`fn_standards_payload_coverable_procedure_only`,
`fn_dept_qa_payload_coverable_procedure_only`) — omitted here in full to avoid a
second copy silently drifting from the live definition; the diff above is the
entirety of the behavior change.

```sql
REVOKE ALL ON FUNCTION public.fn_standards_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_payload(bigint, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_dept_qa_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_dept_qa_payload(bigint, text) TO authenticated, service_role;
```
