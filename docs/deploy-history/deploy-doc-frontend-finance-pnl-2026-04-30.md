# Deploy doc — frontend / /finance/pnl

**Date prepared:** 2026-04-30
**Source approval:** `~/Desktop/namkhan-bi/proposals approved/deploy-prompt-finance-pnl.md`
**Source IA proposal:** `/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/proposals/2026-04-30-finance-pnl/`
**Status:** awaiting deploy session
**Target route:** `https://namkhan-bi.vercel.app/finance/pnl`

---

## Scope

Ship a Next.js page at `/finance/pnl` rendering all 9 mandatory blocks per `_revenue-standard.md`, branded to match the live `/revenue/pulse` (cream surface, forest-green rail, tan accents). Tiles that lack a wired Supabase source ship with the **"Data needed"** badge and a tooltip naming the missing source — they do NOT fake live data.

## Repo + branch

- Repo: `/Users/paulbauer/Desktop/namkhan-bi`
- Base branch: `revenue-redesign-v2` (NOT `main`)
- Working branch: `feat/finance-pnl`
- Vercel project: `namkhan-bi` (`prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl`, region `fra1`)

## Files to create / modify

```
app/finance/pnl/page.tsx              [new]   server component, all 9 blocks
app/finance/pnl/_components/
  KpiGrid.tsx                         [new]   primary 6 + secondary 5
  AgentStrip.tsx                      [new]   4 chips + Fire-all
  DecisionQueue.tsx                   [new]   5 rows + actions
  TacticalAlerts.tsx                  [new]   severity-bordered cards
  UsaliGrid.tsx                       [new]   USALI 11th ed table with materiality coloring
  CommentaryPanel.tsx                 [new]   draft-only, never auto-publish
  CashStrip.tsx                       [new]   13-week cash forecast
  HeatmapPanel.tsx                    [new]   margin-leak heatmap
  GuardrailsBanner.tsx                [new]   yellow finance-writes banner
lib/pnl.ts                            [new]   fetchers; { wired:false, value:null } until schema lands
lib/format.ts                         [touch] add fmtPp (percentage points), fmtUsdK
app/finance/layout.tsx                [check] confirm filter persistence into other finance sub-tabs
```

## What can be wired NOW (no schema work needed)

| Tile / Panel | Source |
|---|---|
| Total Revenue | `kpi.metric('total_revenue', from, to)` |
| GOP $ proxy (Departmental Profit) | `transactions` × `usali_dept` aggregates |
| GOP margin % | derived in `lib/pnl.ts` |
| Variance vs Budget | `plan` schema join |
| Variance vs LY | `kpi.metric_compare(metric, from, to, 365)` |
| F&B subdept split | `kpi.fb_outlet_summary()` |
| Source / country / room-type cuts | `kpi.metric_by_dim()` |
| Active agents (Variance, Cashflow) | `governance.agents` + `agent_prompts` |
| Capacity facts | `public.v_property_totals` |
| Margin leak heatmap (revenue side) | derived from `transactions` |

## What ships as "Data needed" (gated by schema migration — see schema deploy doc)

| Tile / Panel | Blocked by gap |
|---|---|
| Labour Cost % tile | Gap 1 — `ops.payroll_daily` |
| F&B labour 38% Tactical Alert | Gap 1 |
| Margin Leak Sentinel real outputs | Gap 1 |
| A&G / S&M / IT / POM / Utilities rows | Gap 2 — `gl.usali_expense_map` |
| USALI Compliance Auditor real outputs | Gap 2 |
| USALI grid red/amber/green coloring | Gap 3 — `gl.materiality_thresholds` |
| 13-week cash strip | Gap 4 — `gl.cash_forecast_weekly` |
| Variance Composer drafts (persisted) | Gap 5 — `gl.commentary_drafts` |
| "Renegotiate beverage supplier" decision card | Gap 6 — `ops.vendor_benchmarks` |
| Flow-through % tile | Gap 7 — `kpi.flow_through()` (depends on Gap 2) |
| Persistent decision queue (any approve/snooze actions) | Gap 8 — `governance.decision_queue` |

## Deploy ritual (do not improvise)

```bash
cd ~/Desktop/namkhan-bi && git checkout revenue-redesign-v2 && git pull
git checkout -b feat/finance-pnl
# implement
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
npx --yes tsc --noEmit                            # MANDATORY clean
git add -A && git commit -m "feat(finance): /finance/pnl per IA proposal 2026-04-30 — placeholder data gated"
git push -u origin feat/finance-pnl
nohup '/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/deploy-namkhan-bi.command' > /tmp/nb_force.log 2>&1 & disown
tail -10 /tmp/nb_force.log
```

## Verification (binary)

```bash
curl -sI https://namkhan-bi.vercel.app/finance/pnl                         # expect 200
curl -sL https://namkhan-bi.vercel.app/finance/pnl | grep -E "Profit & loss|where the.*margin|USALI|Data needed"
curl -sI https://namkhan-bi.vercel.app/revenue/pulse                       # regression — expect 200
curl -sI https://namkhan-bi.vercel.app/revenue/pace                        # regression — expect 200
curl -sI https://namkhan-bi.vercel.app/revenue/channels                    # regression — expect 200
```

## Acceptance criteria

- [ ] `curl -sI /finance/pnl` → 200
- [ ] All 9 blocks present in DOM
- [ ] Primary 6 + secondary 5 KPI tiles render
- [ ] Tabular sans-serif numerals on KPI values, italic serif on labels
- [ ] Branded skin (cream / forest-green / tan)
- [ ] Yellow guardrails banner present
- [ ] Every unwired tile shows "Data needed" badge with tooltip naming the missing gap (Gap 1–8)
- [ ] No agent calls any external API (modals are static)
- [ ] No regression on `/revenue/*`
- [ ] `tsc --noEmit` clean
- [ ] Branch is `feat/finance-pnl`, not `main`

## On success

- Drop `~/Desktop/namkhan-bi/proposals approved/deploy-prompt-finance-pnl.shipped` (empty file is fine)
- Append a row to `_LOG.md` in this folder
- Owner reviews live page; if approved, fast-forward `feat/finance-pnl → revenue-redesign-v2`

## Risks / blockers

- Without Gap 8 (`governance.decision_queue`), the Approve / Send back / Snooze buttons are local-state only. Plan: ship UI now, wire to backend after Gap 8 migration.
- Without the brand serif name confirmed by the design pass, mockup uses Cormorant Garamond as a stand-in. Easy swap when confirmed.
- Cloudbeds doesn't expose GL — this entire page is read-only on Cloudbeds side. No write-API risk.

---

**Status flips:** `prepared` → `in-progress` (when Claude Code session starts) → `shipped` (when `.shipped` marker drops) or `failed` (with reason).
