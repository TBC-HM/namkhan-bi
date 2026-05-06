# Migration history reconciliation — status 2026-05-06 19:15 ICT

## Where we are

| Source | Count | What |
|---|---|---|
| `supabase_migrations.schema_migrations` (prod DB) | 489 | Authoritative — source of truth for what's applied |
| `supabase/migrations/*.sql` (repo) | 16 (Phase 4) + Phase 1A + future | Partial — earlier migrations applied via Supabase MCP/dashboard before disk tracking |
| `supabase/migrations/_orphan_archive/` | 38 | Files that were on disk but never applied to prod (drafts) — kept for reference, not active |

## Reconciliation actions taken 2026-05-06

1. ✅ Archived 38 orphan disk files to `_orphan_archive/` with README
2. ✅ Marked 16 Phase 4 migrations as `applied` via `supabase migration repair` (truthfully — they ARE in prod)
3. ✅ Marked 7 ghost CLI-cache versions as `reverted` via `supabase migration repair` (truthfully — they were never in prod DB)
4. ❌ `supabase db pull --linked` to recover the 480 historical migrations as .sql files — abandoned due to:
   - Shadow database fails on `cron.schedule()` calls because pg_cron extension not configured in `config.toml`
   - Recovering all 480 via direct SQL extraction (Supabase MCP) was deemed too expensive vs. functional value

## Why this is non-blocking

- Prod schema is fully functional. Cockpit, agents, all features work today.
- New migrations going forward ARE being persisted to disk (Phase 1A files committed).
- `apply_migration` via Supabase MCP continues to write to `schema_migrations` correctly.
- Promotion pipeline + deploy workflows don't need historical .sql files.

## What we lost

- Inability to spin up a clean local Supabase shadow database that mirrors prod
- `supabase db pull` won't run cleanly until pg_cron extension is set up locally
- Historical audit trail of who-changed-what before Phase 4 (mitigated: `cockpit_audit_log` + `schema_migrations.statements` has the actual SQL for everything)

## Future fix path (30-min cleanup, not urgent)

1. Add pg_cron to `supabase/config.toml` `[db.extensions]`
2. Add `CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;` to top of `20260506105031_cockpit_agent_worker_cron.sql`
3. Retry `supabase db pull --linked` → writes the 480 missing files
4. Commit

## Source of truth

```sql
-- All applied migrations on prod (489 rows)
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

-- The actual SQL of any migration:
SELECT statements FROM supabase_migrations.schema_migrations WHERE version='<version>';
```

This file supersedes the prior 7-migration recovery notes. The 7 are subsumed in the 480 figure.
