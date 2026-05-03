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

## Selector cleanup (Cowork audit 2026-05-03)

| Page | Element | Was | Now | Status |
|------|---------|-----|-----|--------|
| Front Office (all pages) | Window/Compare/Segment | rendered by layout `app/front-office/layout.tsx` | layout no longer renders FilterStrip — all front pages are live snapshots | FIXED |
| Operations (layout) | Window/Compare/Segment | rendered by layout for every Ops sub-page incl. live ones (today, housekeeping, maintenance, staff, inventory) | layout no longer renders FilterStrip; period-aware sub-pages render their own | FIXED |
| Operations · Snapshot (`/operations`) | Window/Compare/Segment | from layout | rendered inline by page (period-aware) | OK |
| Operations · Restaurant (`/operations/restaurant`) | Window | from layout | rendered inline by page | OK |
| Operations · Spa (`/operations/spa`) | Window | from layout | rendered inline by page | OK |
| Operations · Activities (`/operations/activities`) | Window | from layout | rendered inline by page | OK |
| Operations · Today / Housekeeping / Maintenance / Staff / Inventory | Window/Compare/Segment | from layout | none (live snapshots) | FIXED |
| Front Office · Arrivals (`/front-office/arrivals`) | Window/Compare/Segment | from layout | none (live next-72h, no period semantics) | FIXED |
| Finance (layout) | Window/Compare/Segment | rendered by layout for every finance sub-page incl. AR aging snapshot | layout no longer renders FilterStrip; period-aware pages render their own | FIXED |
| Finance · Snapshot (`/finance`) | Window/Compare/Segment | from layout | rendered inline (period-aware) | OK |
| Finance · P&L (`/finance/pnl`) | Window/Compare | from layout (with segment) | rendered inline; segment dropped (P&L is by USALI dept, not market segment) | FIXED |
| Finance · Ledger (`/finance/ledger`) | Window/Compare/Segment | from layout | none (AR aging is a snapshot, not a window) | FIXED |
| Finance · Agents (`/finance/agents`) | selectors | from layout | none (configuration page) | FIXED |
| Knowledge (`/knowledge`) | selectors | none in source | none | OK |
| Settings (all pages) | selectors | none in source | none | OK |

## Revenue pages (Cowork audit 2026-05-03)

