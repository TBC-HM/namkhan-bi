# namkhan-pms Supabase schema snapshot — 2026-05-09

Project: `kpenyneooigsyuuomgct` (eu-central-1) · auth: Supabase Auth · base ccy: LAK · revenue source: Cloudbeds property `260955`.

This is a flat reference doc. Grep it. Counts come from `pg_class.reltuples` / live `COUNT(*)` for headline tables; views and materialized views are listed by name. For canonical narrative-level docs see `docs/15_SUPABASE_ARCHITECTURE.md` and the `SUPABASE_STATE_HANDOVER.md` referenced in user memory.

---

## 1. Schema-level inventory

Counts below are **objects per schema** (`r`=table, `v`=view, `m`=materialized view, `p`=partitioned table). Internal Supabase / Postgres infra schemas (`pg_catalog`, `pg_toast`, `auth`, `storage`, `realtime`, `extensions`, `graphql*`, `net`, `vault`, `supabase_functions`, `pgsodium*`, `supabase_migrations`) are intentionally excluded except where the dashboard reads from them.

| schema | tables | views | mat-views | partitioned |
|---|---:|---:|---:|---:|
| activities | 6 | – | – | – |
| alerts | 2 | – | – | – |
| app | 10 | – | – | – |
| assets | 5 | – | – | – |
| auth_ext | 1 | 1 | – | – |
| book | 4 | – | – | – |
| catalog | 10 | 1 | – | – |
| cloudbeds | 6 | – | – | – |
| cockpit | 2 | – | – | – |
| compiler | 4 | – | – | – |
| content | 4 | – | – | – |
| contracts | 5 | – | – | – |
| core | 5 | – | – | – |
| docs | 28 | 2 | – | – |
| documentation | 6 | – | – | – |
| documentation_staging | 5 | – | – | – |
| dq | 3 | 5 | – | – |
| fa | 6 | 1 | – | – |
| fb | 7 | – | – | – |
| finance | 7 | – | – | – |
| frontoffice | 9 | – | – | – |
| gl | 25 | 33 | 1 | – |
| governance | 17 | 4 | – | – |
| guest | 6 | 2 | 1 | – |
| hr | 11 | – | – | – |
| inv | 10 | 7 | – | – |
| inventory | 5 | – | – | – |
| knowledge | 5 | – | – | – |
| kpi | 2 | 18 | – | – |
| marketing | 41 | 17 | – | – |
| news | 2 | – | – | – |
| ops | 24 | 8 | – | – |
| plan | 5 | – | – | – |
| pos | 3 | – | – | – |
| pricing | 4 | – | – | – |
| proc | 8 | 1 | – | – |
| **public** | **88** | **179** | **14** | – |
| revenue | 43 | 20 | – | – |
| sales | 28 | 4 | – | – |
| sales_targeting | 2 | – | – | – |
| seo | 4 | 6 | – | – |
| signals | 5 | – | – | – |
| spa | 5 | – | – | – |
| suppliers | 4 | 2 | – | – |
| training | 5 | – | – | – |
| utilities | 4 | – | – | – |
| web | 15 | – | – | – |

`public` is the dashboard's main target. Per-table counts in §2.

---

## 2. `public` — tables and live row counts

Headline operational tables (live `COUNT(*)`, 2026-05-09):

| table | rows |
|---|---:|
| `reservations` | 4,774 |
| `reservation_rooms` | 40,379 |
| `transactions` | 76,794 |
| `tax_fee_records` | 19,629 |
| `add_ons` | 19,494 |
| `rate_inventory` | 115,556 |
| `guests` | 4,140 |
| `house_accounts` | 1,041 |
| `cockpit_knowledge_base` | 513 |
| `cockpit_tickets` | 316 |
| `cockpit_audit_log` | 3,380 |
| `cockpit_skill_calls` | 9,984 |
| `sync_runs` | 2,149 |
| `sync_request_queue` | 853 |

Full `public` table list (88 tables, alphabetical; row count from `pg_class.reltuples` — `-1` means stats not yet collected):

