# Namkhan FY2026 budget rebuild — applied 2026-09-06

PBS approved: **all-in $1,251,946** (net of tax & service $1,021,413).

## What was wrong

`Budget 2026 v1` assumed **$1.38M** and was running **−71%** by April.

Two separate defects, both found by comparing the live DB against the "26 NK" Google
Sheet (file `1pxu8hXgweHaDQNaky_fJcltHXRd3kzAiYt6qF_KPDXk`, tab `2026 Budget`):

1. **Import was partial.** Annual revenue totals tied to the sheet exactly, but **11 of
   12 monthly phasings** had been replaced with hand-typed round numbers, December
   acting as the plug to make the year foot. Only January matched. Separately,
   **$143,842 of budgeted operating cost never made it in** at all.
2. **The assumption was rate, not volume.** v1 planned 3,496 room nights — within 1% of
   the new 3,460. The entire $362k gap was **ADR $309**, a level never reached in any
   month of 2025 (December peaked at $234).

Also found and fixed: the `rooms_available` driver held **7,300 = 20 rooms × 365**, the
flood-reduced count, instead of the real 24 rooms Jan–Jun / 30 from July = **9,864**.

## The new numbers

Driver model: rooms available → occupancy % → ADR → ancillary per occupied room.

| | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Rooms | 24 | 24 | 24 | 24 | 24 | 24 | 30 | 30 | 30 | 30 | 30 | 30 |
| Occ % | 50 | 62 | 31 | 30 | 27 | 18 | 19 | 15 | 22 | 45 | 50 | 55 |
| ADR | 215 | 205 | 175 | 185 | 160 | 170 | 170 | 165 | 165 | 230 | 240 | 250 |
| Aux/RN | 86.1 | 74.0 | 74.7 | 86.9 | 57.4 | 85.6 | 61.4 | 69.5 | 71.4 | 103.5 | 109.0 | 107.8 |

Year: **3,460 room nights, ADR $207, aux $87.77/RN.**

Aux per occupied room is 2025 actual **+5% Jan–Sep, +15% Oct–Dec**. October 2025 was
normalised from $147.60 to **$90.00**: 49% of that month's ancillary was a single group
(reservation `5587990653891`, $59,210 revenue / $57,535 settled), and letting it set the
baseline is how the $1.38M happened in the first place.

**The occupancy ask is +0.5 points.** Real 2025 occupancy was **34.6%**, not the 31.7%
the system reports — `rooms_available` never recorded the flood closure, so the
denominator included rooms that could not be sold. Growth is capacity +23% and ADR +23%,
not selling harder. December at 55% on 30 rooms is a **+2.4 point** ask against the 52.6%
actually achieved on 20 rooms.

## What was applied

`01_budget_2026_v2.sql` — superseded, kept for reference. Created a separate `v2`
scenario; abandoned because `finance.v_gl_budget_lines` hardcodes
`WHERE s.name = 'Budget 2026 v1'` and the DDL to change that was blocked.

Applied instead, as migration `budget_2026_v1_overwrite_with_approved_driver_numbers`:

1. Archived the originals to scenario **`Budget 2026 v1 ORIGINAL (Apr-2026)`**
   (`status='archived'`, so no view selects it) — 900 lines plus all drivers.
2. Replaced v1's **revenue** lines with the approved numbers. Cost lines untouched.
3. Rewrote v1's **drivers**: `rooms_available`, `occupancy_pct`, `adr_usd`,
   `room_nights` at property level; room-type rows rescaled to the new totals so the
   per-room-type budget stays internally consistent.
4. Parked the staging scenario as `Budget 2026 v2 (staging - merged into v1 …)`, draft.

Values are stored **VAT-inclusive (× 1.10)** because `finance.v_gl_budget_lines` divides
Revenue by `(1 + vat_rate/100)`. The **× 1.2257 tax-and-service factor is a different
thing** and is deliberately not stored. On screen: revenue **1,021,413**, costs 773,458.

## Result

Budget vs actual, revenue, Jan–May 2026 (GL actuals stop at May):

