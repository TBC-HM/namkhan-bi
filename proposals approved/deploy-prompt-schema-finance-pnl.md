# Schema deploy prompt — /finance/pnl supporting tables

**Source proposal:** `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/schema-gap-analysis.md`
**Approved on:** 2026-04-30
**Target:** Supabase project `namkhan-pms` (`kpenyneooigsyuuomgct`)
**Scope:** 8 schema additions (tables + views + functions) that unblock /finance/pnl tiles currently tagged "Data needed"

## Paste this into a fresh Claude Code session with Supabase MCP connected

```
ROLE
You are a senior data engineer applying Supabase migrations to project namkhan-pms (kpenyneooigsyuuomgct). You ship one migration file per gap, named phase1_NN_<scope>.sql, in the order below. Each migration is idempotent (CREATE IF NOT EXISTS, ON CONFLICT DO NOTHING). RLS policies are added in the same migration that creates a table — never as a separate afterthought.

GOAL
Apply 8 migrations that unblock the /finance/pnl page. Full DDL specs live in:
  /Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/schema-gap-analysis.md

KNOWLEDGE TO LOAD FIRST
- ~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md  (current schema state, RLS conventions, migration naming)
- ~/Desktop/cbfiles/supabase/00_INDEX.md                   (KPI skill library — DO NOT duplicate; extend)
- ~/Desktop/cbfiles/supabase/05_PERIOD_HELPERS_SDLY.md     (the kpi.* foundation; new functions follow this pattern)

MIGRATION SEQUENCE (do not reorder)
  phase1_13_usali_expense_map.sql     — Gap 2: gl.usali_expense_map + gl.v_pnl_usali + RLS (read=all auth, write=top-level)
  phase1_14_materiality.sql           — Gap 3: gl.materiality_thresholds + global default seed (5% / $1,000)
  phase1_15_dept_labour.sql           — Gap 1: ops.payroll_daily + kpi.v_dept_labour_ratio_daily + kpi.dept_labour_band_breach()
  phase1_16_decision_queue.sql        — Gap 8: governance.decision_queue + 4-eyes CHECK constraint + index
  phase1_17_commentary_drafts.sql     — Gap 5: gl.commentary_drafts + gl.publish_commentary() with audit_log emit
  phase1_18_flow_through.sql          — Gap 7: kpi.flow_through() (DEPENDS ON phase1_13 — fail if missing)
  phase1_19_cash_forecast.sql         — Gap 4: gl.cash_forecast_weekly + view kpi.v_cash_runway_weeks
  phase1_20_vendor_benchmarks.sql     — Gap 6: ops.vendor_benchmarks + ops.v_vendor_cost_drift

ACCEPTANCE CRITERIA (binary, per migration)
[ ] CREATE IF NOT EXISTS / ON CONFLICT DO NOTHING — idempotent
[ ] RLS policies attached: read=all authenticated, write=app.is_top_level() unless documented otherwise
[ ] Comments on every column (Supabase introspection picks this up)
[ ] Listed in 15_SUPABASE_ARCHITECTURE.md migration history with row counts after apply
[ ] Smoke test query in the migration's epilogue (commented) demonstrating it returns sane data

GLOBAL ACCEPTANCE
[ ] All 8 migrations applied without error
[ ] No existing kpi.* function broken (run kpi.snapshot(CURRENT_DATE - 30, CURRENT_DATE - 1) — must still return 13 rows)
[ ] No existing RLS policy weakened
[ ] 247 → 247+N policies live (count goes up, never down)
[ ] Update ~/Desktop/cbfiles/supabase/15_SUPABASE_ARCHITECTURE.md migration history with new rows for phases 13–20
[ ] Drop a marker file ~/Desktop/namkhan-bi/proposals approved/deploy-prompt-schema-finance-pnl.shipped on success

TOOLS
- Use Supabase MCP for inspection (list_tables, list_extensions, list_migrations, execute_sql for read-only checks)
- Use Supabase MCP `apply_migration` for the writes (NOT execute_sql for DDL — apply_migration tracks history)
- For destructive verification, use the dev branch: create_branch → run migrations → check → merge_branch
  Owner has not explicitly authorized destructive writes on production. Branching is mandatory.

DON'T
- Don't apply against main without first applying to a dev branch and verifying.
- Don't drop or alter any existing table.
- Don't bypass RLS even with service_role unless explicitly required (and document the reason).
- Don't add a migration outside the phase1_NN_ naming convention.
- Don't extend kpi.* with functions that bypass usali_category_map — the map is the contract.

ROLLBACK PLAN
- Each migration must include a corresponding -- DOWN block at the bottom (commented) showing exactly how to revert.
- If a migration fails after partial apply, run the DOWN block, fix, re-apply.

REPORT BACK (write into ~/Desktop/namkhan-bi/to vercel production /deploy-doc-schema-finance-pnl-2026-04-30.md)
- Migration name + applied_at timestamp + applied_by per row
- Row counts post-apply for each new table (most will be 0 except materiality seed = 1)
- Updated 15_SUPABASE_ARCHITECTURE.md diff summary (count of policies, tables, schemas)
- Smoke test outputs for kpi.snapshot, v_pnl_usali, dept_labour_ratio_daily
- Append a row to ~/Desktop/namkhan-bi/to vercel production /_LOG.md
- On success, create the .shipped marker

START.
```

---

## Owner-side review checklist (before approving this prompt)

- [ ] Confirm the table-naming convention (`gl.*`, `ops.*`, `governance.*`, `kpi.*`) matches the live schema map in `15_SUPABASE_ARCHITECTURE.md`.
- [ ] Confirm the materiality default (5% AND $1k) is acceptable as a starting threshold.
- [ ] Confirm the 4-eyes rule for GL writes ≥ $1k — keep, or relax to GM-only?
- [ ] Confirm the RLS pattern (read=all authenticated, write=top-level) matches what /revenue uses today.

If any item above is wrong, edit this prompt before moving it into `proposals approved/`.
