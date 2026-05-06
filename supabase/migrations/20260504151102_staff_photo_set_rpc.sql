-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260504151102
-- Name:    staff_photo_set_rpc
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Public RPC to set a staff member's photo_path (avoids ops.* schema-not-exposed gotcha).
CREATE OR REPLACE FUNCTION public.set_staff_photo(p_staff_id uuid, p_path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ops, public
AS $$
BEGIN
  UPDATE ops.staff_employment SET photo_path = p_path WHERE id = p_staff_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_staff_photo(uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.set_staff_photo(uuid, text) FROM PUBLIC, anon, authenticated;
