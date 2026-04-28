# 13_PHASE1_SYNC_AUDIT.md

**Status:** Phase 1 (Cloudbeds → Supabase ingestion) — **COMPLETE & VERIFIED**
**Audit date:** 2026-04-28
**Edge function:** `sync-cloudbeds` v11 (Supabase project `kpenyneooigsyuuomgct` / `namkhan-pms`)
**Property:** The Namkhan, Luang Prabang (Cloudbeds propertyID 260955)
**Auditor:** Claude (live introspection of DB + raw JSON sampling)

---

## 1. Scope of this document

This is the post-build audit of every entity synced from Cloudbeds to Supabase, validating:

- Field mappings against actual Cloudbeds API response shapes (live-probed, not doc-assumed)
- NULL coverage on critical fields
- Real bugs discovered + fixed in v11
- Real Cloudbeds-side data quality issues (not bugs — operational)
- Known API limitations of the Namkhan plan tier

This file overrides anything stale in `02_CLOUDBEDS_API_REFERENCE.md` and `03_DATA_MODEL_AND_FIELDS.md` until those are formally updated.

---

## 2. Final entity health (v11, post-backfill)

| Entity | Rows | Status | Critical NULLs | Notes |
|---|---:|---|---|---|
| `hotels` | 1 | ✅ | 0 | Single property |
| `room_types` | 10 | ✅ | 0 | |
| `rooms` | 20 | ✅ | 0 | |
| `sources` | 117 | ✅ | 0 | All booking sources |
| `guests` | 4,111 | ✅ | 0 | Synced from prior session |
| `reservations` | 4,749 | ✅ | rate_plan 0%, market_segment 82% NULL (PMS) | 2019 → Feb 2027 |
| `reservation_rooms` | 46,423 | ✅ | rate 0% (was 84%, fixed) | per-night detail; 4,308 zero-rate nights = comp/staff |
| `transactions` | 76,001 | ✅ | amount 0% | F&B + Rooms + Taxes + Adjustments |
| `rate_plans` | 100 | ✅ | 0 | |
| `rate_inventory` | 88,863 | ✅ | 0 | per date × rate plan × room type, ±90/+120d |
| `house_accounts` | 1,035 | ✅ | account_type 100%, balance 100% (API limit) | name 0% NULL |
| `groups` | 20 | ✅ | 0 | |
| `items` | 451 | ✅ | category 1.3% NULL (PMS uncategorized) | F&B/spa/activity items |
| `item_categories` | 16 | ✅ | 0 | |
| `payment_methods` | 10 | ✅ | 0 | |
| `taxes_and_fees_config` | 4 | ✅ | 0 | Lao VAT, Service Charge, Tourism Fee |
| `add_ons` | 19,170 | ✅ FIXED v10 | 0 | derived from transactions; was 500 (PostgREST cap) |
| `tax_fee_records` | 19,225 | ✅ FIXED v10 | 0 | derived from transactions; was 500 |
| `adjustments` | 349 | ✅ | 0 | derived from transactions |
| `market_segments` | 5 | ✅ | 0 | derived from reservations |
| `daily_metrics` | 850 | ✅ | (legacy) | |
| `channel_metrics` | 516 | ✅ | (legacy) | |
| `usali_category_map` | 80 | ✅ | 0 | F&B Food, Beverage, Spa, Activities, Rooms etc. |
| `room_blocks` | 0 | — | n/a | groups have no blocks attached |
| `housekeeping_status` | 0 | ⛔ BLOCKED | n/a | Cloudbeds plan scope missing |

---

## 3. Bugs discovered and fixed in this audit

### 3.1 PostgREST 1000-row default cap silently truncating derived syncs (v9 → v10)

**Symptom:** `add_ons` and `tax_fee_records` capped at 500 rows each despite ~19k+ source transactions.

**Root cause:** `supabase.from('transactions').select(...)` returns a default page (1000 rows max, but for these syncs Postgres returned 500 due to PostgREST `max-rows` config). No pagination loop.

**Fix:** New helper `fetchAllPaged(builderFactory)` that walks `.range(from, to)` until no more rows. Applied to `syncAddOnsFromTransactions`, `syncTaxFeeRecordsFromTransactions`, `syncAdjustmentsFromTransactions`, `syncMarketSegments`.

**Result:** add_ons 500 → 19,170 ✅, tax_fee_records 500 → 19,225 ✅.

---

