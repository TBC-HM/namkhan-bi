# 01 — Scope and Modules

## Four modules

### M1 — SOPs & Training (Phase 2)
- **Audience:** Lao staff, low literacy, visual-first.
- **Deliverables:** PDF/PPT decks, laminated quick cards, short videos, Lao + English.
- **Tools:** Figma, Canva, Loom.
- **Status:** Not started. Trigger after dashboard is in daily use.

### M2 — Data Quality & Audit (Phase 2)
- **Purpose:** Detect wrong/missing fields and operator errors in Cloudbeds.
- **Deliverables:** Daily exception reports, error trend dashboard, Slack/Telegram alerts, DQ agent.
- **Tools:** Cloudbeds API → Supabase edge functions → DQ tables → Make/n8n alerts.
- **Status:**
  - DQ data layer present: `dq_known_issues` table seeded with 5 categories.
  - DQ agent that crawls historical data + flags violations: NOT BUILT (Phase 2).
- **Known DQ issues already logged:**
  - `PMS_USER_ERROR` — Lao operators sometimes hit wrong buttons (wrong category, wrong rate plan, wrong room). Garbage data.
  - `MARKET_SEGMENT_NULL` — 82% of historical reservations have NULL `market_segment`.
  - `UNCATEGORIZED_ITEMS` — ~5% of monthly transactions fall through USALI map; some Cloudbeds items have no `categoryID`.
  - `HOUSEKEEPING_SCOPE_MISSING` — Cloudbeds `housekeeping:read` scope blocked. Need support ticket.
  - `TENT_7_CLOSED` — fixed via `operational_overrides` table.

### M3 — BI & KPI Layer (USALI) — **Phase 1 LIVE**
- **Purpose:** USALI 11th-edition KPIs by department.
- **Deliverables:** Dashboard with 6 top tabs and ~16 sub-tabs.
- **Stack:** Supabase (Postgres + 9 mat views) + Next.js on Vercel.
- **Status:**
  - 9 mat views deployed: see `05_KPI_DEFINITIONS.md` for the source-of-truth map.
  - Dashboard tabs LIVE: Overview · Today · Revenue (6 of 8 sub-tabs) · Departments (2 of 2) · Finance (P&L revenue + Ledger).
  - Tabs GREYED: Action Plans · Comp Set · Promotions · Budget · P&L expense side · F&B-today · Spa-today · Activities-today · Therapist util.

### M4 — Recommendations Engine (Phase 4)
- **Purpose:** Forward-looking, prescriptive actions per department, ranked by ROI.
- **Tools:** Vertex AI (Forecast, AutoML) + rule engine.
- **Status:** Not started. Requires ≥6 months of clean post-DQ-agent data.
- **Will produce:** weekly digest + real-time alerts + feedback loop logging.

## Dependencies (revised after Phase 1 reality)

```
M3 BI ─────► LIVE NOW (uses raw data with USALI mapping; some leakage acceptable)
                │
                ▼
M2 DQ Agent ──► reduces leakage from ~5% to <1% AND flags operator errors daily
                │
                ▼
M1 SOPs ──────► fix root cause of operator errors (training fixes input data)
                │
                ▼
M4 Vertex ────► clean data + 6 months history → forecasts + recommendations
```

> **Original plan said M2 must be live before M3.** Reality: we built M3 on imperfect data using a deterministic USALI classifier. ~6% leakage is visible; we display it as an `unclassified` line so it's not hidden. M2 reduces this and adds operator-error detection.

## Out of scope

- Non-Cloudbeds revenue sources.
- Accounting/payroll system integration (Phase 2 candidate).
- Guest CRM/marketing automation (separate project).
- Multi-property — current schema is property-scoped; multi-property is a v2 design decision.

## Property profile

- 19 sellable rooms (Tent 7 retired permanently).
- 5 room types: Tent (10), Suite (5), Villa (1), Room (4), Suite-other (1).
- Single F&B outlet: **The Roots**.
- Spa, activities, retail (small).
- ~4,749 historical reservations (2019 → Feb 2027 OTB).
- ~76,000 historical transactions, ~46,000 reservation-room nights.
