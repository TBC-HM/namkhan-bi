-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171904
-- Name:    b5_b7_lock_anon_pii_2026_05_05
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- B5/B7: Revoke anon SELECT on PII-heavy tables. 
-- Conservative scope: just guests + transactions (the highest-risk leakage vectors).
-- Keep `authenticated` + `service_role`. Dashboard API routes use service_role anyway.
-- If dashboard breaks, restore is `GRANT SELECT ON public.<table> TO anon;`.

-- 1. guests — names, emails, phones, addresses
REVOKE SELECT ON public.guests FROM anon;

-- Drop the always-true policies that expose anon
DROP POLICY IF EXISTS read_all_guests ON public.guests;

-- Keep `public_read` policy (which is for `authenticated` only after dedupe)
-- Verify what's left
COMMENT ON TABLE public.guests IS 
'Guest PII. anon SELECT revoked 2026-05-05 (B5/B7). Use service_role via API routes for guest reads.';

-- 2. transactions — all financial line items
REVOKE SELECT ON public.transactions FROM anon;
-- Note: only one allow_anon_read policy here (we deduped read_all_transactions earlier).
-- Keep the policy itself but anon won't have GRANT so it can't be used.

COMMENT ON TABLE public.transactions IS
'Financial transactions. anon SELECT revoked 2026-05-05 (B5/B7). Use service_role via API routes.';