### 3.2 Truthy zero bug nullifying complimentary nights (v10 → v11)

**Symptom:** 39,013 / 46,423 (84%) `reservation_rooms.rate` NULL.

**Root cause:**
```js
rate: rate ? Number(rate) : null   // ← 0 is falsy → NULL
```

In Cloudbeds, `detailedRoomRates: {"2026-04-16": 0}` is valid for free room components (comp stays, staff bookings, group blocks, host nights). The truthy check converted these to NULL, losing real zero-rate nights.

**Fix:**
```js
rate: rate != null ? Number(rate) : null
```

**Backfill SQL (executed):**
```sql
UPDATE reservation_rooms
SET rate = (raw->>'rate')::numeric
WHERE rate IS NULL AND raw ? 'rate';
```

**Result:** 0 NULL rates. 4,308 zero-rate nights now correctly preserved (real comps), 42,114 paid nights ✅.

---

### 3.3 `reservations.rate_plan` NULL for older bookings (v10 → v11 + backfill)

**Symptom:** 3,590 / 4,749 (76%) checked_out reservations had NULL `rate_plan`, even though field mapping looked correct.

**Root cause:** Cloudbeds returns `ratePlanNamePublic = null` for older/checked-out reservations and puts the actual rate plan name in `rateName`. The fallback `?? r.rooms?.[0]?.rateName` was already in v9 code, but historical rows synced before v9 didn't have it, and the upsert never re-touched them.

**Fix:** Inline backfill from raw JSON (no re-sync needed):
```sql
UPDATE reservations
SET rate_plan = COALESCE(
  raw->'rooms'->0->>'ratePlanNamePublic',
  raw->'rooms'->0->>'rateName'
)
WHERE rate_plan IS NULL AND raw->'rooms'->0 IS NOT NULL;
```

**Result:** 3,590 NULL → 0 NULL ✅.

---

### 3.4 `market_segment` fallback to `marketCode` (v11 only, not backfillable)

**Symptom:** 3,873 / 4,749 (82%) NULL `market_segment`.

**Root cause:** v10 code:
```js
market_segment: r.rooms?.[0]?.marketName ?? null
```

`marketName` is NULL for 85% of historical bookings in Cloudbeds. `marketCode` (slightly less informative but exists more often) was not being used as fallback.

**Fix in v11:**
```js
market_segment: r.rooms?.[0]?.marketName ?? r.rooms?.[0]?.marketCode ?? null
```

**Caveat:** Backfill via SQL also tried `marketCode` — both are NULL on the same 3,873 bookings. **This is operational PMS data quality, not a sync bug.** Most checked-out reservations were never tagged with a market segment in the Cloudbeds UI. Fix is to enforce front-desk tagging going forward (DQ exception in Module 2).

---

## 4. Cloudbeds API field mappings — verified

These are the actual field names returned by Cloudbeds for The Namkhan, **probed live**. Use as ground truth over any older spec.

### 4.1 `getHotels`
```
data[].propertyID, propertyName, propertyTimezone, propertyCurrency,
       propertyDescription, propertyImage, propertyAddress, organizationID
```

### 4.2 `getRoomTypes`
```
data[0].roomTypes[].roomTypeID, roomTypeName, roomTypeNameShort,
                    roomTypeDescription, maxGuests, adultsIncluded,
                    childrenIncluded, roomTypeUnits, baseRate
```

### 4.3 `getRooms`
```
data[0].rooms[].roomID, roomName, roomDescription, roomTypeID,
                isActive, roomBlocked
```

### 4.4 `getReservationsWithRateDetails` (most critical entity)
**Top-level reservation fields:**
```
reservationID, status, source.sourceID, sourceName,
guestName, guestEmail, guestCountry,
reservationCheckIn, reservationCheckOut,
total, balance, propertyCurrency,
dateCreatedUTC, cancellationDate, thirdPartyIdentifier
```

**`rooms[]` array per reservation (each entry):**
```
roomID, roomName, roomTypeID, roomTypeName, roomTypeIsVirtual,
adults, children, guestID, guestName,
rateID, rateName,                          ← USE THIS for rate_plan
ratePlanNamePublic, ratePlanNamePrivate,   ← often NULL on historical
marketCode, marketName,                    ← often NULL on historical
roomCheckIn, roomCheckOut, roomStatus,
detailedRoomRates: { "YYYY-MM-DD": rate },  ← 0 is valid, not NULL
detailedRoomRateNames: { "YYYY-MM-DD": "name" },
subReservationID, promoCode
```

