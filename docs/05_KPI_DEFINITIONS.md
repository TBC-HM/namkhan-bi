# 05 — KPI Definitions

> Every KPI: formula, source view, owner, status. No KPI exists outside this doc.
> Status: ✅ live · ⏳ greyed · ❌ blocked

## Inventory denominator

- **Available Rooms** = 19 (Tent 7 retired permanently — see `operational_overrides`).
- All occupancy / RevPAR formulas use `v_property_inventory.total_rooms`, which respects `is_active=true`.

## Rooms KPIs

| KPI | Formula | Source view | Owner | Status |
|---|---|---|---|---|
| Occupancy % | rooms_sold / total_rooms | `mv_kpi_daily` | Revenue | ✅ |
| ADR | rooms_revenue / rooms_sold | `mv_kpi_daily` | Revenue | ✅ |
| RevPAR | rooms_revenue / total_rooms | `mv_kpi_daily` | Revenue | ✅ |
| TRevPAR | (rooms_revenue + total_ancillary_revenue) / total_rooms | `mv_kpi_daily` | Mgmt | ✅ |
| GOPPAR | GOP / total_rooms | needs cost upload | Mgmt | ⏳ |
| ALOS | sum(nights) / count(reservations) | `reservations` | Reservations | ✅ (computed in dashboard) |
| Cancellation % (90d) | canceled / total_bookings (last 90d) | `mv_kpi_today` | Revenue | ✅ (20.14% as of Apr 2026) |
| No-Show % (90d) | no_shows / non-canceled | `mv_kpi_today` | Reservations | ✅ |
| Lead Time (avg days, 90d) | check_in_date − booking_date | `mv_channel_perf.avg_lead_time_90d` | Revenue | ✅ |
| Booking Pace | OTB vs STLY | `mv_pace_otb` | Revenue | ✅ |
| OTB Next 90d | reservations between today and today+90 | `mv_kpi_today.otb_next_90d` | Revenue | ✅ |

## Segment & channel KPIs

| KPI | Formula | View | Status |
|---|---|---|---|
| Direct Mix % | Direct revenue / Total rooms revenue (90d) | `mv_channel_perf` | ✅ |
| OTA Mix % | OTA revenue / Total rooms revenue (90d) | `mv_channel_perf` | ✅ |
| ADR by source (90d) | source_revenue / source_nights | `mv_channel_perf.adr_90d` | ✅ |
| Source cancel % | canceled / bookings per source | `mv_channel_perf` | ✅ |
| Avg LOS by source | mean nights | `mv_channel_perf.avg_los_90d` | ✅ |
| OTA Commission % | commissions / OTA revenue | NOT YET — commissions field unmapped | ⏳ |
| Net ADR | (rooms rev − commissions) / occupied rooms | NOT YET | ⏳ |

## F&B KPIs (Roots)

| KPI | Formula | View | Status |
|---|---|---|---|
| F&B Revenue (Food) | sum where `usali_dept='F&B' AND usali_subdept='Food'` | `mv_kpi_daily.fnb_food_revenue` | ✅ |
| F&B Revenue (Beverage) | same with subdept='Beverage' | `mv_kpi_daily.fnb_beverage_revenue` | ✅ |
| F&B Revenue (Minibar) | same with subdept='Minibar' | `mv_kpi_daily.fnb_minibar_revenue` | ✅ |
| F&B per Occupied Room | F&B / occupied roomnights | `mv_capture_rates.fnb_per_occ_room` | ✅ |
| F&B Capture % | reservations with F&B / total reservations | `mv_capture_rates.fnb_capture_pct` | ✅ |
| Avg Cover (Food / Bev) | F&B rev / cover count | covers field not tracked in PMS | ⏳ |
| Top Sellers (30d) | rank by revenue | `mv_classified_transactions` aggregation in app | ✅ |

## Spa & Activity KPIs

| KPI | Formula | View | Status |
|---|---|---|---|
| Spa Revenue | sum where `usali_subdept='Spa'` | `mv_kpi_daily.spa_revenue` | ✅ |
| Activity Revenue | sum where `usali_subdept='Activities'` | `mv_kpi_daily.activity_revenue` | ✅ |
| Spa per Occ Rn | Spa / occupied roomnights | `mv_capture_rates.spa_per_occ_room` | ✅ |
| Spa Capture % | reservations with spa / total reservations | `mv_capture_rates.spa_capture_pct` | ✅ |
| Activity per Occ Rn | Activity / occupied roomnights | `mv_capture_rates.activity_per_occ_room` | ✅ |
| Activity Capture % | reservations with activity / total | `mv_capture_rates.activity_capture_pct` | ✅ |
| Therapist utilization | scheduled / available hours | external scheduler not integrated | ⏳ |

## Housekeeping KPIs

> ❌ All blocked: Cloudbeds `housekeeping:read` scope not granted on our API key.
> Open support ticket; until then, all HK KPIs are greyed.

| KPI | Formula | Status |
|---|---|---|
| Minutes per Room | total cleaning min / rooms cleaned | ❌ |
| Inspection Pass Rate | passed / total inspections | ❌ |
| OOO/OOS % | OOO+OOS / total | ❌ |
| Turnover Time | checkout → inspected ready (min) | ❌ |

## Guest KPIs

| KPI | Formula | Source | Status |
|---|---|---|---|
| Repeat Guest % | guests with ≥2 stays / total guests | `guests` table | ⏳ (queryable; not on dashboard yet) |
| Email Capture % | guests with valid email / total | `guests.email` | ⏳ (queryable in Ledger) |
| Geo Mix | % by country | `reservations.guest_country` | ⏳ (queryable; not yet on dashboard) |

## Finance KPIs

| KPI | Formula | View | Status |
|---|---|---|---|
| USALI Revenue × Dept × Month | from classified transactions | `mv_revenue_by_usali_dept` | ✅ |
| Aged AR (0-30/31-60/61-90/90+) | open balance bucketed by days post-checkout | `mv_aged_ar` | ✅ |
| In-house Balance | sum balance for in-house guests | `mv_arrivals_departures_today` | ✅ |
| High-balance flags | in-house balance > $1,000 | derived in app | ✅ |
| Missing email | reservations 90d with NULL email | derived in app | ✅ |
| Cost % Revenue | costs / revenue | needs cost upload | ⏳ |
| EBITDA | revenue − OpEx − payroll | needs cost upload | ⏳ |

## Reporting cadence

| Cadence | Trigger | Output |
|---|---|---|
| 15 min | `pg_cron` → `refresh_bi_views()` | Materialized views refreshed |
| Daily flash (planned) | 09:00 LAK | Slack/Telegram digest — Phase 2 |
| Weekly | Monday 10:00 | Owner review session |
| Monthly | Day 5 | USALI P&L pack |

## Reconciliation rules

When checking a number that "looks awkward":

1. Run the SQL from the relevant view directly in Supabase SQL editor.
2. Compare to Cloudbeds Insights / native reports.
3. If gap > 5%, check `mv_classified_transactions` for `usali_dept='Unclassified'`.
4. If `Unclassified` is high, add patterns to `usali_category_map`.
5. If gap remains, flag as DQ issue in `dq_known_issues`.
