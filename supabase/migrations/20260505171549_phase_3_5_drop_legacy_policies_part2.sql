-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260505171549
-- Name:    phase_3_5_drop_legacy_policies_part2
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split


-- Continue legacy cleanup: dq, fa, inv, proc, suppliers, plan, ops, training, spa, web, marketing, revenue, pricing

-- dq
DROP POLICY IF EXISTS dq_rules_read ON dq.rules;
DROP POLICY IF EXISTS dq_rules_write ON dq.rules;
DROP POLICY IF EXISTS dq_violations_read ON dq.violations;
DROP POLICY IF EXISTS dq_violations_write ON dq.violations;

-- fa
DROP POLICY IF EXISTS fa_mov_read ON fa.asset_movements;
DROP POLICY IF EXISTS fa_mov_write ON fa.asset_movements;
DROP POLICY IF EXISTS fa_assets_read ON fa.assets;
DROP POLICY IF EXISTS fa_assets_write ON fa.assets;
DROP POLICY IF EXISTS fa_capex_read ON fa.capex_pipeline;
DROP POLICY IF EXISTS fa_capex_write ON fa.capex_pipeline;
DROP POLICY IF EXISTS fa_cat_read ON fa.categories;
DROP POLICY IF EXISTS fa_cat_write ON fa.categories;
DROP POLICY IF EXISTS fa_docs_read ON fa.documents;
DROP POLICY IF EXISTS fa_docs_write ON fa.documents;
DROP POLICY IF EXISTS fa_mlog_read ON fa.maintenance_log;
DROP POLICY IF EXISTS fa_mlog_write ON fa.maintenance_log;

-- inv
DROP POLICY IF EXISTS inv_cat_read ON inv.categories;
DROP POLICY IF EXISTS inv_cat_write ON inv.categories;
DROP POLICY IF EXISTS inv_cl_read ON inv.count_lines;
DROP POLICY IF EXISTS inv_cl_write ON inv.count_lines;
DROP POLICY IF EXISTS inv_cnt_read ON inv.counts;
DROP POLICY IF EXISTS inv_cnt_write ON inv.counts;
DROP POLICY IF EXISTS inv_item_read ON inv.items;
DROP POLICY IF EXISTS inv_item_write ON inv.items;
DROP POLICY IF EXISTS inv_loc_read ON inv.locations;
DROP POLICY IF EXISTS inv_loc_write ON inv.locations;
DROP POLICY IF EXISTS inv_mov_read ON inv.movements;
DROP POLICY IF EXISTS inv_mov_write ON inv.movements;
DROP POLICY IF EXISTS inv_par_read ON inv.par_levels;
DROP POLICY IF EXISTS inv_par_write ON inv.par_levels;
DROP POLICY IF EXISTS inv_ph_read ON inv.photos;
DROP POLICY IF EXISTS inv_ph_write ON inv.photos;
DROP POLICY IF EXISTS inv_bal_read ON inv.stock_balance;
DROP POLICY IF EXISTS inv_bal_write ON inv.stock_balance;

-- proc
DROP POLICY IF EXISTS proc_alog_read ON proc.approval_log;
DROP POLICY IF EXISTS proc_alog_write ON proc.approval_log;
DROP POLICY IF EXISTS proc_cfg_read ON proc.config;
DROP POLICY IF EXISTS proc_cfg_write ON proc.config;
DROP POLICY IF EXISTS proc_prop_read ON proc.new_item_proposals;
DROP POLICY IF EXISTS proc_prop_write ON proc.new_item_proposals;
DROP POLICY IF EXISTS proc_poi_read ON proc.po_items;
DROP POLICY IF EXISTS proc_poi_write ON proc.po_items;
DROP POLICY IF EXISTS proc_po_read ON proc.purchase_orders;
DROP POLICY IF EXISTS proc_po_write ON proc.purchase_orders;
DROP POLICY IF EXISTS proc_recv_read ON proc.receipts;
DROP POLICY IF EXISTS proc_recv_write ON proc.receipts;
DROP POLICY IF EXISTS proc_pri_read ON proc.request_items;
DROP POLICY IF EXISTS proc_pri_write ON proc.request_items;
DROP POLICY IF EXISTS proc_pr_read ON proc.requests;
DROP POLICY IF EXISTS proc_pr_write ON proc.requests;

-- suppliers
DROP POLICY IF EXISTS supplier_alt_read ON suppliers.alternates;
DROP POLICY IF EXISTS supplier_alt_write ON suppliers.alternates;
DROP POLICY IF EXISTS supplier_contacts_read ON suppliers.contacts;
DROP POLICY IF EXISTS supplier_contacts_write ON suppliers.contacts;
DROP POLICY IF EXISTS supplier_prices_read ON suppliers.price_history;
DROP POLICY IF EXISTS supplier_prices_write ON suppliers.price_history;
DROP POLICY IF EXISTS suppliers_read ON suppliers.suppliers;
DROP POLICY IF EXISTS suppliers_write ON suppliers.suppliers;

