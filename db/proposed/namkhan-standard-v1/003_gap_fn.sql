-- Applied live as standards_gap_fn_v1. See the plan's Task 5 for the full text;
-- this is the audit copy.
CREATE OR REPLACE FUNCTION public.fn_standards_gap_summary(p_property_id bigint)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public', 'standards' AS $$
  WITH g AS (
    SELECT a.atom_id, a.dept_code,
           EXISTS (SELECT 1 FROM standards.sop_coverage c
                    WHERE c.atom_id = a.atom_id AND c.property_id = p_property_id AND c.covered) AS covered
    FROM standards.atoms a
  )
  SELECT jsonb_build_object(
    'property_id', p_property_id,
    'total_atoms', (SELECT count(*) FROM g),
    'covered',     (SELECT count(*) FILTER (WHERE covered) FROM g),
    'uncovered',   (SELECT count(*) FILTER (WHERE NOT covered) FROM g),
    'by_dept', coalesce((
      SELECT jsonb_agg(jsonb_build_object('dept_code', dept_code, 'total', n,
               'covered', c, 'uncovered', n - c) ORDER BY (n - c) DESC)
      FROM (SELECT dept_code, count(*) AS n, count(*) FILTER (WHERE covered) AS c
            FROM g GROUP BY dept_code) z), '[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.fn_standards_gap_summary(bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_gap_summary(bigint) TO authenticated, service_role;
