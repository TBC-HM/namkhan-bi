# Deploy doc — schema / finance-pnl supporting tables

**Date prepared:** 2026-04-30
**Source approval:** `~/Desktop/namkhan-bi/proposals approved/deploy-prompt-schema-finance-pnl.md`
**Source gap analysis:** `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/schema-gap-analysis.md`
**Status:** prepared (awaiting deploy session)
**Target:** Supabase project `namkhan-pms` (`kpenyneooigsyuuomgct`)

---

## Scope

Apply 8 idempotent migrations that unblock `/finance/pnl` tiles currently tagged "Data needed". All migrations follow the existing `phase1_NN_<scope>.sql` naming convention. RLS policies attached in the same migration that creates a table.

## Migration sequence (do not reorder)

| # | Migration | Schema additions | Unblocks |
|---|---|---|---|
| 13 | `phase1_13_usali_expense_map.sql` | `gl.usali_expense_map`, `gl.v_pnl_usali` | A&G / S&M / IT / POM / Utilities rows · USALI Compliance Auditor |
| 14 | `phase1_14_materiality.sql` | `gl.materiality_thresholds` + global default seed (5% AND $1,000) | USALI grid coloring · Variance Detector firing rules |
| 15 | `phase1_15_dept_labour.sql` | `ops.payroll_daily`, `kpi.v_dept_labour_ratio_daily`, `kpi.dept_labour_band_breach()` | Labour Cost % tile · F&B labour 38% alert · Margin Leak Sentinel |
| 16 | `phase1_16_decision_queue.sql` | `governance.decision_queue` + 4-eyes CHECK constraint | Persistent queue across whole portal (priority — pull this forward) |
| 17 | `phase1_17_commentary_drafts.sql` | `gl.commentary_drafts`, `gl.publish_commentary()` | Variance Composer drafts |
| 18 | `phase1_18_flow_through.sql` | `kpi.flow_through()` | Flow-through % tile (depends on phase1_13) |
| 19 | `phase1_19_cash_forecast.sql` | `gl.cash_forecast_weekly` + view `kpi.v_cash_runway_weeks` | 13-week cash strip · Cashflow Agent storage |
| 20 | `phase1_20_vendor_benchmarks.sql` | `ops.vendor_benchmarks`, `ops.v_vendor_cost_drift` | Procurement Agent's first real alert |

## Deploy method

Use Supabase MCP `apply_migration` (NOT `execute_sql` for DDL — `apply_migration` tracks history). Mandatory branching:

```
1. mcp__supabase__create_branch(name="feat-finance-pnl-schema")
2. mcp__supabase__apply_migration(branch=..., name="phase1_13_usali_expense_map", query=...)
   ... (one per migration, in sequence)
3. Run smoke tests on the branch (queries listed below)
4. mcp__supabase__merge_branch  → main
5. mcp__supabase__delete_branch(name="feat-finance-pnl-schema")
```

## Smoke tests (run on the branch before merge)

```sql
-- existing kpi.* must still work
SELECT * FROM kpi.snapshot(CURRENT_DATE - 30, CURRENT_DATE - 1);
-- expect: 13 rows with metric / current / sdly / delta_pct columns

-- new tables exist with correct row counts
SELECT 'gl.usali_expense_map'        AS t, COUNT(*) FROM gl.usali_expense_map
UNION ALL SELECT 'gl.materiality_thresholds', COUNT(*) FROM gl.materiality_thresholds  -- expect 1 (global default)
UNION ALL SELECT 'ops.payroll_daily',           COUNT(*) FROM ops.payroll_daily          -- expect 0 until populated
UNION ALL SELECT 'governance.decision_queue',   COUNT(*) FROM governance.decision_queue
UNION ALL SELECT 'gl.commentary_drafts',        COUNT(*) FROM gl.commentary_drafts
UNION ALL SELECT 'gl.cash_forecast_weekly',     COUNT(*) FROM gl.cash_forecast_weekly
UNION ALL SELECT 'ops.vendor_benchmarks',       COUNT(*) FROM ops.vendor_benchmarks;

-- new views compile
SELECT * FROM gl.v_pnl_usali LIMIT 1;
SELECT * FROM kpi.v_dept_labour_ratio_daily LIMIT 1;
SELECT * FROM ops.v_vendor_cost_drift LIMIT 1;

-- new functions callable
SELECT * FROM kpi.flow_through(CURRENT_DATE - 30, CURRENT_DATE - 1);
SELECT * FROM kpi.dept_labour_band_breach('fb', CURRENT_DATE - 30, CURRENT_DATE - 1, 28.0, 32.0);

-- RLS policy count must go up, never down
SELECT COUNT(*) FROM pg_policies WHERE schemaname IN ('app','docs','governance','ops','public','plan','gl','kpi','fb','spa','activities','knowledge','training','guest','marketing','seo','alerts','auth_ext','dq');
-- expect: > 247 (was 247 pre-migration per 15_SUPABASE_ARCHITECTURE.md)
```

## Acceptance criteria

- [ ] All 8 migrations applied via `apply_migration` (tracked in `supabase_migrations.schema_migrations`)
- [ ] No existing `kpi.*` function broken (snapshot returns 13 rows)
- [ ] RLS policy count strictly increased
- [ ] Each new table has read-RLS = `authenticated` and write-RLS = `app.is_top_level()` unless documented
- [ ] Each migration has a commented `-- DOWN` block at the bottom
- [ ] `~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md` updated with new rows (migrations 13–20, schemas table, RLS count)

## Risks / blockers

- `phase1_18_flow_through.sql` depends on `phase1_13_usali_expense_map.sql` — fail if the join target doesn't exist. The sequence above respects this.
- Materiality default (5% AND $1k) is a guess — owner-configurable. Confirm with owner before applying or relax to `top_level` write so it can be tuned without a migration.
- 4-eyes CHECK constraint on `governance.decision_queue` may surprise the frontend. Document clearly in the page's onClick handler.
- `gl.entries` is referenced in `gl.v_pnl_usali` — verify column shape exists in `gl` schema before running phase1_13. If `gl` schema's existing table is named differently (e.g. `gl.posting`), adjust the view DDL.

## Post-deploy actions

- Create the marker: `touch '~/Desktop/namkhan-bi/proposals approved/deploy-prompt-schema-finance-pnl.shipped'`
- Append a row to `_LOG.md` in this folder
- Notify the frontend deploy session that gaps are closed; `lib/pnl.ts` fetchers can flip from `{wired:false}` to actual queries
- Update `~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md` migration history table

---

**Status flips:** `prepared` → `in-progress` (when Claude Code + Supabase MCP session starts) → `shipped` (when `.shipped` marker drops) or `failed` (with reason).
