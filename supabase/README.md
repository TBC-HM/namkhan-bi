# supabase/

Single source of truth for the **namkhan-pms** Postgres database (project ref `kpenyneooigsyuuomgct`, region `eu-central-1`).

The goal is identical to the frontend's relationship with Vercel: nothing lives only in the cloud UI. Every schema change is a migration in this folder, reviewed via PR, applied via the Supabase CLI.

## Layout

```
supabase/
├── config.toml          # CLI config (project_id, ports, auth, edge runtime)
├── .gitignore           # ignore .branches/ .temp/ .env, local dumps
├── seed.sql             # reference seed for local dev / branches ONLY (not applied to prod)
├── migrations/          # timestamped .sql files, applied in order
├── functions/           # edge functions (placeholder; first function lands in F1 handover)
├── PULL_GAPS.md         # any objects `db pull` did not capture
└── README.md            # this file
```

## Common workflows

### First-time setup (per developer)

```bash
npx supabase login                                   # browser OAuth
npx supabase link --project-ref kpenyneooigsyuuomgct # asks for DB password (Project Settings → Database)
```

### Pull current cloud schema into a migration

Use this when you've forgotten to migrate-as-code and the cloud has drifted.

```bash
npx supabase db pull
# inspect the new migration in migrations/
git add supabase/migrations
```

If `db pull` produces partial output (common for `cron`, storage policies, realtime), document the gap in `PULL_GAPS.md` and add a hand-written migration that fills it.

### Add a new migration

```bash
npx supabase migration new <short_name>
# edit the generated SQL file
git add supabase/migrations
```

### Test locally

```bash
npx supabase start          # boots local Postgres, applies all migrations + seed.sql
npx supabase db reset       # nukes local db, re-applies everything from scratch
```

### Diff vs cloud

```bash
npx supabase db diff --linked
```

Returns the SQL needed to make the cloud match local. Empty output = parity.

### Push to cloud (production)

```bash
npx supabase db push        # applies pending migrations to the linked project
```

In v1, this runs manually from `main` after a PR merges. CI does not auto-apply (see `.github/workflows/supabase-diff.yml` — diff-comment only).

### Rollback

There is no automatic rollback. Procedure:

1. Revert the merge commit on `main`.
2. Write a new migration that reverses the change (or restores a previous shape).
3. `supabase db push` the reversal migration.
4. If data was destroyed, restore from the most recent daily backup (Supabase dashboard → Database → Backups).

## Conventions

- Migration filenames: `<UTC timestamp>_<imperative_short_name>.sql` (e.g. `2026050112000001_add_aged_ar_view.sql`).
- One logical change per migration. No multi-purpose dumps.
- `CREATE OR REPLACE` for views and functions; `CREATE … IF NOT EXISTS` for tables.
- Drop dependents in the same migration that recreates them. **Never `DROP … CASCADE`** — it silently kills downstream matviews.
- Materialized views require a unique index, otherwise `REFRESH CONCURRENTLY` fails silently.
- LAK is the base currency, USD is communications. FX lives in `gl.fx_rates`. Never hardcode rates.

## Constraints

- **No service-role key in this folder, ever.** Anon key only on the frontend; service role lives in Supabase Vault.
- **No data exports of `auth.users` / `auth.identities`.** Schema only — these contain real PII.
- **`gl.fx_rates` history (~20 rows) is data, not schema.** Don't capture it in migrations or `seed.sql` beyond an anchor row for local dev.

## Status

| Item | State |
|---|---|
| `config.toml` | ✅ scaffolded |
| `seed.sql` | ⚠ placeholder — regenerate from `db pull` |
| Initial schema migration (`db pull` output) | ❌ pending — requires `supabase login` |
| Cron jobs migration | ❌ pending — `pg_cron` schedule may need hand-writing |
| Storage RLS policies | ❌ pending — verify via `PULL_GAPS.md` |
| `.github/workflows/supabase-diff.yml` | ✅ in repo |

Last verified: 2026-05-01
