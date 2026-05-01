# 15 · Supabase Architecture

**Version:** 2.0
**Last updated:** 2026-05-01
**Project:** `kpenyneooigsyuuomgct` (namkhan-pms)
**Property:** `260955` (The Namkhan, Luang Prabang)
**Postgres:** 17.6.1.111
**Region:** eu-central-1

---

## What changed since v1 (significant)

This version supersedes the architecture doc dated 2026-04-26. Key changes:

| Area | What changed | Why |
|---|---|---|
| `v_property_inventory` | Now sources from `room_types.quantity` (sum of bookable types) instead of `count(*)` from `public.rooms` | Old version returned 19; correct value is 24. Cloudbeds doesn't materialize individual rooms for inventory-pool types. |
| Capacity columns | Three modes now exposed: `capacity_selling` (24), `capacity_live` (30), `capacity_total` (30) | Frontend `?cap=` toggle lets user switch between USALI orthodox and owner-ROI views |
| `mv_kpi_today` | Counts ROOMS not reservations for `in_house`, `arrivals_today`, `departures_today`, `otb_next_90d` | Multi-room bookings were undercount; family booking 2 rooms = 1 in old logic, now correctly = 2 |
| `mv_kpi_daily` | Includes `capacity_selling`, `capacity_live`, `capacity_total` columns | Frontend `aggregateDaily(rows, mode)` picks correct denominator |
| `mv_channel_perf` | ADR is room-night based: `sum(rate)/sum(roomnights)` instead of `sum(total_amount)/sum(nights)` | Group bookings inflated ADR by ~$40 (Booking.com showed $311 instead of true $204) |
| `mv_channel_perf.bookings_*d` | Now excludes canceled (matches revenue scope) | Old version had numerator/denominator scope mismatch |
| `v_commission_lookup` | NEW — fuzzy-name bridge view | `sources.name = 'Booking.com (Hotel Collect Booking)'` ≠ `reservations.source_name = 'Booking.com'` — direct join always failed |
| `mv_channel_economics` | NEW — period-keyed (window_days ∈ {7,30,60,90,180,365}) | Frontend Channels page can pick exact window instead of being stuck at 90d |
| `mv_channel_x_roomtype` | NEW — period-keyed (window_days ∈ {30,90,365}) | Powers OTA × Room-type matrix on Channels page |
| Unique indexes | Added on `mv_kpi_today`, `mv_kpi_daily`, `mv_capture_rates` | Cron's `REFRESH CONCURRENTLY` had been failing silently for 2+ days |
| Cron job 28 | NEW — `refresh-channel-economics` daily at 02:15 UTC | Refreshes the new period-keyed channel matviews |

**Real-data verification (today, 2026-05-01):**

| Check | Value |
|---|---|
| Today capacity | 24 ✅ |
| Today in-house | 7 ✅ |
| `mv_kpi_today.as_of` | 2026-05-01 (fresh) ✅ |
| `mv_kpi_daily` row count | 2,837 nights (2019-01-11 → 2027-02-18) |
| Booking.com 90d ADR | $203.80 (was $311 buggy) ✅ |
| Active channels 90d | 17 |
| Pulse 90d occupancy (selling) | 36.9% (was 46.6% buggy) ✅ |
| Pulse 90d occupancy (total) | 29.5% |
| `mv_channel_economics` rows with bookings | 120 (across 6 windows × ~20 sources) |
| Capture-rate departments | 4 (F&B, Spa, Activities, Retail) |

---

## Schemas — high level

| Schema | Tables | Views | Matviews | Functions | Purpose |
|---|---|---|---|---|---|
| `public` | 37 | 26 | 13 | many | Core PMS data, BI matviews — main BI surface |
| `kpi` | 2 | 18 | 0 | 29 | KPI calc layer (pre-matview), helpers |
| `dq` | 3 | 5 | 0 | 1 | Data quality engine |
| `gl` | 9 | 4 | 0 | 8 | General ledger, FX rates, GL postings |
| `governance` | 14 | 1 | 0 | 2 | Agent registry, runs, mandates, prompts |
| `docs` | 21 | 2 | 0 | 2 | Documents, SOPs, expiry alerts |
| `marketing` | 4 | 0 | 0 | 0 | Reviews, social, influencers, media |
| `frontoffice` | 9 | 0 | 0 | 3 | FO arrivals queue, room assignments |
| `ops` | 23 | 5 | 0 | 0 | Ops checklists, incidents, tasks |
| `fb` / `spa` / `activities` | 7+5+6 | 0 | 0 | 0 | Department-specific (POS-pending) |
| `guest` | 6 | 0 | 0 | 0 | Guest profiles, preferences, comms |
| `knowledge` | 4 | 0 | 0 | 0 | SOP metadata, prompt library |
| `alerts` / `seo` / `plan` / `training` / `app` / `auth_ext` | various | various | 0 | various | Supporting schemas |

