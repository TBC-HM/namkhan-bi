# 00 — README

## Project: Cloudbeds Ops Intelligence (COI)
**Property:** The Namkhan, Luang Prabang, Laos
**Owner:** Paul Bauer (PBS)
**Status:** Phase 1 (BI layer) LIVE · Phases 2-4 in progress
**Last update:** 2026-04-28

## Purpose
Single source of truth for The Namkhan's Cloudbeds operations:
**SOPs · Data Quality · BI/USALI KPIs · Vertex recommendations.**

## Current state at a glance

| Module | Status | Notes |
|---|---|---|
| **P1 — SOPs & Training** | NOT STARTED | Phase 2 |
| **P2 — Data Quality** | PARTIAL | DQ table seeded with 5 known issues. Agent v2 is Phase 2. |
| **P3 — BI/KPI Layer** | **LIVE** | 9 mat views in Supabase + Next.js dashboard on Vercel |
| **P4 — Recommendations Engine** | NOT STARTED | Phase 4. Requires 6 mo of clean data first. |

## Tech stack (actual, not aspirational)

| Layer | What | Where |
|---|---|---|
| PMS | Cloudbeds | property_id `260955` |
| Sync | Postgres edge function `sync-cloudbeds` (Deno) | Supabase project `kpenyneooigsyuuomgct` |
| Storage | Postgres 17 | Supabase eu-central-1 |
| BI views | 9 materialized views (refreshed via `pg_cron` every 15 min) | Supabase |
| Dashboard | Next.js 14 + Tailwind + Recharts | Vercel + GitHub repo `namkhan-bi` |
| Auth | Single password gate via cookie middleware | Vercel env `DASHBOARD_PASSWORD` |
| Future ML | Vertex AI | Phase 4 |

> ⚠️ **Note for future Claude:** earlier docs referenced BigQuery/GCP/Looker Studio.
> That was the original plan; we pivoted to Supabase + Vercel for speed.
> Vertex AI is still planned for Phase 4 ML, but BI lives on Supabase.

## How to use this folder
- These `.md` files are the canonical reference. Edit here, commit, push.
- The same files mirror to the Claude Project Knowledge for chat context.
- Reference docs by filename in prompts (e.g. "per `05_KPI_DEFINITIONS.md` §Rooms KPIs").
- **Never duplicate logic in chat** — fix the doc.

## Document index

| # | File | Status | Purpose |
|---|---|---|---|
| 00 | `00_README.md` | LIVE | Index + project status |
| 01 | `01_SCOPE_AND_MODULES.md` | LIVE | 4 modules, dependencies |
| 02 | `02_CLOUDBEDS_API_REFERENCE.md` | LIVE | Endpoints actually used + field-name discoveries |
| 03 | `03_DATA_MODEL_AND_FIELDS.md` | LIVE | Tables in Supabase, columns, owners |
| 04 | `04_USALI_MAPPING.md` | LIVE | Regex/ilike rules in `usali_category_map` |
| 05 | `05_KPI_DEFINITIONS.md` | LIVE | KPI formulas + their mat-view source |
| 06 | `06_DATA_QUALITY_RULES.md` | DRAFT | DQ rule library; agent v2 enforces |
| 07 | `07_SOP_LIBRARY.md` | DRAFT | SOP index for staff training |
| 08 | `08_BI_DASHBOARDS_SPEC.md` | LIVE | Tab spec for the deployed dashboard |
| 09 | `09_VERTEX_ARCHITECTURE.md` | DRAFT | Phase 4 ML plan |
| 10 | `10_RECOMMENDATIONS_ENGINE.md` | DRAFT | Phase 4 logic |
| 11 | `11_BRAND_AND_UI_STANDARDS.md` | LIVE | Visual identity rules |
| 12 | `12_BACKLOG_AND_ROADMAP.md` | LIVE | Phased plan with current status |
| 13 | `13_PHASE1_SYNC_AUDIT.md` | LIVE | Truth document on sync state |
| 14 | `14_MOCKUP_VS_DATA_AUDIT.md` | LIVE | Mockup feasibility scorecard |
| 15 | `15_DEPLOYMENT_GUIDE.md` | LIVE | Vercel deploy + post-deploy ops |

## Operating rules

- **USALI 11th edition** is the accounting standard.
- **LAK = base currency**, **USD = communication currency**, FX `21800` (revisit quarterly).
- **Cloudbeds is the sole revenue source.** Anything outside is out of scope.
- **No invented fields or logic** — cross-reference Cloudbeds API docs or developer forums.
- **All outputs branded** per `11_BRAND_AND_UI_STANDARDS.md`.
- **Senior consultant tone**: blunt, structured, ROI-focused, push back on weak logic.

## Where things live

| Asset | URL / Path |
|---|---|
| Supabase project | https://supabase.com/dashboard/project/kpenyneooigsyuuomgct |
| GitHub repo | `namkhan-bi` (private) |
| Production dashboard | (Vercel URL after deploy — see `15_DEPLOYMENT_GUIDE.md`) |
| Cloudbeds property | property_id `260955` |
| Cloudbeds API | `https://hotels.cloudbeds.com/api/v1.3/` (some endpoints v1.2) |
