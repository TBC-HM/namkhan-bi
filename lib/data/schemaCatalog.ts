// lib/data/schemaCatalog.ts
// Curated schema reference for the data Q/A agent. Only the tables/views below
// are described to the LLM — anything not here is invisible to the agent.
// Keep entries tight: name + 1-line purpose + key columns. Don't dump full DDL.
//
// The agent's SQL is also gated by /lib/data/sqlGuard.ts (SELECT-only, etc.).

export const SCHEMA_CATALOG = `
=== BI VIEWS — read these for data questions ===

-- FINANCE / GL (budget, P&L, USALI) -----------------------------------------
gl.v_budget_lines                 (period_yyyymm TEXT (e.g. '2026-01'), usali_department, usali_subcategory,
                                   account_code, account_name, amount_lak, amount_usd)
gl.v_budget_vs_actual             (period_yyyymm TEXT (e.g. '2026-01'), usali_department, usali_subcategory,
                                   actual_usd, budget_usd, variance_usd, variance_pct)
                                  -- NOTE: period is TEXT in 'YYYY-MM' format. To filter Jan 2026:
                                  --   WHERE period_yyyymm = '2026-01'
                                  -- To filter current year:
                                  --   WHERE period_yyyymm LIKE to_char(current_date,'YYYY')||'%'
gl.v_pl_monthly_usali             (period_yyyymm TEXT 'YYYY-MM', account_id, account_name, qb_type,
                                   usali_subcategory, usali_line_code, usali_line_label, amount_usd)
                                  -- ★ PRIMARY SOURCE for "revenue in January", historical monthly P&L.
                                  -- NO usali_department column — use usali_subcategory instead
                                  -- (e.g. 'Revenue','Cost of Sales','Payroll & Related','Other Operating Expenses').
                                  -- For F&B-specific filtering, JOIN qb_type or filter usali_line_label ILIKE '%F&B%'/'%Food%'.
                                  -- Use sum(amount_usd) when grouping.
gl.v_pnl_usali                    (posting_date DATE, gl_code, amount NUMERIC, usali_section,
                                   usali_dept, usali_subdept, usali_undist_line, is_labour BOOL)
                                  -- Granular GL-level data for full P&L. usali_section values:
                                  -- 'Revenue','Cost of Sales','Payroll','Other Op Exp','Undistributed','Non-Op'.
                                  -- usali_dept = Rooms / F&B / Spa / Activities / Mekong Cruise / Other Operated
                                  -- usali_undist_line = A&G / Sales & Marketing / POM / Utilities / etc.
gl.v_usali_dept_summary           (period_yyyymm TEXT 'YYYY-MM', fiscal_year INT,
                                   usali_department TEXT, revenue, cost_of_sales,
                                   payroll, other_op_exp, gross_profit,
                                   departmental_profit, dept_profit_margin)
                                  -- ★ DEPT-LEVEL P&L roll-up. Each row = one department per month.
                                  -- Use for "F&B P&L", "Spa profit margin", "department GOP comparison".
                                  -- usali_department values: 'Rooms','F&B','Spa','Activities','Mekong Cruise',
                                  -- 'Other Operated','Undistributed','Non-Operating'.
gl.v_payroll_summary              (period_yyyymm TEXT 'YYYY-MM', staff_count, gross_payroll_usd,
                                   net_payroll_usd, total_days_worked, days_off)
                                  -- ⚠️ NO dept column. For dept-level labour, use ops.v_payroll_dept_monthly.
ops.v_payroll_dept_monthly        (period_month DATE, dept_code, dept_name, headcount,
                                   total_days_worked, total_base_lak, total_overtime_lak,
                                   total_sc_lak, total_allow_lak, total_sso_lak, total_tax_lak,
                                   total_net_lak, total_grand_usd,
                                   total_canonical_net_lak, total_canonical_net_usd,
                                   total_canonical_cost_lak, total_canonical_cost_usd,
                                   total_benefits_lak)
                                  -- ★ Dept-level labour cost. Filter month: period_month = '2026-01-01'.
                                  -- For TOTAL labour cost USD: SUM(total_canonical_cost_usd).
                                  -- dept_code values: 'KITCHEN','HK','FO','SPA','MAINT','ADMIN','GARDEN','F&B_SVC' etc.
gl.v_supplier_overview            (vendor_name, total_usd_ytd, last_invoice_date, txn_count)
gl.v_top_suppliers_current_month  (vendor_name, amount_usd, txn_count)
gl.v_top_suppliers_ytd            (vendor_name, amount_ytd_usd, rank)
gl.v_supplier_transactions        (vendor_name, txn_date, account_name, amount_usd, memo)
gl.v_demand_summary               (period_month, room_nights, occupancy_pct, adr_usd)

-- INVENTORY -----------------------------------------------------------------
inv.v_inv_stock_on_hand           (item_id, item_name, location_code, qty_on_hand, value_usd)
inv.v_inv_par_status              (item_id, item_name, location_code, qty, par_qty, status)
inv.v_inv_slow_movers             (item_id, item_name, days_no_movement, value_usd)
inv.v_inv_expiring_soon           (item_id, item_name, expiry_date, qty, value_usd)
inv.v_inv_usage_trend             (item_id, period_month, usage_qty, usage_value_usd)
inv.v_inv_heatmap_health          (category_code, location_code, health, item_count)
inv.v_inv_days_of_cover           (item_id, item_name, days_of_cover)
inv.categories                    (category_code, category_name)

-- FX RATES (multi-currency conversions) ------------------------------------
gl.fx_rates                       (rate_date DATE, from_currency TEXT, to_currency TEXT,
                                   rate NUMERIC, source TEXT)
                                  -- Daily FX rates from Frankfurter (USD base) + manual LAK.
                                  -- Use for "X in EUR", "Y in LAK", "convert to THB" questions.
                                  -- ALWAYS pick the latest rate via:
                                  --   ORDER BY rate_date DESC LIMIT 1
                                  -- Available currencies: USD, EUR, GBP, THB, CHF, JPY, AUD, SGD, CNY, LAK.

-- KPI / DAILY / OCCUPANCY ---------------------------------------------------
kpi.daily_snapshots               (snapshot_date DATE, total_rooms, in_house, occupied_tonight,
                                   rooms_sold, occupancy_pct, adr_usd, revpar_usd, trevpar_usd,
                                   rooms_revenue_usd, fnb_revenue_usd, spa_revenue_usd,
                                   activity_revenue_usd, total_ancillary_revenue_usd)
                                  -- ⚠️ ONLY recent days (last few weeks). DO NOT use for historical
                                  -- monthly questions like "revenue in January" — use gl.v_pl_monthly_usali instead.
                                  -- Use ONLY for: ADR/RevPAR/occupancy in last 30 days, "today/yesterday/this week".
kpi.v_capture_rate_daily          (date, dept, capture_pct, per_occupied_room_usd)
kpi.v_ancillary_daily             (date, fnb_revenue, spa_revenue, activity_revenue)
kpi.v_channel_economics           (channel, room_nights, adr_usd, commission_pct, net_adr_usd)
kpi.v_fb_outlet_daily             (date, outlet, covers, revenue_usd, avg_check_usd)
kpi.v_dept_labour_ratio_daily     (date, dept, payroll_usd, revenue_usd, labour_ratio_pct)

-- SUPPLIERS / PROCUREMENT ---------------------------------------------------
suppliers.suppliers               (supplier_id, supplier_name, status, is_local_sourcing,
                                   reliability_score, quality_score, contact_email)
proc.purchase_orders              (po_id, supplier_id, total_usd, status, order_date,
                                   expected_delivery)
proc.requests                     (pr_id, requested_by, dept, total_usd, status, created_at)

-- DOCS (knowledge base, NOT for content Q/A — use docs_ask_chunks for that) -
docs.documents                    (doc_id, doc_type, importance, title, external_party,
                                   valid_from, valid_until, sensitivity, file_size_bytes,
                                   created_at, status)
                                  -- e.g. "how many partner docs do we have" → SELECT count
                                  -- "which contracts expire in next 90 days"
                                  -- "list audits by SLH"
public.v_knowledge_overview       (metric_group, metric, value, details JSONB)
                                  -- ★ ROLLUP for "how many docs do we have", "how many SOPs",
                                  -- "how many critical docs", "docs by type", "chunks indexed".
                                  -- Just SELECT * FROM public.v_knowledge_overview.

-- PROPERTY / SETTINGS / OWNER INFO ------------------------------------------
marketing.property_profile        (property_id INT, legal_name, trading_name, tax_id,
                                   business_license_no, vat_registered, website_url,
                                   booking_engine_url, street_line_1, village, district,
                                   province, postal_code, country, latitude, longitude,
                                   star_rating, check_in_time, check_out_time,
                                   primary_language, languages_spoken[], short_description,
                                   long_description, brand_color_hex, brand_palette JSONB,
                                   brand_typography JSONB, affiliations[], unique_selling_points[],
                                   shuttle_available, shuttle_description, airport_distance_km,
                                   bus_drive_time_min, train_distance_km, climate_summary,
                                   climate_temp_min_c, climate_temp_max_c, climate_rainy_months)
                                  -- ★ AUTHORITATIVE source for "what's our tax number",
                                  -- "what's the legal entity", "business license", "address",
                                  -- "check-in time", "USPs", "languages spoken".
                                  -- Single row per property_id. Filter: property_id = 260955.
marketing.property_contact        (property_id, contact_type, value, role, notes)
                                  -- Phone numbers, emails, GM/owner direct contacts.
                                  -- "what's the GM phone" → filter on role='gm' or contact_type='phone'.
public.app_settings               (property_id BIGINT, key TEXT, value JSONB, required_role,
                                   updated_at, updated_by)
                                  -- Key-value store for ad-hoc settings (property.fx_lak_usd,
                                  -- property.active_rooms, property.timezone, etc.). For
                                  -- per-feature configs not modeled in property_profile.

public.app_users                  (id UUID, email, display_name, role, property_id, initials,
                                   active BOOL, created_at, last_seen_at)
                                  -- App-level users with assigned roles.
                                  -- role values: 'owner','rm','fo','ops','finance','marketing','viewer'.
                                  -- "who has owner access", "list active users", "who's logged in lately".

-- AGENTS / GOVERNANCE (AI agents — runs, health, settings, budgets) --------
governance.agents                 (agent_id UUID, code, name, pillar, description, status,
                                   schedule_cron, schedule_human, model_id, prompt_version,
                                   last_run_at, last_success_at, last_error,
                                   avg_confidence, total_runs, total_proposals,
                                   approved_proposals, monthly_budget_usd,
                                   month_to_date_cost_usd, approval_rate, roi_realized_usd,
                                   runtime_settings JSONB)
                                  -- ★ Master list of all AI agents. status: 'active','beta','paused',
                                  -- 'planned','idle','failed'. pillar: 'revenue','sales','marketing',
                                  -- 'operations','guest','finance','front-office','knowledge'.
                                  -- "list active agents", "which agents are paused",
                                  -- "what's compset_agent's MTD cost", "agent ROI".
governance.v_agent_health         (agent_id, code, name, pillar, status, monthly_budget_usd,
                                   month_to_date_cost_usd, runs_30d, success_30d, failed_30d,
                                   cost_30d_usd, tokens_30d, proposals_30d, proposals_pending,
                                   approved_30d, rejected_30d, realized_impact_30d_usd,
                                   last_run_at, last_success_at, last_error)
                                  -- ★ 30-day rollup per agent. Use for "agent health dashboard",
                                  -- "which agents have most failures", "total agent cost this month".
governance.agent_run_summary      (run_id UUID, agent_id, agent_code, agent_name, started_at,
                                   finished_at, status, duration_ms, tokens_in, tokens_out,
                                   cost_usd, proposals_created, error_message, minutes_ago)
                                  -- Per-run row. status: 'running','success','partial','failed'.
                                  -- "show last 10 compset_agent runs", "failed runs today".
governance.agent_settings_for_rm  (agent_id, code, name, status, pillar, runtime_settings JSONB,
                                   locked_by_mandate JSONB)
                                  -- Editable runtime knobs for revenue managers + locked mandate rules.

-- BOOKMARKS / LINKS (stored URLs) -------------------------------------------
docs.bookmarks                    (bookmark_id UUID, url TEXT, title TEXT, description TEXT,
                                   category TEXT, tags TEXT[], importance TEXT, is_active BOOL,
                                   added_by_name TEXT, created_at)
                                  -- Stored URLs / portal links. Categories:
                                  --   pms, partner, reference, industry, tools, admin, news, training, other.
                                  -- "give me the SLH portal link" → SQL on bookmarks.

-- FRONT OFFICE -------------------------------------------------------------
frontoffice.vip_briefs            (reservation_id, guest_name, arrival_date, vip_tier, notes)

-- ROOM CATALOG (Cloudbeds-synced master data) ------------------------------
public.room_types                 (room_type_id BIGINT, property_id, room_type_name,
                                   room_type_name_short, room_type_description, max_guests,
                                   max_adults, max_children, base_rate, quantity)
                                  -- ★ Use for "how many room types", "what's our room mix",
                                  -- "max occupancy of [room type]", "base rate for Riverview Suite".
                                  -- 'quantity' = how many physical rooms of this type.
public.rooms                      (room_id TEXT, property_id, room_type_id, room_name,
                                   room_description, is_active BOOL)
                                  -- Physical room inventory. Filter is_active=true for live rooms.
                                  -- "list all suites" → JOIN to room_types on room_type_id.
public.room_blocks                (id, group_id, property_id, room_type_id, block_date,
                                   rooms_blocked, rooms_picked_up, rate)
                                  -- Group blocks (rooms held for groups/events).

public.v_room_type_pulse_30d      (room_type_id, room_type_name, rooms, capacity_nights,
                                   room_nights_sold, occupancy_pct, adr_usd, revenue_usd,
                                   occupancy_pct_stly, adr_usd_stly, revenue_usd_stly)
                                  -- ★ Last-30-day performance per room type with STLY compare.
                                  -- "which room types are under-performing", "ADR by room type 30d".
                                  -- Sister views: v_room_type_pulse_7d, v_room_type_pulse_90d.

-- GUESTS / RESERVATIONS (Cloudbeds-synced — REAL schema) -------------------
public.guests                     (guest_id TEXT, property_id, first_name, last_name, email,
                                   phone, country, city, address, document_type, document_number,
                                   date_of_birth, gender, language, is_repeat BOOL,
                                   total_stays INT, total_spent NUMERIC, last_stay_date)
                                  -- ★ Master guest profile. NOTE: column is total_spent, NOT
                                  -- total_revenue_usd. NO vip_tier, NO source, NO first_stay_date.
                                  -- guest_id is TEXT (Cloudbeds string ID).
                                  -- Search by name: WHERE last_name ILIKE '%X%' OR first_name ILIKE '%X%'.

public.reservations               (reservation_id TEXT, property_id, booking_id, status,
                                   source, source_name,
                                   guest_name TEXT, guest_email, guest_country, cb_guest_id TEXT,
                                   check_in_date, check_out_date, nights, adults, children,
                                   total_amount NUMERIC, paid_amount, balance, currency,
                                   booking_date, cancellation_date, is_cancelled BOOL,
                                   market_segment, rate_plan, room_type_name)
                                  -- ★ status values: 'confirmed','checked_in','checked_out',
                                  --   'cancelled','no_show','not_confirmed'.
                                  -- ★ For "reservations of <person>" — SIMPLEST path is the
                                  --   embedded guest_name field (every reservation has it):
                                  --     WHERE guest_name ILIKE '%Nehls%'
                                  --   For deeper guest data, JOIN via cb_guest_id (NOT guest_id):
                                  --     JOIN public.guests g ON g.guest_id = r.cb_guest_id
                                  -- ★ Money: column is total_amount (NOT total_revenue_usd).
                                  --   Currency in currency col — usually USD.
                                  -- ★ For arrivals: WHERE check_in_date = current_date + 1
                                  --   AND is_cancelled = false AND status <> 'no_show'.
                                  -- ★ source_name = 'Walk-In','Email','Booking.com','Expedia','Direct',etc.

public.reservation_rooms          (id, reservation_id TEXT, room_type_id, room_id, night_date,
                                   rate NUMERIC)
                                  -- One ROW PER NIGHT (not per stay). Nightly rate per night.
                                  -- For total room revenue per reservation: SUM(rate) GROUP BY reservation_id.
public.reservation_modifications  (reservation_id, modified_at, field, old_value, new_value)

guest.v_guest_reservations        (guest_id, reservation_id, check_in_date, nights,
                                   total_revenue_usd, status, source_channel)
                                  -- Convenience view: every reservation linked to its guest.
guest.review_replies              (review_id, reply_text, replied_by, replied_at)
guest.review_themes               (review_id, theme, sentiment_score)

public.v_guests_linked            (guest_id, name, email, total_stays, total_revenue_usd,
                                   linked_inquiries[], linked_reviews[])
                                  -- ★ Use for "guest profile of X" — cross-schema rollup.
public.v_repeat_guests            (guest_id, name, stays, total_revenue_usd, last_stay)
public.v_reservations_linked      (reservation_id, guest_name, check_in, source, revenue_usd,
                                   has_inquiry BOOL, has_review BOOL, has_payment BOOL)

sales.inquiries                   (id, guest_name, email, source, party_adults, party_children,
                                   date_in, date_out, country, triage_kind, triage_conf, status,
                                   created_at)
                                  -- Inbound sales pipeline. Pre-conversion or unresolved.

=== HARD RULES ===

1. SELECT only. NO insert/update/delete/drop/truncate/alter/grant/copy/vacuum.
2. Always qualify table names with the schema (e.g. gl.v_budget_lines, never v_budget_lines).
3. Always include a LIMIT when the result could be large (LIMIT 50 default).
4. For dates: months are 1-12, periods are YYYY-MM-DD. Use date_trunc('month', ...) where helpful.
5. Currency: prefer USD columns when both LAK and USD exist.
6. Dept names: 'Rooms','F&B','Spa','Activities','Mekong Cruise','Other Operated','Undistributed'.
7. If a question is ambiguous (e.g. "this year" without a year), assume current year.
8. The fiscal calendar is calendar-year (Jan-Dec).
9. Today is reference for "current", "now", "this month".

=== EXAMPLES ===

Q: "show me budget variance January for F&B"
SQL: SELECT usali_subcategory, budget_usd, actual_usd, variance_usd, variance_pct
     FROM gl.v_budget_vs_actual
     WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
       AND usali_department = 'F&B'
     ORDER BY abs(variance_usd) DESC LIMIT 50;

Q: "food suppliers january"
SQL: SELECT vendor_name, sum(amount_usd) AS amount_usd, count(*) AS txn_count
     FROM gl.v_supplier_transactions
     WHERE date_trunc('month', txn_date) = make_date(extract(year from current_date)::int, 1, 1)
       AND (account_name ILIKE '%food%' OR account_name ILIKE '%beverage%' OR account_name ILIKE '%f&b%')
     GROUP BY vendor_name ORDER BY amount_usd DESC LIMIT 50;

Q: "what's the revenue in January"  (historical monthly revenue)
SQL: SELECT usali_line_label, sum(amount_usd) AS amount_usd
     FROM gl.v_pl_monthly_usali
     WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
       AND usali_subcategory = 'Revenue'
     GROUP BY usali_line_label ORDER BY amount_usd DESC LIMIT 50;

Q: "give me the p/l for January" / "January P&L" / "income statement Jan"  (★ FULL P/L)
SQL: SELECT usali_subcategory, sum(amount_usd) AS amount_usd
     FROM gl.v_pl_monthly_usali
     WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
     GROUP BY usali_subcategory
     ORDER BY CASE usali_subcategory
       WHEN 'Revenue'                  THEN 1
       WHEN 'Cost of Sales'            THEN 2
       WHEN 'Payroll & Related'        THEN 3
       WHEN 'Other Operating Expenses' THEN 4
       WHEN 'A&G'                      THEN 5
       WHEN 'Sales & Marketing'        THEN 6
       WHEN 'POM'                      THEN 7
       WHEN 'Utilities'                THEN 8
       WHEN 'Depreciation'             THEN 9
       WHEN 'Interest'                 THEN 10
       WHEN 'FX Gain/Loss'             THEN 11
       WHEN 'Non-Operating'            THEN 12
       ELSE 99 END LIMIT 20;
-- The answer renderer formats this into the canonical USALI table with
-- bolded totals, parenthesised costs, and computed Dept GOP / GOP / Net Income.

Q: "P&L by department January"  (dept-level pivot)
SQL: SELECT usali_department, revenue, cost_of_sales, payroll, other_op_exp,
            departmental_profit, dept_profit_margin
     FROM gl.v_usali_dept_summary
     WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
     ORDER BY CASE usali_department
       WHEN 'Rooms'           THEN 1
       WHEN 'F&B'             THEN 2
       WHEN 'Spa'             THEN 3
       WHEN 'Activities'      THEN 4
       WHEN 'Mekong Cruise'   THEN 5
       WHEN 'Other Operated'  THEN 6
       WHEN 'Undistributed'   THEN 7
       ELSE 99 END LIMIT 20;

Q: "F&B revenue and cost January"  (use v_budget_vs_actual for dept filter)
SQL: SELECT usali_subcategory, actual_usd, budget_usd, variance_usd
     FROM gl.v_budget_vs_actual
     WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
       AND usali_department = 'F&B'
     ORDER BY abs(variance_usd) DESC LIMIT 50;

Q: "what's our adr last month"  (recent KPI — daily_snapshots OK)
SQL: SELECT avg(adr_usd) AS adr_usd, sum(rooms_revenue_usd) AS rooms_revenue,
            avg(occupancy_pct) AS occupancy
     FROM kpi.daily_snapshots
     WHERE snapshot_date >= date_trunc('month', current_date) - interval '1 month'
       AND snapshot_date <  date_trunc('month', current_date)
     LIMIT 1;

Q: "which contracts expire in the next 90 days"
SQL: SELECT title, doc_type, external_party, valid_until
     FROM docs.documents
     WHERE valid_until BETWEEN current_date AND current_date + interval '90 days'
       AND status = 'active'
     ORDER BY valid_until ASC LIMIT 50;

Q: "what's our tax number" / "what's our tax id"
SQL: SELECT legal_name, trading_name, tax_id, business_license_no, vat_registered,
            village, district, province, country
     FROM marketing.property_profile
     WHERE property_id = 260955 LIMIT 1;

Q: "what languages does the property support"
SQL: SELECT primary_language, languages_spoken
     FROM marketing.property_profile WHERE property_id = 260955 LIMIT 1;

Q: "how many docs do we have" / "how many SOPs"
SQL: SELECT metric, value, details FROM public.v_knowledge_overview
     ORDER BY metric_group, metric LIMIT 50;

Q: "F&B revenue January in EUR" (multi-currency conversion)
SQL: WITH latest_eur AS (
       SELECT rate FROM gl.fx_rates
       WHERE from_currency='USD' AND to_currency='EUR'
       ORDER BY rate_date DESC LIMIT 1
     ),
     pl AS (
       SELECT sum(amount_usd) AS revenue_usd
       FROM gl.v_pl_monthly_usali
       WHERE period_yyyymm = to_char(current_date,'YYYY')||'-01'
         AND usali_subcategory = 'Revenue'
     )
     SELECT pl.revenue_usd AS revenue_usd,
            ROUND(pl.revenue_usd * eur.rate, 2) AS revenue_eur
     FROM pl, latest_eur eur LIMIT 1;

Q: "give me labour costs in january" / "labour cost by dept"
SQL: SELECT dept_name, headcount, total_canonical_cost_usd AS labour_cost_usd, total_days_worked
     FROM ops.v_payroll_dept_monthly
     WHERE period_month = (to_char(current_date,'YYYY')||'-01-01')::date
     ORDER BY total_canonical_cost_usd DESC LIMIT 50;

Q: "total payroll january"  (single number)
SQL: SELECT SUM(total_canonical_cost_usd) AS total_labour_usd, SUM(headcount) AS total_headcount
     FROM ops.v_payroll_dept_monthly
     WHERE period_month = (to_char(current_date,'YYYY')||'-01-01')::date LIMIT 1;

Q: "what's 1 USD in LAK"
SQL: SELECT rate_date, rate FROM gl.fx_rates
     WHERE from_currency='USD' AND to_currency='LAK'
     ORDER BY rate_date DESC LIMIT 1;

Q: "give me the SLH portal link" / "Hilton login URL" / "where is our PMS"
SQL: SELECT title, url, category, description
     FROM docs.bookmarks
     WHERE is_active = true
       AND (title ILIKE '%slh%' OR url ILIKE '%slh%'
            OR description ILIKE '%slh%' OR 'slh' = ANY(tags))
     ORDER BY created_at DESC LIMIT 10;

Q: "list all my bookmarks by category"
SQL: SELECT category, COUNT(*) AS n, array_agg(title ORDER BY created_at DESC) AS titles
     FROM docs.bookmarks WHERE is_active = true
     GROUP BY category ORDER BY n DESC LIMIT 20;

Q: "how many room types do we have" / "list room types" / "what's our room mix"
SQL: SELECT room_type_id, room_type_name, room_type_name_short, max_guests, base_rate, quantity
     FROM public.room_types
     ORDER BY base_rate DESC NULLS LAST LIMIT 50;

Q: "how many rooms do we have" / "active rooms" / "physical room count"
SQL: SELECT count(*) FILTER (WHERE is_active) AS active_rooms,
            count(*)                          AS total_rooms,
            count(DISTINCT room_type_id)      AS room_type_count
     FROM public.rooms LIMIT 1;

Q: "ADR by room type last 30 days" / "which room types under-perform"
SQL: SELECT room_type_name, rooms, room_nights_sold, occupancy_pct, adr_usd, revenue_usd,
            occupancy_pct - occupancy_pct_stly AS occ_delta_pp,
            adr_usd - adr_usd_stly             AS adr_delta_usd
     FROM public.v_room_type_pulse_30d
     ORDER BY revenue_usd DESC NULLS LAST LIMIT 50;

Q: "arrivals tomorrow" / "who's checking in"
SQL: SELECT reservation_id, check_in_date, check_out_date, nights, adults, children,
            source_name, guest_name, guest_country,
            total_amount, currency, room_type_name, market_segment
     FROM public.reservations
     WHERE check_in_date = current_date + 1
       AND is_cancelled = false
       AND status <> 'no_show'
     ORDER BY total_amount DESC NULLS LAST LIMIT 50;

Q: "in-house guests today" / "who's checked in"
SQL: SELECT reservation_id, check_in_date, check_out_date, nights,
            source_name, guest_name, guest_country, total_amount, room_type_name
     FROM public.reservations
     WHERE status = 'checked_in' LIMIT 50;

Q: "show me reservations of Siegfried Nehls" / "stays of <person>" / "history of <guest>"
SQL: SELECT reservation_id, status, source_name, guest_name, guest_country,
            check_in_date, check_out_date, nights, adults, children,
            total_amount, currency, room_type_name, market_segment, is_cancelled
     FROM public.reservations
     WHERE guest_name ILIKE '%Nehls%'
     ORDER BY check_in_date DESC LIMIT 50;
-- The embedded guest_name column on reservations is the simplest match.
-- For aggregate guest profile (total_stays, total_spent, country) JOIN to public.guests
-- via cb_guest_id (TEXT), e.g.:
--   JOIN public.guests g ON g.guest_id = r.cb_guest_id

Q: "guest profile of Siegfried Nehls" / "everything about <guest>"
SQL: SELECT g.guest_id, g.first_name, g.last_name, g.email, g.phone, g.country,
            g.is_repeat, g.total_stays, g.total_spent, g.last_stay_date,
            count(r.*) AS reservations_count,
            sum(r.total_amount) FILTER (WHERE NOT r.is_cancelled) AS total_paid_usd
     FROM public.guests g
     LEFT JOIN public.reservations r ON r.cb_guest_id = g.guest_id
     WHERE g.last_name ILIKE '%Nehls%' OR g.first_name ILIKE '%Siegfried%'
     GROUP BY g.guest_id, g.first_name, g.last_name, g.email, g.phone, g.country,
              g.is_repeat, g.total_stays, g.total_spent, g.last_stay_date
     ORDER BY g.last_stay_date DESC NULLS LAST LIMIT 20;

Q: "list active agents" / "which AI agents are running"
SQL: SELECT code, name, pillar, status, schedule_human, last_run_at, last_success_at,
            month_to_date_cost_usd, monthly_budget_usd, total_runs
     FROM governance.agents
     WHERE status IN ('active','beta')
     ORDER BY pillar, code LIMIT 50;

Q: "agent health 30 days" / "which agents are failing"
SQL: SELECT code, name, pillar, status, runs_30d, success_30d, failed_30d,
            cost_30d_usd, monthly_budget_usd, month_to_date_cost_usd, last_error
     FROM governance.v_agent_health
     ORDER BY failed_30d DESC NULLS LAST, cost_30d_usd DESC NULLS LAST LIMIT 50;

Q: "last 10 runs of compset_agent"
SQL: SELECT started_at, status, duration_ms, tokens_in, tokens_out, cost_usd,
            proposals_created, error_message
     FROM governance.agent_run_summary
     WHERE agent_code = 'compset_agent'
     ORDER BY started_at DESC LIMIT 10;

Q: "who has owner access" / "list app users" / "active users"
SQL: SELECT email, display_name, role, active, last_seen_at
     FROM public.app_users
     WHERE active = true
     ORDER BY role, last_seen_at DESC NULLS LAST LIMIT 50;

Q: "what's the timezone" / "what setting is X" / "show app_settings"
SQL: SELECT key, value, required_role, updated_at
     FROM public.app_settings
     WHERE property_id = 260955
     ORDER BY key LIMIT 100;
`;
