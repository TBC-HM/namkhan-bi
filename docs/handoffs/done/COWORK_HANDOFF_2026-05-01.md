> ✅ Completed 2026-05-01 by Cowork session. Frontend shipped via deploy 3k5wneorc; capacity-mode toggle live (?cap=selling|live|total). All KPI math matches backend SQL: pulse 90d 36.9% selling / 29.5% total, ADR \$213, RevPAR \$78.53/\$62.82.

# Namkhan BI Repair — Cowork Handoff

**File:** `COWORK_HANDOFF_2026-05-01.md`
**Status:** Backend repaired live. Frontend changes documented, not yet pushed.
**Repo:** github.com/TBC-HM/namkhan-bi
**Supabase:** `kpenyneooigsyuuomgct` (namkhan-pms)
**Live:** https://namkhan-bi.vercel.app

---

## TL;DR for Cowork

Backend is fixed. Frontend has 11 file changes ready to apply. Math is now USALI-correct.

| Layer | Status |
|---|---|
| Supabase matviews / views | ✅ Applied live |
| Cron pipeline | ✅ Self-healed |
| Frontend `lib/period.ts` | ⏸ Code ready, not pushed |
| Frontend `lib/data.ts` | ⏸ Code ready, not pushed |
| Frontend `FilterStrip.tsx` | ⏸ Code ready, not pushed |
| 9 page replacements | ⏸ Code ready, not pushed |
| Charts on Overview / Pulse | ⏸ Patch ready, not pushed |

---

## Bugs found (this session)

| # | Bug | Symptom | Root cause | Fix |
|---|---|---|---|---|
| 1 | Cron failing every 15 min for 2+ days | `mv_kpi_today.as_of` stuck at 2026-04-29 | `REFRESH CONCURRENTLY` failed because `mv_kpi_daily`, `mv_kpi_today`, `mv_capture_rates` lacked unique indexes | Added unique indexes |
| 2 | Capacity = 19 not 24 | All occupancy inflated 26%; Pulse 90d showed 46.6% (correct: 36.9%) | `v_property_inventory` counted `public.rooms` (19) instead of summing `room_types.quantity` (24) | Rewrote view to source from `v_property_totals` |
| 3 | In-house = 3 vs reality 7 | Ops dashboard wrong | Stale matview from bug #1 | Refreshed |
| 4 | `mv_kpi_today.in_house` counted reservations not rooms | Multi-room bookings undercount | `count(DISTINCT reservation_id)` in matview | Rebuilt with `count(*)` from `reservation_rooms` |
| 5 | Arrivals/Departures counted reservations not rooms | Same | Same | Same |
| 6 | `mv_channel_perf.adr_90d` = $311 (Booking.com) vs true $204 | Multi-room group bookings inflate ADR | `sum(total_amount)/sum(nights)` divided by stay-length not roomnights | Rebuilt: `sum(rate)/sum(roomnights)` |
| 7 | `mv_channel_perf.bookings_*d` included canceled, revenue excluded | Comparable scope mismatch | Wrong filter | Rebuilt with consistent scope, separate canceled column |
| 8 | `sources.commission_pct` join failed for OTAs | "DATA NEEDED" tile + $24.8k fake number | `'Booking.com' ≠ 'Booking.com (Hotel Collect Booking)'` | New `v_commission_lookup` view with fuzzy prefix match |
| 9 | 8 pages ignored window/compare/segment selectors | Dropdowns purely decorative | Pages didn't call `resolvePeriod()` | Replacement files documented (this PR) |
| 10 | Charts on Overview/Pulse hardcoded 90d regardless of selector | Chart didn't match tile numbers | Comment in code: "independent of selected period" | Patch to use `period.from..to` |
| 11 | `aggregateDaily()` used last-row capacity | Multi-night windows with capacity change broke | `availableRn = days × LAST total_rooms` | Sum per-night capacity from chosen mode column |
| 12 | No capacity-mode toggle | Couldn't switch between Selling (24) / Live (30) / Total (30) | Not built | New `?cap=` URL param + dropdown in FilterStrip |