```
action_decisions             agent_trust                  app_settings
app_users                    add_ons (19,494)             adjustments (411)
catalog_cleanup_decisions    channel_metrics (516)        cockpit_agent_identity
cockpit_agent_memory         cockpit_agent_prompts (74)
cockpit_agent_prompts_backup_20260507
cockpit_agent_prompts_backup_20260507_2350
cockpit_agent_prompts_backup_20260508_brand_compliance
cockpit_agent_prompts_backup_20260508_master_contracts
cockpit_agent_prompts_backup_20260508_revenue_contract
cockpit_agent_role_skills (572)    cockpit_agent_skills (29)
cockpit_audit_log (3,284 stat)     cockpit_decisions
cockpit_departments                cockpit_guardrails
cockpit_incidents (45)             cockpit_kb_backup_20260508_marketing_dedup
cockpit_kb_backup_20260508_revenue_dedup
cockpit_kb_backup_20260508_sales_dedup
cockpit_knowledge_base (476 stat / 513 live)
cockpit_kpi_snapshots              cockpit_mismatches
cockpit_notifications (107)        cockpit_pbs_notifications (6)
cockpit_plan_steps                 cockpit_plans
cockpit_projects                   cockpit_proposals
cockpit_secrets                    cockpit_skill_approvals
cockpit_skill_calls (9,750 stat / 9,984 live)
cockpit_skill_proposals            cockpit_standing_tasks
cockpit_tickets (312 stat / 316 live)
communications                     content_attributes (123)
content_channel_versions           content_data_gaps
content_entries (123)              content_faqs
content_media                      content_relations (51)
content_tags (693)                 content_translations (123)
content_usage_log                  custom_fields
daily_metrics (859)                data_insights_snapshots
dq_known_issues                    groups (20)
guests (4,140)                     hotels (1)
house_accounts (1,041)             housekeeping_status (140)
item_categories (16)               items (451)
knowledge_sop_backup_20260508_revenue_dedup
market_segments (5)                operational_overrides
payment_methods (10)               rate_inventory (150,059 stat / 115,556 live)
rate_plans (102)                   reference_audit_log
reference_entries                  reference_sources
reservation_modifications          reservation_rooms (40,379)
reservations (4,774)               room_blocks
room_types (10)                    rooms (20)
scheduled_task_runs (51)           sources (127)
sync_request_queue (853)           sync_runs (2,108 stat / 2,149 live)
sync_watermarks (21)               tax_fee_records (19,629)
taxes_and_fees_config (4)          transactions (76,789 stat / 76,794 live)
usali_category_map (177)           workspace_users
```

### `public` materialized views (14)

All materialized views in `public`, with `pg_class.reltuples` row estimates:

```
mv_aged_ar                       77
mv_arrivals_departures_today      7
mv_capture_rates                  4
mv_channel_economics            185
mv_channel_perf                  45
mv_channel_x_roomtype           466
mv_classified_transactions   76,794
mv_guest_profiles             3,339
mv_kpi_daily                  2,855
mv_kpi_daily_by_segment       2,868
mv_kpi_today                      1
mv_pace_otb                      11
mv_rate_inventory_calendar   32,771
mv_revenue_by_usali_dept        228
```

Refresh cadence: `mv_channel_economics` + `mv_channel_x_roomtype` every 10 min (cron 48); hot/warm BI views every 15/30 min (crons 46, 47); GL P/L mat-view every 4h (cron 37); guest profiles nightly (cron 29).

---

## 3. Key dashboard views (read by the Next.js app)

These are the views the BI dashboard depends on. Add a view to this list whenever a page wires a new one.

### Compset (revenue/compset, revenue/parity)
- `v_compset_agent_settings`
- `v_compset_competitor_property_detail`
- **`v_compset_competitor_rate_matrix`** ← rate matrix grid
- `v_compset_competitor_rate_plan_mix`
- `v_compset_competitor_reviews_summary`
- `v_compset_competitor_room_mapping`
- `v_compset_data_maturity`
- `v_compset_event_types`
- `v_compset_namkhan_vs_comp_avg`
- `v_compset_overview`
- `v_compset_promo_behavior_signals`
- `v_compset_promo_tiles`
- `v_compset_properties`
- `v_compset_property_summary`
- `v_compset_ranking_latest`
- `v_compset_rate_plan_gaps`
- `v_compset_rate_plan_landscape`
- `v_compset_rate_plans_latest`
- `v_compset_scoring_config`
- `v_compset_scoring_config_audit`
- `v_compset_set_summary`

### Sales targeting (sales/btb, sales/inquiries, sales/pipeline)
- `v_sales_targeting_framework`
- `v_sales_targeting_overview`

Backed by `sales_targeting.framework` (50 rows) + `sales_targeting.framework_overview` (12 rows). Schema added in migration `20260509112146 customer_targeting_schema`.