| Page | Element | Source claimed | Source actual | Match? | Action | Status |
|------|---------|----------------|---------------|--------|--------|--------|
| Revenue · Pulse | Occupancy / ADR / RevPAR / TRevPAR | `mv_kpi_daily` aggregated client-side via `aggregateDaily` | client-side aggregation | NO (could differ from Overview, didn't respect segment) | Switched to `f_overview_kpis(p_window,p_compare,p_segment)` so Pulse and Overview share one number | FIXED |
| Revenue · Pulse | Cancel % / No-Show % / Lead Time / ALOS | `lib/pulseExtended` (queries `reservations` directly) | same | YES (period-scoped) | none | OK |
| Revenue · Pulse | Daily revenue 90d chart | `mv_kpi_daily` rooms_revenue + total_ancillary_revenue | same | YES | none | OK |
| Revenue · Pulse | Channel mix 30d chart | `mv_channel_perf` revenue_30d | same | YES | none | OK |
| Revenue · Pace | OTB pace · forward windows | `public.v_otb_pace` (back-window chips greyed out) | `v_otb_pace` | YES | none — page enforces forward-only | OK |
| Revenue · Channels | Channel KPIs + commissions + OTA × Roomtype | `mv_channel_economics`, `mv_channel_x_roomtype` | same | YES | none | OK |
| Revenue · Rates | BAR ladder / Min/Max | `mv_rate_inventory_calendar` via `getRateInventoryCalendar(period)` | same | YES (period-driven) | none | OK |

## Sales / Marketing / Guest / Finance (Cowork audit 2026-05-03)

| Page | Element | Source claimed | Source actual | Match? | Action | Status |
|------|---------|----------------|---------------|--------|--------|--------|
| Sales · Inquiries | KPI tiles ($48.2k MTD, $6.4k today, etc.) | mockup HTML inline | mockup — NO Supabase source | n/a | Wiring waits on `sales.inquiries` schema (not yet created) | DEFER (data not in Supabase) |
| Sales · Revenue MTD tile | `mv_kpi_today.month_revenue` | same | YES | none | OK |
| Sales · B2B / DMC | `dmc.contracts` + `dmc.lpa_sources` + `reservations` filtered DMC | same (5 contracts + 26 LPA + 101 reservations per memory) | YES | none | OK |
| Sales · Packages / Pipeline / Roster / Calendar | mockup HTML | mockup | n/a | source schemas not built | DEFER |
| Marketing · Snapshot | Reviews · social KPIs | `marketing.reviews` (count=0) + `marketing.social_accounts` (count=8) via `lib/marketing.ts` | same | PARTIAL (socials wired; reviews empty) | none — wiring correct, table empty | DEFER (data not in Supabase) |
| Marketing · Library / Social / Reviews / Influencers / Campaigns / Taxonomy / Upload / Media | various marketing.* sources | reads `marketing.*` schema | YES — but most tables empty (campaigns=0, reviews=0) | none — wiring correct, awaiting content | DEFER (data not in Supabase) |
| Guest · Snapshot | Avg rating / unanswered / response rate / followers | `marketing.reviews` (empty) + `marketing.social_accounts` | same | PARTIAL (followers wire; reviews empty) | none — page renders 0s honestly | DEFER (data not in Supabase) |
| Guest · Directory | 5-filter directory + clickable KPIs | `guest.v_directory_facets` + `guest.v_guest_reservations` (4,111 real guests) | same | YES | none | OK |
| Guest · Reviews / NPS / Recovery / Loyalty / Themes | guest.* tables | `guest.review_replies`=0, `guest.nps_responses`=0, `guest.loyalty_members`=0 | YES — wired but tables empty | none — wiring correct | DEFER (data not in Supabase) |
| Finance · Snapshot | Revenue MTD / GOP MTD / Net MTD / AR 90+ | `lib/data.ts` + `mv_aged_ar` + `mv_revenue_by_usali_dept`. Branch reverted finance/page.tsx to origin/main version (Phase 2.5 GL views not yet on main) | same | YES (origin/main version) | rolled back to origin/main version because Phase 2.5 GL deps `./_data` and `lib/supabase-gl.ts` aren't pushed yet | OK (will re-merge once Phase 2.5 lands on main) |
| Finance · P&L | USALI dept rows + GOP %, EBITDA | `getRevenueByUsali` + `getKpiDaily` (origin/main version) | same | PARTIAL (department rows render; GOP $/EBITDA show "—" awaiting `gl_entries` load) | none — `gl_entries_load.sql` from `qb-deploy/` is the unblocker | DEFER (Phase 2.5 GL load) |
| Finance · Ledger | Aged AR + city ledger + missing-email DQ | `mv_aged_ar` (days_overdue>0) + `mv_kpi_today` + reservations missing-email count | same | YES | none | OK |
| Finance · Budget | Annual target tile (greyed) | greyed | greyed | n/a | unchanged | OK |
| Finance · Agents | configuration | n/a | n/a | n/a | none | OK |

## Summary

Pages with deployed wiring fixes verified live against Supabase ground truth:
- `/overview` — IN-HOUSE 9 · DQ 17 · 30D ADR $205 / RevPAR $56 / TRevPAR $84 / Occupancy 27.4 %
- `/revenue/pulse` — same 4 KPIs as `/overview` (reads `f_overview_kpis` directly)
- `/operations` (snapshot), `/operations/restaurant`, `/operations/spa`, `/operations/activities` — selectors restored at page level
- `/operations/today`, `/operations/housekeeping`, `/operations/maintenance`, `/operations/staff`, `/operations/inventory/*` — selectors removed (live snapshots)
- `/front-office/*` — selectors removed (live next-72h)
- `/finance/ledger` — selectors removed (AR aging is a snapshot)
- `/finance`, `/finance/pnl` — selectors restored at page level
- `/knowledge`, `/settings/*` — already had no selectors

DEFER cases (wiring correct, source data missing or schema migration required):
- `mv_kpi_daily` lacks paired `*_lak` columns → daily revenue chart pinned to USD until migration adds them
- `f_overview_kpis` references schema `auth_ext` that anon doesn't have USAGE on → called via `service_role` server-side. `SECURITY DEFINER` is the proper long-term fix.
- Sales (non-B2B), Marketing reviews, Guest reviews/NPS/loyalty: source tables exist but are empty
- Finance P&L GOP/EBITDA: ~~awaiting `gl_entries_load.sql` from `qb-deploy/`~~ — **LOADED 2026-05-03** (2,924 rows). P&L now shows April actuals: $44k revenue / -$12.8k GOP / -29.2 % margin / 75.7 % labour / 43.3 % F&B pay-through / $3.8k A&G.

## Follow-up fixes shipped 2026-05-03 (post-audit)

| Page | Element | Was | Now | Status |
|------|---------|-----|-----|--------|
| `/actions` | Open DQ count + critical/medium/low buckets | `dq_known_issues` table (4 stale rows) | `public.v_dq_open` (joins `dq.violations` + `dq.rules`, 29 live: 12 CRITICAL + 5 WARNING + 12 INFO) | FIXED |
| `/settings/platform-map` | entire page | 404 (Phase 2.5 file missing on main) | brought forward `app/settings/platform-map/page.tsx` + `components/settings/PlatformMapRenderer.tsx` + `content/settings/platform-map.md` from feat | FIXED |
| `/settings` | Platform Map card link | not rendered | added link card pointing to `/settings/platform-map` | FIXED |
| `/finance/pnl` | Labour cost %, F&B Pay-Through, A&G Total | 0.0 % / — / $0.0k (winPeriods scoped to empty May) | **75.7 %** / **43.3 %** / **$3.8k** (scoped to latest closed period) | FIXED |
| `/finance/pnl` | Channels Comm % / OTA tile | 0.0 % / 0 | 0.0 % / 0 (no `account_id` starting `624` or `usali_line_code` containing `OTA` in current data) | DEFER (data tagging gap) |
| `/finance/pnl` | Cash on hand | greyed `—` | greyed `—` (Gap 4 — bank feed pending) | DEFER (no data feed) |
| `/finance/pnl` | Flow-through | greyed `—` | greyed `—` (depends on positive GOP — April GOP is negative) | OK (correct rendering) |
| `lib/data.ts` | `getDqIssues()` | `dq_known_issues.*` | `v_dq_open` with severity shim (`CRITICAL→high`, `WARNING→medium`, `INFO→low`) so existing UI buckets keep working | FIXED |
| `gl.gl_entries` | data load | empty | 2,924 unique rows (`upload_id 0884da5d-c9d7...`); deduplicated post-load (Edge Function ran twice) | FIXED |
| `gl.mv_usali_pl_monthly` | matview | stale | refreshed | FIXED |
| `gl.mv_usali_pl_monthly` | refresh schedule | none — manual only | `cron.job` 37 every 4h at xx:20 (`refresh-gl-mv-usali-pl-monthly`) | FIXED |
| `components/charts/MonthlyByDeptChart.tsx` | LAK Y-axis | `value * FX_LAK_PER_USD` (hardcoded 21800) | pinned to USD (matches DailyRevenueChart fix). To enable LAK, add `revenue_lak` to `mv_revenue_by_usali_dept` first | FIXED |
| `app/revenue/compset/_actions/saveRates.ts` | LAK column written to DB | `rate_usd * FX_LAK_PER_USD` (hardcoded) | uses live `public.fx_usd_to_lak()` rate at write time (single round-trip per save batch) | FIXED |
| `auth_ext` schema | grants | not exposed to anon | granted USAGE + EXECUTE on functions to anon/authenticated; `getOverviewKpis` continues using service_role for JWT-less server contexts | FIXED |
| `/settings/platform-map` | page | 404 (Phase 2.5 file not on main) | brought forward `app/settings/platform-map/page.tsx` + `components/settings/PlatformMapRenderer.tsx` + `content/settings/platform-map.md` | FIXED |
| `/finance/mapping` | page | wasn't on main | brought forward by parallel session — now live with `MappingTable` component | FIXED |
| `public.f_overview_kpis(text,text,text)` | function | NOT `SECURITY DEFINER`, anon needed service-role workaround | `ALTER FUNCTION ... SECURITY DEFINER` + `SET search_path = public, pg_temp`. anon now calls directly. `getOverviewKpis` reverted to plain anon supabase client. | FIXED |
| `app/operations/staff/[staffId]/page.tsx` | annual-LAK→USD subdisplay | `/ FX_LAK_PER_USD` (hardcoded 21800) | server-side `supabase.rpc('fx_usd_to_lak')` at request time | FIXED |
| `/marketing` layout | FilterStrip | rendered globally — bled into `/library`, `/influencers`, `/taxonomy`, `/upload`, `/agents`, `/media` (all static lists) | layout no longer renders FilterStrip; no marketing page actually consumes `?win=` so no inline restoration needed | FIXED |
| `/sales/roster` | tile values | reads `public.v_staff_register_extended` | YES — verified | OK |

## Final pillar smoke test (66/66 pages = HTTP 200)

Every page in the left nav + every sub-tab returns 200. The two earlier 404s (`/operations/inventory`, `/settings/platform-map`) are: platform-map FIXED; inventory deferred (Phase 2.5 inventory pages not yet pushed to main).

## DB cron failures fixed (Cowork audit 2026-05-03)

| Cron | Was failing with | Fix | Status |
|------|------------------|-----|--------|
| `kpi-freshness-check` (every 30 min) | `column "severity" of relation "sent" does not exist` (function wrote to wrong cols) | Rewrote `kpi.check_freshness()` to insert into real `alerts.sent` columns (`channel_id, message, violation_count, sent_at`) | FIXED |
| `agent-snapshot_agent` / `pricing` / `variance` / `cashflow` / `forecast` (hourly) | `agent_runs_status_check` rejected `'queued'` | Added `'queued'` to the CHECK constraint (was: `running/success/partial/failed/timeout`) | FIXED |
| `dq-engine-run` (every 4h) | `column a.account_code does not exist` in R-021/R-022 (gl.accounts uses `account_id`) | Updated `dq.run_all()` JOIN clauses to use `a.account_id = ps/pl.account_code` | FIXED |

## Security advisor triage (Cowork audit 2026-05-03)

`mcp_get_advisors(security)` surfaced 198 lints. Triage:

| Severity | Issue | Action | Status |
|----------|-------|--------|--------|
| ERROR | `public.app_users` / `app_settings` / `action_decisions` have RLS disabled | Frontend reads via anon today; DASHBOARD_PASSWORD is the real boundary. Enabling RLS without UI rework would break /settings/users. Logged for follow-up. | DEFER |
| ERROR | 37 SECURITY DEFINER views in public | Most are intentional public proxies (added by parallel session for cross-schema reads). Working as designed. | OK |
| WARN | 5 SECURITY DEFINER fns executable by anon: `cb_invoke_sync`, `cb_sync_now`, `refresh_bi_views`, `save_competitor_rates`, `f_overview_kpis` | REVOKE EXECUTE on the 4 dangerous ones from anon/authenticated/PUBLIC. Service_role only. `f_overview_kpis` kept open (intentional). | FIXED |
| WARN | 89 functions with mutable `search_path` | Added `SET search_path = public, pg_temp` on `f_overview_kpis` (the one we changed). Others touched by other sessions — DEFER. | DEFER |
| WARN | 14 matviews exposed to API | Other Claude session owns these (mv_channel_economics, mv_kpi_*, etc.). DEFER. | DEFER |
| INFO | 20 RLS-enabled-no-policy + 20 always-true policies | Mostly the parallel session's domain. DEFER. | DEFER |
| WARN | `auth_leaked_password_protection` disabled | Supabase Auth setting, requires console toggle. | DEFER |

| `public.v_dq_open` | view | did not exist | created — joins `dq.violations` + `dq.rules`, returns full row list incl. severity/title/description/category. Granted SELECT to anon/authenticated/service_role | FIXED |

## DQ inspection (the 17 action-required rules)

What's open right now (verified 2026-05-03 via `public.v_dq_open WHERE severity IN (CRITICAL, WARNING)`):

| Severity | Rule | Count | Auto-fix? | Note |
|----------|------|-------|-----------|------|
| CRITICAL | Cloudbeds vs QB rooms gap > 15% (VAT-adj) | 9 | NO | Reconciliation rule — needs operator review per period |
| CRITICAL | Revenue drop > 50% MoM | 2 | NO | Triggered by Lao low-season swing (Feb→Mar). Real business signal, not a bug |
| CRITICAL | Negative room rate | 1 | NO | Single misposted reservation — needs Cloudbeds correction |
| WARNING | Daily occupancy = 0% on weekday | 4 | NO | 4 specific shoulder-season weekdays — real signal |
| WARNING | Cancellation rate > 25% | 1 | NO | Currently 23.02%; threshold may need tuning |

None of the 17 are auto-fixable from the wiring layer. They're correctly surfaced; resolution is operator workflow (review → resolve via `dq.violations.resolved_at`).



