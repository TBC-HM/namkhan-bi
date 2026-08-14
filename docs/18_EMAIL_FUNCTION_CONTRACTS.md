# Email & Gmail Function Contracts

**Last Updated:** 2025-01-15  
**Coverage:** 29 public.fn_gmail_*, fn_mail_*, fn_email_* functions  
**Authority:** PostgREST bridge law §5 — these are the ONLY DB write paths for email operations.

---

## 1. Gmail OAuth & Connection Management

### fn_gmail_connect_finalize
**Purpose:** Complete OAuth flow by persisting new Gmail connection credentials.  
**Inputs:**  
- `p_user_id uuid` — authenticated user  
- `p_gmail text` — Gmail address  
- `p_access text` — OAuth access token  
- `p_refresh text` — OAuth refresh token  
- `p_scope text` — granted OAuth scopes (space-separated)  
- `p_expires_seconds integer` — access token TTL

**Returns:** `uuid` — gmail_connections.id  
**Side Effects:**  
- INSERT into gmail_connections (or UPDATE if re-connecting)  
- Sets active=true, stores tokens encrypted via vault  
- Triggers gmail_connections.updated_at timestamp

**Auth Requirements:** Caller must be p_user_id or service_role  
**Related:** fn_gmail_disconnect, fn_gmail_get_connection

---

### fn_gmail_disconnect
**Purpose:** Mark Gmail connection inactive (soft-delete).  
**Inputs:** `p_user_id uuid`  
**Returns:** `void`  
**Side Effects:**  
- UPDATE gmail_connections SET active=false WHERE user_id=p_user_id  
- Does NOT delete tokens (retention policy handles cleanup)

**Auth Requirements:** Caller must be p_user_id or service_role

---

### fn_gmail_get_connection
**Purpose:** Retrieve active connection details for authenticated user.  
**Inputs:** `p_user_id uuid`  
**Returns:** TABLE(access_token text, refresh_token text, expires_at timestamptz, gmail_address text, active boolean)  
**Side Effects:** None (read-only)  
**Auth Requirements:** Caller must be p_user_id or service_role

---

### fn_gmail_get_refresh_creds
**Purpose:** Fetch full OAuth credentials for token refresh (service-only).  
**Inputs:** `p_gmail_address text`  
**Returns:** TABLE(gmail_address, refresh_token, access_token, expires_at, client_id, client_secret)  
**Side Effects:** None (read-only, decrypts vault secrets)  
**Auth Requirements:** service_role ONLY (returns client secret)  
**Related:** fn_gmail_refresh_user_token, fn_gmail_persist_access_token

---

### fn_gmail_refresh_user_token
**Purpose:** Execute token refresh via Google OAuth and persist new access token.  
**Inputs:** `p_gmail_address text`  
**Returns:** `text` — new access token  
**Side Effects:**  
- Calls Google OAuth token endpoint (external HTTP)  
- UPDATE gmail_connections SET access_token, expires_at  
- On 4xx/5xx from Google: marks connection inactive

**Auth Requirements:** service_role (calls fn_gmail_get_refresh_creds internally)  
**Idempotency:** Safe to call multiple times; uses refresh_token which doesn't expire on use

---

### fn_gmail_persist_access_token
**Purpose:** Update access token after refresh (called by fn_gmail_refresh_user_token).  
**Inputs:**  
- `p_gmail_address text`  
- `p_access_token text`  
- `p_expires_in_seconds integer`

**Returns:** `void`  
**Side Effects:** UPDATE gmail_connections SET access_token, expires_at  
**Auth Requirements:** service_role

---

### fn_gmail_persist_refresh
**Purpose:** Update refresh token (rare; only when Google issues new refresh_token).  
**Inputs:**  
- `p_user_id uuid`  
- `p_access text` — new access token  
- `p_expires_seconds integer`

**Returns:** `void`  
**Side Effects:** UPDATE gmail_connections SET refresh_token, access_token, expires_at  
**Auth Requirements:** service_role

