# Platform Map

> Owner-maintained reference. **Crawled live** from Supabase + Vercel on 02 May 2026.
> Edit status manually using the legend at the bottom — the `[STATUS:xxx]` tag inside each row drives the colour in the rendered tab.

| | |
|---|---|
| **Property** | The Namkhan, Luang Prabang (Cloudbeds 260955) |
| **Hosting** | Supabase `namkhan-pms` (eu-central-1) · Vercel `namkhan-bi` (fra1) |
| **Currency** | LAK base · USD comms · FX 21,800 · live `gl.fx_rates` |
| **Standard** | USALI 11th edition |
| **DB scale (live)** | **27 schemas** · **160+ tables** · 2 currently empty (`assets.*` and `inventory.*` partial — `suppliers.*` 4 tables already created and empty) |

---

## How to use this page

Every row ends with a `[STATUS: ...]` tag. The renderer reads the tag and applies the colour. To change status, edit the markdown source (`/content/settings/platform-map.md`) and push.

| Status tag | Colour | Meaning |
|---|---|---|
| `[STATUS:LIVE]` | 🟢 green | Wired with real data flowing today |
| `[STATUS:READY]` | 🟢 green | Schema or path live, demo/seed data, just needs UI consumer |
| `[STATUS:PARTIAL]` | 🟡 yellow | Some part exists, blocked on a named gap |
| `[STATUS:NEXT]` | 🟠 orange | **Tier 2** — build after the red list is cleared |
| `[STATUS:GAP]` | 🔴 red | **Tier 1** — missing piece blocking real KPIs |
| `[STATUS:OUT]` | ⚫ grey | Out of scope (no API, dropped) |
| `[STATUS:DONE]` | ✅ check | Manually marked done by owner |

**Order of attack: red first, then orange.** Inside each layer, items are listed red → orange → yellow → green so the actionable work is at the top.

---

## Layer 1 · Source systems

> What feeds the database. Brackets show *exactly* what's missing.

### Operations & guest journey

- **The Roots POS (F&B)** — Covers, items, food cost %, capture rate. (no integration · POS system not yet selected · `fb.recipes`/`fb.wastage_log` schema ready and waiting) `[STATUS:GAP]`
- **Spa booking system** — Therapists, treatments, schedules. (no SaaS booked · `spa.*` schema ready, 5 tables, 0 rows · upload path on app needed) `[STATUS:GAP]`
- **Activities · pricelists & bookings** — Tours, classes, equipment. (`activities.*` schema ready, 6 tables, 0 rows · upload path on app needed · operator/partner contracts in PDF only) `[STATUS:GAP]`
- **Reviews — Booking · Tripadvisor · Google · SLH · Expedia · Agoda** — All arrive in one shared inbox. (no parser built · email-receiver Edge Function needed · `marketing.reviews` schema 0 rows) `[STATUS:GAP]`
- **Whistle (guest messaging)** — No public API. (excluded from BI scope) `[STATUS:OUT]`
- **Cloudbeds PMS** — Reservations 4,762 · transactions 76,345 · rate inventory 88,863 rows · 15-min sync via `sync-cloudbeds` Edge Function v12 `[STATUS:LIVE]`
- **Cloudbeds housekeeping API** — Returns 403 on `getHousekeepingStatus`. (Cloudbeds support ticket needed for `housekeeping:read` scope) `[STATUS:PARTIAL]`

### Finance & accounting (QuickBooks owns this)

- **QuickBooks · banking transactions** — Bank feed inside QB · expected tonight via `qb-bulk-gl-load` Edge Function (already deployed v3) `[STATUS:READY]`
- **QuickBooks · salaries & payroll** — Inside QB classes mapped to USALI dept · `gl.gl_entries` 2,924 rows already loaded · `ops.payroll_monthly` 70 rows `[STATUS:LIVE]`
- **QuickBooks · vendor invoices · GL · expenses** — `gl.gl_entries` 2,924 rows · `gl.vendors` 135 rows · full P&L expense side wired via `qb-bulk-gl-load` v3 `[STATUS:LIVE]`
- **GL data quality** — `gl.dq_findings` 455 rows already detecting unmapped accounts, missing classes, undistributed salary, duplicate names · 9 rules running `[STATUS:LIVE]`

### Marketing & paid acquisition

