# Contributing

Short guide for anyone (human or agent) opening a PR against `TBC-HM/namkhan-bi`.

## Branches

| Prefix | Use for |
|---|---|
| `feat/<topic>` | New features, new tabs, new migrations |
| `fix/<topic>` | Bugfixes, regressions, hotfixes |
| `docs/<topic>` | Doc-only changes (`README`, `/docs/*`) |
| `infra/<topic>` | CI, workflows, repo plumbing |
| `chore/<topic>` | Refactors, dependency bumps, cleanup |

Branch off `main`. Keep branches short-lived. Rebase on `main` before opening the PR.

## Commit messages

- Imperative, present tense: "Add city ledger view", not "Added" / "Adds".
- One logical change per commit where practical.
- Conventional Commits **not** required, but if you use them be consistent.
- Reference issues in the body if the change closes one: `Closes #42`.

## Pull requests

1. **Title** — short imperative summary. Match the branch topic.
2. **Description** — must answer:
   - What changed and why?
   - What did you test? (local build, preview URL, screenshots)
   - Which Issue does this close?
3. **At least 1 reviewer approval** before merge. Branch protection on `main` enforces this.
4. **All CI checks must be green:** lint, typecheck, build, and (for migration PRs) `supabase db diff`.
5. **No direct pushes to `main`.** Ever. Hotfixes go through PR with optional fast-track review.

## Local Supabase against the linked project

The CLI works against the cloud project read-only or against a local Postgres. Pick the right one.

### Reading cloud schema (one-time per dev)

```bash
npx supabase login
npx supabase link --project-ref kpenyneooigsyuuomgct
```

Then `supabase db diff --linked` shows what's in cloud vs your local migrations.

### Local stack (preferred for migration testing)

```bash
npx supabase start          # boots local Postgres + Studio + Inbucket
npx supabase db reset       # nukes local DB and re-applies all migrations + seed.sql
npm run dev                 # frontend at http://localhost:3000
```

Set `.env.local` to point `NEXT_PUBLIC_SUPABASE_URL` at `http://127.0.0.1:54321` and use the local anon key printed by `supabase start`.

### Branch databases (preferred for review-time previews)

The Supabase Branching feature creates a throwaway DB per Git branch (paid feature). When enabled, the `supabase-diff` workflow runs `db diff` against the branch DB so reviewers see the exact effect of merging.

## Adding a migration

```bash
npx supabase migration new <imperative_short_name>
# e.g. add_aged_ar_view
```

This creates `supabase/migrations/<UTC_timestamp>_add_aged_ar_view.sql`. Edit the file, write SQL, commit.

Rules:

- **One change per migration.** Don't bundle.
- **Idempotent where possible.** `CREATE OR REPLACE` for views/functions; `IF NOT EXISTS` for tables.
- **Drop dependents in the same migration that recreates them.** `DROP … CASCADE` is banned — it silently kills downstream matviews. Use `DROP … RESTRICT` and recreate.
- **Materialized views need a unique index.** Otherwise `REFRESH CONCURRENTLY` fails silently for days.
- **Never edit a migration that's already merged.** Add a new one.

## Testing locally

```bash
npm ci                          # clean install
npm run lint                    # next lint
npx tsc --noEmit                # typecheck — Next.js build does NOT catch all type errors
npm run build                   # production build, must succeed before push
npm run dev                     # smoke test in browser
```

For migration PRs:

```bash
npx supabase db reset           # re-apply everything from scratch
npx supabase db diff --linked   # confirm no unintended cloud drift
```

## Constraints (do not violate)

- **Never commit `.env*` files.** `.gitignore` enforces this; verify before push.
- **Never put the Supabase service-role key anywhere in the repo.** Anon key only on the frontend; service role lives in Supabase Vault.
- **Never modify schema via the Supabase dashboard UI.** All changes go through migrations in this repo.
- **LAK is base, USD is comms, FX = 21,800.** Stored in `gl.fx_rates`. Don't hardcode.
- **USALI 11th edition is the accounting standard.** Don't rename categories or alter `gl.usali_category_map` without a migration that's been reviewed.
- **No hardcoded room counts.** Capacity is 24 selling / 30 total — read from `v_property_inventory` or `?cap=` mode.
- **Don't compute ADR as `total_amount / nights`.** Use `sum(rate) / sum(roomnights)` from `reservation_rooms`.
- **All pages call `resolvePeriod(searchParams)` and respect `?win=`.** No hardcoded windows.

## Code review focus areas

Reviewers should look for:

1. Type safety — `any` is a code smell.
2. Server-only secrets — anything starting with `NEXT_PUBLIC_` ends up in the bundle.
3. SQL — does this break existing matviews? Are unique indexes present? Are RLS policies preserved?
4. Schema drift — does `supabase db diff --linked` come back empty after merge?
5. Vercel preview — was it visited and clicked through? (Screenshot or URL in PR description.)

## When you get stuck

1. Read the most recent file in `docs/handoffs/` — it documents the current open work.
2. Check `_LOG.md` for the deploy timeline.
3. Read `15_SUPABASE_ARCHITECTURE.md` for the data model.
4. If still stuck, open a draft PR with a question in the description.