---

### fn_gmail_mark_inactive
**Purpose:** Mark connection inactive (e.g., after permanent OAuth failure).  
**Inputs:** `p_user_id uuid`  
**Returns:** `void`  
**Side Effects:** UPDATE gmail_connections SET active=false  
**Auth Requirements:** service_role

---

### fn_gmail_connections_migrate_legacy
**Purpose:** One-time migration from old schema to current gmail_connections table.  
**Inputs:** None  
**Returns:** `jsonb` — migration summary {migrated: N, skipped: N}  
**Side Effects:** INSERT into gmail_connections from deprecated table  
**Auth Requirements:** service_role  
**Status:** Historical; likely no-op if migration already ran

---

## 2. Gmail Contact Sync

### fn_gmail_contact_upsert
**Purpose:** Insert or update a single contact from Gmail API response.  
**Inputs:** `p jsonb` — shape: {email, display_name, mailbox_id, last_message_at}  
**Returns:** `void`  
**Side Effects:**  
- INSERT into gmail_contacts ON CONFLICT(email, mailbox_id) DO UPDATE  
- Updates display_name, last_message_at if newer

**Auth Requirements:** service_role (bulk background job)

---

### fn_gmail_contact_upsert_batch
**Purpose:** Bulk upsert contacts (used by extract jobs).  
**Inputs:** `p_rows jsonb` — array of {email, display_name, mailbox_id, last_message_at}  
**Returns:** TABLE(new_rows integer, updated_rows integer)  
**Side Effects:** INSERT ... ON CONFLICT DO UPDATE for all rows  
**Auth Requirements:** service_role  
**Performance:** Optimized for 100–10,000 rows per call

---

## 3. Gmail Message Extraction (Background Jobs)

### fn_gmail_extract_job_enqueue
**Purpose:** Create extract job batch for one or more Gmail mailboxes.  
**Inputs:**  
- `p_mailboxes jsonb` — array of {email, source, max_messages}  
- `p_created_by uuid` — optional user ID

**Returns:** TABLE(batch_id uuid, enqueued_count integer)  
**Side Effects:**  
- INSERT into gmail_extract_batches  
- INSERT N rows into gmail_extract_jobs (status='queued')

**Auth Requirements:** service_role  
**Related:** fn_gmail_extract_job_claim_next

---

### fn_gmail_extract_job_claim_next
**Purpose:** Atomic claim of next pending job (worker loop).  
**Inputs:** None  
**Returns:** TABLE(id bigint, batch_id uuid, account_email text, source text, max_messages integer, attempts integer)  
**Side Effects:**  
- UPDATE gmail_extract_jobs SET status='running', claimed_at=now() WHERE ... FOR UPDATE SKIP LOCKED  
- Returns NULL if no jobs available

**Auth Requirements:** service_role  
**Concurrency:** Safe for parallel workers

---

### fn_gmail_extract_job_finish
**Purpose:** Mark job complete/failed and record stats.  
**Inputs:**  
- `p_job_id bigint`  
- `p_status text` — 'succeeded' | 'failed'  
- `p_run_id uuid` — optional link to gmail_extract_runs  
- `p_msgs integer` — messages scanned  
- `p_new integer` — new contacts found  
- `p_upd integer` — contacts updated  
- `p_error text` — error message if failed

**Returns:** `void`  
**Side Effects:**  
- UPDATE gmail_extract_jobs SET status, finished_at, ...  
- If all jobs in batch complete: UPDATE gmail_extract_batches SET status='completed'

**Auth Requirements:** service_role

---

### fn_gmail_extract_batch_status
**Purpose:** Read-only status summary for a batch.  
**Inputs:** `p_batch_id uuid`  
**Returns:** TABLE(total, queued, running, succeeded, failed, messages_scanned, new_contacts, updated_contacts, enqueued_at, last_finished_at)  
**Side Effects:** None (aggregate query)  
**Auth Requirements:** service_role or batch creator

