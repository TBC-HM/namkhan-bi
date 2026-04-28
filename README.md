# Namkhan BI

Read-only operator dashboard for The Namkhan (Luang Prabang).
Reads from Supabase project `namkhan-pms` (ref `kpenyneooigsyuuomgct`).

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
| 15 | `15_DEPLOYMENT_GUIDE.md` | …ops reference (deploy, refresh, rotate, recover) |
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

## Repo layout

```
namkhan-bi/
├── README.md                   # this file
├── DEPLOY.md                   # click-by-click first deploy
├── docs/                       # canonical knowledge base
│   ├── 00_README.md            # project status and index
│   ├── 01..15_*.md             # spec docs
│   ├── 13_PHASE1_SYNC_AUDIT.md
│   ├── 14_MOCKUP_VS_DATA_AUDIT.md
│   └── CHANGELOG.md
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
