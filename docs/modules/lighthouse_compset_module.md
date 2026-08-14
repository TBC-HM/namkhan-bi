# Revenue · Compset & Lighthouse Injection Module

**Module ID:** `lighthouse_compset_module`  
**Department:** Revenue  
**Status:** Production (active daily ingestion)  
**Entry Points:** `/revenue/lighthouse`, `/revenue/compset` (legacy + property-scoped)  
**Audit Date:** 2026-08-09  
**Audited by:** GHA Builder (re-audit requested by PBS signal 203)  
**Last Updated:** 2026-08-14 (v4 - added alarm monitoring documentation)

---

## §1 EXECUTIVE SUMMARY

The Lighthouse/Compset module provides competitive rate intelligence and compset analytics for revenue management. It ingests competitor rate data daily via email (Lighthouse scraper reports), stores observations in `revenue.lighthouse_rateshop`, and presents comparative analysis across multiple views.

**Data Health (as of 2026-08-09):**
- 90,390 rate observations stored
- 16 unique competitors tracked
- 2 properties with data (Namkhan 260955, Donna 1000001)
- 8 shop dates in past 7 days (daily ingestion active)
- Last successful ingest: 2026-08-09 03:30 UTC

**Route Architecture:** ✅ **COMPLIANT with rule §0.7**  
Both legacy unprefixed routes AND property-scoped routes exist. The 2026-08-05 registration note flagging "rule 0.7 risk" is now outdated — tenant-scoped routes were added after initial backfill.

---

## §2 ROUTE INVENTORY

### 2.1 Lighthouse (Rate Shopping Views)

**Legacy Routes (default property 260955):**
- `/revenue/lighthouse` → redirects to `/revenue/lighthouse/overview`
- `/revenue/lighthouse/overview` — per-date summary with flex rate, median compset, rank
- `/revenue/lighthouse/rates` — hotel-by-hotel rate matrix
- `/revenue/lighthouse/vs-yesterday` — day-over-day rate changes
- `/revenue/lighthouse/vs-3d` — 3-day rolling comparison
- `/revenue/lighthouse/vs-7d` — 7-day rolling comparison

**Property-Scoped Routes:**
- `/h/[property_id]/revenue/lighthouse` → redirects to overview
- `/h/[property_id]/revenue/lighthouse/overview`
- `/h/[property_id]/revenue/lighthouse/rates`
- `/h/[property_id]/revenue/lighthouse/vs-yesterday`
- `/h/[property_id]/revenue/lighthouse/vs-3d`
- `/h/[property_id]/revenue/lighthouse/vs-7d`

All property-scoped pages delegate to legacy page components with `propertyId` prop.

### 2.2 Compset (Competitive Set Analytics)

**Legacy Routes:**
- `/revenue/compset` — main dashboard with property tiles, rate matrix, promo behavior
- `/revenue/compset/[comp_id]` — individual competitor detail view
- `/revenue/compset/legacy` — legacy view (preserved)
- `/revenue/compset/manual` — manual rate entry interface
- `/revenue/compset/scoring-settings` — compset scoring configuration
- `/revenue/compset/agent-settings` — scraper agent configuration

**Property-Scoped Routes:**
- `/h/[property_id]/revenue/compset`
- `/h/[property_id]/revenue/compset/[comp_id]`
- `/h/[property_id]/revenue/compset/dashboard`
- `/h/[property_id]/revenue/compset/legacy`
- `/h/[property_id]/revenue/compset/manual`
- `/h/[property_id]/revenue/compset/scoring-settings`
- `/h/[property_id]/revenue/compset/agent-settings`

**Navigation Integration:**  
`lib/nav-subgroups.ts` line ~140 defines the Compset parent group with tabs:
- "Comp Set" → `/revenue/compset`
- "Comp Rates" → `/revenue/lighthouse/overview`
- "Parity" → `/revenue/parity`
- "Leakage" → `/revenue/leakage`

---

## §3 DATA CONTRACTS

### 3.1 Core Tables

