# 19 · Cloudbeds Insights API (Data Insights / Stock Reports)

**Status:** live, in production via edge function `sync-cloudbeds` v48
**Written:** 2026-09-06 · **Property used throughout:** Namkhan `260955`
**Owner surface:** Administration › Reports, Revenue › RevReports

This is the API behind every "CB report" in the platform. It is *not* the Core PMS API
(`hotels.cloudbeds.com/api/v1.2|v1.3`) and *not* the Accounting API
(`api.cloudbeds.com/accounting/v1.0`) — it is a third, separate surface with its own
request grammar. Everything below was established by probing the live account, and the
observed status codes and messages are quoted verbatim.

---

## 1. Host, auth, headers

```
Base    https://api.cloudbeds.com
Auth    Authorization: Bearer <CLOUDBEDS_API_KEY>     (vault secret; NOT the accounting key)
Tenant  X-PROPERTY-ID: <property_id>
Accept  application/json
```

Two distinct Cloudbeds credentials exist in the vault and they are **not**
interchangeable:

| Vault secret | Used by | Surface |
|---|---|---|
| `CLOUDBEDS_API_KEY` | `cb()`, `cbInsightsPost/Try/Get` | Core PMS **and** Insights |
| `CLOUDBEDS_ACCOUNTING_KEY` | `cbAccPost`, `cbAccGet` | Accounting API only (trial balance, pending txns) |

Note the header-case inconsistency already in the codebase: `cbAccGet` sends
`X-Property-ID` while every other helper sends `X-PROPERTY-ID`. Both are accepted; do not
"fix" one without testing, HTTP header names are case-insensitive and this has never
been the cause of a failure.

---

## 2. Endpoints

### 2.1 List the catalog — the authoritative report inventory

```
GET /datainsights/v1.1/stock_reports?limit=25&offset=0
```

```jsonc
{
  "offset": 0,
  "limit": 25,
  "total": 174,                      // ← this account's real report count
  "stock_reports": [
    {
      "id": "309",
      "title": "Accounts Receivable (AR) Ledger with Transaction Details",
      "description": "...",
      "dataset_id": 1,
      "rules": { "feature_ids": null, "property_ids": null, ... },
      "updated_at": "2026-08-25T15:08:12Z",
      "published": true,
      "custom_cdfs": [],
      "folder_id": "360871725367296",
      "folder_name": null,           // always null in this account
      "tags": []
    }
  ]
}
```

**`limit` has a server-side maximum below 200** — `limit=200` returns 400. `limit=25`
(the default) works; page with `offset`. Eight pages cover all 174.