---

## SQL changes — already live in Supabase

These were applied via `Supabase:apply_migration` and `Supabase:execute_sql`. **No action needed — they're done.**

| Object | Migration name | What it does |
|---|---|---|
| Unique indexes on 3 matviews | `kpi_master_repair_2026_05_01` | Enables `REFRESH CONCURRENTLY` |
| `v_property_inventory` | `kpi_master_repair_2026_05_01` | Now sources from `v_property_totals`, exposes 3 capacity columns |
| `mv_kpi_today` | `kpi_calc_repair_2026_05_01_v2` | Counts rooms not reservations |
| `mv_kpi_daily` | `restore_mv_kpi_daily_with_capacity_modes` | Includes `capacity_selling/live/total` columns |
| `mv_channel_perf` | `kpi_calc_repair_2026_05_01_v2` | Room-night ADR; non-canceled bookings count |
| `mv_capture_rates` | `restore_mv_capture_rates` | Restored after CASCADE drop |
| `v_commission_lookup` | (prior session) | Fuzzy-name commission bridge |
| `mv_channel_economics` | (prior session) | Period-keyed (`window_days ∈ {7,30,60,90,180,365}`) |
| `mv_channel_x_roomtype` | (prior session) | OTA × Room-type matrix |

**Verified live values:**

- `mv_kpi_today.total_rooms` = 24 ✅
- `mv_kpi_today.in_house` = 7 ✅
- `mv_kpi_today.as_of` = today ✅
- `mv_kpi_daily` today occupancy = 29.17% (7÷24) ✅
- `mv_channel_perf` Booking.com ADR 90d = $203.80 (was $311) ✅
- Pulse 90d occupancy = 36.9% selling / 29.5% total ✅
- Cron status = succeeded at 13:45 UTC ✅

---

## Frontend changes — to be applied by Cowork

### File list

| # | Path | Action |
|---|---|---|
| 1 | `lib/period.ts` | Replace |
| 2 | `lib/data.ts` | Patch (`aggregateDaily` signature + 2 new helpers) |
| 3 | `components/nav/FilterStrip.tsx` | Replace |
| 4 | `components/nav/CapacityResetOnPillarChange.tsx` | New file |
| 5 | `app/layout.tsx` | Patch (mount the reset component) |
| 6 | `app/today/page.tsx` | Replace |
| 7 | `app/operations/today/page.tsx` | Replace |
| 8 | `app/operations/restaurant/page.tsx` | Replace |
| 9 | `app/operations/spa/page.tsx` | Replace |
| 10 | `app/operations/activities/page.tsx` | Replace |
| 11 | `app/finance/ledger/page.tsx` | Replace |
| 12 | `app/actions/page.tsx` | Replace |
| 13 | `app/overview/page.tsx` | Patch (chart range + `aggregateDaily` args) |
| 14 | `app/revenue/pulse/page.tsx` | Patch (same) |
| 15 | `app/revenue/page.tsx` | Patch (`aggregateDaily` arg) |
| 16 | `app/operations/page.tsx` | Patch (`aggregateDaily` arg) |
| 17 | `app/finance/page.tsx` | Patch (`aggregateDaily` arg) |
| 18 | `app/finance/pnl/page.tsx` | Patch (`aggregateDaily` arg) |
| 19 | `app/guest/page.tsx` | Patch if uses `aggregateDaily` |
| 20 | `app/departments/` | **Delete** entire folder |

> **Note:** the original handoff says full source for every replacement file lives in the prior chat-message titled *"Frontend bundle — full files"*. That bundle is **not present in this repo** — Cowork must source it from that chat before applying.

### Apply order