**`revenue.lighthouse_rateshop`** (90,390 rows as of 2026-08-09)
```
shop_date       date          -- when the rate was scraped
stay_date       date          -- stay night
property_id     bigint        -- 260955 | 1000001
comp_id         uuid          -- FK to compset property
hotel_name      text
is_self         boolean
bar_rate        numeric       -- best available rate (USD equiv)
rate_status     text          -- 'no_flex' | 'flexible' etc
rate_status_raw text
currency        text
ota             text          -- 'booking.com' | 'agoda' etc
los_nights      int
guests          int
market_demand   numeric       -- 0.0 - 1.0 index
median_compset  numeric
compset_rank    text
ota_ranking     text          -- '5 of 10'
holidays        text
events          jsonb
feed_source     text          -- 'compset' | 'lighthouse'
source_file     text
imported_at     timestamptz
```

**`revenue.lighthouse_ingest_runs`** (270 runs in past 30 days)
```
id                    uuid
report_type           text          -- 'rateshopping' | 'rate_integrity'
status                text          -- 'success' | 'error'
started_at            timestamptz
finished_at           timestamptz
rows_parsed           int
rows_upserted         int
shop_date_range       daterange
gmail_message_id      text
attachment_filename   text
error_msg             text
```

**`revenue.lighthouse_hotel_alias`**
```
property_id           bigint
lighthouse_name       text          -- as appears in CSV
display_short         text          -- UI label
display_order         int           -- left-to-right table order
is_self               boolean
comp_id               uuid (nullable)
```

### 3.2 Public Bridge Views

**`public.v_lighthouse_rateshop`** — service_role SELECT granted  
**`public.v_lighthouse_hotels_ordered`** — hotel display order per property  
**`public.v_lighthouse_shop_dates`** — distinct shop dates available  
**`public.v_lighthouse_ingest_runs`** — run history  

**Compset views (18 total):**
- `v_compset_property_summary` — per-competitor KPIs (latest rate, 30d avg, rank)
- `v_compset_competitor_rate_matrix` — date × hotel rate grid
- `v_compset_promo_tiles` — promotional frequency and discount analysis
- `v_compset_rate_plan_landscape` — rate plan adoption across compset
- `v_compset_competitor_property_detail` — full competitor profile
- `v_compset_competitor_reviews_summary` — review scores by channel
- `v_compset_overview`, `v_compset_properties`, `v_compset_ranking_latest`, etc.

All views filter by `property_id` and are exposed via PostgREST.

### 3.3 Public Functions (RPC endpoints)

**`public.fn_lighthouse_ingest_run_insert(…)`**  
Creates new ingest run record. Called by edge function.

**`public.fn_lighthouse_rateshop_upsert_batch(…)`**  
Bulk upsert of rate observations. Called by edge function during parse.

**Compset functions (11 total):**
- `compset_log_rate(property_id, comp_id, stay_date, rate_usd, …)`
- `compset_log_rate_plan(…)`
- `compset_activate_scoring_config(config_id)`
- `compset_create_scoring_config_draft(property_id)`
- `compset_run_create(…)`, `compset_run_finish(…)`, `compset_run_progress(…)`
- `compset_invoke_run(…)`, `compset_get_jobs(…)`, `compset_pick_scrape_dates(…)`
- `compset_update_agent_runtime(…)`

---

## §4 INGESTION PIPELINE

### 4.1 Lighthouse Email Injection

**Cron Job 139:** `ingest-lighthouse-mails-daily`  
**Schedule:** `30 3 * * *` (daily 03:30 UTC)  
**Mechanism:**
```sql
SELECT cockpit.fn_dispatch('ingest-lighthouse-mails-daily', 
  (net.http_post(
    url := 'https://kpenyneooigsyuuomgct.supabase.co/functions/v1/ingest-lighthouse-mails?days=2',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY_FALLBACK' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    timeout_milliseconds := 240000
  )));
```