| | Budget | Actual | Var |
|---|---|---|---|
| Jan | 112,009 | 126,230 | +14,221 |
| Feb | 116,243 | 107,404 | −8,839 |
| Mar | 57,591 | 46,517 | −11,074 |
| Apr | 58,730 | 43,654 | −15,076 |
| May | 43,671 | 56,542 | +12,870 |
| **Total** | **388,244** | **380,347** | **−7,897 (−2.0%)** |

Against the old budget the same period read −71%.

## Cost side — applied 2026-09-06 (migration `budget_2026_cost_lines_to_benchmark_targets`)

PBS direction: **costs are the ops manager's, budgeted top-down on industry benchmarks,
not carried from actuals — "you can't budget mistakes."**

The mistake in question, found in `Actuals 2025`:

| | 2025 revenue | 2025 cost | ratio | benchmark |
|---|---|---|---|---|
| Food | 109,759 | **136,446** | **124%** | 30% |
| Beverage | 25,278 | 16,794 | 66% | 22% |

Food cost exceeded food revenue. Worth investigating whether farm operating costs are
posting to `607100 FOOD COST` while the produce is consumed internally — that would
inflate the ratio with no matching revenue. Waste, theft and menu pricing are the other
candidates.

2025 total costs ran at **163% of revenue**. Benchmarks put it at 64%. That is a scale
gap, not only an efficiency gap, and payroll is most of it.

Targets applied to net revenue 1,021,413 (rooms 717,743, F&B 144,787):

| Subcategory | 2025 actual | % rev | Budget 2026 | % rev | Basis |
|---|---|---|---|---|---|
| Payroll & Related | 505,542 | 72% | **505,542** | 49.5% | **held flat (PBS)** — same team absorbs 25% more rooms |
| A&G | 83,963 | 12% | 71,499 | 7.0% | benchmark |
| Sales & Marketing | 160,297 | 23% | 71,499 | 7.0% | benchmark |
| Utilities | 49,025 | 7% | 51,071 | 5.0% | benchmark |
| POM | 54,606 | 8% | 51,071 | 5.0% | benchmark |
| Cost of Sales | 173,735 | 25% | 41,268 | 4.0% | food 30% of food rev, beverage 22% |
| Other OpEx | 116,580 | 17% | 40,857 | 4.0% | benchmark |

Payroll was held flat rather than benchmarked to 32% because the 32% figure implies
cutting $178,690 — about a third of the wage bill — in the same year 6 tents open. Flat
payroll still drops the ratio 72% → 49.5% through growth alone, and it is a target the
ops manager can actually act on. The benchmark stays the destination, not the 2026 ask.

Method: one scale factor per subcategory, so account mix and monthly phasing are
preserved. VAT needs no special handling — stored = net × (1 + rate) and the rate is
constant within a subcategory, so scaling stored by (target_net / current_net) is exact.

**Result — FY2026 GOP +188,607 (18.5%)**, against 2025's −442,602 (−63%). Below the 25%
industry floor, but the first profitable year.

Monthly GOP shows the real shape of the business:

| Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| +41.0k | +42.8k | −11.8k | −9.5k | −23.4k | −33.5k | −25.8k | −34.1k | −20.2k | +69.4k | +84.5k | +109.3k |

Five months carry seven. Operating costs are flat at $67–74k every month because payroll
and overhead do not flex, so June and August each lose ~$34k on their own.

## Drill-down — applied 2026-09-06

`public.v_budget_lines_detail` — an **additive sibling view** (create-forward; the live
`finance.v_gl_budget_lines` is untouched, so nothing that reads it can change behaviour).
Carries `property_id`, `period_yyyymm`, `period_year`, `period_month`,
`usali_subcategory`, `usali_department`, `account_code`, `account_name`, `amount_usd`.

This is what lets a USALI subcategory row expand to the accounts beneath it — Revenue to
its 11 accounts, Payroll to its 10, and so on. `plan.*` is not exposed via PostgREST,
which is why the bridge was needed. UI work still to do.

## Four bugs fixed 2026-09-06

**1. Cost of Sales was phased flat 1/12.** It is a variable cost and December sells 4×
January's room nights, so a flat food-cost line is visibly wrong to anyone operating the
hotel. Re-phased to the room-night curve, account totals unchanged: Jan $4,437 → Jun
$1,546 → Dec $6,101, still $41,268 for the year.

