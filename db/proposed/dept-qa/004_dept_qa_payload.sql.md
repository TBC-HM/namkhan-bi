# 004_dept_qa_payload — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
migration name `fn_dept_qa_payload`, on 2026-09-14. Audit copy only —
`supabase/migrations/` is dead (stale since 2026-05) and nothing here ever runs; the
live database is the source of truth (CLAUDE.md invariant 1).

## Why this exists

Task 4 of the Department QA / discharge-modes project: one RPC behind each
department's QA page, same contract as the sibling dashboards (`fn_qa_dash_payload`,
`fn_standards_payload`) — the page computes nothing and formats only. It joins:

- `public.v_standards_atoms` (Task 2) for `discharge_mode`, `mode_source`,
  `staff_wording`, `dept_code`, `dept_code_2`, `authorities`.
- `standards.sop_coverage` for whether each atom is discharged by a covering SOP.
- `ops.v_staff_register` for the department's active roster.
- `knowledge.qa_audits` for the SLH mystery-inspection scores.
- `knowledge.qa_findings` for open QA findings, joined through `audit_id` to
  `knowledge.qa_audits.dept_code` — **`qa_findings` itself has neither `status` nor
  `dept_code`**; it carries `remediation_status` and only `audit_id` + `property_id`.
  Correcting this before writing anything was the point of Task 4's dispatch brief
  correction — the original brief draft invented both columns and would have failed
  at runtime with a column-does-not-exist error, a class of bug the typechecker
  cannot catch because it lives inside a SQL string.

## Departments with obligations and no staff are normal, not an error

General Management (456 obligations), HR (235) and Purchasing (126) have zero rows
in `ops.v_staff_register`. Those are PBS's and management's own obligations — the
`people` block returns `{"active": 0, "rows": []}` for them (via `COALESCE(...,
'[]'::jsonb)` and `count(*) FILTER`, both of which degrade to zero/empty rather than
NULL on no matching rows), so the page can render that as a fact, not a failure.
Verified live for `gm`: `{"active": 0, "rows": []}`.

## Verification (live, 2026-09-14)

```sql
SELECT public.fn_dept_qa_payload(260955,'housekeeping')->'by_mode',
       public.fn_dept_qa_payload(260955,'housekeeping')->'scores',
       jsonb_array_length(public.fn_dept_qa_payload(260955,'housekeeping')->'obligations');
```

