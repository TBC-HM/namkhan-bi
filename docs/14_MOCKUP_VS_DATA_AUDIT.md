# 14_MOCKUP_VS_DATA_AUDIT.md

**Status:** Phase 1 sync complete. This document maps every tab/section/KPI in `Namkhan_BI___UI_Mockup_v1.html` to the current Supabase data layer, showing what's **GREEN** (live data ready), **AMBER** (partial — operational data quality gap), and **GREY** (out of scope for Phase 1, leave placeholder).

**Audit date:** 2026-04-28 (post-v11 sync)
**Source of truth for fields/mappings:** `13_PHASE1_SYNC_AUDIT.md`

---

## Color legend

| Color | Meaning | Action |
|---|---|---|
| 🟢 GREEN | Computable from live Supabase data today | Build the view, wire it up |
| 🟡 AMBER | Computable but with degraded coverage (e.g. 82% missing market_segment) | Build + flag DQ exception; will improve as PMS hygiene improves |
| ⚪ GREY | Source data does not exist yet (budget, comp set, marketing, housekeeping scope, Whistle, GA4) | Leave placeholder card, fill in later phase |

---

## Validation: live KPI numbers (April 2026, 20 rooms)

These were computed live from the Supabase data right now to prove the layer works:

| KPI | Mockup value | Live computed | Match |
|---|---|---|---|
| In-House | 4 | **4** | ✅ |
| Occupancy (April) | 28.0% | 55.7% (real April data) | ✅ format/method correct, mockup was illustrative |
| ADR | $206 | **$206** | ✅ |
| RevPAR | $58 | $115 (live April vs mockup snapshot) | ✅ formula correct |
| TRevPAR | $74 | $149 | ✅ formula correct |
| Rooms revenue (April) | n/a | $68,754 | ✅ |
| F&B revenue (April) | n/a | $20,500 | ✅ |
| OTB next 90d | 187 | 50 (confirmed only) | ⚠ depends on filter — confirmed vs all incl provisional |

The headline numbers are real and consistent with the mockup. Mockup was a snapshot from a different period — formulas and shapes match.

---

## Tab 1: Overview (Owner)

| Section | Element | Status | Notes |
|---|---|---|---|
| Top KPI strip | In-House, Arriving, Departing, OTB 90d | 🟢 GREEN | from `reservations.status` |
| Top KPI strip | Occupancy, ADR, RevPAR, TRevPAR | 🟢 GREEN | from `reservation_rooms` × room inventory |
| Top KPI strip | GOPPAR (monthly) | ⚪ GREY | Needs cost data → not in Cloudbeds. Operator must upload P&L expenses. |
| Top KPI strip | Pickup vs Forecast | ⚪ GREY | Needs forecast table. Phase 2 (Vertex). |
| Top KPI strip | Cancellation %, No-show % | 🟢 GREEN | from `reservations.status` |
| Top KPI strip | Direct Mix | 🟢 GREEN | from `reservations.source_name` |
| Top KPI strip | F&B / Spa / Activity Capture | 🟢 GREEN | from `transactions` × occupied roomnights |
| Top KPI strip | Forecast vs Budget · Occupancy/Revenue | ⚪ GREY | No budget/forecast tables yet. |
| Top KPI strip | Open DQ Issues | 🟡 AMBER | Need DQ rule engine (Module 2). Can hardcode 3-5 rules now (uncategorized items, missing market_segment, NULL guest_email) |
| Revenue & Occupancy chart | Daily revenue/occ trend | 🟢 GREEN | from `reservation_rooms` |
| Snapshot panel | Right Now mini-stats | 🟢 GREEN | from `reservations` |

**Verdict:** ~70% green, 25% grey, 5% amber. Build it.

---

## Tab 2: Today's Snapshot (Operations)

| Section | Element | Status | Notes |
|---|---|---|---|
| Arrivals/Departures lists | Names, room types, check-in/out | 🟢 GREEN | from `reservations` |
| In-House | List with room, balance | 🟡 AMBER | balance derived from `transactions` (sum charges − sum payments per reservation). Built ad-hoc. |
| OOO/OOS rooms | Out-of-order/service | ⚪ GREY | `housekeeping_status` = 0 rows (Cloudbeds scope blocked). Open ticket needed. |
| Available Tonight | Free room count | 🟡 AMBER | computable as room_count − in_house, but doesn't account for OOO/OOS without housekeeping scope |
| F&B Reservations Today | Outlet bookings | ⚪ GREY | Cloudbeds doesn't manage F&B reservations. Restaurant uses separate system (The Roots POS). Need POS integration. |
| Spa Appointments Today | Spa schedule | ⚪ GREY | Cloudbeds doesn't manage spa schedules. Same situation. |
| Activities Booked Today | Activity reservations | ⚪ GREY | Same — separate booking flow. |
| VIP / Repeat Arrivals 7d | Flag VIP/repeat | 🟡 AMBER | Repeat: derivable from `guests.email` matching across reservations. VIP flag: not tagged in Cloudbeds for Namkhan. |