**Mapping:**
- `reservations.rate_plan` ← `rooms[0].ratePlanNamePublic ?? rooms[0].rateName`
- `reservations.market_segment` ← `rooms[0].marketName ?? rooms[0].marketCode`
- `reservation_rooms.rate` ← `detailedRoomRates[date]` (preserve 0)

### 4.5 `getTransactions` (use **v1.2**, not v1.3)
v1.3 returns 404. v1.2 endpoint, paginated:
```
?propertyID=X&resultsFrom=YYYY-MM-DD&resultsTo=YYYY-MM-DD
&pageNumber=1&pageSize=100
```

**Fields:**
```
transactionID, reservationID, transactionDateTime,
transactionType,
transactionCategory,                       ← USE THIS, not "category"
description, amount, currency, method, quantity,
userName, itemCategoryName
```

**Categories observed in Namkhan data:**
| Category | Count | USALI mapping |
|---|---:|---|
| `tax` | 28,944 | Lao VAT, Service Charge breakdowns |
| `custom_item` | 24,132 | F&B, spa, activities (POS-driven) |
| `fee` | 8,802 | Tourism fee, service charge |
| `payment` | 4,839 | Cash, card, transfer settlements |
| `product` | 4,622 | Items from `getItems` |
| `rate` | 4,242 | Room revenue (per-night charges) |
| `adjustment` | 273 | Manual price adjustments |
| `void` | 69 | Voided charges |
| `room_revenue` | 36 | (legacy/rare) |
| `addon` | 35 | (legacy/rare) |
| `refund` | 7 | Refunds |

### 4.6 `getRatePlans` — **REQUIRES startDate + endDate**
Returns 401/`success:false` without date params. With `detailedRates=true`, each plan includes:
```
ratePlanID, roomTypeID, ratePlanNamePublic, ratePlanNamePrivate,
isDerived, isActive,
roomRateDetailed: [                        ← was incorrectly named "detailedRates" in earlier code
  {
    date, rate, totalRate, roomsAvailable,
    minLos,                                ← lowercase, not "minLOS"
    closedToArrival, closedToDeparture,
    cutOff, lastMinuteBooking
  }
]
```

### 4.7 `getHouseAccountList` (singular Account)
v1.3 endpoint name is `getHouseAccountList` (NOT `getHouseAccountsList`).
```
data[].accountID, accountName, accountStatus,    ← NOT houseAccountID/name/status
       isPrivate, propertyID, dateCreated
```
**API does NOT return `balance` or `accountType`** for The Namkhan plan tier. Would require per-account `getHouseAccountDetails(accountID)` calls (1,035 extra requests). Deferred — derive balance from transactions if needed for BI.

