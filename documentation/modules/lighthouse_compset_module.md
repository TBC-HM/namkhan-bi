# Revenue · Compset & Lighthouse Injection Module

**Module ID:** `lighthouse_compset_module`  
**Department:** Revenue  
**Status:** Production (active daily ingestion)  
**Entry Points:** `/revenue/lighthouse`, `/revenue/compset` (legacy + property-scoped)  
**Audit Date:** 2026-08-09  
**Audited by:** GHA Builder (re-audit requested by PBS signal 203)  
**Last Updated:** 2026-08-14 (v5 - expanded §4 email injection engine technical spec; hardened alarm; Q4 compset agent deprecated)

---

## §1 EXECUTIVE SUMMARY

The Lighthouse/Compset module provides competitive rate intelligence and compset analytics for revenue management. It ingests competitor rate data daily via email (Lighthouse scraper reports), stores observations in `revenue.lighthouse_rateshop`, and presents comparative analysis across multiple views.

**Data Health (as of 2026-08-14):**
- 90,390+ rate observations stored
- 16 unique competitors tracked
- 2 properties with data (Namkhan 260955, Donna 1000001)
- Daily ingestion active (next-day shop dates processed by 04:00 UTC)
- Last successful ingest: 2026-08-14 08:11 UTC (backfill after auth fix)

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
`lib/nav-subgroups.ts` line ~140 defines the Compset parent group with tabs.

---

## §3 DATA CONTRACTS

### 3.1 Core Tables

**`revenue.lighthouse_rateshop`** (90,390+ rows as of 2026-08-14)
```
shop_date, stay_date, property_id, comp_id, hotel_name, is_self,
bar_rate, rate_status, currency, ota, los_nights, guests,
market_demand, median_compset, compset_rank, ota_ranking,
holidays, events (jsonb), feed_source, source_file, imported_at
```

**`revenue.lighthouse_ingest_runs`** (270+ runs)
```
id (uuid), report_type, status, started_at, finished_at,
rows_parsed, rows_upserted, shop_date_range, gmail_message_id,
attachment_filename, error_msg
```

**`revenue.lighthouse_hotel_alias`**
```
property_id, lighthouse_name, display_short, display_order,
is_self, comp_id (nullable)
```

### 3.2 Public Bridge Views

18 compset views + 4 lighthouse views exposed via PostgREST, all with property_id filtering.

### 3.3 Public Functions (RPC endpoints)

- `fn_lighthouse_ingest_run_insert(…)`
- `fn_lighthouse_rateshop_upsert_batch(…)`
- 11 compset functions (log_rate, scoring_config, run management, etc.)

---

## §4 INGESTION PIPELINE

### 4.1 Lighthouse Email Injection — Technical Specification

**Trigger:** pg_cron job 139 `ingest-lighthouse-mails-daily`  
**Schedule:** `30 3 * * *` (daily 03:30 UTC)  
**Command:** Calls edge fn with Authorization header (fixed 2026-08-14)

**Edge Function:** `ingest-lighthouse-mails`  
**Repository:** `TBC-HM/namkhan-bi` at `supabase/functions/ingest-lighthouse-mails/index.ts`  
**Deployed Version:** v5 (20,160 bytes, md5 `a471266f808a6e1dd51d016876f7a510`)  
**Source in Repo:** ledger 1468 (2026-08-14, verified byte-exact)

#### Pipeline Stages (8-step process)

1. **Gmail Authentication:** Service account OAuth2 (`lighthouse-reader@namkhan-bi.iam.gserviceaccount.com`)
2. **Email Discovery:** Query unread emails from lighthousehoteldata@gmail.com (2-day lookback default)
3. **Attachment Extraction:** Download `.csv` attachments, validate MIME type
4. **CSV Parsing:** 28-col rateshopping or 21-col rate_integrity format
5. **Hotel Alias Resolution:** Map lighthouse_name → property_id/comp_id
6. **Database Upsert:** Batch 500 rows per RPC, ON CONFLICT update
7. **Metadata Logging:** Write `lighthouse_ingest_runs` row, mark email READ
8. **Response:** Return JSON summary with msgId/shopDate/rows

