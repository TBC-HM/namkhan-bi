# 006_fn_audit_documents — audit copy (missing-copy backfill, final review M2)

This function was created earlier in the Department QA / discharge-modes project
(Task 5, property-wide audit-reports block on `app/h/[property_id]/operations/
quality/[dept]/page.tsx`) but was never given a `db/proposed/dept-qa/` audit copy.
No behavior change — this file only backfills the record, transcribed live via
`pg_get_functiondef` on 2026-09-15 against project `kpenyneooigsyuuomgct`.

## What it does

`dms.documents` bridge, SECURITY DEFINER, correctly filters `d.property_id =
p_property_id` already (it is the sibling this final review used as the working
example of the invariant-3 recipe that `fn_standards_source_documents` was missing
— see 005). Restricted to `doc_type = 'audit'`, `status = 'active'`,
`is_current_version` true or null.

## Grants (confirmed live via `has_function_privilege`)

`anon` EXECUTE = false; `authenticated` and `service_role` = true.

## SQL (live definition, unchanged by this review)

```sql
CREATE OR REPLACE FUNCTION public.fn_audit_documents(p_property_id bigint)
 RETURNS TABLE(doc_id uuid, title text, doc_subtype text, sensitivity text, file_name text, mime text, file_size_bytes bigint, dated date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'dms', 'pg_temp'
AS $function$
  SELECT d.doc_id, d.title, d.doc_subtype, d.sensitivity, d.file_name, d.mime,
         d.file_size_bytes,
         COALESCE(d.valid_from::date, d.created_at::date) AS dated
    FROM dms.documents d
   WHERE d.property_id = p_property_id      -- bypasses RLS: must filter itself
     AND d.doc_type = 'audit'
     AND d.status = 'active'
     AND COALESCE(d.is_current_version, true)
   ORDER BY COALESCE(d.valid_from, d.created_at) DESC;
$function$;

REVOKE ALL ON FUNCTION public.fn_audit_documents(bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_audit_documents(bigint) TO authenticated, service_role;
```