- **Google Search Console** — Keywords, CTR, indexing. (`seo.queries_daily`, `seo.pages_daily`, `seo.indexing_status`, `seo.core_web_vitals` schemas ready · 0 rows · GSC OAuth + ingest Edge Function needed) `[STATUS:GAP]`
- **Google Ads** — Spend, CPC, conversions. (no schema yet · need `marketing.paid_campaigns` table · Google Ads API OAuth) `[STATUS:GAP]`
- **Meta Ads (Facebook + Instagram)** — Spend, reach, CPL. (no schema yet · same `marketing.paid_campaigns` table · Meta Marketing API OAuth) `[STATUS:GAP]`
- **GA4 + GTM** — Direct vs OTA attribution. (no schema yet · need `marketing.web_analytics` · GA4 Data API OAuth) `[STATUS:GAP]`
- **Keyword research (Ahrefs / Semrush)** — Position tracking, content gaps. (no integration · `seo.queries_daily` could absorb · API key + ingest path needed) `[STATUS:NEXT]`
- **Email platform (Mailchimp / Klaviyo)** — Open, click, unsubs. (no platform selected · no schema · Phase 2) `[STATUS:NEXT]`
- **Instagram + Facebook organic stats** — Reach, engagement, follower growth. (`marketing.social_accounts` 7 rows manual · API integration not built · Phase 2) `[STATUS:NEXT]`
- **Influencer / PR coverage tracking** — Coverage value, attribution. (`marketing.influencers` 0 rows · UI to log coverage manually first) `[STATUS:NEXT]`
- **Media library** — `marketing.media_assets` 7 rows · `media-ingest` + `media-tag` Edge Functions deployed · Drive watcher live · `marketing.media_taxonomy` 198 rows · `marketing.campaign_templates` 17 rows `[STATUS:LIVE]`

### Sales & DMC

- **Inbound inquiry parser** — Email → triage → quote draft → approval. (no `sales.*` schema · no inbox watcher · UI page `/sales/inquiries` exists with mocked data only) `[STATUS:GAP]`
- **DMC contracts library** — `governance.dmc_contracts` 5 rows already · upload path live for PDFs `[STATUS:LIVE]`
- **DMC contract metadata** — Net rates, commission %, allotments, renewal dates. (`governance.dmc_reservation_mapping` 0 rows · header level only · full rate-card decomposition not built) `[STATUS:NEXT]`
- **DMC mapping RLS** — `dmc_mapping_write` policy is `USING (true)` — bypasses RLS. (Supabase advisor flagged · tighten before multi-tenant) `[STATUS:GAP]`
- **Compset rate scraper** — `revenue.competitor_set` 4 rows · `revenue.competitor_property` 12 rows · `revenue.competitor_rates` 0 rows · scraper not built `[STATUS:NEXT]`

### Front office

- **`frontoffice.*` schema** — 8 tables (arrivals, prearrival, upsell, vip, eta, compliance, group_plans, agent_runs) · all 0 rows · ingest from `cloudbeds.reservations` join not wired `[STATUS:NEXT]`
- **Flight schedule LPQ ingest** — Demand signal for Triager + ETA Watcher agents. (no API integration · Lao Airlines + Bangkok Air schedule sources unidentified) `[STATUS:NEXT]`
- **Guest WhatsApp / email pre-arrival channel** — Composer agents send drafts here. (no channel integration · platform unselected) `[STATUS:NEXT]`

### External signals

- **Weather forecast** — Activity planning + arrival composer. (no integration · Open-Meteo free tier ready · no `signals.*` schema yet) `[STATUS:NEXT]`
- **Lao public holidays** — Pi Mai, Boun, regional. (no integration · static seed table acceptable) `[STATUS:NEXT]`
- **FX feed** — `gl.fx_rates` 20 manual rows · no auto-refresh · breaks LAK→USD on stale rates `[STATUS:PARTIAL]`
- **Tourism arrivals stats** — Lao gov data · `signals.tourism_monthly` table doesn't exist yet `[STATUS:NEXT]`

### Sustainability — Travel Life

