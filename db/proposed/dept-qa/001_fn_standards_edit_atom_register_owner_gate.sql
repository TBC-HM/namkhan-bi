-- db/proposed/dept-qa/001_fn_standards_edit_atom_register_owner_gate.sql
-- Audit copy of the migration applied live via Supabase MCP apply_migration
-- (name: fn_standards_edit_atom_register_owner_gate) on project kpenyneooigsyuuomgct.
--
-- FIX 2 (2026-09-14): fn_standards_edit_atom ignored p_property_id entirely —
-- any property authorised by requirePropertyAccess() could rewrite
-- discharge_mode / staff_wording on standards.atoms, a tenant-NEUTRAL shared
-- corpus every property's QA page reads. A Donna HoD could silently rewrite
-- the atoms Namkhan's page renders.
--
-- Gate: only the property that owns the global registers
-- (ops.qa_dash_source_map.owns_global_registers = true — Namkhan 260955 today,
-- Donna 1000001 = false) may write. A non-owning property's call makes no
-- change and returns {ok:false, error:'not_register_owner'}, which
-- app/api/quality/obligation/route.ts turns into an HTTP 403.
--
-- Mode validation and the mode_source='edited' latch are unchanged.

CREATE OR REPLACE FUNCTION public.fn_standards_edit_atom(
  p_property_id bigint,
  p_atom_id uuid,
  p_mode text DEFAULT NULL::text,
  p_staff_wording text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'standards', 'pg_temp'
AS $function$
DECLARE
  v_owns boolean;
BEGIN
  SELECT owns_global_registers INTO v_owns
    FROM ops.qa_dash_source_map
   WHERE property_id = p_property_id;

  IF NOT COALESCE(v_owns, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_register_owner');
  END IF;

  IF p_mode IS NOT NULL AND p_mode NOT IN ('procedure','rule','evidence','observation') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_mode');
  END IF;

  UPDATE standards.atoms
     SET discharge_mode = COALESCE(p_mode, discharge_mode),
         mode_source    = CASE WHEN p_mode IS NOT NULL THEN 'edited' ELSE mode_source END,
         staff_wording  = COALESCE(p_staff_wording, staff_wording)
   WHERE atom_id = p_atom_id;

  RETURN jsonb_build_object('ok', FOUND);
END
$function$;

COMMENT ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) IS
'HoD write-bridge for standards.atoms (Task 6, department-qa-discharge-modes).
TENANCY GATE (2026-09-14): standards.atoms is a tenant-NEUTRAL shared corpus
(no property_id column). p_property_id is checked against
ops.qa_dash_source_map.owns_global_registers before any write: only the
property that owns the global registers (Namkhan, 260955 today) may edit an
atom. Every other property''s call is refused with
{ok:false, error:''not_register_owner''} and no row is touched — the calling
route (app/api/quality/obligation/route.ts) turns that into an HTTP 403.
An edit made from the owning property still changes the shared atom for
every tenant that reads it — that remains correct only because exactly one
property owns the registers today. OPEN QUESTION when a second property
needs its own classifications: whether to add a tenant-scoped overlay table
for discharge_mode/staff_wording (or fork/version the corpus per tenant) so
a non-owning property can maintain its own corrections without needing
register-owner status.';

REVOKE ALL ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) TO authenticated, service_role;
