# sync-cloudbeds-v49/v50/v51 — CSV export, honest row counts, faithful reports, full revenue catalog

**Status: APPLIED 2026-09-06.** Edge functions v49, v50 and v51 deployed (source verified byte-identical
by diff). No DDL. Repo changes: `lib/cb-report-table.ts` (new), the download and preview
routes, `lib/cb-reports.ts`.

Follows `sync-cloudbeds-v48`. PBS: *"i checkd the two report pages - the csv download does
not work - in revenue area i want you to pull all"*.

---

## 1. The CSV download was empty for 13 of 35 reports

Not broken-looking — worse. It returned a valid file with a header line and **zero data
rows**, so it looked like the report had no data. The affected 13 were exactly the ones
worth downloading: 74 Daily Revenue, 96 Pace, 100 Guest Count, 101 Occupancy by Room Type,
102 Occupancy/Revenue YOY, 110 Rooms Sold/ADR/RevPAR, plus 39, 77, 78, 83, 84, 89, 93.

Cause: both the download route and the preview route independently assumed Cloudbeds
returns one shape —

```ts
const firstCol = headers[0];
const rowCount = Array.isArray(records[firstCol]) ? records[firstCol].length : 0;
```

It returns three:

| Shape | `headers` | `records` | Reports |
|---|---|---|---|
| LIST | `["user", "is_void"]` | `{ "user": [v1, v2, …] }` — column-oriented | 38, 59, 309, 311 … |
| GROUPED | `[["occupancy","aggregated"], …]` — array of **paths** | `{ "06-08": { "occupancy": { "aggregated": 23.3 } } }` — row-nested | 74, 96, 101, 102, 110 … |
| EMPTY | `[]` | `{}` | the 8 genuinely-empty ones |

The two are indexed in **opposite directions**. On a GROUPED snapshot, `headers[0]` is an
array (stringifying to `"occupancy,aggregated"`), `records[that]` is `undefined`, the row
count computes as 0, and every row is dropped in silence.

Nesting depth is not fixed either — it follows the report's own definition. Row depth
tracks `group_rows`: 1 for report 96 (`"06-08"`), 2 for report 74 (`"Fee"` → `"Service
Charge"`). Header depth tracks `periods`: 2 normally, 3 for a YOY report like 102
(`["This year","rooms_sold","sum"]`). So `flattenSnapshot` measures both —
`rowDepth = objectDepth(records) - headerDepth` — instead of assuming.

`lib/cb-report-table.ts` is shared by the download and preview routes so the CSV and the
on-screen preview can never again disagree about what a snapshot holds.

Verified against real stored snapshots before shipping:

| Report | Shape | Rows before | Rows after |
|---|---|---|---|
| 74 Daily Revenue | grouped, rowDepth 2 | 0 | 327 |
| 102 Occupancy/Revenue YOY | grouped, headerDepth 3 | 0 | 12 (Jan→Dec, in order) |
| 309 AR Ledger | list | 6889 | 6889 |

### jsonb loses Cloudbeds' row order

`jsonb` normalises object keys (by length, then bytewise), so a snapshot read back gives
`"Apr, Aug, Dec"` where CB sent `"Jan, Feb, Mar"`. CB's ordered `index` array is in the raw
payload but is not exposed on `public.v_stock_report_snapshot`. `flattenSnapshot` re-sorts
instead — month names in calendar order, everything else naturally — so output is
deterministic and a monthly report reads correctly.

## 2. row_count was the column count

`row_count` was `Object.keys(records).length` — the number of **top-level keys**. For LIST
snapshots that is the number of columns; for GROUPED, the outermost group only.

| Report | stored | real |
|---|---|---|
| 309 AR Ledger | 6 | 6,889 |
| 38 Expanded Transactions | 41 | 6,889 |
| 311 Current Ledger | 12 | 6,889 |
| 74 Daily Revenue | 10 | 327 |

The Reports page prints this as "Rows" and the KPI strip sums it, so the headline
"904 rows synced" was understated by orders of magnitude. v49's `countSnapshotRows`
mirrors `flattenSnapshot`; both were run against the same fixtures and agree exactly
(327 / 12 / 6,889).