- **Travel Life audit checklist** — Owner to obtain official template before schema is built. (no checklist sourced · no `sustainability.*` schema) `[STATUS:GAP]`
- **Meter readings — water, electricity, gas, fuel** — Manual monthly entry. (no schema · no upload UI · Travel Life standard requires this) `[STATUS:GAP]`
- **Waste streams — recycle / compost / landfill** — Manual entry. (no schema · no upload UI) `[STATUS:GAP]`
- **Local sourcing %** — Derivable from `gl.vendors` + supplier distance once `suppliers.suppliers` populated · view exists but supplier table empty `[STATUS:NEXT]`
- **CSR + community spend** — From QB classes tagged "CSR". (verify class structure in QB) `[STATUS:NEXT]`

### HR & people

- **Staff register** — `ops.staff_employment` 70 rows · `v_staff_register_extended` view live · `v_staff_detail` view live · `v_staff_anomalies` view live `[STATUS:LIVE]`
- **Daily attendance** — `ops.staff_attendance` 2,100 rows · `ops.staff_availability` 490 rows `[STATUS:LIVE]`
- **Skills + competencies** — `ops.skills` 28 rows · `training.competencies` 0 rows (training content not loaded) `[STATUS:PARTIAL]`
- **Payroll daily** — `ops.payroll_daily` 0 rows · manual CSV upload path not built (Phase1_15 gap 1) `[STATUS:GAP]`
- **Training modules + sessions** — `training.modules` / `training.sessions` / `training.attendance` / `training.certifications` schemas ready · 0 rows everywhere · content not loaded `[STATUS:NEXT]`

---

## Layer 2 · Ingestion pipelines

- **Email-review parser** — Single inbox → LLM extract → `marketing.reviews`. (Edge Function not built · ~1 day work) `[STATUS:GAP]`
- **Webhook receiver** — Cloudbeds `reservation_modifications` real-time. (currently 15-min poll · `public.reservation_modifications` 0 rows) `[STATUS:GAP]`
- **Generic CSV upload UI** — Budget, payroll daily, meter readings. (no upload Edge Function · no Vercel page · Phase 2) `[STATUS:GAP]`
- **`agent_runner` Edge Function** — 5 cron jobs queue runs into `governance.agent_runs` (0 rows because nothing dequeues them yet). 27 agents and 7 prompts ready to fire. (~2h work) `[STATUS:GAP]`
- **`sync-cloudbeds` Edge Function v12** — 14 entities · 15-min/hourly/daily · 167 successful runs in `public.sync_runs` `[STATUS:LIVE]`
- **`qb-bulk-gl-load` Edge Function v3** — QuickBooks GL ingest · `gl.gl_entries` 2,924 rows · `gl.uploads` 1 row · staging table `gl.qb_import_staging` ready `[STATUS:LIVE]`
- **`gl-bulk-load` Edge Function v1** — Manual GL bulk loader (separate from QB) `[STATUS:LIVE]`
- **`media-ingest` + `media-tag` Edge Functions** — Drive → Supabase storage → auto-tag · live `[STATUS:LIVE]`
- **`sync-cloudbeds-diag` + `cb-probe`** — Diagnostic Edge Functions for Cloudbeds API troubleshooting `[STATUS:LIVE]`
- **DMC contract upload path** — PDF → `documents-confidential` storage bucket → `governance.dmc_contracts` row · 5 contracts loaded `[STATUS:LIVE]`
- **Meter-reading upload UI** — Travel Life requirement. (no UI · waits on schema definition) `[STATUS:NEXT]`

---

## Layer 3 · Database — Supabase Postgres `namkhan-pms`

### Schemas with rows (operational, live)