### Overview / KPI / Pace
- `v_overview_dq` — data quality status strip
- `v_overview_live` — live overview KPIs
- `v_overview_segments` — segment mix
- `v_kpi_daily` — daily KPI strip
- `v_pace_curve` — pace curve

### Finance (finance/pnl, finance/budget, finance/ledger)
- `v_finance_ap_aging`
- `v_finance_ar_aging`
- `v_finance_budget_vs_actual`
- `v_finance_cash_forecast`
- `v_finance_house_summary`
- `v_finance_pl_monthly`
- `v_finance_top_suppliers`
- `v_revenue_usali` (USALI 11th classification)

### Marketing / guest
- `v_marketing_media_dashboard`
- `v_guests_linked` (guest profile dedup)

### DMC contracts
- `public.v_dmc_contracts`
- `public.v_dmc_reservation_mapping`

### GL / P&L (gl schema)
- `gl.v_pl_monthly_combined`
- `gl.v_pl_monthly_usali`
- `gl.v_pnl_usali`
- `gl.v_pnl_load_verification`
- `gl.v_supplier_overview`, `v_supplier_transactions`, `v_supplier_vendor_account`, `v_supplier_account_anomalies`
- `gl.v_top_suppliers_current_month`, `v_top_suppliers_ytd`
- `gl.mv_usali_pl_monthly` (materialized; refreshed every 4h by cron 37)

---

## 4. Migrations applied this session (2026-05-09)

| version | name | scope |
|---|---|---|
| `20260509112146` | `customer_targeting_schema` | created `sales_targeting.framework` + `framework_overview`; powers `v_sales_targeting_*` |
| `20260509144131` | `dmc_contracts_enrichment_columns` | added enrichment columns to `contracts.*` / `v_dmc_contracts` |
| `20260509144140` | `pl_archive_and_metadata_columns_20260509` | created `gl.pl_monthly_archive_20260509` + `gl.pl_summary_monthly_archive_20260509`; added metadata columns to live P/L tables |

Recent context (last 30 migrations): canvas proposals v1, cockpit projects v1+v2 goal, revenue master contract wiring, dedup of revenue KB/SOPs, security-invoker on phase-1 views, retreat compiler stack (catalog/content/web/book/pricing). Full list: `select * from supabase_migrations.schema_migrations order by version desc`.

`gl` P/L archive tables now present:
- `gl.pl_monthly_archive_20260509`
- `gl.pl_summary_monthly_archive_20260509`

---

## 5. Active cron jobs (`cron.job`)

Focus jobs called out in the brief:

| jobid | schedule | name | command | active |
|---:|---|---|---|---|
| **43** | `0 23 * * *` | `compset-agent-daily` | `SELECT public.compset_invoke_run('phase_1_validation');` | true |
| **44** | `15 23 * * *` | `parity-check-daily` | `SELECT public.parity_check_internal();` | true |

Cockpit-* jobs (the agent / health / cost loop):

| jobid | schedule | name | active |
|---:|---|---|---|
| 50 | `* * * * *` | `agent-runner` (HTTP → `agent-runner` edge function) | true |
| 53 | `* * * * *` | `cockpit-agent-worker` (HTTP → `/api/cockpit/agent/run?limit=20`) | **false** |
| 54 | `*/5 * * * *` | `cockpit-stale-ticket-reaper` | **false** |
| 55 | `7 * * * *` | `cockpit-deploy-health-hourly` (incident webhook) | true |
| 56 | `0 8 * * *` | `cockpit-daily-incident-review` (creates ticket) | true |
| 57 | `0 7 * * *` | `cockpit-daily-prompt-changelog` | true |
| 58 | `0 9 * * 1` | `cockpit-weekly-team-summary` (creates ticket) | true |
| 59 | `0 23 * * 0` | `cockpit-weekly-cost-report` | true |
| 60 | `0 6 * * *` | `cockpit-daily-kb-curate` | true |
| 61 | `10 6 * * *` | `cockpit-daily-deep-health` | true |
| 73 | `*/5 * * * *` | `cockpit_self_heal_failed_tickets` | **false** |
| 88 | `*/3 * * * *` | `auto-complete-resolved-chat` | **false** |
| 89 | `*/30 * * * *` | `cleanup-vercel-noise` (audit log purge) | true |

Other production-relevant jobs (one-line summary):

