# 02 — Cloudbeds API Reference

> Canonical source: https://hotels.cloudbeds.com/api/v1.3/docs/ and https://integrations.cloudbeds.com/.
> This file documents what we **actually** call and what we **actually** got back during sync.
> Every field-name discovery below was confirmed against live API responses (cb-probe edge function).

## Authentication

- **API Key** (legacy bearer token) — what we currently use.
  - Stored in Supabase vault as `CLOUDBEDS_API_KEY`
  - Format: `cbat_…`
  - Property is fixed (single-property key)
- OAuth 2.0 — preferred for multi-property. Not implemented yet.

## Base URL

- `https://hotels.cloudbeds.com/api/v1.3/`
- Some endpoints fall back to `v1.2/` — noted per call below.

## Endpoints actually used in `sync-cloudbeds`

| Domain | Endpoint | Version | Pagination | Notes |
|---|---|---|---|---|
| Property | `getHotels` | v1.3 | none | Returns hotel info |
| Inventory | `getRoomTypes` | v1.3 | none | Used `roomTypes[].roomTypeID` |
| Inventory | `getRooms` | v1.3 | none | Each room has `roomBlocked` flag |
| Reservations | `getReservations` | v1.3 | offset/limit 100 | Use `resultsFrom/resultsTo` for date filtering |
| Reservations | `getReservation` | v1.3 | none | Detail call when needed |
| Reservation rooms | `getReservationsWithRooms` | v1.3 | offset/limit 100 | Per-night rates here |
| Guests | `getGuests` | v1.3 | offset/limit | |
| Sources | `getSources` | v1.3 | none | 117 sources active |
| Payments | `getPaymentMethods` | v1.3 | none | |
| Folios | `getTransactions` | **v1.2** | offset/limit 100 | v1.3 returned 404 — fallback to v1.2 |
| Items | `getItems` / `getItemCategories` | v1.3 | none | 451 items, 16 categories |
| Taxes & fees | `getTaxesAndFees` | v1.3 | none | |
| House accounts | `getHouseAccounts` | v1.3 | none | `accountType`/`balance` not in list endpoint (plan limit) |
| Groups | `getGroups` | v1.3 | none | 20 groups; no room blocks |
| Rate plans | `getRatePlans` | v1.3 | none | 100 plans |
| Rate inventory | `getRatePlans` (with date range) | v1.3 | dates | Returned per date×rate×room type — ~88,863 rows |
| Add-ons | `getAddons` | v1.3 | offset/limit | |
| Daily metrics | `getDailyMetrics` | v1.3 | dates | 850 rows |
| Channel metrics | `getChannelMetrics` | v1.3 | dates | 516 rows |
| Insights | `getInsightSnapshot` | v1.3 | none | Periodic snapshot |
| ❌ Housekeeping | `getHousekeepingStatus` | v1.3 | — | **SCOPE BLOCKED** — need Cloudbeds support to grant `housekeeping:read` scope |

## Field-name discoveries (verified, do NOT trust the published docs blindly)

These caused real bugs during sync. Future Claude: assume nothing.

### Reservations
- ❌ Doc says `marketSegment`, actual is `marketCode` in some places, `marketName` in others. Use both as fallback.
- 82% of historical reservations have NULL `marketName` — operator-error issue, NOT a sync bug.

### Rate inventory
- ❌ `detailedRates` — actual is `roomRateDetailed[]`
- `minLos` is **lowercase** (not `minLOS` as some docs suggest)

### House accounts
- Use `accountID` (NOT `houseAccountID`)
- Use `accountName` (NOT `name`)
- Use `accountStatus` (NOT `status`)
- `accountType` and `balance` are NOT returned by the list endpoint on our plan.

### Groups
- Use `groupCode` (NOT `groupID`)
- Use `sourceID` and `name`
- Groups have no associated room blocks on our plan (`room_blocks` table = 0).

### Rate inventory pagination
- Use `startDate` / `endDate` instead of pagination cursor.
- Returned shape: `roomRateDetailed[]` per `roomTypeID` per date.

### Transactions
- v1.3 returns 404 for our property → use v1.2.
- Use `resultsFrom` / `resultsTo` (not `dateFrom`/`dateTo`).
- Use `transactionCategory` field (NOT `category` directly — the field is named both ways depending on context).
- Paginates 100 per page.

## Rate limits

- We have not hit them in normal sync.
- Implement exponential backoff on 429 (already in `sync-cloudbeds`).

## Sync architecture

| Layer | Frequency | Mechanism |
|---|---|---|
| Initial backfill | Once | `sync-cloudbeds` v11 — pulled all history (2019→Feb 2027) |
| Incremental | Hourly | `cb_hourly_refresh()` runs `cb_sync_recent_reservations` |
| Reconciliation | Daily | manual for now; full re-sync available |
| Webhooks | Not yet wired | TODO Phase 2 |

## Cloudbeds support tickets to open

| Topic | Why |
|---|---|
| Grant `housekeeping:read` scope on API key | Currently blocked, breaks today's-snapshot OOO/OOS |
| Confirm `accountType`/`balance` availability for non-enterprise plans | Phase 2 ledger detail |

## Reference: known forum threads / issues

- Populate as discovered.
