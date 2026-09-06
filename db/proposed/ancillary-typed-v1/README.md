# ancillary-typed-v1 — reports 39 / 77 / 145 parsed into a typed table

**Status: APPLIED 2026-09-06.** Three migrations, no repo code. Approved by PBS in chat
("i follow do the 3 thats enough for the first round").

Round one of the starred seven (`STARRED_REPORT_IDS` in `lib/cb-reports.ts`). The three
ancillary reports were taken first because they are the biggest datasets in the catalog
and they describe the ops-manager KPI the 2026 budget rests on.

## Why SQL and not the edge function

The snapshots are already stored as `jsonb` in `insights.stock_reports_cb`. Parsing in SQL
needs no Cloudbeds round trip, can be re-run over history, and avoids redeploying a 60KB
edge function every time the mapping changes. Report 74's parse lives in the edge function
for historical reasons; new ones should not.

## The three do NOT share a grain — this is the whole design problem

| Report | Row dimensions | Date basis | Metrics |
|---|---|---|---|
| 39 | `item_service_category` › `item_service_type`, by month | **transaction_datetime** | debit_amount |
| 77 | `custom_category` › `custom_item_name` › date | **checkin_date** | custom_quantity, debit_amount |
| 145 | date › `transaction_type` › `custom_item_category` | **service_date** | quantity_amount, debit_amount |

`checkin_date` is when the stay started; `service_date` is when the item was consumed;
`transaction_datetime` is when it was posted. Folding these into one `date` column would
be silently wrong, so `insights.ancillary_sales_cb` stores `date_basis` and `date_grain`
alongside every row and keeps `report_id` as provenance. **Summing across reports
double-counts the same sale under three different date meanings.**

Dimensions are `btrim`'d — Cloudbeds pads keys (`"Sweet "`, `"My Room  "`) and untrimmed
keys fragment one category into several rows. Where trimming merges keys the metrics are
summed. Cloudbeds' own `"-"` placeholder is preserved: it is a real value meaning
unclassified. Non-numeric cells (Cloudbeds' `"-"`) become NULL, never 0.

`amount` is deliberately not `amount_usd` — per ADR-173 there is no single operating
currency, and a `_usd` suffix on "whatever the property trades in" is the trap that naming
should avoid.

## Verified against the source, to the cent

| Report | Rows parsed | Raw JSON total | Parsed total | Diff |
|---|---|---|---|---|
| 39 | 5,400 | 154,693.55 | 154,693.55 | **0.0000** |
| 77 | 5,280 | 135,832.06 | 135,832.06 | **0.0000** |
| 145 | 7,241 | 343,523.71 | 343,523.71 | **0.0000** |

Report 145 has the longest history — 2025-01-01 → 2026-09-17, 150 categories, 5 POS
transaction types — so it spans the flood period and the 2026 budget year.

## Positioning: detail UNDER the existing KPI, not a replacement

`public.v_ancillary_capture_daily` already models capture from our own PMS and transaction
data (occupied rooms, capture %, per-occupied-room revenue for F&B / spa / activities /
retail). **That stays the KPI.** What report 145 adds is 150 categories and a POS-source
split instead of four buckets, plus an independent classification to check ours against.

### The cross-check, and why the two differ

Cloudbeds reads consistently higher — 2026 YTD $138,691 vs our $110,302, about 26%.
That is not an error on either side. The categories Cloudbeds counts that our four buckets
do not:

| Category | 2026 |
|---|---|
| NK Fees | 13,149 |
| Transportation | 8,774 |
| NK other Room Related | 5,385 |
| I Mekong Tours | 4,795 |
| WHISTLE | 2,007 |
| **Total** | **34,110** |

which covers the gap. Ours is a deliberate subset, and the subset matches how the 2026
budget is structured — transport (31,997) and imekong (33,863) are their own revenue
classes there, not ancillary. **Neither number needs changing; they answer different
questions.** Worth stating plainly because "our ancillary is 26% below Cloudbeds' " reads
like a bug and is not one.

## Objects

- `insights.ancillary_sales_cb` — typed table, PK
  (property_id, report_id, period_date, category, item_name, transaction_type)
- `insights.fn_parse_ancillary_cb(p_property_id bigint default 260955)` — parser,
  SECURITY DEFINER, returns a per-report row count
- `public.v_ancillary_sales_cb` — bridge (invariant 3)
- `public.v_ancillary_monthly_cb` — monthly by category and POS type, **report 145 only**;
  39 and 77 are excluded on purpose because of the date basis

All bridges: `REVOKE ALL ... FROM anon`, `GRANT SELECT TO authenticated, service_role`.

## Still open

1. **Nothing refreshes this.** `fn_parse_ancillary_cb()` is manual. It must run after each
   stock-report sync or the table silently goes stale — the same failure pattern as the
   report-309 stub. A cron or a call at the end of the sync is one statement, but PBS has
   not settled the scheduling question yet, so it is deliberately not wired.
2. No UI reads it yet. The natural consumer is a drill-down from the existing Ancillary
   Capture container into category and POS source.
3. Rounds two and three of the starred seven: 294 + 194 (daily revenue split two ways,
   one shape), then 96 (pace cross-check).