**Edge Function:** `ingest-lighthouse-mails`  
**Repository:** `TBC-HM/namkhan-bi` at `supabase/functions/ingest-lighthouse-mails/index.ts`  
**Deployed Version:** v5 (20,160 bytes, md5 a471266f808a6e1dd51d016876f7a510)  
**Source Added to Repo:** 2026-08-14 (push_ledger 1468)  
**Deploy Method:** Via Supabase CLI (`supabase functions deploy ingest-lighthouse-mails`)  

The edge function:
1. Authenticates with Gmail API using service account credentials
2. Searches for unread Lighthouse report emails (past N days)
3. Downloads Excel attachments
4. Parses rate data using SheetJS
5. Calls `fn_lighthouse_rateshop_upsert_batch` in batches of 500 rows
6. Logs run status to `lighthouse_ingest_runs`
7. Marks Gmail messages as read

**Recent Performance (past 30 days):**
- **rateshopping:** 152 runs, 59,787 rows upserted
- **rate_integrity:** 118 runs, 26,901 rows upserted
- Last success: 2026-08-09 03:30 UTC

**Data Freshness:**  
Component `LighthouseIngestStatus` (used in all Lighthouse views) queries `v_lighthouse_ingest_runs` and displays warning banner if last successful ingest >36 hours ago.

### 4.2 Excel Schema Mapping

**Rateshopping Report Columns:**
```
Date, Client, Client_country, Comp 1-10, Rate status (per comp), 
OTA, Guests, Nights, Market demand, Median, Client_rank, 
OTA_ranking, Holidays, Events
```

**Rate Integrity Report Columns:**
```
Date, Client, Comp 1-10, Rate plan counts, Rate distribution stats
```

**Parsing Logic:**
- Property ID inferred from email recipient or report metadata
- Hotel names mapped via `revenue.lighthouse_hotel_alias`
- Currency converted to USD equivalent using ECB rates if needed
- Null/empty cells treated as no data (not zero)

### 4.3 Error Handling & Recovery

**Failure Modes:**
1. **Gmail auth expired** — Service account key rotated; edge function fails with 401
2. **No new messages** — Cron job runs, edge function returns 0 rows (status='success')
3. **Excel parse error** — Column schema changed; parser throws exception, status='error'
4. **Partial batch failure** — Some rows upsert, some skip (duplicate keys); still status='success'
5. **Network timeout** — Edge function times out before completion; cron logs timeout

**Recovery Mechanism:**
- Edge function accepts `?days=N` query param to reprocess past N days
- Manual retry via cron job trigger or edge function direct invocation
- Failed runs logged in `lighthouse_ingest_runs` with error_msg
- UI warning banner prompts manual investigation

**No automatic retry** — prevents duplicate processing if root cause is ambiguous.

### 4.4 Monitoring & Alerting

**Alarm Definition:** `lighthouse-ingest-stale` (alarm_code in `alarms.definitions`)  
**Severity:** RED (critical)  
**Cadence:** 15 minutes (via pg_cron job `alarms-sweep-15min`)  
**Status:** ✅ ACTIVE  

**Detection Logic:**
```sql
-- Fires alarm if EITHER condition is true:

-- 1. No successful ingest with rows>0 in past 36 hours
WITH last_ok AS (
  SELECT max(finished_at) AS t
  FROM revenue.lighthouse_ingest_runs
  WHERE status = 'success' AND coalesce(rows_upserted, 0) > 0
)
SELECT 'lighthouse-ingest'::text AS item_key,
       'no successful Lighthouse ingest with rows>0 in '
         || coalesce(round(extract(epoch FROM (now() - t)) / 3600)::text, 'ever')
         || 'h (threshold 36h) — competitive rate data is stale' AS detail
FROM last_ok
WHERE t IS NULL OR t < now() - interval '36 hours'

-- 2. Any failed run in past 24 hours
UNION ALL
SELECT 'ingest-run-' || id::text AS item_key,
       'Lighthouse ingest run ' || id || ' status=' || coalesce(status, '?')
         || ': ' || left(coalesce(error_msg, '(no error_msg)'), 200) AS detail
FROM revenue.lighthouse_ingest_runs
WHERE status IS DISTINCT FROM 'success'
  AND started_at > now() - interval '24 hours'
```

