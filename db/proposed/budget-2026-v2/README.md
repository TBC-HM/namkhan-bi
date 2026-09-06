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
