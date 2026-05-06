# Phase 0 Reconciliation Report — 2026-05-06 16:25 ICT

**Goal**: establish what is real (production) vs what GitHub shows.
**Rule**: production is the source of truth. GitHub will be brought to match.
**Status**: read-only report. No changes made except baseline tags + tarball.

---

## A. Vercel (production)

| Item | Value |
|---|---|
| Project | `namkhan-bi` |
| Project ID | `prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl` |
| Team | `pbsbase-2825s-projects` (`team_vKod3ZYFgteGCHsam7IG8tEb`) |
| Region | `fra1` (Frankfurt) |
| Framework | Next.js 14.2.15 |
| Build command | `next build` (default) |
| **Current production deployment** | **`dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg`** |
| Deploy created | 2026-05-06 14:08:21 UTC (12 min before crawl) |
| Deploy status | ● Ready |
| Aliases | `namkhan-bi.vercel.app`, `namkhan-bi-pbsbase-2825s-projects.vercel.app`, `namkhan-bi-pbsbase-2825-pbsbase-2825s-projects.vercel.app` |
| Cron jobs in `vercel.json` | none (all crons live in pg_cron in Supabase) |

### Production env vars (names only, 19 total)

Cockpit-related (set today, 4h ago):
`VERCEL_TOKEN`, `GITHUB_TOKEN`, `NEXT_PUBLIC_SITE_URL`, `COCKPIT_WEBHOOK_SECRET`, `COCKPIT_AGENT_TOKEN`, `COCKPIT_PASSWORD`, `COCKPIT_USERNAME`

Pre-existing:
`MAKE_INGEST_TOKEN`, `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `CRON_SECRET`, `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PROPERTY_ID`, `NEXT_PUBLIC_FX_LAK_USD`, `DASHBOARD_PASSWORD`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`

---

## B. Supabase (`namkhan-pms`)

| Metric | Count |
|---|---|
| Project ref | `kpenyneooigsyuuomgct` |
| Region | `eu-central-1` |
| Application schemas | **36** |
| Base tables | **392** |
| RLS policies | **742** |
| Functions | **223** |
| Materialized views | **16** |
| pg_cron jobs total / active | **38 / 37** |
| Migrations applied (cumulative) | **484** |
| Edge Functions (active) | **13** |
| Storage buckets | **16** |

### Edge Functions (13 active)

`sync-cloudbeds` v18, `sync-cloudbeds-diag` v5, `cb-probe` v5, `media-ingest` v5, `media-tag` v5, `qb-bulk-gl-load` v7, `gl-bulk-load` v5, `render-media` v11, `nimble-probe` v6, `compset-agent-run` v15, `tag-media` v4, `agent-runner` v2, `social-followers-sync` v1.

### Storage buckets (16)

`avatars`, `branding`, `documents-{public,internal,restricted,confidential}`, `dq-evidence`, `media`, `media-{master,raw,rejects,renders}`, `qb_uploads`, `signatures`, `sop-visuals`, `staff-photos`.

### Latest 5 migrations

`20260506141310`, `20260506141223`, `20260506140428`, `20260506140345`, `20260506135741` — all today (Phase 1 docs governance + RLS + grants).

### Health

- All 392 tables show RLS enabled (sampled).
- No RLS policies were dropped during crash (count is healthy at 742).
- `pgrst.db_schemas` was merged with `documentation` + `documentation_staging` today (existing schemas preserved).

---

## C. GitHub (`TBC-HM/namkhan-bi`)

| Metric | Value |
|---|---|
| Default branch | `main` |
| `origin/main` HEAD | `b4b3e79737d01c1785e0974594c2a004d965a0e7` |
| Local checkout branch | **`chore/cockpit-foundation`** |
| Local HEAD | `666c678581480a2954973b3ca3ff72cbe6a59ee9` |
| Local commits ahead of origin/main | **3** |
| origin/main commits ahead of local HEAD | **0** |
| Untracked files in working tree | **37** |
| Modified-but-uncommitted tracked files | **12** |
| Tracked files at HEAD | 828 |
| Tags (after baseline) | `v0-pre-reconciliation-local`, `v0-pre-reconciliation-github` |

### 3 commits PRESENT LOCALLY but missing from `origin/main`

```
666c678 feat: recover WIP across pillars + nav fixes for parity & knowledge/alerts
04e274d recovery: rewrite reverted pages + lock components
38e267f feat(inventory): add Sold YTD/30d to stock table; Last sale/YTD sales to catalog table
```

### 37 untracked files — ALL today's cockpit work

| Group | Files |
|---|---|
| Cockpit API routes (21) | `app/api/cockpit/{activity,agent/prompts,agent/run,auth/magic-link,auth/redeem,chat,cost,docs/{backup,detail,promote,rollback,route},knowledge,schedule,schema/{rows,tables},standing-task/run,team,webhooks/{incident,uptime,vercel}}/route.ts` |
| Cockpit page | `app/cockpit/page.tsx` (~1700 lines) |
| Library | `lib/cockpit-tools.ts` |
| Middleware | `middleware.ts` (Basic Auth gate) |
| Cockpit docs (6) | `cockpit/AGENT_NETWORK.md`, `cockpit/decisions/{0002,0003,0004}-*.md`, `cockpit/runbooks/PIECE_2_VERCEL_HARDENING.md`, `cockpit/runbooks/PIECE_5_VERCEL_TOKEN.md` |
| Make blueprints (5) | `cockpit/make-blueprints/{01,02,03,05}-*.blueprint.json` + `INSTALL_01_02_03_05.md` |
| Misc (3) | `.vercel-deploy-wrapper.sh`, `public/platform-map-v5.html` |