PostgREST exposes only `public` and `graphql_public` by default. **`marketing` and `governance` need to be added in Dashboard → API → Exposed schemas** for the Guest and Agents pages to render data.

---

## Core tables (`public` schema)

Source-of-truth Cloudbeds data. Synced via `cb_hourly_refresh()` and `daily-cold-sync` cron.

| Table | Rows | RLS | Notes |
|---|---|---|---|
| `hotels` | 1 | ✅ | Property metadata |
| `room_types` | 10 | ✅ | Room types with `quantity` field — capacity source of truth |
| `rooms` | 20 | ✅ | Individual rooms; **DO NOT use `count(*)` for capacity** (Cloudbeds doesn't materialize all rooms for inventory pools) |
| `reservations` | 4,749 | ✅ | Booking-level. `nights` = stay length. `total_amount` = full booking total incl. extras |
| `reservation_rooms` | 46,423 | ✅ | One row per (reservation × night × room). `rate` = nightly room rate (USALI room revenue source) |
| `rate_plans` | 109 | ✅ | Rate plan catalogue |
| `rate_inventory` | 88,863 | ✅ | Forward-looking BAR & inventory per (date × room_type × rate_plan) |
| `transactions` | 76,001 | ✅ | All charges/payments. Classified into USALI buckets via `mv_classified_transactions` |
| `add_ons` | 19,170 | ✅ | Custom items (F&B, spa, activities, retail) |
| `tax_fee_records` | 19,225 | ✅ | Tax/fee line items |
| `adjustments` | 349 | ✅ | Manual GL adjustments |
| `daily_metrics` | 851 | ✅ | Cloudbeds-supplied daily aggregates (legacy, prefer `mv_kpi_daily`) |
| `channel_metrics` | 516 | ✅ | Cloudbeds-supplied channel aggregates (commission column NOT populated; use `mv_channel_economics` instead) |
| `guests` | 4,111 | ✅ | Guest profiles |
| `groups` | 20 | ✅ | Group bookings |
| `house_accounts` | 1,035 | ✅ | Folios |
| `sources` | 117 | ✅ | Booking sources / channels with `commission_pct` (use via `v_commission_lookup` due to naming mismatch) |
| `usali_category_map` | 177 | ✅ | Item → USALI department mapping |
| `payment_methods` | 10 | ✅ | Payment method types |
| `items` | 451 | ✅ | Sellable item catalogue |
| `taxes_and_fees_config` | 4 | ✅ | Tax/fee definitions |
| `sync_runs` | 99 | ✅ | Cloudbeds sync log |
| `sync_request_queue` | 853 | ✅ | Queued cold-sync requests |
| `sync_watermarks` | 21 | ✅ | Per-resource sync timestamps |
| `dq_known_issues` | 6 | ✅ | DQ allowlist (suppress known false positives) |
| `operational_overrides` | 1 | ✅ | Manual data overrides |
| `app_users` | 1 | ❌ | App-level users |
| `app_settings` | 9 | ❌ | App settings |
| `action_decisions` | 0 | ❌ | Action card decisions log |

---

## Materialized views (`public` schema)

The frontend reads almost exclusively from these. All have unique indexes (required for `REFRESH CONCURRENTLY`).

| Matview | Size | Refresh | Purpose | Notes |
|---|---|---|---|---|
| `mv_classified_transactions` | 11 MB | every 15 min | Per-transaction USALI classification | Foundation for revenue attribution |
| `mv_kpi_daily` | 512 kB | every 15 min | Per-night Occ/ADR/RevPAR/TRevPAR + revenue by USALI dept | **Now exposes `capacity_selling/live/total` columns for the FE toggle** |
| `mv_kpi_today` | 8 kB | every 15 min | Today snapshot (in_house, arrivals, departures, OTB next 90, cancel%, no-show%) | **Counts ROOMS not reservations now** |
| `mv_kpi_daily_by_segment` | 288 kB | every 15 min | Per-segment daily KPIs | 2,868 rows · 7 segments × ~410 days |
| `mv_revenue_by_usali_dept` | 24 kB | every 15 min | Monthly revenue rollup by USALI department | Powers Finance P&L |
| `mv_channel_perf` | 8 kB | every 15 min | Per-source 30/90/365d KPIs | **ADR is room-night based; bookings_*d excludes canceled** |
| `mv_pace_otb` | 8 kB | every 15 min | OTB vs STLY by check-in month | Powers Demand pace table |
| `mv_arrivals_departures_today` | 8 kB | every 15 min | Today's arrival/departure list with guest details | |
| `mv_aged_ar` | 24 kB | every 15 min | Aged receivables by bucket | Pre-stay deposits separated from true AR (B8 fix) |
| `mv_capture_rates` | 8 kB | every 15 min | F&B/Spa/Activities/Retail capture % per dept | Restored after CASCADE drop in 2026-05-01 |
| `mv_rate_inventory_calendar` | 3.7 MB | every 15 min | Per-date BAR & inventory | Powers Rates and Inventory pages |
| `mv_guest_profiles` | 1.1 MB | every 15 min | Guest enrichment (LTV, repeat, VIP flags) | |
| `mv_channel_economics` | 32 kB | daily 02:15 UTC | Period-keyed channel economics with commission | NEW · window_days ∈ {7,30,60,90,180,365} |
| `mv_channel_x_roomtype` | 64 kB | daily 02:15 UTC | OTA × Room-type matrix | NEW · window_days ∈ {30,90,365} |

---

## Key views (`public` schema)

| View | Purpose | Notes |
|---|---|---|
| `v_property_inventory` | Capacity per property | **Default `total_rooms = capacity_selling = 24`. Exposes `capacity_selling/live/total` columns** |
| `v_property_totals` | Authoritative capacity counts | Source for `v_property_inventory` |
| `v_property_capacity` | (legacy) | Same intent as `v_property_totals` |
| `v_commission_lookup` | NEW · Fuzzy-name commission bridge | Resolves `'Booking.com'` → `'Booking.com (Hotel Collect Booking)'` etc. |
| `v_kpi_daily` | Legacy daily metrics view | Reads from `daily_metrics`; prefer `mv_kpi_daily` |
| `v_arrivals_today`, `v_departures_today`, `v_inhouse` | Real-time today views | Used by `mv_arrivals_departures_today` |
| `v_alos_30d`, `v_lead_time`, `v_lead_time_buckets` | Aggregate booking-pattern views | |
| `v_channel_mix`, `v_channel_mix_30d`, `v_channel_summary` | Legacy channel views | Prefer `mv_channel_perf` and `mv_channel_economics` |
| `v_country_mix`, `v_country_mix_30d` | Geographic mix | Powers Guest analytics |
| `v_otb_pace`, `v_pickup_30d` | Pace and pickup | Used by `mv_pace_otb` |
| `v_repeat_guests`, `v_guests_linked`, `v_reservations_linked` | Guest enrichment | |
| `v_revenue_usali`, `v_room_type_perf`, `v_cancellation_rate`, `v_last_7_days` | Misc helpers | |

---

## KPI formulas — verified USALI 11th edition aligned

| KPI | Source | Formula | Notes |
|---|---|---|---|
| **Occupancy %** | `mv_kpi_daily.occupancy_pct` + FE `aggregateDaily(rows, mode)` | `rooms_sold / capacity_<mode>` per night, summed | FE picks `capacity_selling/live/total` based on `?cap=` |
| **ADR** | `mv_kpi_daily.adr` | `sum(rr.rate) / count(roomnights)` per night | Room-only revenue; `rr.rate` from `reservation_rooms` |
| **RevPAR** | `mv_kpi_daily.revpar` + FE recompute | `rooms_revenue / capacity_<mode>` | Mode-aware via FE |
| **TRevPAR** | `mv_kpi_daily.trevpar` + FE recompute | `(rooms_revenue + total_ancillary_revenue) / capacity_<mode>` | Mode-aware |
| **In-house** | `mv_kpi_today.in_house` | `count(*) FROM reservation_rooms WHERE night_date = today AND status NOT IN (canceled, no_show)` | **Counts rooms, not bookings** |
| **Arrivals today** | `mv_kpi_today.arrivals_today` | rooms checking in today | Not bookings |
| **Departures today** | `mv_kpi_today.departures_today` | rooms checking out today | Not bookings |
| **OTB next 90d** | `mv_kpi_today.otb_next_90d` | room-nights to be sold | Not bookings |
| **Cancel %** | `mv_kpi_today.cancellation_pct_90d` | `canceled / total bookings` (booking_date last 90d) | |
| **No-show %** | `mv_kpi_today.no_show_pct_90d` | `no_shows / non-canceled` (check-in last 90d) | |
| **Channel ADR** | `mv_channel_perf.adr_90d` | `sum(rate) / sum(roomnights)` | Was `total_amount/nights` — fixed for group bookings |
| **Channel ALOS** | `mv_channel_perf.avg_los_90d` | `avg(reservations.nights)` per booking | Booking-level, industry standard |
| **Channel lead time** | `mv_channel_perf.avg_lead_time_90d` | `avg(check_in_date - booking_date)` per booking | Booking-level |
| **Channel bookings** | `mv_channel_perf.bookings_30d/90d/365d` | non-canceled count | Now matches revenue scope |
| **Channel commissions** | `mv_channel_economics.commission_usd` | `revenue × v_commission_lookup.commission_pct / 100` | Period-keyed; uses fuzzy-name lookup |
| **Capture rate** | `mv_capture_rates.capture_rate_pct` per dept | `% guests purchasing in dept` | F&B / Spa / Activities / Retail |
| **Spend per OccRn** | `mv_capture_rates.spend_per_occ_room` per dept | `revenue / occupied roomnights` | |

---

## Capacity-mode toggle (NEW)

**URL param:** `?cap=selling | live | total` on any page. Default: `selling`.

| Mode | Value | Definition | When to use |
|---|---|---|---|
| `selling` | 24 | Room types with bookings in last 90d | USALI default; market-facing inventory |
| `live` | 30 | All currently-marketable room types incl. soon-launching | Forward-looking capacity |
| `total` | 30 | All physical room types in PMS | Owner ROI on capital deployed |

**Backend support:** `mv_kpi_daily` exposes all three columns:
- `capacity_selling` = 24
- `capacity_live` = 30
- `capacity_total` = 30
- `total_rooms` = `capacity_selling` (default for legacy callers)

**Frontend support:** `lib/period.ts`'s `resolvePeriod(searchParams)` returns `period.capacityMode`. `lib/data.ts`'s `aggregateDaily(rows, mode)` picks the right denominator. `FilterStrip` renders a dropdown after Segment.

**Persistence:** URL-only. Resets when crossing pillar boundaries (`/revenue/*` → `/operations/*`) via `CapacityResetOnPillarChange` client component.

---

## Cron jobs (15 active)

| jobid | Name | Schedule | Purpose |
|---|---|---|---|
| 5 | `daily-cold-sync` | 0 20 * * * | Full Cloudbeds resync at 20:00 UTC |
| 6 | `monthly-close-prep` | 0 19 28-31 * * | Month-end close prep + DQ run |
| 7 | `dq-engine-run` | 15 */4 * * * | DQ checks every 4 hours |
| 8 | `dq-daily-digest` | 0 1 * * * | Daily DQ alert email at 01:00 UTC |
| **9** | **`refresh_bi_views_15min`** | **\*/15 * * * *** | **Refresh all 12 core matviews (`refresh_bi_views()`)** |
| 10 | `docs_expiry_alerts` | 0 23 * * * | Document expiry notifications |
| 20 | `hourly-refresh` | 0 * * * * | Cloudbeds hot-data sync |
| 21 | `kpi-daily-snapshot` | 30 22 * * * | Snapshot day's KPIs to history |
| 22 | `kpi-freshness-check` | */30 * * * * | Stale matview alerting |
| 23 | `agent-snapshot_agent` | 0 0-16 * * * | Queue snapshot agent every hour 00-16 UTC |
| 24 | `agent-pricing_agent` | 5 0-16 * * * | Queue pricing agent |
| 25 | `agent-variance_agent` | 0 0 * * * | Queue variance agent daily |
| 26 | `agent-cashflow_agent` | 15 0 * * * | Queue cashflow agent daily |
| 27 | `agent-forecast_agent` | 0 */6 * * * | Queue forecast agent every 6h |
| **28** | **`refresh-channel-economics`** | **15 2 * * *** | **NEW · Refresh `mv_channel_economics` and `mv_channel_x_roomtype` daily at 02:15 UTC** |

**Important:** Job 9 (`refresh_bi_views_15min`) had been failing for 2+ days because three matviews lacked unique indexes. Fixed 2026-05-01. Last successful run: 13:45 UTC today. Self-healing from here.

Agent jobs (23-27) only **queue** runs into `governance.agent_runs`. The Edge Function `agent-runner` (F1) that consumes the queue and calls Anthropic is **not yet deployed** — `agent_runs` table will stay empty until F1 ships.

---

## Refresh function

```sql
-- public.refresh_bi_views() — runs every 15 min via cron job 9
BEGIN;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_classified_transactions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_daily;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_kpi_daily_by_segment;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_revenue_by_usali_dept;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_channel_perf;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_pace_otb;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_arrivals_departures_today;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_aged_ar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_capture_rates;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_rate_inventory_calendar;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_guest_profiles;
COMMIT;
```

The new period-keyed channel matviews are NOT in this function (they refresh once daily via cron job 28 because they're heavier and don't need 15-min freshness).

---

## Schema details

### `kpi` schema (29 functions, 18 views)

Pre-matview KPI calc layer. Frontend rarely reads from these directly — they exist as composable helpers that matviews depend on.

Notable views:
- `kpi.v_capture_rate_daily` — per-day F&B/Spa/Activities/Retail capture rates
- `kpi.v_capture_by_subdept` — subdepartment breakdown
- `kpi.v_channel_economics` — single-window economics (legacy; prefer `mv_channel_economics`)
- `kpi.v_occupancy_base` — primitive occupancy data
- `kpi.v_ancillary_daily` — ancillary revenue per day

Notable functions:
- `kpi.snapshot_today()` — runs at 22:30 UTC, persists today's KPIs to history
- `kpi.check_freshness(threshold_min)` — alerts on stale matviews
- `kpi.run_all()` — full DQ + KPI batch (used by monthly-close-prep)

### `governance` schema (14 tables, 1 view)

Agent registry, run history, mandates, prompts.

| Table | Rows | Purpose |
|---|---|---|
| `agents` | 27 | Agent definitions per pillar |
| `agent_runs` | 0 | Run history (empty until F1 deploys) |
| `mandate_rules` | varies | Health pill / breach rules |
| `prompts` | varies | Agent prompt versions |
| `proposals` | varies | Agent-generated proposals queue |
| (others) | varies | Decisions, approvals, costs, traces |

**Not exposed in PostgREST by default.** Owner must add `governance` to Dashboard → API → Exposed schemas for agent pages to render.

### `marketing` schema (4 tables)

| Table | Rows | Purpose |
|---|---|---|
| `social_accounts` | 7 | Configured social media accounts |
| `reviews` | varies | Review aggregation (TripAdvisor, Booking, Google) |
| `influencers` | varies | Influencer outreach tracking |
| `media` | varies | Media mention tracking |

**Not exposed in PostgREST by default.** Owner must add `marketing` to exposed schemas.

### `dq` schema (3 tables, 5 views, 1 function)

Data quality engine.

| Object | Purpose |
|---|---|
| `dq.checks` | Check definitions |
| `dq.issues` | Issue history |
| `dq.allowlist` | Known-acceptable issues to suppress |
| `dq.run_all()` | Runs all checks (cron job 7 every 4h) |

### `gl` schema (9 tables, 4 views, 8 functions)

General ledger and FX.

| Object | Purpose |
|---|---|
| `gl.fx_rates` | Daily FX rates (LAK ↔ USD/EUR/THB) |
| `gl.entries` | GL postings |
| `gl.accounts` | Chart of accounts |
| `gl.fn_post_revenue()` | Auto-post revenue from transactions |
| (others) | Postings, batches, periods |

LAK = base currency, USD = communication/display currency.

### `frontoffice` schema (9 tables, 3 functions)

Front office operational state.

| Table | Purpose |
|---|---|
| `frontoffice.arrivals` | Today's arrivals queue with prep status |
| `frontoffice.room_assignments` | Per-night room assignments |
| (others) | Check-in/out logs, room blocks |

### `docs` schema (21 tables)

Document management for SOPs, contracts, certifications.

21 SOPs seeded with `knowledge.sop_meta` extension (department, kind, agent consumers, review cadence).

---

## PostgREST exposure status

Currently exposed:
- `public` ✅
- `graphql_public` ✅

Need to add (owner action — Dashboard → API → Exposed schemas):
- `marketing` (Guest tab depends on it)
- `governance` (Agents tab depends on it)

Without these, `supabase.schema('marketing').from('reviews')` returns 401/empty even though data exists.

---

## Key invariants

These invariants must always hold. If a query result violates them, the system is broken.

| Invariant | Check | Action if violated |
|---|---|---|
| Capacity = 24 selling, 30 total | `SELECT * FROM v_property_inventory` | Verify `room_types.quantity` sums and view definition |
| Today's `mv_kpi_today.as_of = current_date` | `SELECT as_of FROM mv_kpi_today` | Cron job 9 is failing; check `cron.job_run_details` |
| All matviews have unique indexes | Compare `pg_class` vs `pg_index` | Cron `REFRESH CONCURRENTLY` will fail; add unique idx |
| `mv_kpi_daily` row count ≥ 2,800 | `SELECT count(*) FROM mv_kpi_daily` | View was dropped or refresh failed |
| `mv_kpi_daily.rooms_sold ≤ total_rooms` for nights post-2024-07 | `SELECT count(*) FROM mv_kpi_daily WHERE rooms_sold > total_rooms AND night_date >= '2024-07-01'` | Capacity wrong or sold count buggy |
| ADR via `mv_kpi_daily` ≈ ADR via `mv_channel_perf` (within 5%) | Compare $213 (Pulse) vs $204 (Booking.com 90d) | Multi-room booking accounting bug |
| Cron job 9 succeeded in last 30 min | `SELECT max(start_time) FROM cron.job_run_details WHERE jobid=9 AND status='succeeded'` | Cron broken |

---

## Migration history (chronological)

| Date | Migration | What |
|---|---|---|
| Pre-2026-04-26 | (initial schema) | Original Cloudbeds sync + matviews |
| 2026-04-26 | `audit_capacity_fix` (attempted, never applied) | First attempt to fix capacity bug — patch existed but wasn't applied to live |
| 2026-04-30 | `audit_fix_initial` | Multi-page period-aware refactor planned (only Snapshot/Pulse landed) |
| 2026-04-30 | `b8_aged_ar_split` | Split pre-stay deposits from true AR in `mv_aged_ar` |
| 2026-05-01 | `kpi_master_repair_2026_05_01` | Unique indexes + `v_property_inventory` rewrite |
| 2026-05-01 | `kpi_calc_repair_2026_05_01_v2` | `mv_kpi_today` + `mv_channel_perf` rebuild with room-count semantics |
| 2026-05-01 | `restore_mv_kpi_daily_with_capacity_modes` | `mv_kpi_daily` with three capacity columns |
| 2026-05-01 | `restore_mv_capture_rates` | Restored after CASCADE drop |
| 2026-05-01 | (prior session) | `v_commission_lookup` + `mv_channel_economics` + `mv_channel_x_roomtype` |

All migrations are stored in `supabase_migrations.schema_migrations` (the Supabase migrations tracking table).

---

## Anti-patterns to avoid

| Don't | Why | Use instead |
|---|---|---|
| `SELECT count(*) FROM rooms` for capacity | Returns 19 (Cloudbeds inventory pools) | `SELECT total_rooms FROM v_property_inventory` |
| `count(DISTINCT reservation_id)` for room counts | Multi-room bookings undercount | `count(*)` from `reservation_rooms` |
| `total_amount / nights` for ADR | Group bookings inflate this | `sum(rr.rate) / count(rr)` from `reservation_rooms` |
| `JOIN sources s ON s.name = r.source_name` directly | Naming mismatch (Cloudbeds adds suffixes) | `JOIN v_commission_lookup cl ON cl.source_name = r.source_name` |
| Hardcode 90d windows in pages | Decorative selectors | Call `resolvePeriod(searchParams)` and respect `?win=` |
| Create matview without unique index | Cron's `REFRESH CONCURRENTLY` fails silently for days | Always add unique idx after CREATE |
| `DROP VIEW v_x CASCADE` | Silently drops dependent matviews | Use `RESTRICT` and recreate dependents in same migration |
| Read from `daily_metrics` | Cloudbeds-supplied legacy | Use `mv_kpi_daily` |
| Read from `channel_metrics.commission_amount` | Field is NULL for all rows | Use `mv_channel_economics.commission_usd` |

---

## What still needs work (next sessions)

| Item | Priority | Notes |
|---|---|---|
| F1 Edge Function `agent-runner` | High | Without it `governance.agent_runs` stays empty |
| Real Cloudbeds source → segment mapping | High | Segment dropdown is regex sketch; needs RM business decision |
| Expose `marketing` + `governance` in PostgREST | High | 30-second Dashboard change · unblocks Guest + Agents tabs |
| `governance.mandate_rules` driving health pills | Med | Currently hardcoded heuristic |
| GOPPAR / EBITDA / Cost % | Med | Needs expense data ingestion |
| OOO/OOS rooms | Med | Cloudbeds `housekeeping:read` 403 — open ticket |
| Forecast vs Budget | Med | Owner uploads budget data |
| Comp Set scraper | Low | Phase 2 |
| F&B/Spa/Activities POS integration | Low | Phase 2 |

---

## Verification queries

Quick sanity checks run any time:

```sql
-- Capacity must be 24
SELECT total_rooms, capacity_selling, capacity_live, capacity_total
FROM public.v_property_inventory;
-- Expect: 24 | 24 | 30 | 30

-- Today snapshot
SELECT as_of, total_rooms, in_house, arrivals_today, departures_today, otb_next_90d
FROM public.mv_kpi_today;
-- Expect: today's date | 24 | (current count) | (current) | (current) | (current)

-- Cron health
SELECT jobid, status, start_time
FROM cron.job_run_details
WHERE jobid IN (9, 28)
ORDER BY start_time DESC LIMIT 5;
-- Expect: status='succeeded' on most recent runs

-- Pulse 90d sanity
SELECT
  ROUND(100.0 * sum(rooms_sold) / (count(*) * 24), 2) AS occ_selling,
  ROUND(sum(rooms_revenue) / NULLIF(sum(rooms_sold),0)::numeric, 2) AS adr,
  ROUND(sum(rooms_revenue) / (count(*) * 24)::numeric, 2) AS revpar
FROM public.mv_kpi_daily
WHERE night_date BETWEEN current_date - 89 AND current_date;
-- Expect (today): ~36.9 | ~213 | ~78.5

-- Channel ADR sanity (Booking.com 90d)
SELECT source_name, bookings_90d, canceled_90d, revenue_90d, roomnights_90d, adr_90d
FROM public.mv_channel_perf
WHERE source_name = 'Booking.com';
-- Expect: ~108 bookings | ~52 canceled | ~$65k | ~320 RN | ~$204 ADR

-- Commission lookup sanity
SELECT source_name, commission_pct
FROM public.v_commission_lookup
WHERE source_name IN ('Booking.com', 'Expedia', 'CTrip / Trip.com')
ORDER BY 1;
-- Expect: 18% / 18% / 18%
```

---

## Files / docs cross-reference

| Doc | Covers |
|---|---|
| `00_README.md` | Project overview |
| `01_SCOPE_AND_MODULES.md` | The 4 modules (SOP / DQ / BI / Recommendations) |
| `02_CLOUDBEDS_API_REFERENCE.md` | Cloudbeds endpoint mapping |
| `03_DATA_MODEL_AND_FIELDS.md` | Field-level data dictionary |
| `04_USALI_MAPPING.md` | USALI 11th edition category mapping |
| `05_KPI_DEFINITIONS.md` | Authoritative KPI definitions |
| `06_DATA_QUALITY_RULES.md` | DQ check definitions |
| `08_BI_DASHBOARDS_SPEC.md` | Page-by-page BI spec |
| `13_PHASE1_SYNC_AUDIT.md` | Initial sync audit |
| `14_MOCKUP_VS_DATA_AUDIT.md` | UI vs data gap analysis |
| **`15_SUPABASE_ARCHITECTURE.md`** | **This doc** |
| `16_SESSION_HANDOFF.md` | Session-to-session task handoffs |
| `docs/handoffs/COWORK_HANDOFF_2026-05-01.md` | Latest frontend PR handoff |

---

**End of architecture doc.**