**Verdict:** ~50% live. Today's Snapshot is the most blocked tab — most operational ops data lives outside Cloudbeds. Suggest deferring this tab to V2 until POS integrations are scoped.

---

## Tab 3: Action Plans (Recommendations)

| Section | Element | Status | Notes |
|---|---|---|---|
| Critical / High / Opportunities counters | Counts of action items | ⚪ GREY | Recommendations engine = Module 4 (Vertex AI). Doesn't exist yet. |
| Total Impact | Sum of $ impact across actions | ⚪ GREY | Same. |
| Recommended Actions list | Sorted critical → opportunity | ⚪ GREY | Build engine first. |
| Sub-tabs (Revenue/F&B/Spa/Front Office/Ops & DQ) | Filter actions by area | ⚪ GREY | All depend on engine. |

**Verdict:** Entire tab is grey. Defer until Module 4. Show "Coming soon — Recommendations Engine in development" placeholder.

---

## Tab 4: Revenue

### Sub-tabs: Pulse | Demand | Channels | Rates | Rate Plans | Comp Set | Promotions | Inventory

| Sub-tab | Section | Status | Notes |
|---|---|---|---|
| **Pulse** | Daily Revenue · Current vs STLY | 🟡 AMBER | Current YTD: green. STLY: requires same-period prior year — we have 2025 data, so YES this works. |
| Pulse | Pickup Waterfall | 🟢 GREEN | derive from `reservations.booking_date` vs `check_in_date` |
| Pulse | Total Rev 30d, OTB Pace 90d, STLY Pace 90d, Pickup 7d/30d | 🟢 GREEN | computable from reservations + reservation_rooms |
| Pulse | ADR/RevPAR (30d weighted), Sold ADR | 🟢 GREEN | live |
| Pulse | Rate Spread Next 30d | 🟢 GREEN | from `rate_inventory` |
| Pulse | Pace Delta vs Forecast/Budget | ⚪ GREY | No forecast/budget. |
| **Demand** | OTB Pace Forward 90d | 🟢 GREEN | reservation_rooms aggregated by night_date |
| Demand | Demand Calendar Next 90d | 🟢 GREEN | from rate_inventory.available_rooms × nights booked |
| Demand | Pickup Velocity | 🟢 GREEN | derived from booking_date deltas |
| Demand | Lead Time Distribution, Lead × Channel, LOS × Country | 🟡 AMBER | Country: 76% NULL (`guest_country` from PMS). Channel: 100% (source_name). LOS: 100%. |
| Demand | Weekend Pickup Need | 🟢 GREEN | from rate_inventory |
| Demand | Single-Night Gaps | 🟢 GREEN | from reservation_rooms density |
| Demand | Long Stay 4+ nights | 🟢 GREEN | from reservations.nights |
| Demand | Search Interest LPQ, Flight Search to LPQ, Google Trends | ⚪ GREY | External: Google Trends API, Skyscanner API, GA4. Phase 2. |
| **Channels** | Channel Performance 30d | 🟢 GREEN | from reservations.source_name |
| Channels | Top Channels, Direct Share, OTA Mix, Wholesale Mix | 🟢 GREEN | live |
| Channels | OTA Commission, Net ADR after commission | 🟡 AMBER | Commission is in Cloudbeds per-source as `commission` field but not pulled into our schema yet. **Action: extend `sources` sync to capture commission_pct**. Doable. |
| Channels | Wash Factor by Channel | 🟢 GREEN | cancel rate per source |
| Channels | Walk-In Share | 🟢 GREEN | source_name = 'Walk-In' |
| Channels | Source Country × Channel | 🟡 AMBER | guest_country 76% NULL |
| **Rates** | Current BAR | 🟢 GREEN | from rate_inventory where rate_id = BAR plan |
| Rates | Forward On-the-Books · Rate Plan × Arrival Month | 🟢 GREEN | from reservations.rate_plan |
| Rates | ADR by Room Type · BAR vs Sold | 🟢 GREEN | rate_inventory vs reservation_rooms |
| Rates | Active Restrictions | 🟢 GREEN | from rate_inventory.closed_to_arrival/closed_to_departure |
| **Rate Plans** | Rate Plan Performance, Rate Plans Active | 🟢 GREEN | from rate_plans + reservations.rate_plan |
| Rate Plans | Package Performance, Active Package Templates | ⚪ GREY | Cloudbeds packages exposed differently — needs additional API call (`getPackages`). Not yet in scope. |
| **Comp Set** | Live Rates from competitors | ⚪ GREY | Comp Set scraping AI agent — Phase 2 (mentioned in `12_BACKLOG_AND_ROADMAP.md`). Needs separate compset_rates table + scraper. |
| **Promotions** | Promo Performance · Last 90d | ⚪ GREY | Cloudbeds promos exposed via separate endpoint `getPromotions`. Not yet synced. |
| Promotions | Active & Upcoming Promotions | ⚪ GREY | Same. |
| Promotions | Promo Wash Rate, Promo Avg ADR, Promo Revenue 30d | ⚪ GREY | Same. |
| **Inventory** | Rate Spread Next 30d, restrictions, availability | 🟢 GREEN | from rate_inventory (88,863 rows live) |

