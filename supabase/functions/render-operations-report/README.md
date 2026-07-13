# render-operations-report

**Deployed:** Supabase edge fn (source of truth = Supabase deploy, NOT this repo).

v1 · 2026-07-14 · PBS #93 - Ops HoD daily digest.

**POST** `{ property_id: number, template_key: "operations_daily" }`

Returns `{ subject, html, property_name, report_date }`.

Sections wired against these views (see edge fn source for full detail):

- 1  `public.v_kpi_daily_property` (yesterday + LY)
- 2  `pms.v_reservations` + `pms.v_reservation_rooms` (arrivals / departures / in-house pax)
- 3  `public.v_staff_punctuality` (90d proxy - factorial.shifts + factorial.clock_events NOT YET WIRED)
- 4  `gl.v_fnb_revenue_by_category_daily` + `kpi.v_ancillary_capture_daily` + `public.v_dept_top_seller_trend`
- 5  `kpi.v_ancillary_capture_daily` + `gl.v_spa_top_treatments_monthly` (therapist hours + today schedule NOT YET WIRED)
- 6  `kpi.v_ancillary_capture_daily` (guide-hours + today schedule NOT YET WIRED)
- 7  `pms.v_reservations` + `pms.v_reservation_rooms` derived
- 8  `public.cockpit_tickets` filtered on `arm ILIKE '%operations%'` or `metadata->>dept=operations`
- 9  `public.mkt_reviews` (last-24h filter)
- 10 empty-state (per-day guardrail-conclusion feed NOT YET WIRED - `public.guardrails` is thresholds only)
- 11 aggregated narrative under 50-word blocks

Currency: **USD across every row.** LAK -> USD via latest `gl.fx_rates` USD-to-LAK entry.

**Preview URL:** `/operations/reports/scheduled/daily/preview?property_id=260955`

**Template row:** `documentation.revenue_report_templates` id=5, key=`operations_daily`.
