-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260503011208
-- Name:    gl_set_account_class_fix_has_class
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

CREATE OR REPLACE FUNCTION gl.set_account_class(
  p_account_id text,
  p_class_id   text,
  p_note       text DEFAULT NULL,
  p_set_by     text DEFAULT 'accountant'
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = gl, public
AS $$
DECLARE
  v_changed integer;
BEGIN
  IF p_class_id IS NULL OR p_class_id NOT IN (SELECT class_id FROM gl.classes) THEN
    RAISE EXCEPTION 'invalid class_id: %', p_class_id;
  END IF;

  INSERT INTO gl.account_class_override(account_id, class_id, note, set_by, updated_at)
  VALUES (p_account_id, p_class_id, p_note, p_set_by, now())
  ON CONFLICT (account_id) DO UPDATE
    SET class_id = EXCLUDED.class_id,
        note     = COALESCE(EXCLUDED.note, gl.account_class_override.note),
        set_by   = EXCLUDED.set_by,
        updated_at = now();

  -- Reclassify gl_entries currently in DQ bucket. has_class is a generated
  -- column derived from class_id <> 'not_specified', so it updates automatically.
  UPDATE gl.gl_entries
     SET class_id = p_class_id
   WHERE account_id = p_account_id
     AND class_id   = 'not_specified';
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  REFRESH MATERIALIZED VIEW gl.mv_usali_pl_monthly;

  RETURN v_changed;
END;
$$;
GRANT EXECUTE ON FUNCTION gl.set_account_class(text, text, text, text) TO service_role;