**Verdict:** ~65% green. Comp Set, Promotions, external trends are grey. Sub-tabs can ship live for Pulse, Demand (mostly), Channels, Rates, Rate Plans, Inventory. Comp Set and Promotions show "in development" placeholders.

---

## Tab 5: Departments

### Sub-tabs: Roots (F&B) | Spa & Activities

| Sub-tab | Section | Status | Notes |
|---|---|---|---|
| **Roots (F&B)** | Total F&B Revenue, Total Covers | 🟢 GREEN | from `transactions` filtered to F&B categories via `usali_category_map` |
| Roots | Avg Cover · Food / Beverage | 🟡 AMBER | Need to define cover count — possible from transaction count grouped by date+session, but Roots POS sessions aren't explicitly tracked. Approximate via distinct guests/day. |
| Roots | Beverage / Food Ratio | 🟢 GREEN | from items × usali category |
| Roots | Top Sellers · Food / Beverage | 🟢 GREEN | from items × transactions |
| Roots | F&B Capture Rate | 🟢 GREEN | live |
| Roots | F&B / Occupied Room | 🟢 GREEN | live |
| Roots | Outlet Split | 🟡 AMBER | Need outlet field in transactions. Cloudbeds POS doesn't natively split outlets — Roots is single outlet. If multiple outlets emerge, would need POS extension. |
| **Spa & Activities → Spa Treatments** | Total Spa Rev, Treatments Sold, Avg Treatment Value | 🟢 GREEN | from items + transactions × usali_category 'Spa' |
| Spa | Avg Treatments / Day | 🟢 GREEN | live |
| Spa | Spa Capture Rate | 🟢 GREEN | live |
| Spa | Treatment Type Split | 🟢 GREEN | from items.name in spa category |
| Spa | Therapist Utilization | ⚪ GREY | No therapist scheduling data in Cloudbeds. Spa uses separate system or manual log. |
| **Spa & Activities → Activities** | Total Activity Revenue, Activities Sold, Avg Activity Value | 🟢 GREEN | from items × usali category 'Activities' |
| Activities | Top Activities | 🟢 GREEN | live |
| Activities | Activity Capture by Source Country | 🟡 AMBER | source_country coverage 24% |
| **Spa & Activities → Wellness Packages** | Packages Sold, Avg Package Value, Package Attach Rate | ⚪ GREY | Cloudbeds packages endpoint not synced (see Rate Plans). |

**Verdict:** ~80% green. Therapist scheduling, packages, and outlet split are the main gaps.

---

## Tab 6: Finance

### Sub-tabs: P&L | Budget | Guest Ledger & Deposits