- `7` dq engine 4-hourly · `8` dq daily digest · `10` docs expiry alerts · `21` daily kpi snapshot · `22` kpi freshness check 30m · `23-27` agent queue (snapshot/pricing/variance/cashflow/forecast) · `29` guest profile refresh · `30` cb reservations sync 30m · `31` cb transactions sync 30m · `35` recompute_daily_metrics 30m · `37` mv_usali_pl_monthly refresh · `38` render-media · `39` cb full sync 3h · `40` derive_all_extras 3h · `42` capture_otb_snapshot daily 17:30 · `45` tag-media · `46` refresh_bi_views_hot 15m · `47` refresh_bi_views_warm 30m · `48` channel economics + roomtype 10m · `51` advisor snapshot daily · `52` social-followers-sync weekly · `62-65` documentation backup + staleness · `66-70` ops/finance/security placeholders + cost burn alarm · `71/74/79` embed-kb (kb / docs / agent_memory) 15m · `77` advance_plans every minute · `78` self_eval_weekly · `80` documentarian wake · `81` nd-notifications cleanup · `86,87` autonomous-dept-shipper / release-scheduled-tickets (both inactive).

---

## 6. UI changelog reference

The 14 design changelog blocks dated **2026-05-09** in `DESIGN_NAMKHAN_BI.md` are the canonical UI changelog for this date. Anchors (line numbers approximate, file:line):

- `DESIGN_NAMKHAN_BI.md:409` — OTA brand badges everywhere (`<OtaBadge>` + `<MaybeOtaBadge>`)
- `DESIGN_NAMKHAN_BI.md:417` — repair-list batch 14: settings + integrations tooltips + KpiStrip tooltip support
- `DESIGN_NAMKHAN_BI.md:423` — repair-list batch 13: finance + revenue + marketing tooltip sweep + chart hover
- `DESIGN_NAMKHAN_BI.md:428` — repair-list batch 12: KPI tooltip sweep round 2 + dead rate plans CTA
- `DESIGN_NAMKHAN_BI.md:433` — repair-list batch 11: pricing calendar + lead scraping concept
- `DESIGN_NAMKHAN_BI.md:438` — repair-list batch 10: events schedule + parity/compset verification
- `DESIGN_NAMKHAN_BI.md:443` — repair-list batch 9: BTB unified page + upload audit
- `DESIGN_NAMKHAN_BI.md:448` — repair-list batch 8: inbox senders + KPI tooltips + date popover hover-KPI
- `DESIGN_NAMKHAN_BI.md:459` — repair-list batch 7: Task 23 printable revenue report
- `DESIGN_NAMKHAN_BI.md:463` — repair-list batch 6: TimeframeSelector spread + task 32 verification
- `DESIGN_NAMKHAN_BI.md:469` — repair-list batch 5: targeting schema, social/[platform], messy-data
- `DESIGN_NAMKHAN_BI.md:480` — repair-list batch 4: chat 404 fix, expand buttons, pulse today, suppliers, pipeline merge, staff drawer
- `DESIGN_NAMKHAN_BI.md:496` — repair-list batch 3: settings nav restructure
- `DESIGN_NAMKHAN_BI.md:502` — repair-list batch 2: `/cockpit/tasks` expand + ops Page-shell migration
- `DESIGN_NAMKHAN_BI.md:508` — repair-list batch (chrome legibility + `/marketing/social` cleanup)

