# Project Assessment — namkhan-bi

**Date:** 2026-05-02 (verified live)
**Scope:** GitHub · Vercel · Supabase · Make.com
**Author:** Claude (Cowork session)
**Live URL:** https://namkhan-bi.vercel.app/

This document supersedes the platform sections of `15_DEPLOYMENT_GUIDE.md`, `17_DEPLOYMENT_GUIDE.md`, `DEPLOY.md`, and `09_VERTEX_ARCHITECTURE.md` where those contradict it. See "Doc staleness" at the end.

---

## 1. TL;DR — where we stand

| Platform | Status | Headline |
|---|---|---|
| Vercel | LIVE — healthy | Last prod deploy 11 min ago (`dpl_5HQ26N8dWU9LAiCB8rXpY7tHqJZP`), all 6 sampled routes return 200, 6 env vars set including `SUPABASE_SERVICE_ROLE_KEY` |
| Supabase | LIVE — healthy | 159 migrations applied, 21 application schemas, 286 objects, 5 Edge Functions, 4,749 reservations / 76,001 transactions / 4,111 guests, PGRST exposes `public, graphql_public, marketing, governance, guest` |
| GitHub | LIVE — but **drift** | `origin/main` = local `main` = `8debc22`. **BUT** `/guest/directory` v2 + `lib/supabase/server.ts` shim are LIVE on Vercel and **NOT committed** to git. Auto-deploy from git push is OFF (intentionally). |
| Make.com | NOT INTEGRATED | Zero code, zero env vars, zero webhooks. Mentioned as aspirational in 3 docs only. Treat as future / not in operating system. |

**Critical issues to fix this session:**
1. Commit and push the uncommitted `/guest/directory` work or you risk losing it on a `git stash` / branch switch.
2. Three deploy-guide docs still claim "auto-deploys on push to main" — false. Update or delete.
3. `09_VERTEX_ARCHITECTURE.md` still cites Make.com for alerts. It is not connected. Either build it or remove the line.

---

## 2. GitHub — `TBC-HM/namkhan-bi`

### Repo state (verified `git status`, `git log`, `git remote`)

| Field | Value |
|---|---|
| Remote | `https://github.com/TBC-HM/namkhan-bi.git` |
| Active branch | `main` |
| HEAD | `8debc22` — `fix(upload): signed-URL flow bypasses Vercel 4.5MB body cap` (2026-05-02 00:21 CEST) |
| `origin/main` vs local | **0 ahead, 0 behind** — pushed |
| Auth identity | `pbsbase@gmail.com` (NOT a TBC-HM org admin) |

### Auto-deploy status

| Mechanism | State | Verified by |
|---|---|---|
| Vercel ↔ GitHub App on `TBC-HM` org | **NOT INSTALLED** | pbsbase has no admin rights on the TBC-HM org → cannot install. Status unchanged since 2026-04-29. |
| `.github/workflows/vercel-deploy.yml` (Action with `VERCEL_TOKEN`) | **DELETED** | Removed 2026-05-01 in commit `846ea4e`. The version still on the dormant branch `feat/supabase-as-code` (commit `f8b1e4c`) is the deleted file — ignore it. |
| Live workflows | `ci.yml` (lint + typecheck + build on push/PR to main), `supabase-diff.yml` (PR-only schema diff against linked project) |

**Net result:** every code change requires a manual `npx vercel --prod --yes --force` from `~/Desktop/namkhan-bi`. `git push` does NOT ship code.

### Branch hygiene — needs cleanup

Five local branches, only `main` is alive:

| Branch | Last commit | Recommendation |
|---|---|---|
| `main` | `8debc22` (HEAD) | keep |
| `revenue-redesign-v2` | `d820930` (2 ahead of origin) | DELETE — work merged into main |
| `feat/supabase-as-code` | `9c43167` | DELETE — phase2 already merged via `63e61e8` |
| `feat/operations-housekeeping-maintenance` | `7c06abc` | DELETE — work shipped via main |
| `bc-redesign-backup-20260430-021518` | `dd76dcc` | KEEP for now (rollback safety net) |
| `v1.2-retry-backup-20260430-122107` | `a189eaa` | KEEP for now |

