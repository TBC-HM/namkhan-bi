# sync-cloudbeds-v48 — definition replay + catalog rebuilt from the API

**Status: APPLIED 2026-09-06.** Edge function deployed (v48, `verify_jwt: false`,
deployed source verified byte-identical to the local file by diff). No DDL, no migration.
Repo change is `lib/cb-reports.ts` + docs.

Supersedes item 2 of `db/proposed/ledger-contact-and-sync-fixes-v1` (v47), and closes its
item 3.

---

## What v47 left broken

v47 shipped a date-column probe and took stock-report sync from 8 reports to 29. Six
reports still failed, every one of them with:

```
400 "Filters are not the same on stock report id {40,79,95,102,304,305}"
```

The v47 brief recorded this as unresolved and guessed it was "saved filter sets". That
guess was right about the cause and wrong about the fix — the plan had been to reproduce
the filters, when the actual requirement is to not send filters of our own at all.

## What it actually was

`GET /datainsights/v1.1/stock_reports/102` returns the stored report. Report 102 carries
both a saved `filters` block **and** named `periods` ("This year" / "Last year") that its
`calculated_columns` reference by name. CB validates the posted body against that
definition:

- send our own `filters` → `"Filters are not the same on stock report id 102"`
- send no `filters` at all → `"Calculated columns must use existing comparisons or
  periods. The following names do not exist: This year, Last year, ..."`

Two different messages, one condition. Critically, **neither is a column error**, so no
amount of probing could ever succeed — v47 would try 12 candidates and fail 12 times.

## The fix

Phase 2 inserted between the column probe and the unfiltered fallback: GET the
definition, POST back `{ property_ids, filters, periods }` verbatim. Only those two keys
— echoing `columns` / `group_rows` / `calculated_columns` is itself rejected.

Verified live on report 102 before writing any code: 400 → 200 with twelve months of YOY
data.

Also in v48:

- `401/403/429/5xx` now abort the probe immediately instead of burning the candidate list.
- A non-column 400 stops the probe (it would fail identically on every remaining
  candidate) and is quoted in the final error if Phases 2 and 3 also fail.
- `period_from`/`period_to` are stored **NULL** in definition mode. The report's own
  periods govern the window there, so recording the caller's requested range would be a
  claim the data does not support — and the preview route prints that range to the user.
- `raw._probe` gains `definition_replay: boolean`.

## Result

| | v46 | v47 | v48 |
|---|---|---|---|
| Reports syncing | 8 | 29 of 35 | **35 of 35** |

Verified distribution of the 2026-09-06 re-sync (all 35 `success`, 0 failed):

| mode | date column | n |
|---|---|---|
| `filtered` | `service_date` | 15 |
| `definition` | — | 12 |
| `filtered` | `stay_date` | 6 |
| `filtered` | `checkin_date` | 2 |
| `unfiltered` | — | 0 |

**`unfiltered` fell to zero** because Phase 2 precedes Phase 3, so reports 58/59/60/90/91/92
moved from `unfiltered` to `definition`. That is an improvement — they now run with the
filters they were saved with rather than dumping the dataset — but it is a real behaviour
change and those six now carry NULL periods.

## The bigger finding: the catalog was 30% fiction

The 404 class never had anything to do with the sync. `lib/cb-reports.ts` was hand-written
from **guessed** report names, and the list endpoint settles it:

```
GET /datainsights/v1.1/stock_reports?limit=25&offset=N     → total: 174
```

- **15 of its 50 ids do not exist** in this account: `50, 51, 52, 53, 54, 55, 56, 57, 62,
  85, 87, 88, 103, 111, 112`. Exactly the 15 that 404'd. Removed.
- **Titles were wrong on ids that do exist.** 40 is *Guests Marketing Email Opt-in List*,
  not "Folio Transaction Report". 79 is *In-House 14 Day Forecast*, not "Revenue by
  Channel". 95 is *Group Rooming List*, not "Future Revenue on Books".
- Consequently the **RevReports revenue subset was wrong too** — it promised "revenue
  management reports" while listing a marketing opt-in list and a group rooming list. The
  subset is rebuilt from real titles and is now 10 reports, all genuinely rate/occupancy/
  pace/ancillary.

`lib/cb-reports.ts` now carries 35 real reports with verbatim API titles. The other 139
are real and syncable; none is listed, because nobody has decided which earn a row.

## Closes v47 item 3 — report 309 stub

The v47 brief flagged report 309's snapshot as invented test data (`{"test": true}`,
headers `["Guest Name","Reservation ID",...]`). The re-sync wrote a real snapshot:

```
row_count 6 · headers ["internal_transaction_code",
  "internal_transaction_code_description", "service_date",
  "balance_due_amount", "source_kind", "transaction_description"]
```

Create-forward — the 2026-09-04 stub row is still there, untouched.

## Zero-row reports are real, not a regression

8 of the 35 sync clean but return 0 rows: `40, 58, 90, 91, 92, 95, 304, 305`. Because 6 of
these moved from `unfiltered` to `definition`, the obvious worry is that definition replay
dropped their data. It did not — posting an unfiltered body to 58 and 90 as a control also
returns `{"headers": [], "records": {}}`. Namkhan does not use Cloudbeds invoicing (58's
saved filter is `invoice_number is_not_null`), 304/305 are pinned to a trial-balance id,
95 to a specific group, and nobody has opted in through 40.

## Deliberately NOT changed

`Number(body.propertyID ?? 260955)` stays, for the reason given in the v47 brief:
`cb_invoke_sync` never sends `propertyID`, so removing the default stops all cron
ingestion. Unchanged in v48.

## Side effect of renaming: duplicate catalog rows

`public.v_stock_reports_catalog` groups by **(report_id, report_name)**. Correcting the
titles therefore left a second row for every renamed report — 38, 168, 306, 309, 311 each
appear twice, once under the old invented name and once under the real one.

Patched in the app rather than the DB: both Reports pages now index the catalog by
`report_id` keeping the newest `last_synced_at`, instead of `catalog.find()`, which
returned whichever row came first. Report 309 was the visible case — its 2-row stub sits
beside the real 6-row snapshot, so the page could show "2 rows" for a report that has 6.

**The view itself is still wrong** and would benefit from grouping on `report_id` alone
(or exposing only the latest snapshot per report). That is DDL and needs approval, so it
is listed below rather than applied. The app-side fix is correct either way and should
stay.

## Still open

1. 139 catalogued reports are not surfaced anywhere.
2. Only report 74 is parsed into a typed table; the other 34 are JSON blobs behind
   `v_stock_report_snapshot`.
3. `folder_name` is null for all 174, so categories in `lib/cb-reports.ts` are an
   editorial call. A folders endpoint probably exists; not probed.
4. No scheduled stock-report sync — all runs are manual. The definitions carry
   `schedule_ids`, so Cloudbeds has its own scheduler we do not use.

5. **`v_stock_reports_catalog` groups by (report_id, report_name)** — see above. Needs a
   view change to group by `report_id` only. Not applied: DDL requires PBS approval, and
   the standing order is create-forward, so this should be a new sibling view rather than
   a replacement if the existing shape has other readers.

Full API reference: `docs/19_CLOUDBEDS_INSIGHTS_API.md`.