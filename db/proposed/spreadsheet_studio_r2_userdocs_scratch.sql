-- db/proposed/spreadsheet_studio_r2_userdocs_scratch.sql
-- Spreadsheet Studio r2 (brief module-spreadsheet-studio-v1, goal 46)
-- APPLIED to namkhan-pms 2026-07-30 as migrations:
--   spreadsheet_studio_r2_userdocs_scratch
--   studio_workbooks_bridge_add_scratch_name
-- Audit-record copy — the live DB is the source of truth.
--
-- §10.2 user-docs registry ops · §10.3 scratch snapshot save ·
-- §10.4 reversible brain-consent flag. All SECURITY DEFINER bridges over
-- reports.* (bridge law L5); anon revoked on every write/read fn.

CREATE OR REPLACE FUNCTION public.fn_studio_register_user_doc(
  p_owner text, p_level text, p_property_id integer, p_filename text,
  p_storage_path text, p_size_bytes bigint, p_mime text, p_tags text[],
  p_brain_excluded boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = reports, public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_level NOT IN ('holding','property') THEN
    RAISE EXCEPTION 'level must be holding or property';
  END IF;
  IF p_level = 'property' AND p_property_id IS NULL THEN
    RAISE EXCEPTION 'property-level doc requires property_id';
  END IF;
  INSERT INTO reports.user_docs (owner, level, property_id, filename, storage_path, size_bytes, mime, tags, brain_excluded)
  VALUES (coalesce(nullif(trim(p_owner),''),'pbs'), p_level, p_property_id, p_filename, p_storage_path,
          coalesce(p_size_bytes,0), p_mime, coalesce(p_tags,'{}'), coalesce(p_brain_excluded,true))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_studio_user_docs_usage()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = reports, public AS $$
  SELECT jsonb_build_object('doc_count', count(*), 'total_bytes', coalesce(sum(size_bytes),0))
  FROM reports.user_docs;
$$;

CREATE OR REPLACE FUNCTION public.fn_studio_set_doc_brain(p_id uuid, p_excluded boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = reports, public AS $$
BEGIN
  UPDATE reports.user_docs SET brain_excluded = coalesce(p_excluded,true) WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user doc % not found', p_id; END IF;
  RETURN NOT coalesce(p_excluded,true);
END $$;

CREATE OR REPLACE FUNCTION public.fn_studio_save_scratch(
  p_workbook_id uuid, p_scope text, p_property_id integer, p_owner text, p_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = reports, public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'snapshot must be a jsonb object';
  END IF;
  IF p_workbook_id IS NULL THEN
    IF p_scope NOT IN ('holding','property') THEN
      RAISE EXCEPTION 'scope must be holding or property';
    END IF;
    INSERT INTO reports.workbooks (scope, property_id, type, owner, source_modules, snapshot, data_timestamp, last_refresh)
    VALUES (p_scope, p_property_id, 'custom_scratch', coalesce(nullif(trim(p_owner),''),'pbs'), '{}', p_snapshot, now(), now())
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
  UPDATE reports.workbooks
     SET snapshot = p_snapshot, last_refresh = now(), data_timestamp = now()
   WHERE id = p_workbook_id AND type = 'custom_scratch'
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RAISE EXCEPTION 'scratch workbook % not found', p_workbook_id; END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.fn_studio_get_scratch(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = reports, public AS $$
  SELECT jsonb_build_object(
    'id', id, 'scope', scope, 'property_id', property_id, 'owner', owner,
    'snapshot', snapshot, 'last_refresh', last_refresh, 'created_at', created_at)
  FROM reports.workbooks WHERE id = p_id AND type = 'custom_scratch';
$$;

-- additive bridge column: scratch display name without the snapshot payload
CREATE OR REPLACE VIEW public.v_studio_workbooks AS
SELECT id, scope, property_id, sheet_id, url, type, owner, source_modules,
       template_id, template_version, status, access_classification,
       parent_workbook_id, derived_by, derived_at, last_refresh,
       data_timestamp, created_at,
       snapshot->>'name' AS display_name
FROM reports.workbooks;
GRANT SELECT ON public.v_studio_workbooks TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.fn_studio_register_user_doc(text,text,integer,text,text,bigint,text,text[],boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_studio_set_doc_brain(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_studio_save_scratch(uuid,text,integer,text,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_studio_user_docs_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_studio_get_scratch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_studio_register_user_doc(text,text,integer,text,text,bigint,text,text[],boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_studio_set_doc_brain(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_studio_save_scratch(uuid,text,integer,text,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_studio_user_docs_usage() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_studio_get_scratch(uuid) TO authenticated, service_role;