- `obligations` count: **355** (matches expected — housekeeping's primary + shared).
- `scores.slh_worst_pct` = **79.3** (matches expected — the pool deck, the only
  section below the SLH 80% fail line).
- `scores.slh_pct` = **92.6**, computed as
  `round(100 * sum(total_score) / sum(max_score), 1)` across housekeeping's two
  `slh_mystery_inspection` audit rows (23.0/29.0 pool deck + 275.5/293.5 main
  section = 298.5/322.5 = 92.56...). The dispatch brief's stated expectation was
  93.9, which is the `pct_score` of the 293.5-max-score row alone (the section that
  is *not* below mandate) — i.e. a different aggregation (exclude the failing
  section from the numerator/denominator, or just take the passing section's own
  score) than the sum-weighted formula the brief's own SQL specifies. Per the task
  instructions ("report the ACTUAL numbers ... do not adjust anything to match an
  expectation"), the formula was left exactly as specified in the brief and the
  actual computed number (92.6) is reported here as a discrepancy for review, not
  silently reconciled.
- Zero-staff department: `SELECT public.fn_dept_qa_payload(260955,'gm')->'people'`
  → `{"active": 0, "rows": []}` — not null. Confirmed.
- `open` block cross-checked against a direct join of `qa_findings` to `qa_audits`
  grouped by `dept_code`: housekeeping 12, roots_service 11, gm 3, front_office 2,
  kitchen 1, spa 1 — 30 total, all `findings_open = findings_total` (every finding
  in the live data is currently open). All match exactly.
- `boat` (small department): 2 active staff (Boat Manager, Boat Captain), 4
  obligations, `open` = `{"findings_open": 0, "findings_total": 0}` (not null, no
  qa_findings rows for boat), `scores` = all null (no `slh_mystery_inspection` audit
  rows exist for boat — there is nothing to divide, so every field in `scores` is
  null rather than a divide-by-zero or a fabricated number).

## Grants

```sql
REVOKE ALL ON FUNCTION public.fn_dept_qa_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_dept_qa_payload(bigint, text) TO authenticated, service_role;
```

Confirmed live via `pg_proc.proacl`: `postgres=X/postgres, authenticated=X/postgres,
service_role=X/postgres` — no `anon` grant (ADR-277).

```sql
CREATE OR REPLACE FUNCTION public.fn_dept_qa_payload(p_property_id bigint, p_dept text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','standards','ops','knowledge','pg_temp'
AS $$
WITH cov AS (
  SELECT atom_id, bool_or(covered) AS covered, min(sop_code) FILTER (WHERE covered) AS sop_code
    FROM standards.sop_coverage WHERE property_id = p_property_id GROUP BY atom_id
),
a AS (
  SELECT v.atom_id, v.title, v.requirement_text, v.authorities, v.category,
         COALESCE(v.discharge_mode,'procedure') AS discharge_mode,
         v.mode_source, v.staff_wording,
         (v.dept_code IS DISTINCT FROM p_dept) AS is_shared,
         COALESCE(c.covered,false) AS covered, c.sop_code
    FROM public.v_standards_atoms v LEFT JOIN cov c ON c.atom_id = v.atom_id
   WHERE p_dept IN (v.dept_code, v.dept_code_2)
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'property_id', p_property_id,
  'dept_code', p_dept,
  'dept_name', (SELECT max(name) FROM ops.departments
                 WHERE property_id = p_property_id AND code = p_dept),
  'people', (
    SELECT jsonb_build_object(
      'active', count(*) FILTER (WHERE s.is_active),
      'rows', COALESCE(jsonb_agg(jsonb_build_object(
        'staff_id', s.staff_id, 'name', s.full_name, 'position', s.position_title
      ) ORDER BY s.full_name) FILTER (WHERE s.is_active), '[]'::jsonb))
      FROM ops.v_staff_register s
     WHERE s.property_id = p_property_id AND s.dept_code = p_dept
  ),
  'obligations', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'atom_id', a.atom_id, 'title', a.title, 'text', a.requirement_text,
      'staff_wording', a.staff_wording,
      'authorities', a.authorities, 'category', a.category,
      'mode', a.discharge_mode, 'mode_source', a.mode_source,
      'covered', a.covered, 'sop_code', a.sop_code, 'is_shared', a.is_shared
    ) ORDER BY a.discharge_mode, a.covered, a.title), '[]'::jsonb) FROM a
  ),
  'by_mode', (
    SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
      SELECT discharge_mode AS mode, count(*) AS atoms,
             count(*) FILTER (WHERE covered) AS covered,
             (discharge_mode IN ('procedure','evidence')) AS coverable
        FROM a GROUP BY 1) x
  ),
  'scores', (
    SELECT jsonb_build_object(
      'slh_pct', round(100.0*sum(total_score)/NULLIF(sum(max_score),0), 1),
      'slh_worst_pct', round(min(pct_score), 1),
      'slh_sections', count(*),
      'slh_audited_at', max(audited_at)::date,
      'slh_top_miss', (array_agg(top_miss ORDER BY pct_score ASC))[1])
      FROM knowledge.qa_audits
     WHERE property_id = p_property_id AND dept_code = p_dept
       AND audit_type = 'slh_mystery_inspection'
  ),
  'open', (
    SELECT jsonb_build_object(
      'findings_open',  count(*) FILTER (WHERE COALESCE(f.remediation_status,'open') <> 'closed'),
      'findings_total', count(*))
      FROM knowledge.qa_findings f
      JOIN knowledge.qa_audits a2 ON a2.audit_id = f.audit_id
     WHERE f.property_id = p_property_id AND a2.dept_code = p_dept
  )
);
$$;

REVOKE ALL ON FUNCTION public.fn_dept_qa_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_dept_qa_payload(bigint, text) TO authenticated, service_role;
```
