# Deployment — Canonical Guide

**Scope:** how code reaches production for `namkhan-bi` (Next.js 14 · Vercel · Supabase `kpenyneooigsyuuomgct` · GitHub `TBC-HM/namkhan-bi`). Constitution: L18 (shipping), L3 (DDL), L22 (tenancy). Loop mechanics: `loop_operations`. History: `documents_history` (v16 and earlier; CLI-era recipes are archaeology — never execute them).

## §1 — What "live" means (truth table)

| Claim | Proof | NOT proof |
|---|---|---|
| Push landed | `governance.push_ledger.verified = true` (md5 re-read) | HTTP 200 / `ok:true` (= dispatched) |
| Build green | `fn_gh_check_build_status(sha)` → `conclusion=success` | `in_progress`, Vercel "Ready" |
| **Change is LIVE** | **`governance.promotion_log.promoted = true` for its SHA** (ADR-222) | Vercel "Ready" on main (2026-08-05: 048f200 Ready with failing checks) |
| Route works | curl the route on prod domain → 200 + expected content | build success |

## §2 — The pipeline (ADR-222, LOCKED)

```
agent/human ──push──▶ main ──CI checks──▶ fn_promotion_sweep (cron 5min)
                                            │ requires: tsc + lint·typecheck·build +
                                            │ pre-deploy-checks ALL success, ≥12 min soak
                                            ▼
                                     `production` branch (forward-only)
                                            ▼
                                     Vercel prod build → alias
```
- Production does NOT track `main`. The promoter owns the `production` ref — **never push to it by hand**.
- Every commit on main still builds (preview/prod-branch CI); prebuild gates run on EACH commit.
- `vercel deploy` / `vercel --prod` / `vercel alias` — **BANNED from every surface** (L18; also blocked in repo `.claude/settings.json`). One historical incident: 30 CLI deploys → prod fell back 5 days on stop.

## §3 — Shipping protocol (agents; humans may PR → auto-merge per ADR-175/280)

1. **Pre-push** (per file): imports exist in package.json? · new IT2 page registered in `_lib/groups.ts`/ALLOWLIST? · importer pushed AFTER its dependency verified? · protected path? (`governance.protected_paths` → needs `fn_approve_protected_push` owner approval first — NEVER self-granted, L23).
2. **Push via `deploy_github` skill (`fn_gh_deploy_file`)** — never raw `fn_gh_push_file` for dependent files. The wrapper mechanically blocks push B until push A confirmed (`prior_push_not_confirmed` otherwise).
3. **Verify each push**: `net._http_response` for the request_id → status_code=200; new-file-imported-by-next? → confirm via Contents API (`api.github.com/.../contents/<path>`, header `Accept: application/vnd.github.v3.raw`; **never `raw.githubusercontent.com`** — 30-60s CDN stale).
4. **Push order (law 759)**: gate-satisfying files first — allowlist/registry/config → components → page. An intermediate red commit freezes promotion even if final state is green.
5. **After the batch**: `fn_gh_check_build_status('main')` → `fn_gh_read_build_result(req)` until success. On failure: read the exact error, fix ONLY that, one push, re-check. **Never report done before success + promotion.**
6. **Blocked-push parking protocol.** A failed/unconfirmed push FREEZES its dependency chain — never push dependents "hoping". Then exactly three legal moves:
   - **Fix now** (default): read the exact error → fix ONLY that → one push → re-verify → continue the batch.
   - **Park and return**: if the blocker is external (red main from someone else, protected-path approval pending, rate/credit limit) — stop pushing; stage every UNSHIPPED file as `dms.documents` rows (`doc_subtype='code_patch'`, `source='<actor>_<YYYY_MM_DD>_recovery'`, full file content or old/new patch in body_markdown) so nothing lives only in a dying session; note the blocker; retry after green. Builders additionally set the brief to `needs_input` (approval-class blocker) or leave it claimed with the state logged (transient blocker) — the sweep re-picks it.
   - **Escalate**: decision-class blocker (protected path, guardrail) → file the question (L10), park as above, end the run — a parked run with staged patches is a legitimate ending (A3), a half-pushed batch is not.
   Recovery precedent: claude_2026_05_15/17 recovery rows (20+6 files) restored this way. NEVER leave main in a state where the pushed half does not build (push-order law).
7. Hot files (`governance.push_hot_files`): CAS via `fn_gh_declare_read` (stale base = 409). Shrink guard: <60% of `file_size_baseline` refused → `push_shrink_waivers` row first (30-min TTL). Multi-replace SQL: pre-check every OLD pattern hits exactly 1; dollar-quote bodies; verify each replace AFTER push (non-matching = silent no-op); re-fetch before composing the next patch.