### 12 modified-but-uncommitted files (mix of mine + concurrent session)

| File | Likely owner | Notes |
|---|---|---|
| `DESIGN_NAMKHAN_BI.md` | me | Changelog entries appended for cockpit work |
| `vercel.json` | concurrent | Added `maxDuration: 60` for `/api/marketing/upload` |
| `components/nav/subnavConfig.ts` | concurrent | Nav additions |
| `app/finance/{ledger,page}.tsx` | concurrent | Finance pillar work |
| `app/knowledge/page.tsx` | concurrent | Knowledge pillar |
| `app/operations/staff/{page,[staffId]/page}.tsx` | me + concurrent | I added `fx_lak_usd` to PayrollRow type; concurrent added staff-detail features |
| `app/revenue/channels/[source]/page.tsx` | concurrent | BDC analytics |
| `app/revenue/compset/page.tsx` | concurrent | Compset v3 components |
| `app/settings/{cockpit,page}.tsx` | me + concurrent | Cockpit settings page polished by me |

---

## D. Drift summary

| # | Item | Production state | GitHub state | Severity | Recommended sync action |
|---|---|---|---|---|---|
| 1 | Production source branch | `chore/cockpit-foundation` | not reflected on `main` | **HIGH** | Create reconciliation branch off `main`, cherry-pick the 3 local commits, add the 37 untracked + 12 modified files in one commit, fast-forward `main` |
| 2 | 3 local commits | included in production | absent from `origin/main` | HIGH | Cherry-pick or merge into `main` reconciliation branch |
| 3 | 37 untracked cockpit files | running on production | not in any branch | HIGH | `git add` + commit on reconciliation branch |
| 4 | 12 modified tracked files | running on production | divergent | HIGH | Same commit as #3; document each change in commit body |
| 5 | Today's 5 migrations | applied to prod DB | NOT in `supabase/migrations/` folder (applied via Supabase MCP `apply_migration`) | MEDIUM | Run `supabase db pull` (needs Docker running) OR write the migrations manually to repo for parity |
| 6 | Edge Function bumps | sync-cloudbeds v18 deployed | repo may have older source | MEDIUM | Verify `supabase/functions/sync-cloudbeds/index.ts` matches v18 source — pull from project if drift |
| 7 | Cockpit env vars (7 new) | set on Vercel | not in `.env.example` | LOW | Update `.env.example` with new var names (no values) |
| 8 | Storage buckets | 16 buckets live | none referenced in repo | LOW | Document buckets in `cockpit/runbooks/STORAGE.md` (new) |
| 9 | DB schemas `documentation` + `documentation_staging` | live | migrations applied via MCP, not in repo migrations folder | MEDIUM | Pull migrations OR write equivalent SQL files |
| 10 | pg_cron job #54 (`docs-daily-backup`) | active | only documented in ADR 0004 | LOW | Note in repo: ADR 0004 already documents |

---

## E. What does NOT need to change

- Supabase production data (392 tables, 484 migrations) — **untouched, intact, healthy**
- 742 RLS policies — **none disabled by crash**
- 13 Edge Functions — **all ACTIVE**
- 37 active cron jobs — **running normally**
- 16 storage buckets — **intact**
- Vercel production deploy `dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg` — **serving traffic correctly**

The crash damaged GitHub state but production survived intact.

---

## F. Recommended Part 2 plan

1. Verify with PBS that the 12 modified files include no concurrent-session conflicts that should be discarded.
2. Create a fresh branch `reconcile/phase-0-2026-05-06` off `origin/main`.
3. Cherry-pick the 3 local commits in order: `38e267f` → `04e274d` → `666c678`.
4. `git add` everything in working tree (37 untracked + 12 modified).
5. Single commit: `reconcile: sync GitHub to match production deployment dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg [phase 0]`.
6. Resolve any merge conflicts (likely zero since GitHub `main` has 0 commits we don't have).
7. PR `reconcile/phase-0-2026-05-06` → `main` for PBS approval.
8. After merge, tag merge commit as `v0-post-reconciliation`.
9. Pull migrations via `supabase db pull` once Docker is running OR write equivalents.
10. PROCEED to Part 3 (branch protection on main).

**Estimated time**: 30-45 min once PBS approves this report. Most of the time is reading 12 modified files for concurrent-session conflicts.

---

## G. Risks flagged

1. **The 12 modified files are not all mine.** A concurrent session edited some of them. If I commit them blindly, I attribute concurrent work to my reconciliation. Mitigated by listing per-file likely owner above; PBS should sample-check.
2. **Migrations applied via Supabase MCP do NOT auto-write to `supabase/migrations/`.** The migration history lives in the DB, not in the repo. `supabase db pull` is the proper recovery — needs Docker.
3. **The deploy wrapper script `.vercel-deploy-wrapper.sh` contains a hardcoded path.** It's currently a personal helper. Decide whether to commit it (with path generalized) or keep it ignored.

---

## H. Baseline pointers (for rollback if Part 2+ goes wrong)

| Layer | Pointer |
|---|---|
| Working tree tarball | `/Users/paulbauer/Desktop/cockpit-baselines/namkhan-bi-working-tree-20260506_162046.tgz` (23MB) |
| Local Git tag | `v0-pre-reconciliation-local` → SHA `666c678` |
| Remote Git tag | `v0-pre-reconciliation-github` → SHA `b4b3e79` |
| Vercel deploy ID | `dpl_8yuJFddTaUJy1LDghmFaFcJmNcbg` |
| Supabase auto-backup | Pro-plan daily backup + 7-day PITR |
| Audit log row | `cockpit_audit_log.id = 27`, type `phase_0_baseline` |

---

**STOP. Awaiting PBS review before Part 2 (GitHub reconciliation).**