---

### fn_gmail_extract_run_start
**Purpose:** Begin extraction run for an account (idempotency key).  
**Inputs:** `p_account text` — Gmail address  
**Returns:** `uuid` — run_id (new or existing if in-progress)  
**Side Effects:** INSERT into gmail_extract_runs (account, status='running', started_at=now())  
**Auth Requirements:** service_role

---

### fn_gmail_extract_run_finish
**Purpose:** Finalize extraction run with stats.  
**Inputs:**  
- `p_run_id uuid`  
- `p_status text` — 'success' | 'error'  
- `p_msgs, p_new, p_upd integer` — counters  
- `p_err text` — error if any

**Returns:** `void`  
**Side Effects:** UPDATE gmail_extract_runs SET status, finished_at, ...  
**Auth Requirements:** service_role

---

## 4. Gmail Reply Matching & Scanning

### fn_gmail_record_reply_match
**Purpose:** Link incoming Gmail reply to outbound marketing send; add sender to responders.  
**Inputs:**  
- `p_sender_email text`  
- `p_message_id text` — Gmail Message-ID  
- `p_in_reply_to text` — References/In-Reply-To header  
- `p_matched_send_id bigint` — optional link to email_send_history.id

**Returns:** TABLE(subscriber_id bigint, added_to_responders boolean)  
**Side Effects:**  
- INSERT into gmail_replies  
- If matched to campaign: UPDATE subscribers SET responded=true, INSERT into campaign_responders

**Auth Requirements:** service_role (webhook receiver)  
**Idempotency:** ON CONFLICT DO NOTHING on (message_id)

---

### fn_gmail_reply_scan_state_bump
**Purpose:** Update last-scan watermark for reply polling.  
**Inputs:**  
- `p_account text` — Gmail address  
- `p_matches integer` — replies found in this scan

**Returns:** `void`  
**Side Effects:** UPDATE gmail_reply_scan_state SET last_scan_at=now(), last_match_count=p_matches  
**Auth Requirements:** service_role

---

## 5. Email Settings & Preferences

### fn_email_settings_upsert
**Purpose:** Save property-level email preferences (SMTP config, sender name, etc.).  
**Inputs:**  
- `p_property_id bigint`  
- `p_payload jsonb` — shape matches email_settings columns (smtp_host, from_name, signature, ...)

**Returns:** `jsonb` — saved settings row  
**Side Effects:** INSERT into email_settings ON CONFLICT(property_id) DO UPDATE  
**Auth Requirements:** Caller must have property_id access via RLS

---

### fn_email_chrome_upsert
**Purpose:** Save Chrome extension email config (deprecated/legacy).  
**Inputs:**  
- `p_property_id bigint`  
- `p_payload jsonb`

**Returns:** `jsonb`  
**Side Effects:** UPDATE email_chrome_settings or INSERT  
**Auth Requirements:** Caller must have property_id access

---

## 6. Email Sending & History

### fn_email_send_history_record
**Purpose:** Log outbound email send (marketing campaigns or transactional).  
**Inputs:**  
- `p_property_id bigint`  
- `p_email text` — recipient  
- `p_stream text` — 'marketing' | 'transactional' | 'sales'  
- `p_campaign_id uuid` — optional  
- `p_funnel_id uuid` — optional  
- `p_funnel_step_no integer` — optional

**Returns:** `bigint` — email_send_history.id  
**Side Effects:**  
- INSERT into email_send_history  
- If p_stream='marketing' and campaign_id provided: UPDATE campaign_emails_sent counter

**Auth Requirements:** Caller must have property_id access  
**Retention:** Subject to fn_email_retention_purge_12mo

---

### fn_email_hero_fallback
**Purpose:** Generate fallback hero text when campaign has no hero_message set.  
**Inputs:**  
- `p_campaign_id uuid`  
- `p_property_id bigint`

