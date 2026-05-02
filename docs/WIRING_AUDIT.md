# WIRING_AUDIT.md

Cowork audit started 2026-05-03. One row per UI element. Status = `OK` (already correct), `FIXED` (rewired in this audit), `BLOCKED` (logged in `BLOCKED.md`).

| Page | Tab | Element | Type | Source claimed | Source actual | Match? | Action | Status |
|------|-----|---------|------|----------------|---------------|--------|--------|--------|
| Overview | (none) | IN-HOUSE | tile | `mv_kpi_today.in_house` | `mv_kpi_today.in_house` (stale, returned 10) | NO (10 vs 9) | Switched fetcher to `v_overview_live.in_house` | FIXED |
| Overview | (none) | Arriving Today | tile | `mv_kpi_today.arrivals_today` | `mv_kpi_today.arrivals_today` | NO (stale source) | Switched to `v_overview_live.arriving_today` | FIXED |
| Overview | (none) | Departing Today | tile | `mv_kpi_today.departures_today` | `mv_kpi_today.departures_today` | NO (stale source) | Switched to `v_overview_live.departing_today` | FIXED |
| Overview | (none) | OTB Next 90d | tile | `mv_kpi_today.otb_next_90d` | `mv_kpi_today.otb_next_90d` | NO (stale source) | Switched to `v_overview_live.otb_next_90d` | FIXED |
| Overview | (none) | Occupancy (window) | tile | client-side aggregate of `mv_kpi_daily` | client agg | NO (didn't respect segment) | Switched to `f_overview_kpis(p_window,p_compare,p_segment).occupancy_pct` | FIXED |
| Overview | (none) | ADR (window) | tile | client agg of `mv_kpi_daily` | same | NO (no LAK column, used FX synth) | Switched to `f_overview_kpis.adr_usd` + `adr_lak` (real columns) | FIXED |
| Overview | (none) | RevPAR (window) | tile | client agg of `mv_kpi_daily` | same | NO (FX synth on LAK) | Switched to `f_overview_kpis.revpar_usd` + `revpar_lak` | FIXED |
| Overview | (none) | TRevPAR (window) | tile | client agg of `mv_kpi_daily` | same | NO (FX synth on LAK) | Switched to `f_overview_kpis.trevpar_usd` + `trevpar_lak` | FIXED |
| Overview | (none) | GOPPAR | tile | greyed | greyed | n/a | unchanged (cost data pending) | OK |
| Overview | (none) | Cancellation % | tile | `mv_kpi_today.cancellation_pct_90d` | same | NO (stale source) | Switched to `v_overview_live.cancellation_pct` | FIXED |
| Overview | (none) | No-show % | tile | `mv_kpi_today.no_show_pct_90d` | same | NO (stale source) | Switched to `v_overview_live.no_show_pct` | FIXED |
| Overview | (none) | F&B / Occ Rn | tile | `mv_capture_rates.fnb_per_occ_room` | same | PARTIAL (didn't follow window) | Switched to `f_overview_kpis.fnb_per_occ_rn_usd` (window-aware) | FIXED |
| Overview | (none) | Spa / Occ Rn | tile | `mv_capture_rates.spa_per_occ_room` | same | PARTIAL | Switched to `f_overview_kpis.spa_per_occ_rn_usd` | FIXED |
| Overview | (none) | Activity / Occ Rn | tile | `mv_capture_rates.activity_per_occ_room` | same | PARTIAL | Switched to `f_overview_kpis.activity_per_occ_rn_usd` | FIXED |
| Overview | (none) | Open DQ Issues | tile | hardcoded count from `dq_known_issues` table (returned 4) | `dq_known_issues` row count | NO (4 vs 17) | Switched to `v_overview_dq.action_required` | FIXED |
| Overview | (none) | LAK secondary on money tiles | sublabel | `value * FX_LAK_PER_USD` (hardcoded 21800) | hardcoded FX | NO (synthesized) | Removed FX synthesis path in `KpiCard`. Real LAK now passed via `valueLak` prop from `f_overview_kpis.*_lak` | FIXED |
| Overview | (none) | Revenue & Occupancy chart | chart | `mv_kpi_daily` (revenue cols × FX in LAK mode) | same | NO (FX synth in LAK mode) | Pinned chart to USD; `mv_kpi_daily` has no paired LAK columns. Schema migration to add LAK cols = follow-up | FIXED (USD-only) |
| Overview | (none) | Channel mix card | table | `mv_channel_perf` | `mv_channel_perf` | YES | none | OK |
| Overview | (none) | WINDOW selector | dropdown | URL `?win=` → `resolvePeriod` | same | YES (drives `f_overview_kpis(p_window)`) | translated `30d → 30D` etc. in `getOverviewKpis` | OK (driven by f_overview_kpis) |
| Overview | (none) | COMPARE selector | dropdown | URL `?cmp=` → `resolvePeriod` | same | YES (drives `f_overview_kpis(p_compare)`) | translated `pp → PREV_PERIOD`, `stly → YOY` | OK |
| Overview | (none) | SEGMENT selector | dropdown | URL `?seg=` → `resolvePeriod` | same | YES (drives `f_overview_kpis(p_segment)`) | translated `dmc → 'DMC'`, `group → 'Group Bookings'` etc. | OK |

Window enum mapping (frontend → `f_overview_kpis` arg):
`today→TODAY · 7d→7D · 30d→30D · 90d→90D · ytd→YTD · next7→NEXT_7 · next30→NEXT_30 · next90→NEXT_90`.
Non-canonical UI windows (`l12m`, `next180`, `next365`) are unreachable from FilterStrip but tolerated by `resolvePeriod` for legacy callers; coerced to nearest valid by `getOverviewKpis`.