```bash
git checkout main && git pull
git checkout -b fix/kpi-capacity-mode-2026-05-01

# Apply files (full source in the prior chat — paste blocks into corresponding files)

# Search-replace all aggregateDaily() callsites:
#   aggregateDaily(rows)  →  aggregateDaily(rows, period.capacityMode)

# Delete dead duplicates
git rm -r app/departments

npm run build       # must succeed
npm run dev         # smoke-check locally

git add -A
git commit -m "fix(kpi): capacity-mode toggle, period-aware on remaining 9 pages, charts respect window

Backend already deployed via Supabase migrations. This is the frontend follow-up.

- lib/period.ts: adds CapacityMode resolver (?cap=selling|live|total)
- FilterStrip.tsx: capacity dropdown after segment
- CapacityResetOnPillarChange.tsx: new client guard, drops ?cap on pillar change
- lib/data.ts aggregateDaily(rows, mode): sums per-night capacity correctly
- 9 pages now call resolvePeriod and feed window through to data calls
- Charts on Overview/Pulse use period.from..to instead of hardcoded 90d
- app/departments/ removed (duplicates redirected to operations/*)

Verified backend: capacity 24, in_house 7, Booking.com ADR 204"

git push origin fix/kpi-capacity-mode-2026-05-01
```

Vercel auto-creates preview. Test before merging.

---

## Verification on preview

| Test | Expected |
|---|---|
| `/` → Today widget | 7 in-house, 24 capacity |
| `/today` selectors | Window changes Available number |
| `/today?cap=total` | Capacity 30, Available 23 |
| Navigate Revenue → Operations | Capacity dropdown reset to Selling |
| `/revenue/pulse?win=90d` | Occupancy 36.9%, ADR $213, RevPAR $78.53 |
| `/revenue/pulse?win=90d&cap=total` | Occupancy 29.5%, ADR $213, RevPAR $62.82 |
| `/revenue/channels?win=30d` | Booking.com row shows 30d numbers |
| `/revenue/channels?win=90d` | Booking.com ADR ≈ $204 (not $311) |
| OTA × Room matrix tooltips | Hover works on every cell, not just column 1 |
| `/operations/restaurant?win=7d` | F&B revenue updates |
| `/finance/ledger?win=30d` | "Missing email" tile shows window-scoped count |
| Overview chart | Visible range matches window selector |
| Pulse chart | Same |

**If any test fails on preview, REVERT, do not push fixes blindly.**

---

## What this does NOT fix

| Gap | Reason | Owner action |
|---|---|---|
| Real Cloudbeds source → segment mapping | Needs business decision | RM defines mapping |
| Health-pill rules driven from `governance.mandate_rules` | Cosmetic | Future PR |
| Forecast vs Budget | No budget table | Owner uploads budget data |
| GOPPAR / EBITDA / Cost % | No expense data ingested | Cost upload schema |
| OOO/OOS rooms | Cloudbeds `housekeeping:read` 403 | Open ticket with Cloudbeds |
| Comp Set rates | No scraper built | Phase 2 |
| F&B/Spa/Activities POS data | No POS integration | Phase 2 |
| `governance.agent_runs` populates | F1 Edge Function `agent-runner` not deployed | Doc 16 next session |
| `marketing` + `governance` schemas in PostgREST | Owner action, 30 sec | Dashboard → API → Exposed schemas |

---

## All KPI calcs — final state

| KPI | Source | Formula | USALI-aligned? |
|---|---|---|---|
| Occupancy % | `mv_kpi_daily` + FE `aggregateDaily` | `rooms_sold / capacity_<mode>` summed per night | ✅ |
| ADR | `mv_kpi_daily.adr` | `sum(rr.rate) / count(roomnights)` | ✅ |
| RevPAR | `mv_kpi_daily.revpar` (or FE recompute) | `rooms_revenue / capacity` | ✅ |
| TRevPAR | `mv_kpi_daily.trevpar` | `(rooms_revenue + ancillary) / capacity` | ✅ |
| In-house | `mv_kpi_today.in_house` | `count(*) FROM reservation_rooms WHERE night_date = today AND status NOT IN (canceled,no_show)` | ✅ |
| Arrivals | `mv_kpi_today.arrivals_today` | rooms checking in today | ✅ |
| Departures | `mv_kpi_today.departures_today` | rooms checking out today | ✅ |
| OTB next 90d | `mv_kpi_today.otb_next_90d` | room-nights to be sold | ✅ |
| Cancel % | `mv_kpi_today.cancellation_pct_90d` | canceled / total bookings (booking_date last 90d) | ✅ |
| No-show % | `mv_kpi_today.no_show_pct_90d` | no_shows / non-canceled (check-in last 90d) | ✅ |
| Channel ADR | `mv_channel_perf.adr_90d` | `sum(rate) / sum(roomnights)` | ✅ |
| Channel ALOS | `mv_channel_perf.avg_los_90d` | `avg(nights)` per booking | ✅ |
| Channel Lead time | `mv_channel_perf.avg_lead_time_90d` | `avg(check_in - booking_date)` | ✅ |
| Channel bookings count | `mv_channel_perf.bookings_*d` | non-canceled count | ✅ |
| Capture rate | `mv_capture_rates.capture_rate_pct` per dept | % guests purchasing | ✅ |
| Spend per OccRn | `mv_capture_rates.spend_per_occ_room` per dept | revenue / occupied roomnights | ✅ |