**Returns:** `text` — generated hero message  
**Side Effects:** None (pure computation; may read property name, campaign subject)  
**Auth Requirements:** Caller must have property_id + campaign_id access

---

## 7. Email Data Lifecycle

### fn_email_purge_expired
**Purpose:** Delete email_send_history rows beyond retention window (12 months).  
**Inputs:** None  
**Returns:** `jsonb` — {deleted_count, cutoff_date}  
**Side Effects:** DELETE FROM email_send_history WHERE sent_at < now() - interval '12 months'  
**Auth Requirements:** service_role (cron job)  
**Scheduling:** Should run daily via pg_cron

---

### fn_email_retention_purge_12mo
**Purpose:** Delete sales + marketing messages beyond 12-month retention.  
**Inputs:** None  
**Returns:** TABLE(purged_sales_messages bigint, purged_marketing_sends bigint, cutoff_date timestamptz)  
**Side Effects:**  
- DELETE FROM gmail_messages WHERE ... and stream IN ('sales', 'marketing')  
- DELETE FROM email_send_history WHERE ...

**Auth Requirements:** service_role  
**Data Loss:** Permanent; ensure backups exist if compliance requires longer retention

---

### fn_email_message_link_to_lead
**Purpose:** Associate Gmail message with a lead (CRM linking).  
**Inputs:**  
- `p_message_id text` — Gmail message ID  
- `p_lead_id bigint`

**Returns:** `jsonb` — {success: boolean, ...}  
**Side Effects:** UPDATE gmail_messages SET lead_id=p_lead_id  
**Auth Requirements:** Caller must have lead_id access via RLS

---

## 8. Mail UI & Features

### fn_mail_ai_features_enabled
**Purpose:** Check if AI features (summarization, suggested replies) are enabled for mailbox.  
**Inputs:** `p_mailbox_id integer` (default 1)  
**Returns:** `boolean`  
**Side Effects:** None (reads email_settings.ai_enabled or property feature flags)  
**Auth Requirements:** Caller must have mailbox_id access  
**Policy Note:** Committed in 0fcd446d; returns feature flag state

---

### fn_mail_attachment_validate
**Purpose:** Validate attachment before upload (size, filename, type).  
**Inputs:**  
- `p_filename text`  
- `p_size_bytes bigint`  
- `p_mailbox_id integer` (default 1)

**Returns:** `jsonb` — {valid: boolean, error?: string, max_size_mb?: number}  
**Side Effects:** None (validation only)  
**Auth Requirements:** Caller must have mailbox_id access  
**Limits:** Enforces 25 MB default, blocked extensions (.exe, .scr, .bat, ...)

---

### fn_mail_contact_suggest
**Purpose:** Autocomplete contact emails (typeahead search).  
**Inputs:** `p_prefix text` — typed characters  
**Returns:** TABLE(email text, display_name text, last_touched timestamptz)  
**Side Effects:** None (read-only)  
**Auth Requirements:** Caller's mailbox scope (RLS filters gmail_contacts)  
**Performance:** Indexed on email, display_name; limit 20 results

---

## Contract Governance

**Verification Discipline:**  
- All functions follow PostgREST bridge law §5 (public.fn_* wraps private schema logic).  
- RLS policies enforce property/mailbox/user isolation where applicable.  
- service_role-only functions (token refresh, extract jobs) have NO RLS bypass — they operate on explicit parameters.

**Testing Coverage Target:** >=60% on lib/gmail.ts, lib/userGmail.ts, app/api/mail/{send,reply}/route.ts  
**Last Coverage Run:** [To be filled by builder after test execution]

**Related Documentation:**  
- OAuth flow: lib/gmail.ts, lib/userGmail.ts  
- Extract job architecture: gmail_extract_*.sql migrations  
- Email retention policy: fn_email_retention_purge_12mo contract above

---

**Contract Authority:** This document is the canonical reference for email function behavior. Any discrepancy between code and contract should be flagged as a bug (favor contract unless contract is proven wrong).
