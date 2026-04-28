# 03 — Data Model and Fields

> Living inventory of what exists in Supabase project `kpenyneooigsyuuomgct`.
> When schema changes, update here. The dashboard reads `mv_*` views, not raw tables.

## Tables (raw layer — synced from Cloudbeds)

| Table | Rows (snapshot) | Owner | Purpose |
|---|---|---|---|
| `hotels` | 1 | System | Property metadata |
| `room_types` | 10 | System | Cloudbeds room types |
| `rooms` | 20 (19 sellable, Tent 7 retired) | System | Physical inventory |
| `reservations` | ~4,749 | System | All reservations 2019→Feb 2027 |
| `reservation_rooms` | ~46,423 | System | Per-night rates per reservation |
| `transactions` | ~76,001 | System | All folio postings |
| `guests` | ~4,111 | System | Guest profiles |
| `sources` | 117 | System | Booking sources |
| `payment_methods` | 10 | System | |
| `item_categories` | 16 | System | F&B / Spa / Activity / Retail categorization |
| `items` | 451 | System | Sellable items |
| `taxes_and_fees_config` | 4 | System | |
| `house_accounts` | 1,035 | System | City ledger / corporate accounts |
| `groups` | 20 | System | Group bookings |
| `rate_plans` | 100 | System | All rate plans |
| `rate_inventory` | ~88,863 | System | Date × rate × room type forward inventory |
| `add_ons` | ~19,170 | System | |
| `tax_fee_records` | ~19,225 | System | |
| `adjustments` | ~349 | System | Folio adjustments |
| `daily_metrics` | ~850 | System | Cloudbeds-side daily aggregates |
| `channel_metrics` | ~516 | System | Cloudbeds-side channel aggregates |
| `market_segments` | 5 | System | (mostly NULL in reservations — see DQ) |
| `room_blocks` | 0 | System | Empty — not exposed on our plan |
| `housekeeping_status` | 0 | System | Empty — scope blocked |
| `usali_category_map` | 119 | PBS | USALI mapping rules (regex/ilike) |
| `operational_overrides` | 1 | PBS | Tent 7 closed (extensible) |
| `dq_known_issues` | 5 | PBS | Parked DQ findings for agent v2 |
| `sync_runs` | growing | System | Sync audit log |
| `sync_watermarks` | small | System | High-water marks per entity |
| `sync_request_queue` | small | System | Wave-based sync coordination |

## Materialized views (BI consumption layer)

All refreshed by `refresh_bi_views()` — runs every 15 min via `pg_cron`.

| View | Rows (snapshot) | Used by | Purpose |
|---|---|---|---|
| `mv_classified_transactions` | ~76,001 | base for downstream | Every txn tagged with USALI dept/subdept via `usali_category_map` priority match |
| `mv_kpi_daily` | ~2,837 | Overview, Pulse, P&L | Date-grain occupancy/ADR/RevPAR + USALI revenue split |
| `mv_kpi_today` | 1 | Overview, Today | Right-now snapshot |
| `mv_revenue_by_usali_dept` | ~226 | Finance P&L | Monthly USALI revenue × dept × subdept |
| `mv_channel_perf` | ~45 | Revenue Channels | Per-source 30/90/365d performance |
| `mv_pace_otb` | ~11 | Revenue Demand | OTB vs STLY by check-in month |
| `mv_arrivals_departures_today` | 4 (today) | Today, Ledger | Today's snapshot list |
| `mv_aged_ar` | ~94 | Finance Ledger | Open balances bucketed (0-30 / 31-60 / 61-90 / 90+) |
| `mv_capture_rates` | 1 | Overview, Roots, Spa | F&B/Spa/Activity per occupied roomnight + capture % |
| `mv_rate_inventory_calendar` | ~29,457 | Revenue Rates, Inventory | Forward 120 days |

## Field validation

| Entity | Field | Type | Required? | Validation | Owner |
|---|---|---|---|---|---|
| `reservations` | `reservation_id` | text | Y | unique | System |
| `reservations` | `property_id` | bigint | Y | match `hotels.property_id` | System |
| `reservations` | `status` | text | Y | one of: confirmed/canceled/checked_in/checked_out/no_show | System |
| `reservations` | `source_name` | text | recommended | from approved source list | Reservations |
| `reservations` | `market_segment` | text | **HIGH DQ ISSUE** | required by SOP, 82% NULL today | Reservations |
| `reservations` | `check_in_date` | date | Y | ISO 8601 | System |
| `reservations` | `check_out_date` | date | Y | > `check_in_date` | System |
| `reservations` | `nights` | int | Y | ≥ 1 | System |
| `reservations` | `adults` / `children` | int | Y | ≥ 0 | System |
| `reservations` | `total_amount` | numeric | Y | ≥ 0 (signed for credits) | System |
| `reservations` | `balance` | numeric | Y | unpaid amount | System |
| `reservations` | `currency` | text | Y | LAK/USD/EUR/THB | System |
| `reservation_rooms` | `night_date` | date | Y | within reservation range | System |
| `reservation_rooms` | `rate` | numeric | Y | rate=0 valid (comp/house-use) | System |
| `transactions` | `transaction_id` | text | Y | unique | System |
| `transactions` | `category` | text | Y | maps via `usali_category_map` | System |
| `transactions` | `item_category_name` | text | recommended | empty = falls through to description | F&B / Reservations |
| `transactions` | `description` | text | Y | used as classifier fallback | System |
| `transactions` | `amount` | numeric | Y | signed | System |
| `rooms` | `is_active` | bool | Y | false = blocked from inventory | System |
| `rooms` | `raw->>'roomBlocked'` | bool | Y | mirrors Cloudbeds | System |

## Approved enums

- `market_segment`: `Leisure-Direct`, `Leisure-OTA`, `Leisure-Wholesale`, `Corporate`, `Group`, `Complimentary`, `House-Use`
- `source_name` (top): `Booking.com`, `Expedia`, `Direct/Web`, `Walk-in`, `SLH.com`, `Direct/Email`, `Agoda`
- `room_status`: `Clean`, `Dirty`, `Inspected`, `OOO`, `OOS` *(not yet populated — scope blocked)*

## USALI tagging columns

`mv_classified_transactions` adds two columns to every transaction:
- `usali_dept` — one of: `Rooms` · `F&B` · `Other Operated` · `Retail` · `Tax` · `Fee` · `Adjustment` · `Misc Income` · `Unclassified`
- `usali_subdept` — e.g. `Food`, `Beverage`, `Minibar`, `Spa`, `Activities`, `Transportation`, `Laundry`, `Front Office`

See `04_USALI_MAPPING.md` for the rule library.

## Operational overrides

Use `operational_overrides` table to pin facts the PMS gets wrong without polluting raw data:

```sql
INSERT INTO operational_overrides
  (entity_type, entity_id, override_type, reason, set_by)
VALUES
  ('room', '508412-1', 'permanently_closed', 'Tent 7 retired', 'paul');
```

## DQ known issues

Use `dq_known_issues` table to park issues for the future DQ agent. Categories so far:
`PMS_USER_ERROR`, `MARKET_SEGMENT_NULL`, `UNCATEGORIZED_ITEMS`, `HOUSEKEEPING_SCOPE_MISSING`, `TENT_7_CLOSED` (fixed).
