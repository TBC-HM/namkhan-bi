-- Controller addition, not in the original plan.
--
-- The bootstrap corpus load and merge were executed from SQL (the API routes need a live
-- authenticated session and a service-role key that this checkout does not have). For the
-- merge to be idempotent with app/api/standards/merge/route.ts, the SQL must generate
-- atom_keys IDENTICAL to lib/standards/atomKey.ts — otherwise running the route later
-- would mint a duplicate set of atoms instead of no-op-ing.
--
-- This is an exact port, verified against the TypeScript's real output for two cases
-- before it was allowed to write anything:
--   atomKeyFor('housekeeping','The bed was turned down.')
--     = housekeeping:the-bed-was-turned-down:78b2103c811079c4
--   atomKeyFor('roots_service','Refills of beverages were proactively offered.')
--     = roots_service:refills-of-beverages-were-proactively-offered:21f9e69207a63bf9
-- Both matched. If lib/standards/atomKey.ts ever changes, this MUST change with it.
CREATE OR REPLACE FUNCTION public.fn_standards_atom_key(p_dept text, p_text text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH n AS (
    SELECT regexp_replace(btrim(regexp_replace(lower(coalesce(p_text,'')), '[^a-z0-9]+', ' ', 'g')),
                          '\s+', ' ', 'g') AS norm
  )
  SELECT p_dept || ':' ||
         left(array_to_string((string_to_array(n.norm, ' '))[1:8], '-'), 60) || ':' ||
         left(encode(digest(p_dept || '::' || n.norm, 'sha256'), 'hex'), 16)
  FROM n;
$$;
REVOKE ALL ON FUNCTION public.fn_standards_atom_key(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_standards_atom_key(text, text) TO service_role;
