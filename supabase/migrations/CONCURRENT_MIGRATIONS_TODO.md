# Concurrent migrations applied 2026-05-06 — SQL recovery TODO

These 7 migrations were applied to the production DB by **a concurrent session**, NOT by Cowork. The DB has them; the repo doesn't have the source SQL files.

| # | Version | Name | Approx purpose |
|---|---|---|---|
| 1 | `20260506004037` | `fix_bdc_pace_alias_and_kpi_daily_grant` | BDC pace view alias + KPI daily grant |
| 2 | `20260506004132` | `grant_anon_select_for_revenue_pages` | Anon SELECT grants for revenue pages |
| 3 | `20260506004807` | `bdc_anon_select_policies` | BDC anon RLS policies |
| 4 | `20260506004954` | `compset_log_rate_fix_property_id` | Compset rate-log property_id fix |
| 5 | `20260506101437` | `anon_select_pricing_parity` | Anon SELECT for pricing/parity |
| 6 | `20260506101542` | `anon_read_revenue_tables` | Anon SELECT for revenue tables |
| 7 | `20260506103611` | `marketing_anon_read_ready_media` | Anon SELECT for marketing.ready_media |

## Recovery path

These are visible in `supabase_migrations.schema_migrations` but their `.sql` source is not in `supabase/migrations/`. To recover the actual SQL:

```bash
# Once Docker Desktop is running:
npx supabase db pull --linked
```

This will diff production vs local and write the missing migrations as proper files. Run, review the diff, commit.

## Why this is non-blocking

Production has these applied. The cockpit Phase 0 reconciliation is unaffected by their absence in the repo — they show up in `schema_migrations` and the runtime behaviour is correct. Adding the SQL files is for parity + onboarding (e.g., spinning up `namkhan-pms-staging` later).

## Owner

Concurrent session (not Cowork). They modified `app/finance/*`, `app/revenue/*`, `app/knowledge/*`, `components/nav/subnavConfig.ts`, etc. Likely also has the migration source in their session memory.