- **`public`** — Cloudbeds mirror · 290k+ rows across reservations, transactions, rate_inventory, guests, sources, items, etc. `[STATUS:LIVE]`
- **`gl`** — USALI ledger · `accounts` 247 rows · `gl_entries` 2,924 rows · `vendors` 135 rows · `pl_monthly` 348 rows · `pnl_snapshot` 1,264 rows · `fx_rates` 20 rows · `dq_findings` 455 rows · `dq_findings_log` 455 rows · 9 active DQ rules `[STATUS:LIVE]`
- **`kpi`** — `daily_snapshots` 2 rows · `freshness_log` 684 rows · 14 materialized views (mv_kpi_today, mv_pace_otb, mv_aged_ar, mv_channel_perf, etc.) `[STATUS:LIVE]`
- **`docs`** — `documents` 45 rows · `compliance_meta` 11 rows · 17 specialised tables for legal, insurance, vendor, HR, financial docs · expiry alerts cron `[STATUS:LIVE]`
- **`governance`** — `agents` 27 · `agent_prompts` 7 · `agent_triggers` 7 · `mandates` 7 · `mandate_rules` 23 · `authority_limits` 6 · `tools_catalog` 15 · `dmc_contracts` 5 · `proposals` 0 (waits on `agent_runner`) `[STATUS:LIVE]`
- **`ops`** — `departments` 16 · `staff_employment` 70 · `staff_attendance` 2,100 · `staff_availability` 490 · `payroll_monthly` 70 · `shift_templates` 15 · `skills` 28 · `task_catalog` 26 · `connectors` 13 `[STATUS:LIVE]`
- **`plan`** — `lines` 3,064 · `account_map` 234 · `scenarios` 4 · `drivers` 48 · upload UI not built `[STATUS:PARTIAL]`
- **`marketing`** — `media_assets` 7 · `media_taxonomy` 198 · `campaign_templates` 17 · `social_accounts` 7 · `media_renders` 0 · `reviews` 0 · `influencers` 0 · `campaigns` 0 `[STATUS:PARTIAL]`
- **`dq`** — `rules` 33 · `violations` 1,527 · `run_log` 37 · running but no Vercel surface `[STATUS:LIVE]`
- **`knowledge`** — `sop_meta` 21 · `qa_audits` 0 · `brand_voice_corpus` 0 `[STATUS:PARTIAL]`
- **`app`** — `roles` 8 · `permissions` 34 · `profiles` 1 · `user_roles` 1 · 6 tables empty (audit_log, api_keys, notifications, media, tasks, task_comments) `[STATUS:PARTIAL]`
- **`revenue`** — `competitor_set` 4 · `competitor_property` 12 · `competitor_rates` 0 (scraper not built) `[STATUS:PARTIAL]`

### Schemas live but empty (waiting for source data)

- **`fb`** — `outlets` 4 · `allergens` 14 · `recipes` 0 · `wastage_log` 0 · waits on POS feed `[STATUS:PARTIAL]`
- **`spa`** — 5 tables, 0 rows · waits on spa booking source `[STATUS:PARTIAL]`
- **`activities`** — 6 tables, 0 rows · waits on activities source + pricelist upload `[STATUS:PARTIAL]`
- **`guest`** — 6 tables, 0 rows · waits on email-review parser + NPS source `[STATUS:PARTIAL]`
- **`frontoffice`** — 8 tables, 0 rows · waits on flight + WhatsApp ingest + agent runner `[STATUS:PARTIAL]`
- **`seo`** — 4 tables, 0 rows · waits on Search Console OAuth `[STATUS:PARTIAL]`
- **`training`** — 5 tables, 0 rows · waits on content load `[STATUS:PARTIAL]`
- **`suppliers`** — 4 tables already exist (`suppliers`, `contacts`, `price_history`, `alternates`) · 0 rows everywhere · matches the v3 handover spec **already partially deployed** — verify alignment with handover doc `[STATUS:PARTIAL]`

### Schemas not yet created

- **`assets`** — FF&E + OS&E register. (does not exist · handover delivered to Cowork 02-May) `[STATUS:GAP]`
- **`inventory`** — Par stock + stocktake. (does not exist · handover delivered to Cowork 02-May · note: there IS an `inv.*` namespace with 2 helper functions but no tables — old artefact, ignore) `[STATUS:GAP]`
- **`sustainability`** — Travel Life. (does not exist · waits on owner-supplied checklist) `[STATUS:GAP]`
- **`contracts`** — Beyond DMC: insurance, employment, vendor, B2B. (does not exist · `governance.dmc_contracts` covers DMC only · not yet defined for full scope) `[STATUS:NEXT]`
- **`signals`** — Flights, weather, holidays, tourism. (does not exist · low priority) `[STATUS:NEXT]`
- **`hr`** — Confirmed not needed — QB owns payroll, `ops.staff_employment` owns roster `[STATUS:OUT]`

### Storage buckets