**These two functions must stay in step.** They live in different runtimes (Deno edge vs
Next.js) so they cannot share an import; if you change one, change the other, or the
stored count and the displayed table will describe the same snapshot differently.

## 3. Revenue area now carries the whole revenue catalog

PBS: *"in revenue area i want you to pull all"*. `REVENUE_REPORT_IDS` goes from 10 to **74**
— every revenue-management report in the Cloudbeds catalog, sub-categorised so the list
stays scannable:

| Category | n |
|---|---|
| Revenue | 26 |
| Occupancy | 15 |
| Channels | 11 |
| Booking | 11 |
| Pace | 5 |
| Ancillary | 6 |

`KNOWN_REPORTS` grows to 99 (74 revenue + 25 administration).

Deliberately left in Administration rather than Revenue: transactions by service date
(209, 217), taxes and fees (218), payment methods (283), outstanding balances (131),
posted transactions for cancelled reservations (285), revenue/taxes review by reservation
number (298), transactions review (307), out-of-service rooms (107, operational) and the
marketing opt-in list (40).

Of the 174 in the account, 75 remain unlisted — genuinely non-revenue and non-financial
(housekeeping detail, room status, guest documents).

## 4. v50 — definition replay must also carry `comparisons`

Syncing the expanded catalog surfaced one more gap. Report 287 (Pace - YOY Change) failed
even under v48's definition replay:

```
400 "Calculated columns must use existing comparisons or periods.
     The following names do not exist: This year, Last year, ..."
```

Its definition has **`periods: null`** and puts the two named windows in **`comparisons`**
instead — each a name plus its own filter block. The calculated columns reference those
names, so replaying only `filters` + `periods` left them undefined.

v50 replays `comparisons` too. Verified live on 287 before the code change: 400 → 200 with
data. A report uses one or the other, so both must be carried.

**99 of 99 reports now sync.**

## 5. v51 — the reports were returning the wrong data under the right name

The most serious finding of the session, and it only surfaced because expanding to 99
reports made the pattern visible: eight unrelated reports all reported **exactly 6,889
rows**, including *"Voids, Adjustments and Refunds Review"*.

Cause: the probe body sends **our** date filter *instead of* the report's saved filters.
CB enforces a filter match only for reports whose calculated columns depend on it — for
everything else it silently accepts our filter and drops theirs. So report 168, saved as
`is_void = Yes OR is_refund = Yes`, returned all 6,889 transactions in the window rather
than the 19 voids and refunds.

Every one of the 99 catalogued reports carries saved filters, and **73 were resolving this
way**. The snapshots were not corrupt — they were the raw dataset, correctly fetched,
stored under a report name that promised something narrower. That is worse than an error,
because nothing looks wrong.

v51 reorders the resolution: **verbatim definition replay first**, date probe only as a
fallback for definitions carrying no filters/periods/comparisons. Verified on 168 before
the change: 6,889 → 19 rows.

### The trade-off, stated plainly

In definition mode the report's **own** window governs. Report 61 (Cashier Report) is saved
as `start_current_week`, report 38 as `start_current_month` — so `fromDate`/`toDate` are
now ignored wherever a definition exists, and `period_from`/`period_to` store NULL.

That is the report as Cloudbeds defines it, which is what a page called "Reports" should
show. It does mean these snapshots are not a 90-day history. Anything needing history
should read the typed pipelines (`insights.daily_revenue_cb`) or the PMS silver layer, not
the snapshots. Widening a specific report to a custom range is a deliberate per-report
change — and worth doing only where CB accepts saved-filters AND a date clause together.

## Still open

1. `v_stock_reports_catalog` groups by `(report_id, report_name)` — carried over from v48.
   Needs a view change; DDL, so it needs approval.
2. Only report 74 is parsed into a typed table. The other 98 are JSON blobs behind
   `v_stock_report_snapshot`.
3. CB's ordered `index` is not stored on the public view. Exposing it would remove the need
   to re-sort rows heuristically.
4. No scheduled stock-report sync — every run is manual.

Full API reference: `docs/19_CLOUDBEDS_INSIGHTS_API.md`.
