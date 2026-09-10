-- AUDIT COPY of the three write bridges, applied live inside migration
-- standards_schema_v1 and hardened by standards_bridges_hardening_v1.
--
-- These were MISSING from the audit copy: a later edit to the plan's Task 1 replaced a
-- text range that had these functions inside it, so they were silently dropped from the
-- file the audit copy is extracted from. Caught by the final whole-branch review.
--
-- GRANTS: service_role ONLY. These are WRITE bridges into the shared, tenant-neutral
-- corpus every property is measured against. They were briefly granted to `authenticated`,
-- which would have let any logged-in user of either tenant inject rows into the standard
-- via POST /rest/v1/rpc/... They are only ever called by service-role API routes.

CREATE OR REPLACE FUNCTION public.fn_standards_source(p_source_key text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public','standards' AS $$
  SELECT to_jsonb(s) FROM standards.sources s WHERE s.source_key = p_source_key;
$$;

CREATE OR REPLACE FUNCTION public.fn_standards_load_requirements(p_source_key text, p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','standards' AS $$
DECLARE v_source_id uuid; v_before int; v_after int;
BEGIN
  SELECT source_id INTO v_source_id FROM standards.sources WHERE source_key = p_source_key;
  IF v_source_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', format('source %s not seeded', p_source_key));
  END IF;
  SELECT count(*) INTO v_before FROM standards.requirements WHERE source_id = v_source_id;
  INSERT INTO standards.requirements
    (source_id, section, subsection, question_no, text, weight, dept_code, dept_code_2, category, verdict_2026)
  SELECT v_source_id, e->>'section', e->>'subsection', (e->>'question_no')::int,
         e->>'text', NULLIF(e->>'weight','')::numeric, e->>'dept_code', e->>'dept_code_2',
         e->>'category', e->>'verdict_2026'
  FROM jsonb_array_elements(p_rows) e
  ON CONFLICT (source_id, section, question_no) DO NOTHING;
  SELECT count(*) INTO v_after FROM standards.requirements WHERE source_id = v_source_id;
  RETURN jsonb_build_object('ok', true, 'inserted', v_after - v_before, 'total', v_after);
END $$;

CREATE OR REPLACE FUNCTION public.fn_standards_merge_atoms(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','standards' AS $$
DECLARE v_atoms int; v_cites int;
BEGIN
  INSERT INTO standards.atoms (atom_key, dept_code, dept_code_2, title, requirement_text, category)
  SELECT e->>'atom_key', e->>'dept_code', e->>'dept_code_2',
         e->>'title', e->>'requirement_text', e->>'category'
  FROM jsonb_array_elements(p_rows) e
  ON CONFLICT (atom_key) DO NOTHING;
  INSERT INTO standards.atom_sources (atom_id, requirement_id)
  SELECT a.atom_id, (rid)::uuid
  FROM jsonb_array_elements(p_rows) e
  JOIN standards.atoms a ON a.atom_key = e->>'atom_key'
  CROSS JOIN LATERAL jsonb_array_elements_text(e->'requirement_ids') AS rid
  ON CONFLICT (atom_id, requirement_id) DO NOTHING;
  SELECT count(*) INTO v_atoms FROM standards.atoms;
  SELECT count(*) INTO v_cites FROM standards.atom_sources;
  RETURN jsonb_build_object('ok', true, 'atoms', v_atoms, 'citations', v_cites);
END $$;

REVOKE ALL ON FUNCTION public.fn_standards_source(text) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.fn_standards_load_requirements(text, jsonb) FROM anon, PUBLIC, authenticated;
REVOKE ALL ON FUNCTION public.fn_standards_merge_atoms(jsonb) FROM anon, PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_standards_source(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_standards_load_requirements(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_standards_merge_atoms(jsonb) TO service_role;

-- fn_standards_gap_summary is likewise service_role only: it is SECURITY DEFINER and
-- trusts a caller-supplied p_property_id with no access check, so an authenticated grant
-- would let either tenant read the other's coverage by RPC. Routes must call it behind
-- requirePropertyAccess() (L22).
REVOKE EXECUTE ON FUNCTION public.fn_standards_gap_summary(bigint) FROM authenticated;