**Error Handling:**
- Gmail API failures → HTTP 500, no ingest_run row
- No emails → HTTP 200, empty summary
- CSV parse/upsert errors → log in error_msg, continue next email
- Each email atomic

**Manual Invocation:**
```bash
curl -X POST 'https://kpenyneooigsyuuomgct.supabase.co/functions/v1/ingest-lighthouse-mails?days=3' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
```

Query params: `?days=N`, `?report=rateshopping|rate_integrity|all`, `?maxMails=N`

### 4.2 Compset Scraper Agent (Status: DEPRECATED)

**Historical Context:** Prior to Lighthouse, a Playwright scraper ran nightly. Decommissioned ~2025-12 in favor of Lighthouse commercial service.

**Current State:**
- Code preserved in `supabase/functions/compset-scraper/` (NOT deployed)
- DB functions exist (unused, kept for historical data access)
- UI route `/revenue/compset/agent-settings` still accessible
- No active cron job
- Last run: ~2025-12-15

**Recommendation:** Formally archive in future module cleanup brief. Keep DB functions for historical queries.

---

## §4.4 MONITORING & ALERTING

### Alarm: `lighthouse-ingest-stale`

**Status:** ✅ ACTIVE (hardened 2026-08-14)  
**Severity:** red | **Cadence:** 15 min | **Owner:** revenue ops

**Fire Conditions (3-branch OR):**

1. **Staleness:** No successful ingest with rows>0 in past 36h
2. **Failed runs:** Any `status != 'success'` in past 24h
3. **Cron transport failures (NEW):** HTTP/auth failures from cockpit.job_outcomes in past 24h

**Sweep:** `alarms.fn_sweep()` every 15min writes `alarms.events`

**Live Fire History:**
- **2026-08-14 03:30 UTC:** Cron 401 (missing auth header)
- **Detection:** 08:12 UTC via branch 3 (cron-fail-85107)
- **Resolution:** Cron updated, backfill successful
- **Outcome:** ✅ Alarm proven effective

---

## §5 EDGE FUNCTION SOURCE CODE

**File:** `supabase/functions/ingest-lighthouse-mails/index.ts`  
**Repo:** `TBC-HM/namkhan-bi`  
**Version:** v5 (ACTIVE)  
**Size:** 20,160 B | **MD5:** `a471266f808a6e1dd51d016876f7a510`  
**Ledger:** 1468 (verified byte-exact)  
**Deploy:** `supabase functions deploy ingest-lighthouse-mails`

**Dependencies:** Deno, googleapis, papaparse, Supabase client

---

## §6 ACCEPTANCE CRITERIA (Re-Audit Completion)

**Original 6 gaps:**

✅ **Q1: Edge function source in repo** — CLOSED (ledger 1468)  
✅ **Q6: Ingestion failure alerting** — CLOSED (hardened, live-fire proven)  
✅ **Q2: Email injection engine spec** — CLOSED (§4.1 8-stage spec)  
✅ **Q4: Compset scraper agent status** — CLOSED (§4.2 documented DEPRECATED)  
📋 **Q3: Testing target** — OPEN (30 tests, testing_ok=0, plan TBD)  
📋 **Q5: Data retention policy** — OPEN (recommended 24-month rolling, implementation deferred)

**Live Health (2026-08-14 08:11 UTC):**
- ✅ Daily ingestion healthy (08-14 backfilled: 728+305 rows)
- ✅ Alarm active and proven
- ✅ Cron auth fixed (jobid 139 + 120)
- ✅ Zero open incidents

**Module Completion:** 85% → 92% (4 of 6 gaps closed)

---

## §7 OPERATIONAL NOTES

**Dependencies:** Gmail API service account, Supabase secrets vault, PostgREST public.fn_* bridges

**Known Limitations:**
- Hotel alias resolution requires manual setup
- No email archival (Gmail inbox unbounded)
- CSV format changes break parser (no schema versioning)

**Performance:**
- Avg: 3-5s per email
- Typical: 2 emails × 1000 rows = 2000 upserts in <10s
- Batch size: 500 rows (under 10MB limit)

**Future Enhancements:**
- Automate alias detection (fuzzy matching)
- Schema versioning
- 24-month retention (cold storage)
- Build 30-test suite
- Ops dashboard integration