## §4 — Verification (before telling anyone "done")

```sql
SELECT path, ok, verified FROM governance.push_ledger ORDER BY id DESC LIMIT 5;   -- verified=true
SELECT sha, all_green, promoted, promoted_at FROM governance.promotion_log ORDER BY id DESC LIMIT 3;
SELECT * FROM public.v_deployments ORDER BY created_at DESC LIMIT 1;              -- Ready
-- then curl the changed route(s) on the prod domain → 200 + expected content
```
`v_current_prod` is RETIRED. `/api/health` is the app-level probe.

## §5 — Rollback & incidents

- **Default = fix-forward**: revert/fix on `main`, let promotion carry it. Forward-only production ref means no hand rollbacks of the branch.
- **Schema-coupled breakage → fix-forward ONLY.** A rolled-back build against a migrated schema is a lie — see §6.
- Emergency stop of a bad promotion: `loop_kill` (halts sweeps incl. promotion) → fix → `loop_restart` (user approval; 3 switches — see `loop_operations` §5).
- Vercel Instant Rollback (dashboard) exists but carries traps (OFFICIAL 2026 docs): it disables prod auto-assign until Undo Rollback (your fix push silently won't go live), keeps old env vars, reverts crons. Use only with PBS in the loop; record in an incident note.
- Deploy incident classes seen: dependency pushed after importer (48 red builds over 2 days, 2026-07/08) · orphan IT2 page froze main at prebuild · fragment push shrank a 66kB file to 5kB (3 red prod deploys).

## §6 — DB ↔ app coordination (EXPAND-CONTRACT LAW — new v17)

DDL goes to prod directly (MCP `apply_migration`, L3) while app versions roll — so **every migration must be backward-compatible with every deployed build**:
- **Expand** first: add nullable columns / new tables / new views; dual-write if renaming. Deploy app. Backfill. **Contract** (drop/rename old) only after no deployed build references it.
- Never: `NOT NULL` without default on large tables · column drops/renames in one step · `CREATE OR REPLACE VIEW` that removes/reorders columns (DROP+CREATE, and only after consumers migrated) · long-lock DDL (use `CREATE INDEX CONCURRENTLY`, `NOT VALID` + later `VALIDATE`).
- This law is WHY rollback of schema-coupled changes is banned (§5): the old build + new schema combination was never tested.
- Edge functions deploy SEPARATELY from git push: source in repo (`supabase/functions/*`) is the record; deploy via MCP `deploy_edge_function`; verify version bumped via `get_edge_function`; smoke-test the URL. Push to main ≠ edge fn deployed.

## §7 — Gates inventory (what actually blocks what)

| Gate | Fires on | Blocks? |
|---|---|---|
| `check-it2-orphans.mjs` (prebuild) | EVERY Vercel build | ✅ hard: IT2 page not in groups.ts/ALLOWLIST; cockpit/chat pages not redirect stubs |
| `ci.yml` (lint → tsc → build) | push/PR main+staging | ✅ in GHA |
| `typecheck.yml` (tsc --noEmit) | every push/PR | ✅ in GHA |
| `fn_promotion_sweep` | cron 5-min | ✅ THE production gate (ADR-222) |
| Protected paths | fn_gh_push_file | ✅ needs owner approval row |
| `metric-drift-gate` / `supabase-diff` | migrations path — **DEAD** (ADR-282: dir retired) | ❌ retarget to schedule = open brief |
| `design-doc-check`, Lighthouse | PRs | ❌ non-blocking, informational |
| ⚠ Vercel build itself | — | **`next.config.js` ignores TS+lint** (`ignoreBuildErrors`, "temp" 2026-05) and `tsconfig strict:false`. Vercel green ≠ typechecked. Migration back: tsc error-count ratchet in CI → burn to zero → flip flags (open brief) |

There is **no test runner** in the repo. Never claim "tests pass."

## §8 — Environment & secrets

- Vercel prod env vars: `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` (server-only; if missing, `supabase-gl` silently falls back to anon → all `gl.*` reads return `[]`) · `ANTHROPIC_API_KEY` · `DASHBOARD_PASSWORD` · `NEXT_PUBLIC_FX_LAK_USD` · `NEXT_PUBLIC_PROPERTY_ID` (legacy single-tenant constant — retirement tracked under L22 work).
- Rotation: rotate at source (Supabase/console.anthropic) → update Vercel env → next deploy picks it up. Runtime secrets in SQL/edge land via vault (`fn_get_secret`) — never in code (L21).
- Env changes do NOT retro-apply to built deployments (a rolled-back build keeps its baked env).

## §9 — Troubleshooting (fast table)

| Symptom | Cause → fix |
|---|---|
| Change shipped, page unchanged in browser | Service worker cache: DevTools → Application → Unregister SW + Clear site data + hard reload (or incognito). Green checks + fresh curl prove it's client-side |
| Page renders $0 / empty, SQL works | L5 bridge gap (grant/view), not RLS |
| `gl.*` reads all `[]` | `SUPABASE_SERVICE_ROLE_KEY` missing on Vercel (§8) |
| `Module not found ./x` | Dependency never landed — verify protocol §3.3 |
| Failed compile in 15–20s | prebuild orphan gate (§7) |
| Digest error at runtime, build green | JSX component defined inside async RSC — `rules/frontend.md` |
| Ready on main but not live | Promotion gate: check `promotion_log` (checks red or soak pending) |
| Prod frozen on old build | Intermediate red commit (push-order law) — get HEAD green, push a `.deploy-marker` commit |

## §10 — Moved / superseded (do not resurrect)

- CLI deploy recipes, `vercel link/env pull/alias set/ls` — BANNED; history only.
- pg_cron inventory snapshot — **query `cron.job`** (L14); never list crons in this doc.
- Route-by-route release notes (v12–v15) — belong to `cockpit_change_log` + module docs.
- Bulk-import (edge fn + RPC batching) and signed-URL upload patterns — moved to `api` doc (pointer: dms holds the originals in v16 history).
- ship-from-ticket autonomous shipper — documented in `loop_operations`; cron inactive by PBS decision.
- `v_current_prod` — retired; §4 is the verification set.

## §11 — Domains (ADR-284, 2026-08-10)

Vercel project `namkhan-bi` (team `pbsbase-2825s-projects`) serves Production on **two** hostnames. Both are legal; neither may be deleted.

| Host | Role | DNS | Rule |
|---|---|---|---|
| `app.beyondcircle.ai` | **Canonical** human-facing host | Cloudflare: `CNAME app -> eeb17ed579c07248.vercel-dns-017.com` | Proxy status **DNS only (grey cloud)**. Orange cloud = Vercel "Invalid Configuration" + no TLS cert. Cloudflare Flexible SSL = redirect loop. |
| `namkhan-bi.vercel.app` | **Permanent machine alias** | Vercel-managed | NEVER remove. 24 pg_cron jobs + `cockpit.webhook_config` call it. |
| `beyondcircle.ai` (apex) | Reserved — Phase 2 marketing site / conversion funnel | unpointed | Do NOT alias to the app. |
| `staging.beyondcircle.ai` | Planned -> `namkhan-pms-staging` | not created | Open item. |

**Canonical base URL is `public.fn_app_base_url()`** — read it, never hardcode a host. `public.v_app_hosts` lists every legal host and its role.

Laws:
- **Add, never replace.** A new host goes in alongside the old; an alias is retired only after every consumer is migrated and proven.
- **Never hardcode a hostname** in code, SQL, cron, agent prompts or docs. Emit relative links, or read `fn_app_base_url()` (constitution §0.7 tenant URL shape).
- **OAuth/webhook callbacks**: register the new host ALONGSIDE the old (Google · Cloudbeds · Make · Supabase Auth redirect URLs `https://app.beyondcircle.ai/**`). Never swap.
- **Cron migration is a batched follow-up**, not part of a domain cutover. Audit: `SELECT jobid, jobname FROM cron.job WHERE command ILIKE '%namkhan-bi.vercel.app%'`.
- Promotion pipeline is unchanged: ADR-222 still owns what reaches production; domains are aliases onto the promoted build.

---
*Update history: v18 · 2026-08-10 — NEW §11 Domains (ADR-284: beyondcircle.ai acquired at Cloudflare; app.beyondcircle.ai added as an ADDITIONAL Production domain, vercel.app alias retained permanently, apex reserved for marketing). Canon-doc render trigger fixed the same session (WITH ORDINALITY) — canon docs had been unwritable since 2026-08-09. v17 · 2026-08-09 — canon-5 sweep slice 1 (constitution v5.0 programme, ADR-279/280/282). 49k→~11k. CLI-era prose deleted (history preserved), cron snapshot deleted (query live), route changelogs removed, ADR-222 promotion gate made §1-tier truth, NEW §6 expand-contract DDL law (research-backed), §7 honest gates inventory incl. ignoreBuildErrors ratchet path. Prior v16 in documents_history.*