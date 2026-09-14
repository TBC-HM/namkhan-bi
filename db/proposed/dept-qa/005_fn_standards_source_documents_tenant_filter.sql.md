# 005_fn_standards_source_documents_tenant_filter — audit copy

Applied live via Supabase MCP `apply_migration` (project `kpenyneooigsyuuomgct`),
migration name `fn_standards_source_documents_tenant_filter`, on 2026-09-15. Audit
copy only — `supabase/migrations/` is dead, nothing here ever runs.

## Why this exists — CRITICAL 1, final whole-branch review

`fn_standards_source_documents()` (the zero-argument version created earlier in this
project, never given an audit copy — this file also serves as M2's missing copy)
was SECURITY DEFINER and filtered only `d.status = 'active'`. Every row it returned
was `dms.documents.property_id = 260955` (Namkhan), and two are
`sensitivity = 'confidential'` — the SLH Mystery Inspection 2025 and 2026 reports.
`/h/1000001/operations/standard` (Donna) called the same zero-argument RPC and
rendered working Download buttons for both — a cross-tenant leak of confidential
audit reports, violating invariant 3 (bridge objects bypass RLS and MUST filter
`property_id` themselves).

The migration comment that originally created this function claimed the documents
were "platform reference documents, not a property's records." That rationale was
wrong — the SLH mystery-inspection reports are plainly one property's confidential
records — and is not repeated here.

## Fix

- Re-emitted as `public.fn_standards_source_documents(p_property_id bigint)` with
  `AND d.property_id = p_property_id` added to the WHERE clause.
- `COMMENT ON FUNCTION` states the tenancy requirement plainly (see SQL below) so a
  future edit cannot silently drop the filter again without also removing a comment
  that explains why it must not.
- The old zero-argument overload is dropped (`DROP FUNCTION IF EXISTS
  public.fn_standards_source_documents()`) so no caller can silently keep using the
  unfiltered version. Confirmed only one overload exists post-migration.
- `app/h/[property_id]/operations/standard/page.tsx` updated to call
  `.rpc('fn_standards_source_documents', { p_property_id: pid })`.

## Verification (live, 2026-09-15)

```sql
SELECT (SELECT count(*) FROM public.fn_standards_source_documents(260955)) AS namkhan_docs,
       (SELECT count(*) FROM public.fn_standards_source_documents(1000001)) AS donna_docs;
-- {"namkhan_docs":6,"donna_docs":0}

SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='fn_standards_source_documents';
-- exactly one row: args = "p_property_id bigint"
```

Grants: `has_function_privilege('anon', 'public.fn_standards_source_documents(bigint)', 'EXECUTE')`
= false; `authenticated` and `service_role` = true.

## SQL

```sql
CREATE OR REPLACE FUNCTION public.fn_standards_source_documents(p_property_id bigint)
 RETURNS TABLE(authority text, source_key text, source_title text, doc_id uuid, doc_title text, file_name text, mime text, file_size_bytes bigint, sensitivity text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'standards', 'dms', 'pg_temp'
AS $function$
  SELECT s.authority, s.source_key, s.title AS source_title,
         d.doc_id, d.title AS doc_title, d.file_name, d.mime,
         d.file_size_bytes, d.sensitivity
    FROM standards.sources s
    JOIN dms.documents d ON d.doc_id = s.doc_id
   WHERE d.status = 'active'
     AND d.property_id = p_property_id
   ORDER BY s.authority, d.title;
$function$;

COMMENT ON FUNCTION public.fn_standards_source_documents(bigint) IS
'Bridge object (invariant 3): SECURITY DEFINER, bypasses RLS, MUST filter
property_id itself. Two of the six documents returned (SLH Mystery Inspection 2025
and 2026) are sensitivity=confidential audit reports belonging to ONE property
(Namkhan, 260955) — not tenant-neutral platform reference material, whatever a prior
comment claimed. Never re-emit this without the property_id filter.';

REVOKE ALL ON FUNCTION public.fn_standards_source_documents(bigint) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_source_documents(bigint) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.fn_standards_source_documents();
```
