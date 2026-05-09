# CHANGELOG — Namkhan BI

## 2026-04-28 — v0.1 (Phase 1 complete, ready to deploy)

### Added
- 9 BI materialized views in Supabase: `mv_kpi_today`, `mv_kpi_daily`, `mv_revenue_by_usali_dept`, `mv_channel_perf`, `mv_pace_otb`, `mv_arrivals_departures_today`, `mv_aged_ar`, `mv_capture_rates`, `mv_rate_inventory_calendar`, plus `mv_classified_transactions` as the classifier
- `refresh_bi_views()` function (pg_cron-callable)
- `usali_category_map` table — 119 active rules
- `operational_overrides` table — Tent 7 pinned permanently closed
- `dq_known_issues` table — 5 categories logged for future DQ agent
- Full Next.js 14 dashboard codebase (50 files, 25 routes, all sub-tabs)
- Single-password gate via cookie middleware
- USD/LAK currency toggle
- Soho-house casual luxury palette (Playfair Display + Inter, sand accent)
- All docs updated to current reality (Supabase + Vercel, not BigQuery + Looker)
- New doc `15_DEPLOYMENT_GUIDE.md`
- Repo-side `DEPLOY.md` with click-by-click first-deploy

### Changed
- USALI classifier rebuilt with regex word-boundaries (`\m...`) to fix "Side"/"Inside Activity" collision
- Description used as fallback when `item_category_name` is empty
- 119 patterns final after iterative reconciliation against Apr 2026 actuals
- Inventory denominator changed from 20 → 19 (Tent 7 retired)

### Awkward numbers found and fixed during build
| # | Issue | Fix |
|---|---|---|
| 1 | Tent 7 marked blocked in PMS | Pinned in `operational_overrides`; `is_active=false` filter on `v_property_inventory` |
| 2 | F&B revenue showed $680/month (1,200% off) | Rebuilt classifier using `usali_category_map` instead of inline regex |
| 3 | "Inside Activity" misclassified as F&B Food (matched "Side") | Word-boundary regex + priority bump |
| 4 | 297 transactions/month with empty `item_category_name` | Description fallback in classifier |
| 5 | "Beer" pattern missed "Beers" | `\mbeer` (boundary at start only, allows plurals) |
| 6 | Oct 2025 spike: $11,934 unclassified | Added Dream Craft, Lao BBQ, Tigger Trails patterns |
| 7 | Activity revenue zero pre-Oct 2025 | Real signal — POS rolled out Oct 2025; not a bug |
| 8 | Spa low pre-Oct 2025 | Same root cause as #7 |

### Final reconciliation (April 2026)
- Rooms: $39,450 · ADR $205 · RevPAR $69 · Occ 33.7%
- F&B: $8,876 (Food $5,183 · Beverage $3,013 · Minibar $680)
- Spa: $2,789 · Activities: $2,626 · Retail: $4,567
- Unclassified: $185 (0.6% leakage — acceptable)
- Cancellation 90d: 20.14%

### Deferred to Phase 2
- Cloudbeds support ticket for `housekeeping:read` scope
- DQ agent (operator-error fingerprinting)
- Resolve Supabase security advisors (RLS, SECURITY DEFINER views, anon function perms)
- Slack/Telegram alerts
- Budget upload + P&L expense side
- Comp Set scraper
- Repeat Guest %, Geo Mix dashboard tabs

### Known limitations going to production
- Single-password auth (no per-user audit log)
- Anon key visible in browser bundle (mitigated by mat-view-only read access; tables still need RLS)
- Manual data refresh fallback (`pg_cron` not yet configured in some environments)

## 2026-05-09 — Repair-list batch + cut-corners + regression repair

### Data
- `gl.pl_monthly` backfilled with 2025 + 2026 from `Green Tea P&L` workbooks. 1497 rows across 17 periods (`2025-01..2026-05`). 28× 50-row chunks, idempotent `ON CONFLICT (period_yyyymm, account_id) DO UPDATE` upsert. Hashes: 2026 = `955c0aad2630d06f`, 2025 = `de2fad62a3a50849`. `/finance/pnl` MonthDropdown auto-picks new periods (verified 2026-01..2026-04 listed; 2026-05 filtered as sparse mid-month).
- `messy.unpaid_bills` shipped (250 distinct rows from `Unpaid Bills.xls`, 253 source → 3 collapsed by natural-key dedup). `xlrd`-based parser at `scripts/parse_unpaid_bills.py`, SQL emitter at `scripts/emit_unpaid_bills_sql.py`. SHA-256 of source file persisted on every row for re-import idempotency. `messy` schema added to PostgREST exposed schemas.