- 15 buckets live: `media`, `media-renders`, `sop-visuals`, `branding`, `documents-internal`, `documents-confidential`, `dq-evidence`, `signatures`, etc. · `objects` 7 rows (low usage so far) `[STATUS:LIVE]`
- **`media-renders` bucket** — Public bucket allows listing — Supabase advisor flag. (lock down before public traffic) `[STATUS:GAP]`

### Security debts (from Supabase advisor)

- **3 `public` tables without RLS** — `app_users`, `app_settings`, `action_decisions` are exposed to PostgREST without RLS. (fix before any prod traffic) `[STATUS:GAP]`
- **40+ `SECURITY DEFINER` views in `public`** — Bypass RLS of querying user. (fix before multi-user) `[STATUS:GAP]`
- **4 `SECURITY DEFINER` functions callable by anon role** — `cb_invoke_sync`, `cb_sync_now`, `refresh_bi_views`, `save_competitor_rates` callable without auth. (revoke EXECUTE from anon) `[STATUS:GAP]`
- **20+ `docs.*` tables with RLS enabled but no policies** — Effectively read-blocked for everyone except service role. (write policies before launching docs UI) `[STATUS:NEXT]`
- **80+ functions with mutable `search_path`** — Minor security warning. (set search_path on each function or move to schema-qualified calls) `[STATUS:NEXT]`
- **Leaked-password protection disabled in Supabase Auth** — Enable HaveIBeenPwned check `[STATUS:NEXT]`
- **3 extensions in `public`** — `pg_net`, `citext`, `pg_trgm` — should be moved to dedicated schema · low risk `[STATUS:NEXT]`

---

## Layer 4 · AI / agents / recommendations

- **`agent_runner` Edge Function (F1)** — Blocking all 7 agents. (5 cron jobs queue runs · nothing dequeues · ~2h to ship · Anthropic API key needs to land in Supabase Vault first) `[STATUS:GAP]`
- **Anthropic API key in Supabase Vault** — Required for `agent_runner` to call claude-sonnet-4-7 `[STATUS:GAP]`
- **27 agents configured** — `governance.agents` 27 rows · 7 with active prompts (snapshot, pricing, forecast, lead_scoring, review, variance, cashflow) · 20 in draft `[STATUS:READY]`
- **Sales agents** — Inquiry Triager, Auto-Offer Composer, Group Quote Strategist, Package Builder, Pricing Validator, DMC/B2B Specialist, Follow-up Watcher, Conversion Coach. (referenced in UI · prompts not in `governance.agent_prompts` yet) `[STATUS:NEXT]`
- **Front-office agents** — Triager, Pre-Arrival Composer, Upsell Composer, VIP Curator, ETA Watcher, Compliance Verifier, Group Coordinator, Margin-Leak Sentinel. (referenced in UI · prompts not in DB yet) `[STATUS:NEXT]`
- **`governance.proposals`** — 0 rows · awaits agent_runner output · UI surface `/agents/run` exists `[STATUS:READY]`
- **Vertex AI (Phase 4)** — Forecast, AutoML no-show, anomaly detection. (deferred · needs ≥6 months clean data) `[STATUS:NEXT]`

---

## Layer 5 · Frontend — `namkhan-bi` on Vercel

> The deployed app at https://namkhan-bi.vercel.app — 9 top-level pillars, each with sub-tabs. **The mockup goes much further than the data behind it.**

### Top-level navigation (live)

- **`/overview`** — Right Now KPIs · 30-day rev/occ chart · channel mix from `mv_channel_perf` (live) · GOPPAR shows "Cost data needed" until QB sync runs tonight · Forecast vs Budget shows "Coming soon — budget upload pending" `[STATUS:LIVE]`
- **`/revenue`** — Revenue analytics page · drives off live KPIs `[STATUS:LIVE]`
- **`/sales/inquiries`** — Sales inbox cockpit · UI built · agents referenced but not running · "Data needed · sales schema" labels everywhere `[STATUS:PARTIAL]`
- **`/marketing`** — Snapshot + Reviews + Social + Influencers + Media sub-tabs · all show "0 reviews" / "no data" until parsers built `[STATUS:PARTIAL]`
- **`/operations`** — Snapshot + Today + Restaurant + Spa + Activities + Housekeeping + Maintenance · DQ alerts inline (housekeeping API blocked, segment tag missing) `[STATUS:PARTIAL]`
- **`/front-office/arrivals`** — Arrivals cockpit · UI built · 8 KPIs all "Data needed · cloudbeds offline / `frontoffice.*` ingest pending" `[STATUS:PARTIAL]`
- **`/guest`** — Guest journey · `mv_guest_profiles` exists · review/NPS surfaces blocked on parser `[STATUS:PARTIAL]`
- **`/finance`** — Snapshot + P&L + Ledger live · Budget/Cashflow/Variance/AP-AR sub-tabs marked "soon" · QB tonight unlocks expense side `[STATUS:LIVE]`
- **`/knowledge`** — Snapshot + 4 Agents sub-tabs (Roster, Run, History, Settings) · 10 agents · 0 live · 10 draft `[STATUS:PARTIAL]`
- **`/settings`** — Snapshot + Property + Users & roles + Budget + Integrations + Notifications + Reports + DQ engine sub-tabs · most "Coming Phase 2" `[STATUS:PARTIAL]`

