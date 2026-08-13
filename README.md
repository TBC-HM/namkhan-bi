> **⚠️ STALE — This file is legacy documentation**
>
> Canonical platform architecture and deployment guide now live in the database
> (`documentation.documents`, rendered via the knowledge system). This file is
> kept for historical reference only.

# Namkhan BI

Read-only operator dashboard for The Namkhan (Luang Prabang).
Reads from Supabase project `namkhan-pms` (ref `kpenyneooigsyuuomgct`).

> **🎨 Design system — READ FIRST before any UI change**
>
> - **`DESIGN_NAMKHAN_BI.md`** (repo root) — canonical reference + locked rules + update history
> - **`docs/11_BRAND_AND_UI_STANDARDS.md`** — full spec for `<KpiBox>`, `<DataTable>`, `<StatusPill>`, `<PageHeader>`
> - **`CLAUDE.md`** (repo root) — instructions auto-loaded by AI coding agents (Claude Code, Cursor, etc)
>
> Reference page: [/sales/inquiries](https://namkhan-bi.vercel.app/sales/inquiries) — every other page must match its typography / hierarchy / surface. Mandatory session ritual for AI sessions: read `DESIGN_NAMKHAN_BI.md` at start, append a `### YYYY-MM-DD` changelog entry at end. Auto-cycle locked 2026-05-03.

## Status

- **Live:** https://namkhan-bi.vercel.app (password-gated — `DASHBOARD_PASSWORD`)
- **Last verified:** 2026-05-01
- **CI:** [![CI](https://github.com/TBC-HM/namkhan-bi/actions/workflows/ci.yml/badge.svg)](https://github.com/TBC-HM/namkhan-bi/actions)
- **Vercel:** auto-deploys on push to `main` *(currently CLI-only — see `DEPLOY.md`)*
- **Supabase:** schema in [`/supabase/migrations/`](./supabase/) — single source of truth, **not** the dashboard

## 🛠 Active engineering handoffs

> Cowork (or any engineer): start here before opening a PR.

### Open

| Handoff | Status | Owner | Path |
|---|---|---|---|
| _none open_ | — | — | (last completed: [`KPI capacity-mode toggle + period-aware pages`](./docs/handoffs/done/COWORK_HANDOFF_2026-05-01.md) ✅ 2026-05-01) |

### How to read a handoff doc

Each handoff in `docs/handoffs/` follows the same shape:

1. **TL;DR** — one paragraph on what's done vs what's left
2. **Current state table** — backend / frontend / cron status
3. **Files to change** — exact paths with replace / patch / delete actions
4. **Apply order** — exact `git` commands to run
5. **Verification checklist** — clickable tests on Vercel preview
6. **Risk register** — what could go wrong + mitigation
7. **Revert plan** — last good commit hash

### Important conventions

- **Never push directly to `main`.** Branch + PR + Vercel preview verification + merge.
- **Backend changes (Supabase) are applied separately from frontend PRs.** A handoff doc will tell you if the backend is already live (most are).
- **If a verification test fails on preview, REVERT, do not push fixes blindly.**
- **Last good commit** is always called out in the handoff. Memorize it before starting.

### After completing a handoff

Move the file from `docs/handoffs/` to `docs/handoffs/done/` with a one-line summary appended at the top:

```markdown
> ✅ Completed YYYY-MM-DD by [name]. Merged via PR #XXX.
```

This keeps the open list clean and creates a permanent audit trail.

### Stack reminder

- **Frontend:** Next.js 14 App Router on Vercel
- **Backend:** Supabase Postgres (project `kpenyneooigsyuuomgct` = namkhan-pms)
- **Source data:** Cloudbeds PMS (property `260955` = The Namkhan, Luang Prabang)
- **Build:** `npm run build` must succeed before any push
- **Smoke test:** `npm run dev` → http://localhost:3000

### Anti-patterns to avoid

| Don't | Why |
|---|---|
| Hardcode `19` anywhere | Capacity is 24 (selling) or 30 (total). Use `v_property_inventory` or `?cap=` mode. |
| Use `count(DISTINCT reservation_id)` for room counts | Multi-room bookings undercount. Use `count(*)` from `reservation_rooms`. |
| Compute ADR as `total_amount / nights` | Group bookings inflate this. Use `sum(rate) / sum(roomnights)` from `reservation_rooms`. |
| Hardcode windows (90d, 30d) in pages | All pages must call `resolvePeriod(searchParams)` and respect `?win=`. |
| Create matviews without unique indexes | Cron's `REFRESH CONCURRENTLY` will fail silently for days. |
| Drop a view with `CASCADE` | Will silently drop dependent matviews. Use `DROP ... RESTRICT` and recreate dependents in the same migration. |

### When in doubt

Read the most recent handoff doc end-to-end before touching anything. Each handoff documents the bugs that motivated the change, so you understand the constraints before writing code.

---

## Stack
- Next.js 14 (app router) + TypeScript
- Tailwind CSS + Recharts
- Supabase JS client (anon key, read-only on materialized views)
- Single-password gate (env `DASHBOARD_PASSWORD`)
- Hosted on Vercel · DB on Supabase

## Quick deploy

See **[DEPLOY.md](./DEPLOY.md)** for the literal click-by-click. ~10 minutes total.

Summary:
1. Push this folder to a private GitHub repo `namkhan-bi`
2. Vercel → New Project → Import → set 5 env vars → Deploy
3. After ~2 min, visit the assigned URL → enter `DASHBOARD_PASSWORD`

## Knowledge base

The `/docs/` folder is the canonical reference for the entire COI project (Cloudbeds Ops Intelligence).
Read these files in order if you're new:

| # | File | Read this if you want to know… |
|---|---|---|
| 00 | `00_README.md` | …project status and where everything lives |
| 01 | `01_SCOPE_AND_MODULES.md` | …the four modules and their dependencies |
| 02 | `02_CLOUDBEDS_API_REFERENCE.md` | …which Cloudbeds endpoints we call and quirks discovered |
| 03 | `03_DATA_MODEL_AND_FIELDS.md` | …Supabase tables, mat views, and field validation |
| 04 | `04_USALI_MAPPING.md` | …how transactions get tagged with USALI dept/subdept |
| 05 | `05_KPI_DEFINITIONS.md` | …every KPI formula and its source view |
| 06 | `06_DATA_QUALITY_RULES.md` | …DQ rule library + operator-error patterns |
| 07 | `07_SOP_LIBRARY.md` | …SOP index for staff training (Phase 2) |
| 08 | `08_BI_DASHBOARDS_SPEC.md` | …each tab's KPIs, source view, and live/grey status |
| 09 | `09_VERTEX_ARCHITECTURE.md` | …Phase 4 ML architecture |
| 10 | `10_HANDOFF_TO_PBS.md` | …how to operate the BI portal after Claude leaves |
| 11 | `11_BRAND_AND_UI_STANDARDS.md` | …typography, colour tokens, layout grid, component variants |
| 12 | `12_TENANT_COMPARISON_SPEC.md` | …multi-property normalization + FX + TZ |

After that, the folders:

- **`handoffs/`** (active cowork items) · **`done/`** (completed cowork handoffs with timestamps)
- **`deploy/`** (literal step-by-step for Vercel + Supabase)
- **`decisions/`** (ADR-style rationale for every non-obvious choice)

## Scripts

| Command | Does what |
|---|---|
| `npm run dev` | Dev server on :3000 |
| `npm run build` | Next build (= Vercel's deploy command) |
| `npm run start` | Serve production build |
| `npm run typecheck` | TypeScript errors without emitting |

## Maintenance rituals

| Interval | Action | Where |
|---|---|---|
| Every commit | Build must succeed | `npm run build` |
| Every PR | Vercel preview must load all pages | Click nav tree |
| Daily | Sync Cloudbeds → materialized views | Cron (already scheduled) |
| Weekly | Review DQ anomalies | `/data-quality` tab |
| Monthly | Update `11_BRAND_AND_UI_STANDARDS.md` if new component added | File PR |

## Future modules

| Module | Status | Path | Launch |
|---|---|---|---|
| M1 (BI dashboards) | ✅ live | `/dashboard` | 2026-04-29 |
| M2 (Action Center) | 🚧 partial | `/action-center` | 2026-05-03 target |
| M3 (Agent fleet) | ⏸ paused | `/agents` | 2026-Q2 |
| M4 (Predictive) | 📋 planning | `/forecast` | 2026-Q3 |

## One-click fixes (common issues)

### Dashboard shows $0 everywhere

1. Check Supabase → SQL Editor → run `SELECT count(*) FROM mv_revenue_summary;`
2. If zero: trigger refresh via SQL Editor → `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_summary;`
3. Wait ~30s, reload dashboard

### Build fails on Vercel

1. Check the error log (click deployment → Build Logs)
2. If "module not found": likely a case-sensitivity error in the import path (macOS allows it, Vercel Linux doesn't)
3. If TypeScript errors: run `npm run typecheck` locally and fix before pushing

### Can't log in

- Password gate uses `DASHBOARD_PASSWORD` env var on Vercel
- If you changed it: redeploy (Vercel needs a new build to pick up env changes)

---

## Handover status

**Claude Code session handover — 2026-05-01 morning**

All files you need are in `/docs/handoffs/`. Start at `00_README.md` → read in sequence → then apply the open handoff.

**Current open handoff:** _none_ (last completed: capacity-mode toggle, 2026-05-01)

The entire codebase structure is documented. Every non-obvious decision has a file in `/docs/decisions/`. If you see something that doesn't make sense, read its rationale file first before changing.

Welcome aboard! 🚀