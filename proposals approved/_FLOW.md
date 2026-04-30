# Approved-Proposals Flow

This folder is the **inbox** for items the owner has approved for development and deployment.

Two types of approved items live here:
1. **`deploy-prompt-<section>-<tab>.md`** → frontend page deploy (Next.js route on Vercel)
2. **`deploy-prompt-schema-<scope>.md`** → Supabase schema migration (DDL via Supabase MCP)

## Contract for the scheduled task (every run, in order)

1. **Scan this folder** for any `deploy-prompt-*.md` file without a sibling `*.shipped` marker.
2. **Classify** each unshipped item as `frontend` or `schema` by filename prefix.
3. **Generate the deploy doc** and save it to `~/Desktop/namkhan-bi/to vercel production /` named:
   - `deploy-doc-frontend-<section>-<tab>-<YYYY-MM-DD>.md` for frontend
   - `deploy-doc-schema-<scope>-<YYYY-MM-DD>.md` for schema
4. **Append a row to** `~/Desktop/namkhan-bi/to vercel production /_LOG.md` with: date · scope · branch · commit · status · live URL or migration name.
5. **After the actual deploy session ships,** the deploy session drops `<original-name>.shipped` here. Do NOT create that marker from the proposal pipeline — only the deploy session does, after a green build.

## What goes in here (input)

Pre-staged by the IA designer in each proposal folder:
- `deploy-prompt-<section>-<tab>.md`           (frontend)
- `deploy-prompt-schema-<section>-<tab>.md`    (schema)

Owner approves by **moving** (or copying) the prompt file from the proposal folder into THIS folder. That single move is the approval signal.

## What goes in `to vercel production /` (output)

- One `deploy-doc-*.md` per shipment
- One `_LOG.md` shared ledger
- (Optional) screenshots, build receipts, migration plan exports

## Hard rules

- Never deploy an item that is not in this folder. No bypass.
- Frontend: never deploy without `npx tsc --noEmit` clean + `--force` flag.
- Frontend: never push to `main`. Stay on `feat/<route>` until owner approves merge.
- Schema: never apply a destructive migration (DROP, TRUNCATE, RLS removal) without 4-eyes approval recorded in the deploy doc.
- Schema: every migration goes through `phase1_<NN>_*` naming convention.
- Cloudbeds writes always require human approval until the 90-day validation window passes.
- Every "Data needed" tile must say so honestly — never fake live data.

## Knowledge the next agent must load before acting on any item here

Read at the start of every run:
- `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/_revenue-standard.md`
- `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/_ci-reference.md`
- `~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md`
- `~/Desktop/cbfiles/supabase/00_INDEX.md` (KPI skill library index)
- `~/Desktop/cbfiles/supabase/05_PERIOD_HELPERS_SDLY.md` (the `kpi.*` foundation)

These are the canonical truths. Treat anything contradicting them as stale.