> **This endpoint is the reason `lib/cb-reports.ts` was rewritten on 2026-09-06.** The
> original catalog was hand-written from guessed names: 15 of its 50 ids did not exist
> (all 15 404'd), and several ids that did exist carried the wrong title. Never hand-write
> a report id again — read it from here.

### 2.2 Read one report's definition

```
GET /datainsights/v1.1/stock_reports/{id}
```

Returns the saved report: `columns`, `filters`, `periods`, `group_rows`, `sort`,
`settings`, `calculated_columns`, `custom_cdfs`, `dataset_id`, `type`, `property_ids`.
This is what makes §4.2 possible, and it is also the cheapest way to learn a dataset's
real column names (`stay_date` vs `service_date` vs `checkin_date`).

### 2.3 Run a report

```
POST /datainsights/v1.1/stock_reports/{id}/query/data?mode=Run
```

Response is **column-oriented**, not row-oriented:

```jsonc
{
  "headers": ["service_date", "room_revenue", "..."],   // or nested [group, column, metric] triples
  "index":   [["Jan"], ["Feb"], ...],                   // present on grouped/period reports
  "records": { "2026-06-01": [12, 3400.0, ...] },       // keyed by the group/date value
  "totals":  { ... }                                    // when settings.totals is true
}
```

Both `app/api/admin/reports/preview/route.ts` and the CSV download route derive row count
from `records[headers[0]].length` — keep them in agreement if you change either.

---

## 3. The three request body shapes

Exactly one of these is correct for any given report, and **which one is correct is a
property of the report, not of the dataset**. v48 discovers it at runtime.

### 3.1 Filtered (most reports)

```jsonc
{
  "property_ids": [260955],
  "filters": { "and": [
    { "cdf": { "type": "default", "column": "service_date" },
      "operator": "greater_than_or_equal", "value": "2026-06-08" },
    { "cdf": { "type": "default", "column": "service_date" },
      "operator": "less_than_or_equal",    "value": "2026-09-06" }
  ]}
}
```

`filters` is **plural** (a v43 fix; singular `filter` is silently ignored).

### 3.2 Unfiltered (snapshot reports)

```jsonc
{ "property_ids": [260955] }
```

For datasets with no date dimension at all — in-house lists, credit-note registers.

### 3.3 Definition replay (reports with saved periods/filters)

```jsonc
{
  "property_ids": [260955],
  "filters": <verbatim from GET /stock_reports/{id}>,
  "periods": <verbatim from GET /stock_reports/{id}>
}
```

Only `filters` and `periods` are replayed. Do **not** echo back `columns`,
`group_rows` or `calculated_columns` — those are applied server-side from the report id,
and sending them is itself rejected.

**In this mode the report's own periods govern the window.** A caller's `fromDate`/`toDate`
are ignored, so v48 stores `period_from`/`period_to` as `NULL` rather than printing a
range the data does not cover.

---

## 4. Failure modes observed in production

### 4.1 `400` — unknown column

```
"Cdf: service_date not found for this dataset: Guests"
```

The dataset has no such column. **Fix:** try another column. v47 added
`DATE_COLUMN_CANDIDATES` (12 names, `service_date` first) and probes them in order; an
unknown column costs one cheap request. Detected by `isUnknownColumnError()`, which
matches `not found for this dataset` / `cdf:` / `invalid column` / `unknown column`.

Observed accepted columns: `service_date` (most), `stay_date` (occupancy/pace),
`checkin_date` (booking-window reports).

### 4.2 `400` — saved filters / missing periods

```
"Filters are not the same on stock report id 102"
```
and, if you drop `filters` entirely to dodge it:
```
"Calculated columns must use existing comparisons or periods.
 The following names do not exist: This year, Last year, ..."
```

Both are the **same underlying condition**: the report carries a saved definition, and CB
validates the posted body against it. The first message fires when our filters differ
from the stored ones; the second fires when we omit the `periods` that the report's
`calculated_columns` reference by name.

This is a body-shape rejection, not a column problem — **no candidate column can ever fix
it**, which is why v47 failed on these reports no matter how long it probed. **Fix:**
§3.3 definition replay.

Reports fixed this way on 2026-09-06: `40, 79, 95, 102, 304, 305` (6 of 6).

### 4.3 `404` — report does not exist

```
"A Stock report with id: 103 does not exist"
```

Not retryable and not a bug in the sync — the id is simply not in this account. All 15
occurrences were ids invented for the old hand-written catalog:
`50, 51, 52, 53, 54, 55, 56, 57, 62, 85, 87, 88, 103, 111, 112`.
**Fix:** delete the id, or find its real replacement via §2.1.

### 4.4 Not treated as probeable

`401`, `403`, `429` and `5xx` abort immediately in v48 rather than burning the candidate
list — retrying a different column cannot fix an auth failure or a rate limit.

---

## 5. How `sync-cloudbeds` resolves a report (v48)

```
fetchReport(from, to)
 │
 ├─ mode already learned this invocation?  → reuse it (filtered / unfiltered / definition)
 │
 ├─ Phase 1  probe DATE_COLUMN_CANDIDATES in order
 │     200                        → mode = filtered,  remember the column
 │     400 unknown-column         → next candidate
 │     400 anything else          → STOP probing, remember the message, go to Phase 2
 │     401/403/429/5xx            → throw
 │
 ├─ Phase 2  GET the definition, replay filters + periods
 │     200                        → mode = definition
 │     else                       → go to Phase 3
 │
 └─ Phase 3  POST { property_ids } unfiltered
       200                        → mode = unfiltered
       else                       → throw, quoting the Phase-1 message if there was one
```

The mode is learned **once per invocation** and reused for every date in a multi-date
run, so a 12-candidate probe is paid at most once, not once per day.

### Where the learning is recorded

| Location | Contents |
|---|---|
| `sync_runs.metadata` | `{ date_column, mode, probe: [...], ef_version }` |
| `insights.stock_report_snapshots.raw._probe` | `{ date_column, mode, definition_replay, ef_version }` |

`probe` is the full trail — every column tried, its status, and why it was rejected. This
is the first place to look when a report that used to sync stops syncing.

```sql
-- which shape did each report resolve to, and what did it cost?
SELECT replace(entity,'stock_report_','') AS report_id,
       status,
       metadata->>'mode'        AS mode,
       metadata->>'date_column' AS date_column,
       jsonb_array_length(coalesce(metadata->'probe','[]'::jsonb)) AS probe_steps,
       left(error_message, 120) AS err
FROM public.sync_runs
WHERE entity LIKE 'stock_report%'
  AND started_at > now() - interval '1 day'
ORDER BY (replace(entity,'stock_report_',''))::int;
```

---

## 6. Invoking a sync

```jsonc
POST {SUPABASE_URL}/functions/v1/sync-cloudbeds
Authorization: Bearer <service role>
{
  "scope": "stock_report",
  "propertyID": 260955,
  "reportId": 74,
  "reportName": "Daily Revenue Report",
  "fromDate": "2026-06-08",
  "toDate":   "2026-09-06"
}
```

`dates: ["2026-09-05", "2026-09-06"]` runs one snapshot per date instead of one for the
range. From the UI this is the Sync button in `ReportsTableClient`; from SQL, `net.http_post`.

> `propertyID` defaults to `260955` inside the edge function. This looks like an L22
> violation and is not: `cb_invoke_sync` never sends `propertyID`, so removing the
> default stops **all** Cloudbeds ingestion. Leave it. (Agent memory:
> *CB sync property default is load-bearing*.)

---

## 7. Result as of 2026-09-06

| | before v47 | v47 | v48 |
|---|---|---|---|
| Reports syncing | 8 | 29 of 35 | **35 of 35** |
| Failure: unknown column | many | fixed | fixed |
| Failure: saved filters/periods | 6 | 6 | **fixed** |
| Failure: 404 phantom id | 15 | 15 | **removed from catalog** |

Verified mode distribution across the 35 (2026-09-06 re-sync, all 35 `success`):

| mode | date column | n | report ids |
|---|---|---|---|
| `filtered` | `service_date` | 15 | 38, 39, 61, 63, 74, 76, 77, 78, 83, 84, 89, 168, 306, 309, 311 |
| `definition` | — | 12 | 40, 58, 59, 60, 79, 90, 91, 92, 95, 102, 304, 305 |
| `filtered` | `stay_date` | 6 | 93, 94, 96, 100, 101, 110 |
| `filtered` | `checkin_date` | 2 | 75, 86 |
| `unfiltered` | — | 0 | — |

**`unfiltered` fell to zero, and that is a deliberate v48 behaviour change.** Six reports
(58, 59, 60, 90, 91, 92) resolved to `unfiltered` under v47 and now resolve to
`definition`, because Phase 2 runs before Phase 3. Both return 200; definition replay is
the more faithful of the two, since it applies the filters the report was actually saved
with instead of dumping the whole dataset. The visible consequence is that these six now
store `period_from`/`period_to` as `NULL` (§3.3). If a consumer ever needs a genuine
date-bounded pull of one of them, it must post its own filters and accept whatever CB
says about them — do not assume the unfiltered path is still reachable.

---

## 8. Open items

1. **139 reports are real but not surfaced.** `lib/cb-reports.ts` lists 35 of the 174.
   Adding one is a single line — the sync path already handles every shape. Nobody has
   decided which of the 139 earn a row.
2. **Snapshots are whole-response blobs.** Only report 74 is parsed into a typed table
   (`insights.daily_revenue_cb` → `v_monthly_revenue_cb`). Everything else is queryable
   only as JSON via `v_stock_report_snapshot`. A second typed extraction should be driven
   by a real question, not by "we have the data".
3. **`folder_name` is always null**, so the category column in `lib/cb-reports.ts` is a
   local editorial judgement, not Cloudbeds metadata. There is likely a folders endpoint
   that would resolve the 9 `folder_id`s into real names; not yet probed.
4. **No scheduled stock-report sync.** Every sync so far has been manual (UI button or
   SQL). `schedule_ids` on the definitions shows Cloudbeds has its own scheduler for
   these reports; we do not use it.