### Settings sub-tabs

- **Settings → Snapshot** — Property profile static config display `[STATUS:LIVE]`
- **Settings → Property** — Hard-coded values · move to `app_settings` table `[STATUS:NEXT]`
- **Settings → Users & roles** — `app.profiles` 1 user · password-gated only · proper auth deferred `[STATUS:GAP]`
- **Settings → Budget** — Upload UI · schema present (`plan.lines` 3,064 rows) · entry form not built `[STATUS:GAP]`
- **Settings → Integrations** — Cloudbeds + Supabase live · QB tonight · email parser Phase 2 · Vertex Phase 4 `[STATUS:PARTIAL]`
- **Settings → Notifications** — Mandate alerts, decision queue, digest. Not built `[STATUS:NEXT]`
- **Settings → Reports** — Owner monthly pack · investor deck · SLH reporting. Not built `[STATUS:NEXT]`
- **Settings → DQ engine** — `dq.violations` 1,527 rows · UI not surfaced (5 known issues displayed in Operations instead) `[STATUS:PARTIAL]`
- **Settings → Platform Map (this page)** — Markdown-driven with custom status tags · owner edits in repo `[STATUS:LIVE]`

### Pages not yet built but spec'd in mockup

- **Asset Register page** — Waits on `assets.*` schema (Cowork PR pending) `[STATUS:NEXT]`
- **Inventory + Reorder + Stocktake pages** — Waits on `inventory.*` schema (Cowork PR pending) `[STATUS:NEXT]`
- **Supplier Base page** — `suppliers.*` schema already exists (verify content) · UI not built `[STATUS:NEXT]`
- **Sustainability / Travel Life page** — Waits on schema definition + checklist `[STATUS:GAP]`
- **DMC contracts dashboard** — Renewal alerts, rate compare, commission validation · `governance.dmc_contracts` ready · UI not built `[STATUS:NEXT]`
- **Marketing paid-channel dashboard** — Search Console + Google Ads + Meta Ads + GA4 · waits on integrations `[STATUS:NEXT]`
- **SOP visual library** — `knowledge.sop_meta` 21 rows · no rendering surface `[STATUS:NEXT]`

---

## Layer 6 · Cross-cutting

### Observability

- **`public.sync_runs`** 167 rows · **`kpi.freshness_log`** 684 rows · **`cron.job_run_details`** active · **`gl.dq_findings`** 455 rows · **`dq.violations`** 1,527 rows `[STATUS:LIVE]`

### Secrets & auth

- **Cloudbeds API key in Supabase Vault** `[STATUS:LIVE]`
- **QuickBooks OAuth token** — Required for `qb-bulk-gl-load` · already operational (2,924 rows loaded) `[STATUS:LIVE]`
- **Anthropic API key** — Not in Vault · blocks `agent_runner` `[STATUS:GAP]`
- **Google Search Console / Ads / Meta / GA4 OAuth** — None set up yet `[STATUS:GAP]`
- **Make.com webhook keys** — For media pipeline · live `[STATUS:LIVE]`
- **Single-user password gate** — Replace with proper Supabase Auth before second user `[STATUS:GAP]`

### DevOps