### Uncommitted changes (right now, `main`)

```
Modified:   components/nav/subnavConfig.ts
Modified:   lib/format.ts
Modified:   tsconfig.tsbuildinfo               # noise — already in .vercelignore
Untracked:  .verify-guest-directory.command   # local helper
Untracked:  app/guest/directory/              # /guest/directory v2 — LIVE on Vercel
Untracked:  lib/supabase/                     # server.ts shim required by directory route
Untracked:  migration_phase2_guest_pgrst_expose.sql  # already applied to DB
```

**Risk:** the directory work is visible to users at https://namkhan-bi.vercel.app/guest/directory but does not exist in any branch. A `git checkout`, `git stash`, or laptop loss = code gone.

**Action:** commit + push before next deploy.

---

## 3. Vercel — `pbsbase-2825's projects / namkhan-bi`

### Project (verified `vercel inspect`, `vercel env ls`, `vercel ls`)

| Field | Value |
|---|---|
| Project ID | `prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl` |
| Team / org ID | `team_vKod3ZYFgteGCHsam7IG8tEb` |
| Scope (CLI) | `pbsbase-2825's projects` |
| Production URL | `https://namkhan-bi.vercel.app` |
| Framework / region | Next.js 14.2.15 / `fra1` |
| Latest READY deploy | `dpl_5HQ26N8dWU9LAiCB8rXpY7tHqJZP` — 11 min ago, build 41s, alias updated |

### Environment variables (production)

All six confirmed present:

| Name | Set | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | 4 days old |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | 4 days old |
| `NEXT_PUBLIC_FX_LAK_USD` | ✓ | = 21800 |
| `NEXT_PUBLIC_PROPERTY_ID` | ✓ | = 260955 |
| `DASHBOARD_PASSWORD` | ✓ | single-password gate |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | added 16 h ago — required for `/api/marketing/upload-sign` and DMC contract uploads |

### Local `.env.local` gaps (will break local dev for upload features)