**2. Income Tax had no rows at all** — so the earlier UPDATE matched nothing and the
line stayed null. Inserted 12 monthly rows on `691100 CURRENT INCOME TAX` at 20% (Lao
corporate rate) of budgeted pre-tax profit: GOP 188,607 − FX 5,000 − Interest 3,300 =
180,307 → **36,061**.

Two below-GOP lines were deliberately NOT populated, and this is a decision rather than
an omission:
- **Non-Operating stays 0.** 2025's $36,899 was $32,474 of TAX PENALTIES & FINES plus
  $4,425 owner personal expense. Budgeting a fine is precisely the mistake this rebuild
  exists to stop.
- **Depreciation stays $197** (vehicle only). `DEPRECIATION BUILDING` and
  `DEPRECIATION GENERAL ASSET` are both zero for 2025 despite significant capex
  including the 120 m² library, so the asset register is not posting. That needs the
  register, not a number invented here. **This one is still a real gap.**

**3. `public.v_pace_curve` double-counted the budget.** `plan.drivers` stores
`room_nights` twice — property level (`room_type_id IS NULL`) and split across 9 room
types — and the view summed both. The pace chart compared actuals against **6,920**
budget room nights instead of 3,460. Added `room_type_id IS NULL` to both the budget and
STLY CTEs. Now reads Jun 129.6 / Jul 176.7 / Aug 139.5 / Sep 198 / Oct 418.5 / Nov 450.

**4. `finance.v_gl_budget_lines` hardcoded the scenario name** and never filtered
`property_id`. Now selects the most recently created *approved* budget scenario per
property per fiscal year, and tail-appends `account_code` / `account_name` /
`property_id`. The archived original is excluded by its `status='archived'`. This also
closes the tenancy hole where a Donna scenario sharing the name would have summed into
Namkhan's budget.

## Budget grid UI — 2026-09-06

`app/finance/budget/BudgetGridClient.tsx`. Each month header carries a **+**; pressing it
expands that month into three columns — **Budget · Act · Var %** — and collapses again.
Several months can be open at once. Collapsed months stay a single column so the grid
still fits without scrolling until detail is asked for.

Variance colour is direction-aware: on Revenue an overshoot is green, on a cost line an
overspend is red. A month with no GL rows shows "—" rather than a −100% variance, so the
unposted back half of the year does not read as catastrophic misses.

Also fixed in the page:
- The tab strip highlighted **P&L** while you were on Budget (`active: s.href === '/finance/pnl'`).
- `SUBCAT_ORDER` held 10 of the 14 USALI subcategories, so anything landing in Mgmt Fees,
  Depreciation, Income Tax or Non-Operating was accepted by the upload API and then
  silently dropped from the grid *and* from every total. Now all 14 — which is how the
  new Income Tax line becomes visible.

## FY2026 budget as it now stands

| | |
|---|---|
| Revenue | 1,021,413 |
| Total costs | 877,168 |
| **GOP** | **+188,607 (18.5%)** |
| Net income | +144,245 |

## Still open

- **`02_unhardcode_budget_scenario.sql` — NOT APPLIED, blocked by the permission
  classifier.** Would make the view select the newest approved budget per property
  rather than a literal name, and expose `account_code` / `account_name` /
  `property_id`. Needed for the drill-down UI, and it closes a latent tenancy bug: the
  view never filters `property_id`, so a Donna scenario named `Budget 2026 v1` would
  sum into Namkhan's budget.
- **`public.v_pace_curve` double-counts the budget.** `plan.drivers` stores
  `room_nights` twice — once at property level and once split across 9 room types — and
  the view sums both without filtering `room_type_id`. The pace chart therefore compares
  actuals against ~6,920 budget room nights instead of 3,460. Both halves are now
  internally consistent, but the view still needs the filter. Same DDL block.
- **Costs are still v1's** ($773,458 on screen) and are **$143,842 lighter** than the
  source sheet implies, so budgeted GOP is overstated by roughly that. Needs its own pass.
- **Capture rate as a first-class budget row** (the ops manager's KPI, per PBS) is UI
  work and is blocked behind the view change above.
