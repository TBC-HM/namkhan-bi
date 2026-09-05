# ledger-contact-and-sync-fixes-v1

Verified against live DB `kpenyneooigsyuuomgct` and live Vercel on 2026-09-06.
Nothing here is applied — each item was blocked by the permission classifier and
needs explicit approval.

## 1. Aged receivables reminder button is dead on 90% of the value

`01_aged_ar_contact_email_fallback.sql`

The container header (54 resv · $37.2k) is **correct** — the four live buckets
(`0_30`, `31_60`, `61_90`, `90_plus`) are all labeled and sum exactly to
54 / $37,196.12. Wiring, drawer and click-through are fine.

The real defect is contact coverage: only **7 of 54** rows resolve an email, so
`GuestDrawer`'s "send reminder" is disabled on 47 rows worth **$33,492**.
`v_aged_ar_with_contact` already joins `pms.guests_cb` and already uses `g.phone`,
but the email COALESCE never falls back to `g.email`. That single omission costs
45 of the 47 missing addresses.

Note "send reminder" is a `mailto:` link, not a sending API — there is no
send-reminder route anywhere in `app/api`.

## 2. Stock report sync fails for any non-transaction dataset

`02_sync_cloudbeds_v47_index.ts` (full replacement file for the deployed Edge
Function `sync-cloudbeds`, currently v46)

Syncing report 52 (In-House Guest List) failed. From `public.sync_runs`:

```
/datainsights/v1.1/stock_reports/52/query/data?mode=Run 400:
"Cdf: service_date not found for this dataset: Guests"
```

`syncStockReport()` hardcodes a `service_date` date filter for all 174 reports.
Datasets that are not transaction-shaped reject it, which is why only 8 reports
have ever synced. v47 probes a candidate column list, then falls back to an
unfiltered pull, and records which column worked so the mapping can be learned
from real responses instead of guessed.

Deploy with `verify_jwt: false` (matching v46) — `cb_invoke_sync` passes a
service-role bearer, but the function's own setting is currently false.

### Deliberately NOT changed
`Number(body.propertyID ?? 260955)` stays. `public.cb_invoke_sync` does not send
`propertyID` at all, so every pg_cron sync resolves the property purely through
that default. Removing it without first adding the parameter to `cb_invoke_sync`
and rewriting all five cron commands stops all Cloudbeds ingestion. The
user-facing path (`app/api/admin/reports/sync/route.ts`) already passes an
explicit propertyID after `requirePropertyAccess`, so the default is cron-only.
Worth fixing, but as its own sequenced change, not folded into this one.

## 3. Report 309 in the catalog is fake test data

No SQL written — needs a decision, and the standing order is never to destroy.

`insights.stock_reports_cb` row for report 309 ("AR Ledger with Transaction
Details") contains:

```json
records = {"row_0": ["Test Guest", "RES001", "2026-09-01", "2026-09-05", 250.00]}
raw     = {"test": true}
headers = ["Guest Name","Reservation ID","Check-In","Check-Out","Balance"]
```

Those headers are invented — real CB reports return snake_case dataset columns
(compare report 306: `primary_guest_full_name`, `internal_transaction_code`,
`transaction_datetime_property_timezone`, ...). So the Reports library shows 309
as "synced · 2 rows" when it has never actually been pulled. Re-syncing it after
fix 2 lands would overwrite the stub via upsert — create forward, nothing dropped.

## 4. Deposits container — mostly NOT a bug

Investigated, no change proposed. `v_deposits_pipeline_with_contact` shows 154
future reservations, only 4 with any payment ($2,390 paid vs $153,075 balance).
That reads as broken but is largely correct: the balance is concentrated in
pay-at-hotel OTA channels and tour operators billed on account.

| Source | Resv | With payment | Balance |
|---|---|---|---|
| Booking.com | 52 | 2 | $48,574 |
| SynXis | 28 | 0 | $28,190 |
| Expedia | 29 | 0 | $24,502 |
| Website/Booking Engine | 14 | **2** | $19,657 |
| Tour operators (EXO, Khiri, Tiger Trails, …) | ~15 | 0 | ~$9,000 |

The one line worth a human look is **Website/Booking Engine: 12 of 14 direct
bookings show no payment**. Direct bookings normally take a deposit at booking,
so either the booking engine is not capturing deposits or those payments are not
reaching `pms.transactions_cb`. Contributing factor: cron 31 syncs transactions
only over a rolling `-7/+1` day window (`cb_invoke_sync('transactions',-7,1,1,10)`),
so a deposit paid months before arrival was never ingested. A one-off wide
backfill (`scope=backfill_transactions`) would settle whether the payments exist
in Cloudbeds at all.
