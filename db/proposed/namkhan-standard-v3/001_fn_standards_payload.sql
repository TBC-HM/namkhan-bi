-- AUDIT COPY of the migration applied via Supabase MCP on 2026-09-10.
-- Applied as: standards_payload_bridge, then standards_payload_bridge_dept_names.
-- supabase/migrations/ is DEAD in this repo; this directory is the audit trail.
--
-- The Standard tab's only read. `standards` is deliberately absent from
-- pgrst.db_schemas, so nothing can reach standards.atoms directly — every read
-- goes through this SECURITY DEFINER bridge, granted to authenticated +
-- service_role and never to anon (invariant 3 / ADR-277).
--
-- Two shapes in one function on purpose. p_dept NULL returns the summary the
-- landing view needs and NO atom rows; p_dept set adds that department's atoms.
-- 1,777 atoms is ~500KB of prose; the largest single department (gm, 397) is
-- 220KB. Shipping the whole corpus on every load to render a 13-row table is the
-- mkt_dash mistake — see memory mkt-dash-payload-recompute-times-out.
--
-- Tenancy: the atom corpus is tenant-neutral by design (spec §3) — every property
-- is measured against the same standard. Only standards.sop_coverage and the
-- department LABELS are per-property, and both are filtered on p_property_id here.
-- A payload that silently reported another tenant's coverage is exactly the leak
-- v_qa_dash_sop had (589 shown, 465 real).
CREATE OR REPLACE FUNCTION public.fn_standards_payload(
  p_property_id bigint,
  p_dept        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, standards, pg_temp
AS $$
WITH cov AS (
  SELECT atom_id, bool_or(covered) AS covered,
         min(sop_code) FILTER (WHERE covered) AS sop_code
    FROM standards.sop_coverage
   WHERE property_id = p_property_id
   GROUP BY atom_id
),
dn AS (
  SELECT code, max(name) AS name FROM ops.departments
   WHERE property_id = p_property_id AND code IS NOT NULL
   GROUP BY code
),
a AS (
  SELECT v.*, COALESCE(c.covered, false) AS covered, c.sop_code
    FROM public.v_standards_atoms v
    LEFT JOIN cov c ON c.atom_id = v.atom_id
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'property_id',  p_property_id,
  'dept',         p_dept,
  'dept_name',    (SELECT COALESCE(name, p_dept) FROM dn WHERE code = p_dept),
  'totals', (
    SELECT jsonb_build_object(
      'atoms',        count(*),
      'covered',      count(*) FILTER (WHERE covered),
      'multi_source', count(*) FILTER (WHERE source_count > 1),
      'requirements', (SELECT count(*) FROM standards.requirements),
      'sources',      (SELECT count(*) FROM standards.sources WHERE source_id IN
                        (SELECT source_id FROM standards.requirements)),
      'authorities',  (SELECT count(DISTINCT authority) FROM standards.sources WHERE source_id IN
                        (SELECT source_id FROM standards.requirements))
    ) FROM a
  ),
  -- One row per external standard we are held to. The atoms column sums to MORE
  -- than the corpus, because a merged atom is counted under every authority that
  -- asks for it — that overlap is the saving the merge exists to produce.
  'authorities', (
    SELECT COALESCE(jsonb_agg(x ORDER BY x.requirements DESC), '[]'::jsonb) FROM (
      SELECT s.authority,
             count(r.requirement_id)              AS requirements,
             count(DISTINCT asrc.atom_id)         AS atoms,
             string_agg(DISTINCT s.title, ' · ')  AS documents
        FROM standards.sources s
        JOIN standards.requirements r  ON r.source_id = s.source_id
        LEFT JOIN standards.atom_sources asrc ON asrc.requirement_id = r.requirement_id
       GROUP BY s.authority
    ) x
  ),
  'departments', (
    SELECT COALESCE(jsonb_agg(x ORDER BY x.atoms DESC), '[]'::jsonb) FROM (
      SELECT a.dept_code,
             COALESCE(dn.name, a.dept_code)             AS dept_name,
             count(*)                                   AS atoms,
             count(*) FILTER (WHERE a.covered)          AS covered,
             count(*) FILTER (WHERE a.source_count > 1) AS multi_source
        FROM a LEFT JOIN dn ON dn.code = a.dept_code
       GROUP BY a.dept_code, dn.name
    ) x
  ),
  -- Ordered so merged atoms — the ones closing several audits at once — sort first.
  'items', CASE WHEN p_dept IS NULL THEN '[]'::jsonb ELSE (
    SELECT COALESCE(jsonb_agg(x ORDER BY x.source_count DESC, x.category, x.title), '[]'::jsonb) FROM (
      SELECT atom_id, atom_key, title, requirement_text, category,
             authorities, source_count, covered, sop_code, dept_code_2
        FROM a WHERE dept_code = p_dept
    ) x
  ) END
);
$$;

REVOKE ALL ON FUNCTION public.fn_standards_payload(bigint, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_payload(bigint, text) TO authenticated, service_role;