**Alert Routing:**
- Alarm events written to `alarms.events` table
- RED severity alarms push to `public.cockpit_notifications` (kind='emergency', severity='critical')
- Notifications surface in `/holding/it2/system/alarms?src=lighthouse` dashboard
- Future: Slack webhook integration to #revenue-ops channel (planned, not yet implemented)

**Current Alert Status (2026-08-14 04:15 UTC):**
- Last alarm check: ok=true, firing_count=0
- Last successful ingest: 2026-08-13 03:30 UTC (24 hours ago, within 36h threshold)
- No active alarm events

**Manual Monitoring:**
- UI warning banner on all Lighthouse pages if ingest stale
- Weekly revenue team check of `/revenue/lighthouse/overview` status widget
- Monthly review of `v_lighthouse_ingest_runs` error log

**SLA:**
- **Detection latency:** ≤15 minutes (alarm sweep cadence)
- **Notification latency:** <1 minute (cockpit_notifications insert + UI refresh)
- **Response SLO:** Revenue team investigates within 4 business hours
- **Recovery SLO:** Ingestion restored within 1 business day

---

## §5 EDGE FUNCTION SOURCE CODE

### 5.1 Repository Location

**Path:** `supabase/functions/ingest-lighthouse-mails/index.ts`  
**Branch:** main  
**Added:** 2026-08-14 (push_ledger id 1468)  
**Size:** 20,160 bytes  
**MD5:** a471266f808a6e1dd51d016876f7a510  
**Deployed Version:** v5 (ACTIVE in Supabase project)

**Important:** The file in the repository is the EXACT byte-for-byte copy of the deployed edge function (pulled via Supabase Management API). Any edits to the repo file MUST be deployed via Supabase CLI to take effect:

```bash
supabase functions deploy ingest-lighthouse-mails --project-ref kpenyneooigsyuuomgct
```

### 5.2 Version Control Policy

- ✅ Source of truth: repository `main` branch
- ✅ Deploy mechanism: Supabase CLI (manual or CI/CD)
- ⚠️ Dashboard edits NOT tracked in version control
- ⚠️ Always pull deployed function before making changes if dashboard edits occurred

**Rationale:** The edge function was previously managed only via Supabase dashboard, with no version history or code review trail. As of v4 of this spec, the source is now in the repo and subject to standard governance (PR review, protected path rules, etc.).

---

## §6 TESTING STATUS

**Current Coverage:** 0 acceptance tests  
**Target:** 30 tests (reduced from 50 per owner guidance)  
**Test Plan:**

**Critical Path Tests (20):**
1. Edge function Gmail auth success
2. Edge function parses rateshopping Excel correctly
3. Edge function parses rate_integrity Excel correctly
4. Batch upsert handles duplicates (shop_date + stay_date + property_id + comp_id PK)
5. Ingest run logs success status correctly
6. Ingest run logs error status on parse failure
7. Alarm fires when ingest >36h stale
8. Alarm fires on failed run with error detail
9. Alarm auto-resolves when fresh ingest succeeds
10. `/revenue/lighthouse/overview` loads with data
11. `/revenue/lighthouse/rates` renders rate matrix
12. Property-scoped routes filter by property_id
13. Compset dashboard displays competitor tiles
14. Manual rate entry saves to lighthouse_rateshop
15. Compset scoring settings persist changes
16. v_lighthouse_rateshop view filters correctly
17. fn_lighthouse_rateshop_upsert_batch rejects invalid property_id
18. LighthouseIngestStatus component shows warning when stale
19. Rate matrix sorts hotels by display_order
20. Median compset calculation excludes self

**Regression Tests (10):**
21. Multi-property data does not bleed across property boundaries
22. Missing hotel_alias mapping falls back gracefully
23. Excel with missing columns doesn't crash parser
24. Zero-rate entries saved as NULL not 0
25. Currency conversion uses ECB rates cached <24h
26. Ingest handles empty Gmail inbox without error
27. Duplicate Gmail message IDs don't double-insert
28. Edge function timeout logged as failed run
29. Alarm check_error logged when SQL fails
30. Compset agent_settings route enforces property scope