-- plan
DROP POLICY IF EXISTS plan_account_map_read ON plan.account_map;
DROP POLICY IF EXISTS plan_account_map_write ON plan.account_map;
DROP POLICY IF EXISTS plan_read ON plan.account_map;
DROP POLICY IF EXISTS plan_top ON plan.account_map;
DROP POLICY IF EXISTS plan_drivers_read ON plan.drivers;
DROP POLICY IF EXISTS plan_read ON plan.drivers;
DROP POLICY IF EXISTS plan_top ON plan.drivers;
DROP POLICY IF EXISTS plan_lines_read ON plan.lines;
DROP POLICY IF EXISTS plan_lines_write ON plan.lines;
DROP POLICY IF EXISTS plan_read ON plan.lines;
DROP POLICY IF EXISTS plan_top ON plan.lines;

-- ops
DROP POLICY IF EXISTS ops_read ON ops.connector_health;
DROP POLICY IF EXISTS ops_top ON ops.connector_health;
DROP POLICY IF EXISTS skills_read ON ops.skills;
DROP POLICY IF EXISTS skills_write ON ops.skills;
DROP POLICY IF EXISTS staff_availability_read ON ops.staff_availability;
DROP POLICY IF EXISTS staff_availability_write ON ops.staff_availability;
DROP POLICY IF EXISTS ops_read ON ops.timeclock;
DROP POLICY IF EXISTS ops_top ON ops.timeclock;
DROP POLICY IF EXISTS ops_read ON ops.webhook_events;
DROP POLICY IF EXISTS ops_top ON ops.webhook_events;

-- training
DROP POLICY IF EXISTS training_read ON training.attendance;
DROP POLICY IF EXISTS training_top ON training.attendance;
DROP POLICY IF EXISTS training_read ON training.competencies;
DROP POLICY IF EXISTS training_top ON training.competencies;

-- spa
DROP POLICY IF EXISTS spa_read ON spa.therapist_treatments;
DROP POLICY IF EXISTS spa_top ON spa.therapist_treatments;

-- pricing
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.fx_locks;
DROP POLICY IF EXISTS pricing_authenticated_select ON pricing.margin_overrides;

-- web (legacy authenticated reads bypass tenant)
DROP POLICY IF EXISTS web_authenticated_ab_tests ON web.ab_tests;
DROP POLICY IF EXISTS web_authenticated_campaign_pages ON web.campaign_pages;
DROP POLICY IF EXISTS web_authenticated_configurations ON web.configurations;
DROP POLICY IF EXISTS web_authenticated_consents ON web.consents;
DROP POLICY IF EXISTS web_authenticated_email_sends ON web.email_sends;
DROP POLICY IF EXISTS web_authenticated_events ON web.events;
DROP POLICY IF EXISTS web_pages_authenticated ON web.pages;
DROP POLICY IF EXISTS web_authenticated_pages_history ON web.pages_history;
DROP POLICY IF EXISTS web_posts_authenticated ON web.posts;
DROP POLICY IF EXISTS web_retreats_authenticated ON web.retreats;
DROP POLICY IF EXISTS web_authenticated_retreats_versions ON web.retreats_versions;
DROP POLICY IF EXISTS web_series_anon ON web.series;
DROP POLICY IF EXISTS web_series_authenticated ON web.series;

-- marketing (anon read on tenant data → drop)
DROP POLICY IF EXISTS calendar_events_read ON marketing.calendar_events;
DROP POLICY IF EXISTS anon_read_compset ON marketing.calendar_events;
DROP POLICY IF EXISTS "anon read campaign_assets" ON marketing.campaign_assets;
DROP POLICY IF EXISTS "auth read campaign_assets" ON marketing.campaign_assets;
DROP POLICY IF EXISTS "anon read campaigns" ON marketing.campaigns;
DROP POLICY IF EXISTS anon_read_compset ON marketing.campaigns;
DROP POLICY IF EXISTS "auth read campaigns" ON marketing.campaigns;

-- revenue legacy reads
DROP POLICY IF EXISTS adhoc_read ON revenue.ad_hoc_scrape_requests;
DROP POLICY IF EXISTS compset_property_read ON revenue.competitor_property;
DROP POLICY IF EXISTS compset_rates_read ON revenue.competitor_rates;
DROP POLICY IF EXISTS anon_read_compset ON revenue.competitor_rates;
DROP POLICY IF EXISTS room_mapping_read ON revenue.competitor_room_mapping;
DROP POLICY IF EXISTS compset_set_read ON revenue.competitor_set;
DROP POLICY IF EXISTS demand_calendar_read ON revenue.demand_calendar;
DROP POLICY IF EXISTS flag_rules_read ON revenue.flag_rules;
DROP POLICY IF EXISTS flags_read ON revenue.flags;
DROP POLICY IF EXISTS label_map_read ON revenue.rate_plan_label_map;
DROP POLICY IF EXISTS rate_taxonomy_read ON revenue.rate_plan_taxonomy;
DROP POLICY IF EXISTS scoring_config_read ON revenue.scoring_config;
