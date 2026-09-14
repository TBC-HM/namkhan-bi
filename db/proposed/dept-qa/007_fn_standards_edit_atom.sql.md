# 007_fn_standards_edit_atom — audit copy (missing-copy backfill, final review M2)

This function was created earlier in the Department QA / discharge-modes project
(Task 6, the HoD in-place correction UI in `DepartmentQa.tsx`'s `ObligationEditor`)
but was never given a `db/proposed/dept-qa/` audit copy. No behavior change — this
file only backfills the record, transcribed live via `pg_get_functiondef` on
2026-09-15 against project `kpenyneooigsyuuomgct`.

## Tenancy shape — deliberately parked, not touched by this review

`p_property_id` is accepted but **not** used to scope the `UPDATE` — it updates
`standards.atoms` by `atom_id` alone, because the atom corpus is tenant-neutral (the
same compliance obligation exists once, shared by every property) while the
correction itself (`discharge_mode`, `staff_wording`) is currently stored on that
same tenant-neutral row rather than per-property. This means a HoD correction at one
property is visible to every property, which is a real open question but an owner
decision, explicitly parked (final-review brief: "Do NOT touch — fn_standards_edit_atom's
tenancy shape — that is an owner decision, parked deliberately"). Not changed here.

## Grants (confirmed live via `has_function_privilege`)

`anon` EXECUTE = false; `authenticated` and `service_role` = true.

## SQL (live definition, unchanged by this review)

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_edit_atom(p_property_id bigint, p_atom_id uuid, p_mode text DEFAULT NULL::text, p_staff_wording text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'standards', 'pg_temp'
AS $function$
BEGIN
  IF p_mode IS NOT NULL AND p_mode NOT IN ('procedure','rule','evidence','observation') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_mode');
  END IF;
  UPDATE standards.atoms
     SET discharge_mode = COALESCE(p_mode, discharge_mode),
         mode_source    = CASE WHEN p_mode IS NOT NULL THEN 'edited' ELSE mode_source END,
         staff_wording  = COALESCE(p_staff_wording, staff_wording)
   WHERE atom_id = p_atom_id;
  RETURN jsonb_build_object('ok', FOUND);
END $function$;

REVOKE ALL ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_edit_atom(bigint, uuid, text, text) TO authenticated, service_role;
```