- **`supabase/migrations/` in repo** — Improving · `assets`+`inventory`+`suppliers` handover added a clean migration file pattern `[STATUS:PARTIAL]`
- **GitHub Actions CI** — Not configured · no PR validation, no automated `db diff` check `[STATUS:GAP]`
- **Branch protection on `main`** — Not set · anyone with write access can push direct `[STATUS:GAP]`
- **Vercel auto-deploy on push to `main`** — Live · single password gate `[STATUS:LIVE]`

### Compliance

- **SLH standards audit log** — Not built · mandate rules exist in `governance.mandate_rules` 23 rows `[STATUS:NEXT]`
- **Mystery shopper score tracking** — Not built `[STATUS:NEXT]`
- **Document expiry alerts** — `docs.expiry_alerts` table ready · `docs.generate_expiry_alerts` function ready · cron firing `[STATUS:LIVE]`

---

## Red list — Tier 1 work (must clear before anything else)

The full set of `[STATUS:GAP]` rows above. Ranked by ROI:

1. **Anthropic API key + `agent_runner`** — 2h work · unlocks 7 agents and the entire decision queue UX
2. **Email-review parser** — 1 day · unlocks `marketing.reviews`, review_agent, reputation tracking
3. **Roots POS integration** — Largest remaining ops blind spot · F&B cost %, capture rate, food cost stay fake until this lands
4. **Travel Life checklist** — Owner action · obtain template before any `sustainability.*` schema is written
5. **Search Console + Google Ads + Meta Ads + GA4 OAuth + ingest** — Without these, "marketing" is a black box
6. **Sales inbox parser + `sales.*` schema** — `/sales/inquiries` page is mocked; agents are waiting
7. **Cloudbeds webhook receiver** — Real-time over 15-min poll · `reservation_modifications` table ready
8. **Generic CSV upload UI** — Budget, payroll daily, meter readings all need this
9. **Spa + Activities pricelists upload path + booking source** — Schema ready, no source feed
10. **Security advisor cleanup** — RLS on 3 `public` tables · revoke anon EXECUTE on 4 RPCs · lock down `media-renders` bucket · before any second user
11. **DMC mapping RLS hardening** — `dmc_mapping_write` policy is `USING (true)` — fix before multi-tenant
12. **Settings → Budget upload UI** — Schema is there, just need ingest + version history
13. **`payroll_daily` upload path** — `ops.payroll_daily` 0 rows · breaks dept × day labour analytics

## Orange list — Tier 2 work (after the red list)

14. Front-office ingest (flight, WhatsApp, ETA agent runs)
15. Compset rate scraper
16. DMC contract metadata (full rate-card decomposition)
17. `assets.*` + `inventory.*` Vercel UI (after Cowork PR lands)
18. Supplier UI + populate `suppliers.*` (4 empty tables ready)
19. SOP visual library page
20. Marketing paid-channel dashboard
21. Email platform (Mailchimp / Klaviyo) + integration
22. Influencer / PR coverage tracker
23. Training content load + competencies surface
24. External signals — weather, holidays, tourism arrivals
25. Search Console keyword research deep-dive (Ahrefs / Semrush)
26. Vertex AI Phase 4 (after ≥6 months clean data)
27. Function `search_path` cleanup, leaked-password protection, extensions in `public`
28. CI/CD + branch protection
29. Cashflow rolling 13-week forecast (`gl.cash_forecast_weekly` table ready, UI/agent not wired)
30. Variance commentary publishing flow (`gl.commentary_drafts` ready, UI not built)

---

## Open decisions on owner's desk

1. **Travel Life checklist** — obtain official audit template before sustainability schema is written
2. **Roots POS selection** — which POS system before integration scope can be specified
3. **Spa + Activities booking system** — same: pick the source before integrating
4. **Email platform** — Mailchimp vs Klaviyo vs other
5. **DMC contract granularity** — header-only or full rate-card decomposition (handover spec'd both)
6. **`assets.locations` seed** — mirror `public.rooms` 1:1 or fresh inventory of physical spaces
7. **Inventory cost-flow** — FIFO or moving-average for `stock_balance` trigger
8. **Auth strategy** — keep password gate in Phase 2 or move to Supabase Auth now (forced before second user)

---

*Last refreshed: 02 May 2026 · crawled live from Supabase project `kpenyneooigsyuuomgct` and https://namkhan-bi.vercel.app · maintained by the platform owner · edit `[STATUS:xxx]` tags to update colours.*
