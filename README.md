# Namkhan BI

Read-only operator dashboard for The Namkhan (Luang Prabang).
Reads from Supabase project `namkhan-pms` (ref `kpenyneooigsyuuomgct`).

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
| 10 | `10_RECOMMENDATIONS_ENGINE.md` | …Phase 4 recommendation logic |
| 11 | `11_BRAND_AND_UI_STANDARDS.md` | …visual identity rules |
| 12 | `12_BACKLOG_AND_ROADMAP.md` | …what's next, with current status |
| 13 | `13_PHASE1_SYNC_AUDIT.md` | …what got synced from Cloudbeds |
| 14 | `14_MOCKUP_VS_DATA_AUDIT.md` | …mockup-feasibility scorecard |
| 15 | `15_SUPABASE_ARCHITECTURE.md` | …full schema, agents, mandates, RLS |
| 16 | `16_SESSION_HANDOFF.md` | …backlog F1–F11, E1–E8, D1–D5 (stub awaiting import) |
| 17 | `17_DEPLOYMENT_GUIDE.md` | …ops reference (deploy, refresh, rotate, recover) |
| — | `CONTRIBUTING.md` | …branching, PRs, migration workflow |
| — | `CHANGELOG.md` | …version history |

> **Important:** the same docs are also mirrored in the Claude Project Knowledge.
> When you edit a doc here, re-upload it to the project (drag-drop) so chat context stays current.

## Tab status (snapshot)

| Tab | Status | Notes |
|---|---|---|
| Overview | LIVE | Headline KPIs, 90d revenue chart, channel teaser |
| Today's Snapshot | LIVE | Arrivals/departures/in-house live; F&B/Spa/Activities-today greyed |
| Action Plans | GREY | Vertex recommendations engine pending (Phase 4) |
| Revenue · Pulse / Demand / Channels / Rates / Rate Plans / Inventory | LIVE | |
| Revenue · Comp Set / Promotions | GREY | Phase 2 |
| Departments · Roots / Spa & Activities | LIVE | Therapist util / packages greyed |
| Finance · P&L | LIVE (revenue) | Expense side GREY (cost upload pending) |
| Finance · Budget | GREY | Awaiting upload schema |
| Finance · Ledger | LIVE | In-house balance, aged AR, city ledger |

## Environment variables

| Var | Meaning | Where to find |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kpenyneooigsyuuomgct.supabase.co` | hardcoded |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Supabase → Project Settings → API → `anon public` |
| `DASHBOARD_PASSWORD` | Single password for the login gate | pick anything strong; share with team out-of-band |
| `NEXT_PUBLIC_FX_LAK_USD` | LAK per USD (default 21800) | adjust as FX shifts |
| `NEXT_PUBLIC_PROPERTY_ID` | Cloudbeds property ID | `260955` |

## Refresh schedule

In Supabase SQL editor (one-off after deploy):

```sql
SELECT cron.schedule(
  'refresh_bi_views',
  '*/15 * * * *',
  'SELECT public.refresh_bi_views();'
);
```

If `pg_cron` is not enabled: Database → Extensions → enable `pg_cron`.

## Database changes — read this before touching Supabase

The Supabase schema is now version-controlled in [`/supabase/migrations/`](./supabase/).

- **DO NOT** make schema changes via the Supabase dashboard UI.
- **DO** create a migration: `npx supabase migration new <name>` → edit SQL → commit → PR.
- **DO** test against a local stack (`supabase start` + `supabase db reset`) before merging.
- **CI** posts `supabase db diff --linked` on every PR that touches `supabase/migrations/**` (read-only).
- **Apply to cloud** = `npx supabase db push` from `main` after the PR merges. Manual in v1.
- **Rollback** = revert the merge commit + write a new reversal migration + push.

See [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) for the full migration workflow.

## Repo layout

```
namkhan-bi/
├── README.md                   # this file
├── DEPLOY.md                   # click-by-click first deploy
├── docs/                       # canonical knowledge base
│   ├── 00_README.md            # project status and index
│   ├── 01..17_*.md             # spec docs
│   ├── 15_SUPABASE_ARCHITECTURE.md
│   ├── 16_SESSION_HANDOFF.md
│   ├── 17_DEPLOYMENT_GUIDE.md
│   ├── CONTRIBUTING.md
│   └── CHANGELOG.md
├── supabase/                   # database-as-code (single source of truth)
│   ├── config.toml             # CLI config
│   ├── migrations/             # timestamped .sql, applied in order
│   ├── functions/              # edge functions (placeholder)
│   ├── seed.sql                # local-dev seed (NOT applied to prod)
│   └── README.md               # workflows: pull/push/diff/reset
├── .github/workflows/          # ci.yml (lint+typecheck+build) · supabase-diff.yml (PR diff)
├── app/                        # Next.js routes
│   ├── layout.tsx              # Root layout w/ brand + nav
│   ├── login/page.tsx          # Password gate UI
│   ├── api/login/route.ts      # Sets auth cookie
│   ├── overview/               # Owner overview
│   ├── today/                  # Today's snapshot
│   ├── actions/                # Recommendations (grey)
│   ├── revenue/                # Pulse / Demand / Channels / Rates / Rate Plans / Inventory / Comp Set / Promotions
│   ├── departments/            # Roots / Spa & Activities
│   └── finance/                # P&L / Budget / Ledger
├── components/
│   ├── nav/                    # Brand, TopNav, SubNav
│   ├── kpi/Kpi.tsx             # KPI card with USD/LAK toggle
│   ├── charts/                 # Daily revenue, monthly USALI
│   ├── sections/Section.tsx    # Section wrapper, grey-out helper
│   └── ui/CurrencyToggle.tsx   # USD ↔ LAK
├── lib/
│   ├── supabase.ts             # Client, PROPERTY_ID
│   ├── data.ts                 # Server fetchers + aggregators
│   └── format.ts               # Money/pct/number/date helpers
├── middleware.ts               # Password gate enforcement
├── styles/globals.css          # Soho-house casual luxury palette
└── (config files)              # next.config.js, tailwind.config.js, tsconfig.json, etc.
```
