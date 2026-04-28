# 08 — BI Dashboards Spec

> The dashboard is built and deployed (Next.js + Vercel).
> This doc maps each tab → KPIs → source view → status.

## Dashboard structure

```
The Namkhan · Owner Intelligence
├── Overview                      LIVE
├── Today's Snapshot              LIVE (HK greyed)
├── Action Plans                  GREY (Phase 4)
├── Revenue
│   ├── Pulse                    LIVE
│   ├── Demand                   LIVE
│   ├── Channels                 LIVE
│   ├── Rates                    LIVE
│   ├── Rate Plans               LIVE
│   ├── Inventory                LIVE
│   ├── Comp Set                 GREY (Phase 2)
│   └── Promotions               GREY (Phase 2)
├── Departments
│   ├── Roots (F&B)              LIVE (covers/avg-cover greyed)
│   └── Spa & Activities         LIVE (therapist util greyed)
└── Finance
    ├── P&L                      LIVE (revenue side; expense GREY)
    ├── Budget                   GREY (upload pending)
    └── Ledger                   LIVE
```

## Tab spec

### Overview
- **Audience:** Owner / GM
- **Refresh:** 60s revalidate, source data refreshes every 15 min
- **KPIs (Right Now):** In-House · Arriving Today · Departing Today · OTB Next 90d
- **KPIs (30d):** Occupancy · ADR · RevPAR · TRevPAR · GOPPAR (greyed)
- **KPIs (Bottom row):** Cancellation% · No-show% · F&B/Occ · Spa/Occ · Activity/Occ · Open DQ Issues
- **Charts:** 90-day stacked daily revenue (Rooms · F&B · Spa · Activity)
- **Sub-sections:** Forecast vs Budget (greyed) · Channel Mix top 6
- **Source views:** `mv_kpi_today`, `mv_kpi_daily`, `mv_capture_rates`, `dq_known_issues`, `mv_channel_perf`

### Today's Snapshot
- **Audience:** Front Office, GM
- **KPIs:** In-House · Arrivals · Departures · Available Tonight · OOO/OOS (greyed — scope blocked)
- **Tables:** Arrivals · Departures · In-House (with balance flags)
- **Greyed:** F&B Today · Spa Today · Activities Today (no live POS feeds yet)
- **Source views:** `mv_kpi_today`, `mv_arrivals_departures_today`

### Action Plans
- **GREY** — Phase 4. Vertex recommendations engine pending.

### Revenue · Pulse
- **KPIs (30d):** Occupancy · ADR · RevPAR · TRevPAR · Total/Rooms/Ancillary revenue · Pace vs Forecast (greyed)
- **Chart:** 90-day daily revenue, stacked by USALI dept
- **Source:** `mv_kpi_daily`

### Revenue · Demand
- **KPIs:** OTB Roomnights · OTB Revenue · STLY Roomnights · Pace Δ
- **Table:** Pace by month — OTB rn · STLY rn · Δrn · OTB rev · STLY rev · Δrev
- **Source:** `mv_pace_otb`

### Revenue · Channels
- **KPIs:** Total Bookings 90d · Total Revenue 90d · OTA Mix · Direct Mix
- **Table:** All sources — bookings · revenue · ADR · avg lead · avg LOS · cancel%
- **Source:** `mv_channel_perf`

### Revenue · Rates
- **Table:** Min/Avg/Max BAR per room type (next 30d)
- **Table:** Active restrictions (CTA / CTD / Stop-Sell / MinStay)
- **Source:** `mv_rate_inventory_calendar`

### Revenue · Rate Plans
- **Table:** 90-day performance per rate plan — bookings · roomnights · revenue · ADR
- **Source:** `rate_plans` + `reservations` aggregation

### Revenue · Inventory
- **Table:** Per-date for next 60 days — total available · min rate · max rate · spread
- **Source:** `mv_rate_inventory_calendar`

### Revenue · Comp Set
- **GREY** — Phase 2 scraper agent

### Revenue · Promotions
- **GREY** — Cloudbeds promo endpoint not synced

### Departments · Roots (F&B)
- **KPIs:** F&B Total · Food · Beverage · F&B/Occ Rn · F&B Capture %
- **Table:** Top 12 sellers (30d)
- **Greyed:** Outlet Split (single outlet) · Avg Cover (cover field not in PMS)
- **Source:** `mv_kpi_daily`, `mv_capture_rates`, `mv_classified_transactions`

### Departments · Spa & Activities
- **KPIs:** Spa Revenue · Activity Revenue · Spa Capture · Activity Capture
- **Tables:** Top Spa · Top Activities (30d)
- **Greyed:** Wellness Packages · Therapist Utilization
- **Source:** `mv_kpi_daily`, `mv_capture_rates`, `mv_classified_transactions`

### Finance · P&L
- **KPIs:** Total · Rooms · F&B · Other Operated · Retail (latest full month)
- **KPIs (greyed):** GOP · EBITDA · Cost % · GOPPAR
- **Chart:** Trailing 12-month stacked monthly revenue by USALI dept
- **Table:** USALI detail for latest full month with % of total
- **Greyed section:** Expense side
- **Source:** `mv_revenue_by_usali_dept`, `mv_kpi_daily`

### Finance · Budget
- **GREY** — Awaiting budget upload schema

### Finance · Ledger
- **KPIs:** In-House Guests · Total In-House Balance · High-Balance flags · Missing Email
- **Aged AR section:** Total AR + 4 buckets (0-30 / 31-60 / 61-90 / 90+) + table
- **Table:** City Ledger Accounts (active first 20)
- **Greyed:** Deposits Held / Due
- **Source:** `mv_aged_ar`, `mv_kpi_today`, `mv_arrivals_departures_today`, `house_accounts`

## Tech stack

- **Frontend:** Next.js 14 (app router) + TypeScript + Tailwind + Recharts
- **Auth:** Single-password gate via cookie middleware (`DASHBOARD_PASSWORD` env var)
- **Hosting:** Vercel (region `fra1`)
- **Data:** Supabase JS client → mat views (anon key, read-only)
- **Currency:** USD ↔ LAK toggle in top right (FX 21800, configurable)

## UI rules

Per `11_BRAND_AND_UI_STANDARDS.md`:
- Namkhan brand top-left, SLH affiliation top-right
- Soho House-style typography (Playfair Display + Inter + JetBrains Mono)
- Casual luxury palette: dark bg #0e0e0e, sand accent #bfa980
- Tabular numerals everywhere for KPIs
- LAK base + USD secondary in KPI cards
- Greyed sections: 35% opacity + "Coming soon" overlay with reason

## Tabs not built (yet)

| Tab | Why not | Trigger to build |
|---|---|---|
| Action Plans | Vertex engine = Phase 4 | Need 6 mo of clean post-DQ data |
| Comp Set | No comp set scraper | Phase 2 backlog |
| Promotions | Cloudbeds endpoint not synced | When PBS prioritizes |
| Budget | No budget upload schema | When operator P&L is uploaded |
| P&L expenses | No cost upload | Same as Budget |
| F&B Today | No live POS feed | Phase 2 (POS integration) |
| Spa Today | External scheduler | Phase 2 |
| Activities Today | Bookings live outside Cloudbeds | Phase 2 |
| Therapist Utilization | Spa scheduler integration | Phase 2 |
| Repeat Guest % / Geo Mix dashboards | Data exists, dashboard tab not built | Easy add — backlog |