### Surfaces
- `<Container title="Bugs" hint="Kit watches">` shipped on every dept-entry page. 4-state workflow: `new` (red, glow) → `acked` (orange) → `processing` (light green) → `done` (dark green + `done · press →` link to `fix_link`). Click dot to advance manually; modal textarea (Cmd+Enter) to file. Backed by `public.cockpit_bugs` + `app/api/cockpit/bugs/route.ts` (GET / POST / PATCH / DELETE). Kit polls `WHERE status='new'` to act.
- `/messy-data` unpaid-bills panel + `UnpaidBillsActions` (Download CSV + Send to accountant mailto). Auto-saving `human_status` dropdown wired via new `app/api/messy/unpaid-bills/update` (validates the CHECK enum; rejects bogus + missing-id with 400).
- `/revenue/pulse` RM-meaningful redesign: 3-col hero (`What's open` top-3 alerts · `Today` · `Pace gap`), single big pace curve below, 8-tile signals strip, decisions footer, collapsed `<details>` "All charts" wrapping the legacy grid.
- `/revenue/pricing/calendar` brighter palette + `RATE_MIN = 10` floor to skip $0 junk rows. `/revenue/pricing` layout reorder ("What's open today" placeholder above existing chart/table).
- `/operations/events` (NEW) — month-view calendar over `marketing.calendar_events` (82 rows, 17 types across 5 categories). 7×6 grid Mon-first, today brass-tinted, 3 multi-select filters (Event types · Categories · Holiday countries), legend, "+ Add event" disabled (awaiting backend).
- `/revenue/parity` rewritten as date×OTA grid per PBS reference screenshot. New `<ParityFilterBar>` + `<ParityGrid>`. Backed by new `public.v_parity_grid` view (pivots `revenue.competitor_rates × revenue.competitor_property` by `stay_date`, channel columns + `loss_channels` array + `comp_lowest_usd`).

### Chat
- ChatShell: thread starts fresh on every mount (no localStorage). New "+ Create task" button writes most-recent user ask into `nk.<dept-prefix>.entry.tasks.v2`. `conversation_history` (last 20 user/assistant pairs) wired to `/api/cockpit/chat` so back-and-forth turns work.
- All 7 personas (`lead`, `revenue_hod`, `sales_hod`, `marketing_hod`, `operations_hod`, `finance_hod`, `it_manager`) bumped with a "CHAT MODE — DECIDE FIRST" preamble. Question / advice ask → conversational prose (`summary_markdown` only). Explicit build / decompose ask → existing structured output. Active prompt IDs: 86, 87, 88, 89, 90, 91, 92.

### Theme / chrome
- `/knowledge` route hidden from `LeftRail`, `UserMenu`, `HeaderPills` Tools, `DeptEntry` hamburger.
- Dark-canvas table CSS root-cause fix (round 3): older `table:not(.data-table) td { color: var(--ink) !important }` rule was painting cells with light-theme `#1c1815`. New `body table { ... !important }` block overrides everything for the dark canvas (zebra striping, hover, USALI section/gop/ebitda rows).
- `HeaderPills` brightened (text `#d8cca8 → #f0e5cb`, weather/air icons `#c4a06b → #f4d99a`).
- `/cockpit/schedule` 404 fixed — new redirect page sends to `/cockpit?tab=schedule`; `CockpitPage` reads `?tab=` via `useEffect` to open the right panel.

### Compare-mode KPI tones
- Wired `delta` props with sign-aware tones across `/revenue/channels`, `/revenue/channels/[source]`, `/revenue/reports/[type]`. Pulse + Pace already had it.
- 59 `<title>` hover tooltips across 13 SVG chart files (audit-driven sweep).

### Bug fixes
- `/api/operations/inventory/sync-cloudbeds` — was silently writing 0 rows (missing `property_id` in `inv.items` upsert candidate caused NOT NULL violation per row). Fixed by importing `PROPERTY_ID` from `lib/settings` and adding to payload. Smoke confirms `failed:0, updated:262`.

### KB rows logged
- `cockpit_knowledge_base` ids 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540 (scope: `design_system_log` / `system_architecture` / `repair_list_status`).

### Deploys
- `dpl_2noYREg5VYk6aCkJPitCYtnLscHz`, `dpl_GFup53aoueKiYNHXWhcLiq8Pnhda`, `dpl_3Lw1Qrck2MeucbAAmRBpk9t4oiy4`, `dpl_AVQ7oBSxGiRt8DXfAPhgFyF2Uj6S`, `dpl_Lrdtu2HcJ56pi1PAsVAugmzb6ktm`, `dpl_9sZQfrHm7F7eEBVJT8y7YPCb16EF`, `dpl_4P…` (sync-cloudbeds), `dpl_HBWKjtuw9TM6SHLDSuC867sfXsCS` (failed sharp), `dpl_<retry>` (succeeded), `dpl_Cyi2o6hQ7BNWwSCqtk7MUjAwvUe7` (events).

### Pending (see KB id 536, scope `repair_list_status`)
- Compset wiring + chart per screenshot (in flight)
- Media library dropdown + search (in flight)
- Customer profile slide-in: contact fields + Bookings tab (in flight)
- Lots more — see KB row for the full list.
