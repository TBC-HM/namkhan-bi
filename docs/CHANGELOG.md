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