(That's 15 anchors — the brief said 14; the OTA-badges block was authored separately from the repair-list. Treat it as the umbrella entry for the day.)

Earlier 2026-05-09 entries that are *not* repair-list (kept here for completeness, since they happened the same day):
- `:512` Task 33 — header pills brighter
- `:519` mass page-empty fix — anon RLS root cause + PostgREST schema cache
- `:556` sweep 3 — last 36 PageHeader pages migrated
- `:573` sweep 2 — 39 dept sub-pages migrated to `<Page subPages>`
- `:590` final — frame strip + all `/revenue` + dept dashboards on canonical primitives
- `:612` later — page-by-page wiring pass starts (DeptEntry + ArtifactActions + `/revenue/pace`)
- `:628` Design system manifesto + canvas-first UI
- `:640` `CLAUDE.md` — added § "Design system manifesto (locked 2026-05-09)"
- `:2374` inbox back-link + Kit cockpit CTA

---

## 7. How to refresh this snapshot

```sql
-- schema-level inventory
SELECT n.nspname AS schema, c.relkind, COUNT(*) AS n
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','v','m','p')
  AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
GROUP BY 1,2 ORDER BY 1,2;

-- key dashboard views
SELECT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind='v' AND n.nspname='public'
  AND (c.relname LIKE 'v_compset_%' OR c.relname LIKE 'v_sales_targeting_%'
       OR c.relname LIKE 'v_overview_%' OR c.relname LIKE 'v_revenue_%'
       OR c.relname LIKE 'v_finance_%' OR c.relname LIKE 'v_kpi_%'
       OR c.relname LIKE 'v_pace_%' OR c.relname LIKE 'v_marketing_%')
ORDER BY c.relname;

-- recent migrations
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 30;

-- cron jobs
SELECT jobid, schedule, jobname, active FROM cron.job ORDER BY jobid;
```

Generated: 2026-05-09 by backup agent. Source: `mcp__claude_ai_Supabase__execute_sql` against `kpenyneooigsyuuomgct`.

---

## End-of-session 2026-05-09 update

This block is appended at end-of-session — read alongside the original snapshot above.

### New schemas / tables landed today

| Schema.Table | Purpose | Source |
|---|---|---|
| `targeting.frameworks` (13) | Customer-targeting framework taxonomy | xlsx upload |
| `targeting.framework_items` (52) | Items per framework (target customer / ICP / firmographics / …) | xlsx upload |
| `targeting.scoring_model` (5) | Lead scoring weights (ICP fit 0.25 · Intent 0.25 · Commercial 0.20 · Reach 0.15) | xlsx upload |
| `targeting.lead_scraping_fields` (20) | Canonical lead-record fields for scraper | xlsx upload |
| `messy.unpaid_bills` (200) | QB Unpaid Bills.xls parked here pending reconciliation | Desktop xlsx |
| `public.cockpit_bugs` | Bugs box backing store with 4-state workflow | new feature |
| `public.v_parity_grid` | Date × OTA pivot view feeding `/revenue/parity` | new feature |
| `sales.scraping_jobs` | Scraping queue scaffold (queued/running/done/failed) | new feature |
| `gl.pl_monthly_archive_20260509` (1,057) | Pre-backfill snapshot preserved before P/L overwrite | safety |

### Mutations
- `gl.pl_monthly` 1,057 → 1,497 rows (2025+2026 backfilled from Green Tea P&L workbook; 2025 marked `is_final=false`)
- `cockpit_agent_prompts` — 7 chat personas v+1 with v6 CHAT MODE preamble (active ids 93–99)
- `cockpit_knowledge_base` 525 → 561 (28 new rows this session, scope `design_system_log` / `system_architecture` / `repair_list_status`)

### Schema gotchas to remember
- `gl.gl_entries.amount_usd` and `has_class` are GENERATED — never INSERT them
- `gl.gl_entries.upload_id` is NOT NULL FK to `gl.uploads` — every batch needs an uploads row first
- `gl.gl_entries.account_id` only matches P&L (60xxxx-66xxxx). Balance-sheet QB rows fail FK
- `gl.gl_entries.class_id` enum values are lowercase: `not_specified | undistributed | fb | rooms | spa | transport | imekong`
- `cockpit_tickets` has 13 inbound FKs — `DELETE` needs cascade cleanup (route handler at `/api/cockpit/tickets` does it)
- Several `v_compset_*` views are anon-grant-only; UI workaround = local anon `createClient` instead of shared service-role client (see `app/revenue/compset/page.tsx` + `lib/pricingKpis.ts`)

### Cron / autonomy state
- `*/5 * * * *` `/api/cockpit/bugs/sweep` — bug→ticket linking + status flips
- `compset-agent-daily` (cron 43) · `parity-check-daily` (cron 44)
- `*/10 * * * *` GitHub Actions `agent-runner` (scaffolded today; runner script `scripts/agent-runner.ts` shipped — needs `ANTHROPIC_API_KEY` + `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in repo secrets to activate)

### Backup checklist
- [x] Schema doc updated (this file)
- [x] KB rows logged for every batch (525-561)
- [x] `DESIGN_NAMKHAN_BI.md` changelog appended for every UI batch
- [x] `docs/CHANGELOG.md` 2026-05-09 entry written
- [ ] Migrations dump for today's MCP-applied DDL — `supabase db dump --schema-only > supabase/migrations/20260509_session_state.sql` recommended next session
- [ ] GitHub push — `git push origin chore/schema-snapshot-2026-05-09` (committed locally, not pushed)