`/Users/paulbauer/Desktop/namkhan-bi/.env.local` has only 5 keys:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_FX_LAK_USD`, `DASHBOARD_PASSWORD`, `VERCEL_OIDC_TOKEN`

Missing locally: `NEXT_PUBLIC_PROPERTY_ID`, `SUPABASE_SERVICE_ROLE_KEY`. Add them or `npm run dev` will fail on the upload routes.

### Recent deploy stability

Last 20 deploys: 17 Ready, 3 Errored (all 16 h ago, clustered — likely the v1.2 type-check fight). No errors in the last 12 deploys.

### Route verification (live curl, just now)

| Route | HTTP |
|---|---|
| `/` | 307 → `/overview` |
| `/overview` | 200 |
| `/guest/directory` | 200 (untracked code IS live) |
| `/sales/b2b` | 200 |
| `/marketing/library` | 200 |
| `/operations/staff` | 200 |
| `/revenue/compset` | 200 |
| `/api/marketing/upload-sign` (GET) | 405 (correct — POST only) |

### Deploy procedure (the only working path)

```bash
cd ~/Desktop/namkhan-bi
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit                  # mandatory pre-deploy guard
npx --yes vercel --prod --yes --force   # --force is non-negotiable
```

`--force` mandatory because Vercel restores build cache that drags in the stale `to vercel production /` folder, which fails typecheck. With `--force`, build uploads ~125 files instead of ~153 and passes.

---

## 4. Supabase — `kpenyneooigsyuuomgct` (`namkhan-pms`)

### Project (verified Supabase MCP)

| Field | Value |
|---|---|
| Project ref | `kpenyneooigsyuuomgct` |
| Org slug | `htucmbbcgghqmargfqsr` |
| Region | `eu-central-1` |
| Postgres | `17.6.1.111` (release_channel `ga`) |
| Status | ACTIVE_HEALTHY |
| Created | 2026-04-26 |

### PostgREST exposed schemas (verified via `pg_db_role_setting`)

```
public, graphql_public, marketing, governance, guest
```

JS client `.schema('ops')`, `.schema('frontoffice')`, `.schema('gl')`, `.schema('kpi')`, etc. will silently return null. Pattern in this repo: expose a public proxy view and read it from the client (see memories `feedback_supabase_exposed_schemas`, `feedback_marketing_schema_pgrst`).

### Schema inventory (table + view counts)

| Schema | Objects | Notes |
|---|---|---|
| `public` | 86 | Cloudbeds raw + matviews + proxies |
| `ops` | 32 | Staff, payslips, attendance — needs proxies |
| `docs` | 23 | Document storage metadata |
| `kpi` | 20 | KPI definitions / capture views |
| `marketing` | 19 | Phase 2 media + campaigns — exposed |
| `governance` | 18 | DMC contracts, agents, RLS — exposed |
| `gl` | 13 | General ledger / FX |
| `frontoffice` | 9 | Front-office views — needs proxies |
| `guest` | 8 | Directory v2 — exposed today |
| `dq` | 8 | Data quality engine |
| `seo` | 10 | SEO module |
| `app, fb, spa, activities, knowledge, training, plan, alerts, auth_ext, revenue` | 4–13 each | mixed |

**Total application objects:** ~286 across 21 schemas.

### Live data (verified COUNT queries)

| Table | Rows |
|---|---|
| `public.reservations` | 4,749 |
| `public.guests` | 4,111 |
| `public.transactions` | 76,001 |
| `public.mv_kpi_daily` | 2,837 days |

### Edge Functions

| Slug | Version | Purpose | JWT |
|---|---|---|---|
| `sync-cloudbeds` | 11 | Pulls reservations/transactions from Cloudbeds API | off |
| `sync-cloudbeds-diag` | 1 | Diagnostic helper | off |
| `cb-probe` | 1 | Cloudbeds connectivity probe | off |
| `media-ingest` | 1 | Media library ingest | on |
| `media-tag` | 1 | Media auto-tagging | on |

### Migrations

159 applied, last six all from today (2026-05-01 → 2026-05-02):

```
20260501221607  fix_cloudbeds_sync_v12
20260501221818  fix_cloudbeds_sync_v13_pgnet_timeout
20260501222033  fix_cloudbeds_sync_v14_polling
20260501222257  fix_cloudbeds_sync_v15_collect_response
20260501222828  fix_cloudbeds_sync_v16_invoker
20260502133444  phase2_guest_pgrst_expose      ← exposes guest schema
```

**Sync was actively patched yesterday (v12 → v16).** Verify the sync function is currently running cleanly before next morning's KPI report.

### Other Supabase projects in the same org — DO NOT TOUCH

- `PBS CENTRAL` (`gjxifmrqnzcrdhykpxqn`) — separate workspace
- `TDP_BI_HUB` (`rrpzcewmlrcqicveepss`) — empty shell

---

## 5. Make.com — NOT INTEGRATED

Verified by full repo grep for `make.com`, `make_webhook`, `hook.eu.make`, `hook.us.make`, `integromat`, `MAKE_WEBHOOK`. Four hits total, all in documentation, none in code or env config:

| File | Line | Type |
|---|---|---|
| `docs/09_VERTEX_ARCHITECTURE.md` | 29 | "Cloud Run + Make.com" listed as alerts vehicle — aspirational, not built |
| `docs/handoffs/done/16_SESSION_HANDOFF_2026-04-30.md` | 186 | Note that `/webhooks/reviews` and `/webhooks/inbound-email` could be built via Make OR an Edge Function |
| `PROPOSE DELETE/.../marketing-frontend/INSTALL.md` | 75, 89 | Recommendation in a deprecated install doc |

**Operational reality:**
- No Make.com scenarios are calling Supabase Edge Functions
- No Supabase webhooks fire to Make.com
- No environment variables reference Make
- The `review_agent` and `lead_scoring_agent` triggers in `governance.agents` point at endpoints that DO NOT EXIST

**Implication:** if you want OTA review aggregation, inbound-email parsing, alerting to Slack/Telegram, etc., you still need to choose: (a) build Edge Functions (Deno, in-repo, fully observable), (b) connect Make.com (faster to ship, harder to version-control, monthly cost), or (c) use a third option (n8n self-hosted).

Recommendation: do NOT scatter Make.com mentions across docs as if it's installed. Pick a path, document the path, delete the others.

---

## 6. Doc staleness — fix or delete

| Doc | Status | Action |
|---|---|---|
| `DEPLOY.md` (root) | STALE — describes idealized GitHub auto-deploy that doesn't work | Replace with link to `17_DEPLOYMENT_GUIDE.md` plus correction |
| `docs/15_DEPLOYMENT_GUIDE.md` | STALE — duplicate of 17, says "auto-deploys on push to main" | Delete |
| `docs/17_DEPLOYMENT_GUIDE.md` | STALE — same false claim about auto-deploy | Rewrite the "Components" table (Frontend row), keep rest |
| `docs/09_VERTEX_ARCHITECTURE.md` | ASPIRATIONAL — Make.com cited but not built | Add "PLANNED — not yet implemented" banner |
| `docs/handoffs/done/16_SESSION_HANDOFF_2026-04-30.md` | ARCHIVED — outdated | Already in `done/`, leave |
| `docs/specs/sales-b2b-dmc/` | CURRENT | Keep |
| `docs/handoffs/done/COWORK_HANDOFF_2026-05-01.md` | CURRENT | Keep |
| Root `_LOG.md` | Verify it's still being maintained | Check |
| Folder `to vercel production /` (note trailing space) | Stale staging area, both `.vercelignore` and `tsconfig.json exclude` reference it (with trailing space) | Move outside repo or delete |
| Folder `PROPOSE DELETE/` | Stale | Move outside repo or delete |
| Folder `Archive/` | Almost empty (just `proposals/`) | Keep or remove |
| Folder `agents-frontend/` | Empty in main, populated in dormant branches | Verify, then delete if unused |
| Folder `marketing-frontend/` | Same situation | Same |
| Folder `period-wiring/` | Empty in main | Same |

---

## 7. Recommended next actions (ordered, blunt)

1. **Commit /guest/directory work now.** `git add app/guest/directory lib/supabase migration_phase2_guest_pgrst_expose.sql && git commit -m "feat(guest/directory): v2 with 5 filters + KPI tiles" && git push`. Without this you lose the work on any branch switch.
2. **Delete or rewrite the three deploy-guide files** so the docs match reality. Either CLI-only (current truth) or invest one hour to get a TBC-HM admin to install Vercel GitHub App (then auto-deploy works for real and you can re-add `vercel-deploy.yml`).
3. **Decide Make.com fate.** Either install + wire two scenarios this week (reviews + inbound email) or strip the references from docs.
4. **Clean dead branches** (`revenue-redesign-v2`, `feat/supabase-as-code`, `feat/operations-housekeeping-maintenance`).
5. **Move stale folders** (`to vercel production /`, `PROPOSE DELETE/`, empty `agents-frontend/marketing-frontend/period-wiring`) out of repo. Reduces deploy upload size and removes typecheck cache failure modes.
6. **Add the 2 missing keys to local `.env.local`** (`NEXT_PUBLIC_PROPERTY_ID`, `SUPABASE_SERVICE_ROLE_KEY`) so local dev runs full feature set.
7. **Verify `sync-cloudbeds` v11 is running cleanly** after the v12→v16 fix marathon yesterday.

---

## 8. Single-source-of-truth references

- Infrastructure (canonical): see Claude memory `reference_namkhan_bi_infrastructure.md`
- Supabase architecture (canonical): `docs/15_SUPABASE_ARCHITECTURE.md` v2.0 (2026-05-01) — schema-level
- Deploy procedure (canonical): this document, section 3 — supersedes `DEPLOY.md` and the two `_DEPLOYMENT_GUIDE.md` files
- Phase 2 / DMC / staff / compset state: per-feature project memories listed in MEMORY.md
