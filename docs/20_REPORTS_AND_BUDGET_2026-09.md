# 20 · Cloudbeds reports + budget actuals — 2026-09-06/07

What changed, why, and which numbers moved. Companion to
`docs/19_CLOUDBEDS_INSIGHTS_API.md` (the API reference); this is the change record.

Scope: the Cloudbeds stock-report pipeline, the Reports/RevReports surfaces, the budget
and Planning actuals, plus two platform fixes found on the way. Other work landed on
`main` in the same window from other sessions (social, retreats) and is not covered here.

---

## 1. The recurring shape of these bugs

Five separate defects turned out to be the same mistake, and it is worth naming because
it will happen again:

> **Code shipped ahead of the schema, or a view exposing fewer columns than its source —
> and nothing failed loudly.**

- `fn_channel_promotion_upsert_v2` called by a route; migration never applied.
- `runner-v3.ts` writing `status`; the column never added — runner dead ~3 weeks.
- `finance.v_budget_vs_actual_monthly` split revenue from cost; the **public** bridge was
  never updated, so Planning silently received `undefined` for all four columns.
- `v_budget_lines_detail` reading a journal feed that had stopped carrying P&L rows.
- A nav entry pointing at a page that was never committed.

None of these threw. Every one produced a plausible-looking screen. **A green build and a
passing `tsc` prove nothing about a JSON contract, a view's column list, or whether a
table still receives rows.**

---

## 2. Cloudbeds stock reports: 8 → 99 syncing

### The version arc

| | What it fixed |
|---|---|
| v47 | Date-column probe — datasets lacking `service_date` |
| v48 | **Definition replay** — reports with saved `filters`/`periods` |
| v49 | **Honest `row_count`** — was the COLUMN count for list snapshots |
| v50 | `comparisons` replayed too — report 287 |
| v51 | **Definition FIRST** — stop silently dropping each report's saved filters |

v51 is the one that mattered. Up to v50 the probe sent *our* date filter **instead of**
the report's saved filters, and Cloudbeds accepts that silently for any report it does
not enforce. All 99 reports carry saved filters and 73 were resolving that way — so most
snapshots were the raw dataset stored under a narrower report's name. "Voids, Adjustments
and Refunds Review" returned **6,889 transactions instead of 19**.

Trade-off accepted: in definition mode the report's own window governs, so a caller's
from/to is ignored and `period_from`/`period_to` store NULL. These snapshots are the
report, not a history series.

### The catalog was 30% fiction

`lib/cb-reports.ts` was hand-written from **guessed** report names. The API's list
endpoint settles it: **15 of its 50 ids did not exist** (every one a 404), and several
that did exist had the wrong title — 40 is a marketing opt-in list, not "Folio
Transaction Report"; 79 is a 14-day forecast, not "Revenue by Channel".

Rebuilt from `GET /datainsights/v1.1/stock_reports`: **99 reports, verbatim API titles**
— 74 revenue, 25 administration, of 174 the account exposes. **Never hand-add an id.**

### Reports UI

- **CSV export was empty for 13 of 35 reports** — a header line and zero rows, and they
  were the ones worth downloading (74 Daily Revenue, 96 Pace, 101 Occupancy, 102 YOY,
  110 ADR/RevPAR). Cloudbeds returns three response shapes indexed in opposite directions;
  both the download and preview routes had assumed one. `lib/cb-report-table.ts`
  `flattenSnapshot()` handles all three and is now shared by download, preview, the
  full-report page and email, so they cannot disagree.
- **Email 500** — same root cause one layer down: `csvCell(value: string)` received a
  `string[]` for grouped reports and `.replace` threw.
- **Preview** now opens the whole report in a new tab (`/h/[pid]/admin/reports/[id]`).
  The inline panel could only ever show the top of a 6,889-row report.
- **Two decimals**, capped in `flattenSnapshot`. Real JSON numbers only — numeric-looking
  *strings* pass through untouched, because reservation numbers and invoice ids arrive as
  strings and coercing them would corrupt identifiers.
- **Seven starred** priority reports pinned to the top of RevReports.

### Chosen on evidence, not on how the report reads

Two reports were dropped from the shortlist for reasons worth remembering:

- **Booking window / LOS / country production** — already on Revenue › Markets, and
  cross-tabbed by country, room type and stay month, which the Cloudbeds versions are not.
- **Market group & segment** — sounds additive, but Namkhan barely populates the
  dimension: report 239 returns 5 rows, 238 returns 2, 240 returns 1.

---

## 3. Budget actuals: June was reporting −99%

The budget grid showed **June 2026 at $1,206** across 13 lines with **zero revenue lines**
against a $102,879 budget. June's actual P&L was **Revenue $78,810, total $133,023**.

Cause: actuals came from `finance.gl_entries` (the journal feed) via
`gl_mv_usali_pl_monthly`. That feed carries almost no P&L rows after May — of June's 676
entries only 26 hit a P&L account; July and August are 100% balance-sheet. Refreshing the
matview first proved it structural, not stale.

Actuals now come from `finance.gl_pl_monthly` (the QuickBooks P&L-by-month upload).
Validated on May where both are complete: **identical Revenue, $56,542 from each**, only
four cost lines differing by $72–$209.