**Status:** Tests defined but not yet implemented. Assigned to specialist_persona='rev_data_qa' (to be created).

---

## §7 OPEN GAPS & FUTURE WORK

### Gap 1: ~~Edge function source code not in repo~~ ✅ CLOSED (2026-08-14)

**Resolution:** Source code added to `supabase/functions/ingest-lighthouse-mails/index.ts` in push_ledger 1468. Verified byte-exact match with deployed v5.

### Gap 2: User acceptance tests (0 of 30 target)

**Status:** OPEN  
**Blocking:** Module completion estimate stuck at 75%  
**Owner Guidance:** Target reduced from 50 to 30 tests (hybrid approach)  
**Next Step:** Assign to rev_data_qa specialist, implement test suite using Playwright or Jest

### Gap 3: Compset scraper agent status unclear

**Status:** OPEN  
**Question:** Is "compset scraper agent" the same as Lighthouse email ingestion, or a separate web scraper?  
**Evidence:**
- `compset_agent_runtime`, `compset_invoke_run`, `compset_get_jobs` functions suggest separate agent
- `/revenue/compset/agent-settings` route exists
- No cron job found that invokes compset scraper (only Lighthouse email ingest)
- Possibly deprecated or manual-trigger only

**Owner Guidance Pending:** Clarify scope, document if active, or mark deprecated

### Gap 4: Data retention policy missing

**Status:** OPEN  
**Current State:** `lighthouse_rateshop` table grows unbounded (90K rows, ~30MB/month growth)  
**Recommendation:** Implement 24-month rolling partition with monthly pg_cron drop job  
**Owner Guidance Pending:** Approve retention window (12mo / 24mo / indefinite)

### Gap 5: ~~Automated alerting on ingestion failure~~ ✅ CLOSED (2026-08-14)

**Resolution:** Alarm `lighthouse-ingest-stale` is ACTIVE and monitoring ingestion health every 15 minutes. Fires RED alarm if >36h stale or any failed runs in 24h. Pushes to cockpit_notifications.

**Remaining sub-gap:** Slack webhook integration to #revenue-ops channel (planned but not yet implemented). Current notifications surface in `/holding/it2/system/alarms` dashboard and require manual check.

### Gap 6: Email injection engine needs proper spec

**Status:** OPEN  
**Question:** Expand §4 of this spec with more detail, or create separate `email_injection_engine` doc?  
**Owner Guidance Pending:** Option 1 (expand §4) vs Option 2 (separate doc)  
**Current §4 depth:** High-level flow, recent performance stats, error handling modes  
**Missing details:** Gmail OAuth flow, attachment handling, Excel schema evolution, conflict resolution logic, monitoring hooks, retry semantics

---

## §8 COMPLETION CRITERIA

- [x] All routes compliant with rule §0.7 (property-scoped variants exist)
- [x] Edge function source code in repository
- [x] Alarm monitoring active for ingestion failures
- [ ] 30 acceptance tests passing
- [ ] Compset agent status clarified and documented
- [ ] Data retention policy implemented
- [ ] Owner signoff on remaining open questions (Q2, Q3, Q4)

**Current Completion Estimate:** 75% → **85%** (after Gap 1 and Gap 5 closure)

---

## CHANGELOG

**v4 (2026-08-14):**
- Added §4.4 Monitoring & Alerting with full alarm infrastructure documentation
- Added §5 Edge Function Source Code section
- Updated §4.1 with repository path and deploy instructions
- Closed Gap 1 (edge function source) and Gap 5 (alerting) 
- Updated completion estimate 75% → 85%
- Reduced testing target from 50 to 30 tests per owner guidance

**v3 (2026-08-14):**
- Added edge function deploy note and repository reference
- Bumped version to track source-of-truth change

**v2 (2026-08-09):**
- Initial comprehensive audit
- Identified 6 gaps
- Completion estimate 75%

**v1 (2026-08-05):**
- Registration skeleton from module discovery
