# Supabase pull gaps

Objects in the cloud project that `npx supabase db pull` did **not** capture. Each gap is filled by a hand-written migration referenced below.

> **Status:** This file is a placeholder. Run `npx supabase db pull` against `kpenyneooigsyuuomgct`, then audit the generated migration against the expected inventory in `docs/15_SUPABASE_ARCHITECTURE.md` and update this file with what's missing.

## Expected gaps (based on Supabase CLI behaviour as of 2026-05)

| Area | Why it leaks | Mitigation migration |
|---|---|---|
| `pg_cron` job schedules (14 active) | CLI does not export the `cron.job` table | `<ts>_cron_jobs.sql` — recreate via `cron.schedule(...)` |
| `storage.objects` RLS policies (≈21 policies) | Lives outside table-RLS scope | `<ts>_storage_policies.sql` — recreate via `CREATE POLICY` on `storage.objects` |
| Realtime publications | Sometimes excluded | Verify `supabase_realtime` publication, hand-write if absent |
| `auth.users` / `auth.identities` rows | NEVER export — contains real PII | n/a; schema-only, no migration |
| `vault.secrets` references | Excluded for safety | Document key names only in `docs/15_SUPABASE_ARCHITECTURE.md` |
| `gl.fx_rates` history (~20 rows) | Data, not schema | n/a; leave existing cloud rows untouched |

## Audit log

| Date | Pulled by | Migration filename | Gaps logged | Mitigation migrations added |
|---|---|---|---|---|
| YYYY-MM-DD | <user> | <timestamp>_initial_schema.sql | … | … |