### 4.8 `getGroups`
```
data[].groupCode, sourceID, name, contactName, contactEmail, contactPhone,
       blockSize, pickup, pickupPct,
       arrivalDate, departureDate, cutoffDate, status,
       blocks[] (or allotmentBlocks[])
```
Use `groupCode || sourceID` as ID (not `groupID` — that field doesn't exist).

### 4.9 `getPaymentMethods`
Returns object, not array:
```
data: {
  gateway: "...",
  methods: [{ paymentMethodID, name, method, isActive, isDefault }, ...]
  // OR sometimes object: { cash: {...}, card: {...} }
}
```
Code handles both shapes.

### 4.10 `getItems`
```
data[].itemID, name, sku, itemCode, itemType, price,
       categoryID, categoryName, description,
       fees[], taxes[], totalFees, totalTaxes, grandTotal, priceWithoutFeesAndTaxes,
       stockInventory
```

### 4.11 `getItemCategories`
```
data[].categoryID, name (or categoryName), description, isActive
```

### 4.12 `getTaxesAndFees`
```
data: { taxes:[], fees:[] }
each item: taxID/feeID, name, amount, amountType ("percent"/"flat"),
           appliedTo, isInclusive, isActive
```

### 4.13 `getHousekeepingStatus` — ⛔ **SCOPE MISSING**
Returns `success:false, message:"Scope required for this call was not granted by property"`. Cloudbeds plan/scope limitation. **Action: open ticket with Cloudbeds support requesting `housekeeping:read` scope on API key `cbat_ehTgCvfpEk1zIoXa1fd0Tz6Y0VqmCANP`**. Blocks SOP module 1 (room status workflow) and DQ module 2 (housekeeping audit).

---

## 5. Cloudbeds-side data quality issues (NOT sync bugs)

These cannot be fixed in the pipeline — they require operational changes in the PMS.

| Issue | Coverage | Fix path |
|---|---|---|
| 82% of reservations missing `marketName`/`marketCode` | 3,873 / 4,749 | Enforce front-desk tagging on every booking. Surfaced in DQ Module 2. |
| 6 items have no `categoryID` (`uncategorized`) | 6 / 451 | Categorize in Cloudbeds Settings → Items |
| `house_accounts.balance` and `accountType` not in list endpoint | 1,035 / 1,035 | API limitation; derive from transactions if BI requires |
| `room_blocks` empty | 20 groups, 0 blocks | Groups don't currently use allotment blocks — will populate naturally if used |

---

## 6. Endpoint → table architecture map

| Cloudbeds endpoint | Table | Sync function | Frequency rec. |
|---|---|---|---|
| `getHotels` | `hotels` | `syncHotels` | hourly |
| `getRoomTypes` | `room_types` | `syncRoomTypes` | hourly |
| `getRooms` | `rooms` | `syncRooms` | hourly |
| `getPaymentMethods` | `payment_methods` | `syncPaymentMethods` | daily |
| `getItemCategories` | `item_categories` | `syncItemCategories` | daily |
| `getItems` | `items` | `syncItems` | daily |
| `getTaxesAndFees` | `taxes_and_fees_config` | `syncTaxesAndFeesConfig` | daily |
| `getRatePlans` (no `detailedRates`) | `rate_plans` | `syncRatePlans` | hourly |
| `getRatePlans` (`detailedRates=true`) | `rate_inventory` | `syncRateInventory` | every 15min |
| `getHouseAccountList` | `house_accounts` | `syncHouseAccounts` | hourly |
| `getGroups` | `groups`, `room_blocks` | `syncGroups` | hourly |
| `getHousekeepingStatus` | `housekeeping_status` | `syncHousekeepingStatus` | ⛔ scope blocked |
| `getReservationsWithRateDetails` | `reservations`, `reservation_rooms` | `syncReservations` | every 15min |
| `getTransactions` (v1.2) | `transactions` | `syncTransactions` | every 15min |
| (derived from `reservations`) | `market_segments` | `syncMarketSegments` | daily after reservations |
| (derived from `transactions`) | `add_ons` | `syncAddOnsFromTransactions` | daily after transactions |
| (derived from `transactions`) | `tax_fee_records` | `syncTaxFeeRecordsFromTransactions` | daily after transactions |
| (derived from `transactions`) | `adjustments` | `syncAdjustmentsFromTransactions` | daily after transactions |

**Not feasible (Phase 2 / external):**
- `communications` (Whistle) — no public API
- `reservation_modifications` — webhooks only, needs receiver service
- `data_insights_snapshots` — separate Cloudbeds Insights API

---

## 7. Operational architecture

### 7.1 Edge function
- **Slug:** `sync-cloudbeds`
- **Project:** `kpenyneooigsyuuomgct`
- **Version:** v11 (deployed 2026-04-28)
- **JWT verification:** disabled (called via internal RPC)
- **Auth:** Cloudbeds API key from Supabase Vault (`CLOUDBEDS_API_KEY`)
- **Wall-time:** 150s edge timeout — paginated functions cap at 4-6 API pages per invocation

### 7.2 Invocation pattern
```sql
SELECT public.invoke_sync('reservations');   -- async, returns request_id
SELECT public.invoke_sync('all');             -- full sync
```
Internally uses `pg_net.http_post` to call the edge function. Results land in `sync_runs` table.

### 7.3 Observability
- `sync_runs` — every invocation logged: entity, status, rows_upserted, error_message, metadata
- `sync_watermarks` — last successful sync timestamp + cursor per entity

### 7.4 Cloudbeds API key
- **Active key:** `cbat_ehTgCvfpEk1zIoXa1fd0Tz6Y0VqmCANP` (regenerated 2026-04-27)
- **Client:** `live1_260955_y4OBg1AvaziKxr8R5mLGe6ns`
- **Stored in:** Supabase Vault as `CLOUDBEDS_API_KEY`
- **Other keys in Cloudbeds account (likely dead, candidate for cleanup):** ACCOUNTING, Google Sheets Sync, LookerStudio Integration, Hy Sheets sync, Hy API V2

---

## 8. Open action items (ranked by ROI)

| # | Action | Impact | Effort |
|---:|---|---|---|
| 1 | Set up `pg_cron` schedules per §6 frequencies | Sync stays fresh, no manual trigger | 30 min |
| 2 | Open Cloudbeds support ticket for `housekeeping:read` scope | Unblocks SOP Module 1 + DQ Module 2 | 1 email + wait |
| 3 | Update `02_CLOUDBEDS_API_REFERENCE.md` and `03_DATA_MODEL_AND_FIELDS.md` to match this audit | Future contributors don't repeat field-name discovery work | 1-2 hr |
| 4 | Build BI views (Module 3): ADR, RevPAR, Occupancy, USALI revenue P&L | Unlocks dashboards from existing data | 4-8 hr |
| 5 | Operational fix: front-desk SOP to require `marketCode` on every reservation | Restores 82% segment coverage going forward | Manager training |
| 6 | DQ rule: flag uncategorized items + reservations missing market_segment | Surfaces issues weekly | 1 hr per rule |
| 7 | Audit & delete dead Cloudbeds API keys (LookerStudio, Hy, Google Sheets) | Security hygiene | 5 min |
| 8 | Phase 2: webhook receiver for `reservation_modifications` | Real-time changes vs 15-min polling | 1 day |
| 9 | Phase 2: Cloudbeds Insights API integration → `data_insights_snapshots` | Pickup curves, pace reports | 2-3 days |

---

## 9. Audit reproduction queries

Drop-in queries any future Claude session or analyst can run to re-validate Phase 1.

```sql
-- 9.1 Row counts per entity
SELECT 'reservations' AS t, COUNT(*) FROM reservations
UNION ALL SELECT 'reservation_rooms', COUNT(*) FROM reservation_rooms
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'rate_inventory', COUNT(*) FROM rate_inventory
UNION ALL SELECT 'add_ons', COUNT(*) FROM add_ons
UNION ALL SELECT 'tax_fee_records', COUNT(*) FROM tax_fee_records
UNION ALL SELECT 'adjustments', COUNT(*) FROM adjustments
UNION ALL SELECT 'house_accounts', COUNT(*) FROM house_accounts
ORDER BY 1;

-- 9.2 Recent sync_runs
SELECT entity, status, started_at, rows_upserted, rows_failed,
       LEFT(COALESCE(error_message,''),200) AS err
FROM sync_runs
ORDER BY started_at DESC LIMIT 30;

-- 9.3 Watermarks
SELECT entity, last_synced_at, metadata
FROM sync_watermarks
ORDER BY last_synced_at DESC;

-- 9.4 Critical NULL audit
SELECT
  'reservations' AS t,
  COUNT(*) FILTER (WHERE rate_plan IS NULL) AS null_rateplan,
  COUNT(*) FILTER (WHERE market_segment IS NULL) AS null_segment,
  COUNT(*) FILTER (WHERE total_amount IS NULL) AS null_total
FROM reservations
UNION ALL
SELECT 'reservation_rooms',
  COUNT(*) FILTER (WHERE rate IS NULL),
  NULL, NULL
FROM reservation_rooms
UNION ALL
SELECT 'transactions',
  COUNT(*) FILTER (WHERE amount IS NULL),
  COUNT(*) FILTER (WHERE category IS NULL),
  NULL
FROM transactions;
```

---

## 10. Version history of `sync-cloudbeds`

| Version | Date | Key changes |
|---:|---|---|
| v1-v3 | early | First scaffolding, hardcoded fallbacks |
| v4 | | Vault-based API key |
| v5 | | (broken — placeholder string) |
| v6 | | Real field discovery via `cb-probe`: `accountID`, `groupCode` |
| v7 | | Bulk upserts (200/500 chunked); 4-page reservation cap for 150s timeout |
| v8 | | API success-false error surfacing; v1.2 fallback for transactions |
| v9 | | `roomRateDetailed` (was incorrectly `detailedRates`); `minLos` (was `minLOS`); 6-page tx pagination |
| v10 | | `fetchAllPaged()` helper for derived syncs (PostgREST 1000-row cap fix) |
| **v11** | **2026-04-28** | **`rate != null` (preserve 0); `marketCode` fallback** |

---

**End of audit. Phase 1 = production-ready. Move to scheduling + BI.**