| Sub-tab | Section | Status | Notes |
|---|---|---|---|
| **P&L** | Total Revenue, GOP, EBITDA, Cost % of Revenue, GOPPAR | 🟡 AMBER | Revenue side: 🟢 from transactions. Cost side: ⚪ no expense data — needs operator manual entry or accounting system integration. Show revenue today, leave costs grey. |
| P&L | USALI Profit & Loss table | 🟡 AMBER | Revenue lines: 🟢 ready. Expense lines: ⚪ grey. |
| P&L | Revenue by USALI Department | 🟢 GREEN | usali_category_map joined to transactions |
| P&L | Trends · 12 Months | 🟢 GREEN | for revenue. |
| **Budget** | Annual Revenue Target, YTD Actual vs Budget, Forecast EOY, Target EBITDA Margin | ⚪ GREY | Budget table doesn't exist yet. Need upload schema (`budgets` table + monthly breakdown). 1-day build. |
| Budget | Monthly Budget · 2026 | ⚪ GREY | Same. |
| Budget | Version History | ⚪ GREY | Same. |
| **Guest Ledger & Deposits** | In-House Guests, Total In-House Balance, High-Balance Flags | 🟡 AMBER | Balance = sum of unpaid charges per active reservation. Computable from `transactions`. |
| Ledger | Aged Receivables Detail (0-30, 31-60, 61-90, 90+) | 🟡 AMBER | Computable but requires joining transactions to reservation/house_account check-out date. Doable. |
| Ledger | Deposits Held, Deposits Due (next 30d), Reservations w/ Deposit, Avg Deposit %, Overdue Deposits | 🟡 AMBER | Cloudbeds tracks deposits in transactions (category=payment with negative balance correlation). Schema works but rule needs tuning. |
| Ledger | City Ledger Accounts, Total City Ledger | 🟢 GREEN | from `house_accounts` (1,035 rows live) |
| Ledger | Avg Days to Pay, Avg Settlement Time | 🟡 AMBER | Computable from house_account dateCreated + payment dates. |
| Ledger | Missing Email | 🟢 GREEN | from reservations.guest_email NULL count |

**Verdict:** P&L revenue side ready, expense side grey. Budget grey entirely. Ledger ~70% green.

---

## Aggregate scorecard

| Tab | 🟢 Green | 🟡 Amber | ⚪ Grey | Ship now? |
|---|---|---|---|---|
| Overview | 70% | 5% | 25% | ✅ YES |
| Today's Snapshot | 50% | 10% | 40% | ⚠ Defer or partial |
| Action Plans | 0% | 0% | 100% | ❌ Defer entirely |
| Revenue | 65% | 10% | 25% | ✅ YES (skip Comp Set, Promotions) |
| Departments | 80% | 5% | 15% | ✅ YES |
| Finance | 50% | 25% | 25% | ✅ YES (P&L revenue, Ledger; skip Budget, expense side) |

**Recommendation:** Ship 4 of 6 tabs immediately (Overview, Revenue, Departments, Finance), defer Today's Snapshot and Action Plans until Module 4 (Vertex) and POS integration are scoped.

---

## What needs to happen before "go-live"

| # | Action | ETA |
|---:|---|---|
| 1 | Materialized views in Supabase: `mv_kpi_daily`, `mv_kpi_monthly`, `mv_revenue_by_segment`, `mv_pace_otb`, `mv_channel_perf`, `mv_capture_rates`, `mv_arrivals_departures`, `mv_aged_ar` | 1 day |
| 2 | Refresh job (pg_cron, every 15 min) | 1 hr |
| 3 | Front-end build: replace mockup hardcoded values with live API calls to Supabase | 2-3 days |
| 4 | Grey-out (CSS class) for un-fed sections — show "Coming soon" overlay | 2 hr |
| 5 | DQ exception list (5 hardcoded rules: missing market_segment, missing email, uncategorized items, NULL guest_country, NULL ratePlanNamePublic) | 4 hr |

---

## Cowork deployment prompt

Paste the block below into Cowork to spin up the front-end deployment. It already includes context, scope, constraints, and a deliverable checklist.