---

## Capacity-mode toggle — design

| Mode | Value | Definition | When to use |
|---|---|---|---|
| Selling | 24 | Room types with bookings in last 90d | USALI default; market-facing inventory |
| Live | 30 | All currently-marketable room types incl. soon-launching | Forward-looking capacity |
| Total | 30 | All physical room types in PMS | Owner ROI on capital deployed |

**Behavior:** URL param `?cap=`. Default: `selling`. Resets when user crosses pillar boundaries (`/revenue/* → /operations/*` drops `cap`). Implementation via `CapacityResetOnPillarChange` client component mounted in root layout.

---

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| `mv_kpi_daily` rebuild dropped 2837 historical rows that need to recompute on first refresh | Low | Already refreshed; verified 2837 rows back |
| FE build fails because `lib/data.ts` `aggregateDaily` signature changed | Med | All callsites must be updated in same PR |
| User on existing tab with `?cap=` in URL navigates to another pillar | Low | `CapacityResetOnPillarChange` strips it |
| Capacity dropdown overlaps existing FilterStrip on mobile | Low | CSS may need tweak — test on preview |
| Some pages still don't update because cron next tick hasn't fired | Low | Cron now succeeds every 15 min; max 15-min delay |

---

## Key SQL artifacts

These exist on disk in `/home/claude/v4/sql/03_kpi_master_repair.sql` (replay-safe):

- Unique-index creation
- `v_property_inventory` rewrite
- `mv_kpi_today` rebuild
- `mv_kpi_daily` rebuild with capacity columns
- `mv_channel_perf` rebuild
- `mv_capture_rates` recreate
- Verification block with abort-on-fail checks

---

## Estimated Cowork effort

| Task | Time |
|---|---|
| Read this doc + chat context | 15 min |
| Apply 11 file changes | 30 min |
| Search-replace `aggregateDaily` callsites | 10 min |
| Local build + smoke test | 15 min |
| Push + Vercel preview verification | 20 min |
| Merge to main | 5 min |
| **Total** | **~95 min** |

---

## Contact for blockers

- SQL questions → reference `03_kpi_master_repair.sql` and Supabase migrations panel
- `period.ts` behavior → reference v2 source in chat
- Capacity logic → `v_property_totals` is the source of truth
- Anything broken in production after merge → revert to commit before this branch (last good: `561fe86` *v1.2 repair: bridge incomplete API migration*)

---

## Files preserved in chat context

The full source code for every file is in the originating Claude.ai conversation, in the message titled **"Frontend bundle — full files"**. Cowork should:

1. Open that conversation
2. Scroll to "Frontend bundle — full files"
3. Copy-paste each block into the corresponding file path
4. Search-replace `aggregateDaily(` callsites
5. Delete `app/departments/`
6. Commit and push

> **Cowork note (2026-05-01 file placement):** the source-code blocks did not travel into this repo with the doc. If you need to execute this handoff without the originating chat, the spec above is detailed enough to derive the implementation, but it is not a literal drop-in like the revenue-fix bundle was.

---

**End of handoff.**