| Month | Budget | Was | Now | Revenue | Closed |
|---|---|---|---|---|---|
| Jun | 102,879 | 1,206 | **133,023** | 78,810 | yes |
| Jul | 111,245 | — | **105,937** | 50,597 | **no** |
| Aug | 102,667 | — | **73,348** | 54,603 | **no** |

Two things fixed alongside:

- **No revenue sign flip.** `gl_entries` stores revenue as a credit; `gl_pl_monthly`
  stores it positive. Carrying the old negation across would have inverted every revenue
  line.
- **A live cross-tenant leak.** The old actuals CTE had *no property filter at all* —
  `v_gl_pl_monthly_combined` has no `property_id` column, so actuals from every property
  joined to the budget on `(period, account_code)` alone. Two properties have 2026 GL data.

`is_final` is now exposed and the grid marks provisional months. July's flag arrived as
`true` from the 2026-08-28 upload and was **wrong** — corrected to false 2026-09-07 per
PBS ("July preliminary, not closed").

### Department revenue was revenue + cost added together

`public.v_budget_vs_actual_monthly` never exposed the revenue/cost split its `finance`
source had, so Planning fell back to `actual_usd` — revenue **plus** cost per class:

| Class | Shown | Real (revenue only) |
|---|---|---|
| transport | **202%** of budget | **111%** |
| activities | **66%** — read as a miss | **104%** — on plan |
| spa | 123% | 145% |
| retail | 101% | 170% |

Transport worst because its cost accounts (614121) run to more than twice its revenue
account (708090). The KPI tiles above the table had it worse still — summing across every
class, adding all revenue to all costs, then computing a variance on the total. Both fixed.

---

## 4. Platform fixes found on the way

- **`agent-runner` was dead ~3 weeks.** `runner-v3.ts` writes `status` on its heartbeat
  insert; the column did not exist, so it died on its first statement. Last heartbeat
  before the fix: **2026-08-14**. `public.cockpit_runner_heartbeat` is a VIEW over
  `cockpit.exec_runner_heartbeat` and the runner writes *through* it, so the column had to
  be added to both. Verified by replaying the insert (201) then dispatching the workflow
  (run 34058953191 green).
- **CI had been red for days** on `lint · typecheck · build`. Two files carried
  `eslint-disable` for `@typescript-eslint/no-explicit-any`, a rule this repo never
  configures, so ESLint errored on the directive itself. Those were the only two Errors in
  the run. Vercel ignores lint, which is why it sat unnoticed.

---

## 5. Nav

- **Contacts department dissolved** — Guests → Sales, Reputation/Behaviour → Marketing.
  URLs unchanged; `SUBSEGMENT_ALIAS` keeps the right department lit.
- **Promotions page removed.** The nav entry pointed at a hub that was never committed,
  and instead of 404ing it fell through to `channels/[source]` with `source="promotions"`
  and rendered a channel-detail page for an invented source. Entry removed, hub deleted,
  and `[source]` now 404s unknown sources against `public.sources` (fails open for
  properties with no registry, so Donna is unaffected).

---

## 6. Things that look wrong and are not

Recorded because each one reads like a bug and will be re-reported otherwise.

| Observation | Reality |
|---|---|
| 8 reports sync clean with **0 rows** | Genuinely empty here. Namkhan does not use Cloudbeds invoicing; 304/305 are pinned to a trial-balance id. Verified with an unfiltered control request. |
| ~24% of all report cells are **0** | Sparse room-type × date grids. Report 227 is *by room type AND room number* — most rooms are unsold most nights. |
| ~12% are `"-"` | Cloudbeds' own not-applicable marker, a literal string. Not null, not zero, and must never render as 0. |
| Our ancillary is **26% below** Cloudbeds' | Different scope. CB counts NK Fees, Transportation, NK other Room Related, I Mekong and WHISTLE ($34,110). Our four buckets exclude them — and transport and imekong are separate revenue classes in the budget. |
| Budget grid shows Aug, Planning stops at Jun | Two different uploads. Account-level runs further than the by-class export. Expected. |
| Report **110** occupancy/RevPAR all `"-"` | **Genuinely broken, in Cloudbeds.** Its saved filter includes `reservation_source not_contains "media estancia"`, but capacity is a property-level fact with no reservation_source — so the filter drops the inventory rows, `capacity_count` sums to 0, and everything derived from it dies. Fix in the Cloudbeds report builder, or use 155 / 105. |

---

## 7. Open

1. **Nothing refreshes the parsed ancillary table.** `fn_parse_ancillary_cb()` is manual.
2. **No scheduling for stock reports.** The Email button is a one-off send — the variables
   are named `schedule*` but there is no cadence. The pattern exists twice already:
   `documentation.revenue_report_recipients` (has `cadence`) and `reports.studio_schedules`.
3. **Rounds 2–3 of the starred seven**: 294 + 194 (one shape, one unit), then 96.
4. **75 catalogued reports unsurfaced** — real and syncable, none listed.
5. **July's `is_final` will regress** if the next upload re-asserts `true`. The flag comes
   from the upload; nothing here defends it.
6. `v_stock_reports_catalog` groups by `(report_id, report_name)`, so renaming a report
   creates a second row. Patched in the app; the view still wants a fix.