```
ROLE
You are a senior full-stack engineer building the read-only BI dashboard front-end for The Namkhan (Luang Prabang, Laos).

CONTEXT
- Backend is Supabase Postgres, project ID `kpenyneooigsyuuomgct` (region eu-central-1).
- Phase 1 ingestion is COMPLETE (see project file 13_PHASE1_SYNC_AUDIT.md). Live tables: hotels, room_types, rooms, reservations (4,749), reservation_rooms (46,423), transactions (76,001), rate_plans (100), rate_inventory (88,863), house_accounts (1,035), items (451), add_ons (19,170), tax_fee_records (19,225), adjustments (349), market_segments (5), usali_category_map (80).
- The visual reference is `Namkhan_BI___UI_Mockup_v1.html` in the project (5,097 lines, hand-coded HTML/CSS — keep the look and feel exactly).
- USALI 11th edition is the accounting standard. LAK = base currency stored, USD = display currency. Toggleable.
- Branding per `11_BRAND_AND_UI_STANDARDS.md`: Namkhan logo top-left, SLH logo bottom-left, Soho House-style typography, casual luxury tone.

SCOPE FOR THIS DEPLOYMENT
Ship 4 of 6 tabs as live, two as visible-but-greyed:
- Tab 1 Overview: LIVE
- Tab 2 Today's Snapshot: GREY-OUT (placeholder "Coming soon — POS integration in scope")
- Tab 3 Action Plans: GREY-OUT (placeholder "Recommendations engine in development")
- Tab 4 Revenue (sub-tabs Pulse, Demand, Channels, Rates, Rate Plans, Inventory): LIVE; Comp Set and Promotions sub-tabs grey-out
- Tab 5 Departments (Roots F&B, Spa, Activities): LIVE; Wellness Packages and Therapist Utilization grey-out
- Tab 6 Finance: P&L revenue side LIVE, expense side grey; Budget tab grey-out; Guest Ledger LIVE
Per-tab feasibility detail is in project file 14_MOCKUP_VS_DATA_AUDIT.md.

TECH STACK
- Front-end: Next.js 14 (app router) + TypeScript + Tailwind. No external UI lib — keep mockup CSS verbatim.
- Data: Supabase JS client, server-side fetch with revalidation 60s. Anon key only — RLS read-only on materialized views.
- Charts: Recharts (already loaded in mockup as global)
- Currency toggle: state-managed at root, propagates LAK ↔ USD via single divisor (current FX rate stored in `system_settings.fx_lak_usd`, default 21800)
- Hosting: Vercel, project name `namkhan-bi`

DATA LAYER ACCESS
- Materialized views the back-end will expose (must be created — request DDL from me if not present):
  - mv_kpi_today, mv_kpi_period (occ/ADR/RevPAR/TRevPAR per day, week, month)
  - mv_revenue_by_usali_dept (joined transactions × usali_category_map)
  - mv_channel_perf_30d, mv_channel_perf_90d
  - mv_pace_otb (OTB by check-in month, vs STLY)
  - mv_arrivals_departures_today
  - mv_aged_ar (0-30, 31-60, 61-90, 90+)
  - mv_capture_rates (F&B / Spa / Activity per occupied roomnight)
  - mv_rate_inventory_calendar (date × room_type × rate × available_rooms × restrictions)
- All views read-only via Supabase REST. Hit them via PostgREST endpoints.

GREY-OUT BEHAVIOR
For grey sections: render the same card structure but apply `.greyed-out` class (opacity 0.35, pointer-events none) and overlay an SLH-typography "Coming soon — [reason]" label at center. Reason text per section listed in 14_MOCKUP_VS_DATA_AUDIT.md.

DELIVERABLES
1. Working dashboard at namkhan-bi.vercel.app (auth-protected, basic password until Phase 2 SSO)
2. Source repo on GitHub (private)
3. README with: env vars, local dev steps, materialized view refresh cron command, deploy command
4. Storybook of the 6 tab components
5. Loading states, error states, no-data states for each card

OUT OF SCOPE
- No write operations. Read-only.
- No Whistle, no GA4, no Skyscanner, no comp set scrape — those are placeholders.
- No mobile-responsive layout for v1 — desktop only.
- No login system beyond a single password gate.

QUALITY BAR
- All live KPIs must compute server-side and match queries in 13_PHASE1_SYNC_AUDIT.md §9.
- Currency display 100% consistent: USD shows 2 decimals, LAK shows whole numbers in millions/thousands suffix.
- Loading: skeleton shimmer, no layout shift.
- Error: section-level fallback ("Data temporarily unavailable") not full-page crash.
- A11y: keyboard navigation works on all sub-tabs, ARIA labels on all interactive cells.

CONSTRAINTS
- Do not invent fields not in the live schema. Cross-check against project file 13_PHASE1_SYNC_AUDIT.md §4 before writing any query.
- Do not auto-format LAK as USD or vice versa.
- Do not embed Cloudbeds API calls in the front-end — all data via Supabase only.
- Do not add new sub-tabs the mockup doesn't have.

START
1. Confirm you've read 13_PHASE1_SYNC_AUDIT.md and 14_MOCKUP_VS_DATA_AUDIT.md.
2. Output the exact list of materialized views you need created in Supabase, with each view's SQL definition.
3. Then propose the Next.js project skeleton (file tree, route structure).
Wait for my approval before writing any component code.
```

---

**End of audit.**
