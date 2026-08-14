# Email Inbox Module — Function Contracts

**Version:** 1.0  
**Date:** 2026-08-14  
**Scope:** Public DB functions for Gmail/email operations (PostgREST bridge layer)

---

## Overview

This document defines the contract for 28 public-schema functions that comprise the email inbox module's DB write path. Per PostgREST bridge law §5, all writes to `marketing.user_gmail_connections`, `marketing.gmail_*`, and `sales.email_*` tables MUST go through these SECURITY DEFINER RPCs.

**Architecture:**
- **lib/gmail.ts** — Sales inbox OAuth + polling (legacy, read-only polling)
- **lib/userGmail.ts** — Per-user Gmail connections (read/write/send/reply)
- **lib/sharedGmail.ts** — Shared utilities
- **app/api/mail/** — REST endpoints (send, reply, list, modify, contacts)
- **DB functions** — All mutations (documented below)

---

## 1. Gmail Connection Management

### `fn_gmail_connect_finalize`
**Purpose:** Finalize a user's Gmail OAuth flow by persisting tokens.

**Signature:**
```sql
fn_gmail_connect_finalize(
  p_user_id uuid,
  p_gmail text,
  p_access text,
  p_refresh text,
  p_scope text,
  p_expires_seconds integer
) RETURNS uuid
```

**Input:**
- `p_user_id`: Supabase auth.users.id
- `p_gmail`: Gmail address (must be @thenamkhan.com)
- `p_access`: Fresh access_token from Google
- `p_refresh`: Refresh token (persisted for token renewal)
- `p_scope`: Granted scopes (space-separated)
- `p_expires_seconds`: Token TTL

**Output:**
- `uuid`: ID of the inserted/updated row in `marketing.user_gmail_connections`

**Side Effects:**
- INSERT or UPDATE in `marketing.user_gmail_connections`
- Sets `active = true`, resets `expires_at`
- If conflict on `user_id`, preserves old `refresh_token` if new one is empty

**Auth:** SECURITY DEFINER (no RLS — caller must validate user_id matches session)

**Errors:**
- Raises `domain_not_allowed` if email domain is not @thenamkhan.com

**Usage:** Called by `/api/user/gmail/callback` after OAuth code exchange.

---

### `fn_gmail_disconnect`
**Purpose:** Soft-delete a user's Gmail connection.

**Signature:**
```sql
fn_gmail_disconnect(p_user_id uuid) RETURNS void
```

**Input:**
- `p_user_id`: Supabase auth.users.id

**Output:** None (void)

**Side Effects:**
- Sets `active = false` on the matching row in `marketing.user_gmail_connections`
- Does NOT delete messages or contacts

**Auth:** SECURITY DEFINER

**Usage:** Called by `/settings/gmail` disconnect button.

---

### `fn_gmail_mark_inactive`
**Purpose:** Mark a connection inactive (called on token refresh failure).

**Signature:**
```sql
fn_gmail_mark_inactive(p_user_id uuid) RETURNS void
```

**Input:**
- `p_user_id`: Supabase auth.users.id

**Output:** None

**Side Effects:**
- Sets `active = false`

**Auth:** SECURITY DEFINER

**Usage:** Called by `lib/userGmail.ts:refreshIfExpired` when Google returns 401.

---

### `fn_gmail_get_connection`
**Purpose:** Retrieve active connection tokens for a user.

**Signature:**
```sql
fn_gmail_get_connection(p_user_id uuid) 
RETURNS TABLE(
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  gmail_address text,
  active boolean
)
```

**Input:**
- `p_user_id`: Supabase auth.users.id

**Output:** Single row (or empty) with token data.

**Side Effects:** None (read-only)

**Auth:** SECURITY DEFINER (returns sensitive tokens — caller must verify session)

**Usage:** Called by `lib/userGmail.ts:refreshIfExpired` to get current tokens.

---

### `fn_gmail_persist_refresh`
**Purpose:** Update access token after refresh (user-scoped).

**Signature:**
```sql
fn_gmail_persist_refresh(
  p_user_id uuid,
  p_access text,
  p_expires_seconds integer
) RETURNS void
```

**Input:**
- `p_user_id`: Supabase auth.users.id
- `p_access`: New access_token from Google
- `p_expires_seconds`: Token TTL

**Output:** None

**Side Effects:**
- Updates `access_token` and `expires_at` in `marketing.user_gmail_connections`
- Sets `active = true`

**Auth:** SECURITY DEFINER

**Usage:** Called by `lib/userGmail.ts:refreshIfExpired` after successful token refresh.

---

### `fn_gmail_persist_access_token`
**Purpose:** Update access token for a sales Gmail account (legacy, sales-scoped).

**Signature:**
```sql
fn_gmail_persist_access_token(
  p_gmail_address text,
  p_access_token text,
  p_expires_in_seconds integer
) RETURNS void
```

**Input:**
- `p_gmail_address`: Email address (sales inbox)
- `p_access_token`: New access token
- `p_expires_in_seconds`: Token TTL

**Output:** None

**Side Effects:**
- Updates `access_token` and `expires_at` in `sales.gmail_connections`

**Auth:** SECURITY DEFINER

**Usage:** Called by sales polling cron (legacy, separate from user connections).

---

### `fn_gmail_get_refresh_creds`
**Purpose:** Retrieve refresh credentials for a sales Gmail account.

**Signature:**
```sql
fn_gmail_get_refresh_creds(p_gmail_address text)
RETURNS TABLE(
  gmail_address text,
  refresh_token text,
  access_token text,
  expires_at timestamptz,
  client_id text,
  client_secret text
)
```

**Input:**
- `p_gmail_address`: Email address

**Output:** Row with tokens + OAuth client credentials (from Supabase vault).

**Side Effects:** None (read-only)

**Auth:** SECURITY DEFINER

**Usage:** Called by sales polling cron to refresh tokens.

---

### `fn_gmail_refresh_user_token`
**Purpose:** Refresh a user's access token (orchestrates Google API call from DB).

**Signature:**
```sql
fn_gmail_refresh_user_token(p_gmail_address text) RETURNS text
```

**Input:**
- `p_gmail_address`: Email address

**Output:** New access_token (text)

**Side Effects:**
- Makes HTTP call to Google token endpoint via `pg_net`
- Updates `marketing.user_gmail_connections` with new token

**Auth:** SECURITY DEFINER

**Errors:** Raises exception if Google returns 400/401

**Usage:** Called by `/api/cron/gmail-token-refresh` (background job).

---

### `fn_gmail_connections_migrate_legacy`
**Purpose:** One-time migration of old sales.gmail_connections → marketing.user_gmail_connections.

**Signature:**
```sql
fn_gmail_connections_migrate_legacy() RETURNS jsonb
```

**Input:** None

**Output:** `{ migrated: N }` where N = row count

**Side Effects:**
- INSERT into `marketing.user_gmail_connections` from `sales.gmail_connections`

**Auth:** SECURITY DEFINER

**Usage:** Run once during module migration (2026-07-31).

---

## 2. Contact Management

### `fn_gmail_contact_upsert`
**Purpose:** Upsert a single Gmail contact.

**Signature:**
```sql
fn_gmail_contact_upsert(p jsonb) RETURNS void
```

**Input:**
- `p`: JSON object with keys:
  - `email` (text, required)
  - `display_name` (text, optional)
  - `last_touched` (timestamptz, optional)
  - `mailbox_id` (integer, optional, default 1)

**Output:** None

**Side Effects:**
- INSERT or UPDATE in `marketing.gmail_contacts`
- ON CONFLICT(email, mailbox_id) DO UPDATE

**Auth:** SECURITY DEFINER

**Usage:** Called by contact extraction worker.

---

### `fn_gmail_contact_upsert_batch`
**Purpose:** Batch upsert of contacts (performance-optimized).

**Signature:**
```sql
fn_gmail_contact_upsert_batch(p_rows jsonb)
RETURNS TABLE(new_rows integer, updated_rows integer)
```

**Input:**
- `p_rows`: JSON array of contact objects (same schema as `fn_gmail_contact_upsert`)

**Output:**
- `new_rows`: Count of INSERTs
- `updated_rows`: Count of UPDATEs

**Side Effects:**
- Bulk INSERT/UPDATE in `marketing.gmail_contacts`

**Auth:** SECURITY DEFINER

**Usage:** Called by `/api/cron/gmail-extract` batch processor.

---

### `fn_mail_contact_suggest`
**Purpose:** Autocomplete contact search (prefix match).

**Signature:**
```sql
fn_mail_contact_suggest(p_prefix text)
RETURNS TABLE(
  email text,
  display_name text,
  last_touched timestamptz
)
```

**Input:**
- `p_prefix`: Search prefix (e.g., "john")

**Output:** Up to 10 matching contacts, ordered by `last_touched DESC`

**Side Effects:** None (read-only)

**Auth:** Public (no sensitive data in output)

**Usage:** Called by `/api/mail/contacts/suggest` for compose autocomplete.

---

## 3. Gmail Extract Jobs (Background Batch Processing)

### `fn_gmail_extract_job_enqueue`
**Purpose:** Enqueue a batch of Gmail mailboxes for contact extraction.

**Signature:**
```sql
fn_gmail_extract_job_enqueue(
  p_mailboxes jsonb,
  p_created_by uuid DEFAULT NULL
)
RETURNS TABLE(batch_id uuid, enqueued_count integer)
```

**Input:**
- `p_mailboxes`: JSON array of objects:
  ```json
  [
    { "account_email": "user@thenamkhan.com", "source": "user", "max_messages": 500 }
  ]
  ```
- `p_created_by`: Optional user_id for audit

**Output:**
- `batch_id`: UUID of the new batch
- `enqueued_count`: Number of jobs created

**Side Effects:**
- INSERT into `marketing.gmail_extract_batches` (1 row)
- INSERT into `marketing.gmail_extract_jobs` (N rows)

**Auth:** SECURITY DEFINER

**Usage:** Called by `/api/cron/gmail-extract-enqueue`.

---

### `fn_gmail_extract_job_claim_next`
**Purpose:** Claim the next pending job (worker coordination).

**Signature:**
```sql
fn_gmail_extract_job_claim_next()
RETURNS TABLE(
  id bigint,
  batch_id uuid,
  account_email text,
  source text,
  max_messages integer,
  attempts integer
)
```

**Input:** None

**Output:** Single job row (or empty if no pending jobs)

**Side Effects:**
- Sets `status = 'running'`, increments `attempts`, sets `claimed_at`

**Auth:** SECURITY DEFINER

**Usage:** Called by worker in `/api/cron/gmail-extract`.

---

### `fn_gmail_extract_job_finish`
**Purpose:** Mark a job as succeeded or failed.

**Signature:**
```sql
fn_gmail_extract_job_finish(
  p_job_id bigint,
  p_status text,
  p_run_id uuid DEFAULT NULL,
  p_msgs integer DEFAULT 0,
  p_new integer DEFAULT 0,
  p_upd integer DEFAULT 0,
  p_error text DEFAULT NULL
) RETURNS void
```

**Input:**
- `p_job_id`: Job ID
- `p_status`: 'succeeded' | 'failed'
- `p_run_id`: Optional run ID (from `fn_gmail_extract_run_start`)
- `p_msgs`, `p_new`, `p_upd`: Counters
- `p_error`: Error message (if failed)

**Output:** None

**Side Effects:**
- UPDATE `marketing.gmail_extract_jobs` (status, counters, finished_at)

**Auth:** SECURITY DEFINER

**Usage:** Called by worker after processing a job.

---

### `fn_gmail_extract_batch_status`
**Purpose:** Get aggregate status of a batch.

**Signature:**
```sql
fn_gmail_extract_batch_status(p_batch_id uuid)
RETURNS TABLE(
  total integer,
  queued integer,
  running integer,
  succeeded integer,
  failed integer,
  messages_scanned bigint,
  new_contacts bigint,
  updated_contacts bigint,
  enqueued_at timestamptz,
  last_finished_at timestamptz
)
```

**Input:**
- `p_batch_id`: Batch UUID

**Output:** Single row with counts

**Side Effects:** None (read-only)

**Auth:** Public

**Usage:** Called by admin UI to show batch progress.

---

### `fn_gmail_extract_run_start`
**Purpose:** Start a new extraction run (for a single account).

**Signature:**
```sql
fn_gmail_extract_run_start(p_account text) RETURNS uuid
```

**Input:**
- `p_account`: Gmail address

**Output:** `run_id` (uuid)

**Side Effects:**
- INSERT into `marketing.gmail_extract_runs`

**Auth:** SECURITY DEFINER

**Usage:** Called at the start of each job execution.

---

### `fn_gmail_extract_run_finish`
**Purpose:** Finalize an extraction run.

**Signature:**
```sql
fn_gmail_extract_run_finish(
  p_run_id uuid,
  p_status text,
  p_msgs integer,
  p_new integer,
  p_upd integer,
  p_err text
) RETURNS void
```

**Input:**
- `p_run_id`: Run UUID
- `p_status`: 'success' | 'error'
- `p_msgs`, `p_new`, `p_upd`: Counters
- `p_err`: Error message (if any)

**Output:** None

**Side Effects:**
- UPDATE `marketing.gmail_extract_runs` (status, counters, finished_at)

**Auth:** SECURITY DEFINER

**Usage:** Called at the end of each job execution.

---

## 4. Reply Tracking & Matching

### `fn_gmail_record_reply_match`
**Purpose:** Record that a subscriber replied to a campaign email.

**Signature:**
```sql
fn_gmail_record_reply_match(
  p_sender_email text,
  p_message_id text,
  p_in_reply_to text,
  p_matched_send_id bigint DEFAULT NULL
)
RETURNS TABLE(
  subscriber_id bigint,
  added_to_responders boolean
)
```

**Input:**
- `p_sender_email`: Reply sender
- `p_message_id`: Gmail message ID
- `p_in_reply_to`: In-Reply-To header (from original campaign)
- `p_matched_send_id`: ID from `marketing.email_send_history`

**Output:**
- `subscriber_id`: Matched subscriber
- `added_to_responders`: Whether subscriber was added to responders segment

**Side Effects:**
- INSERT into `marketing.email_reply_matches`
- Possibly UPDATE subscriber segment membership

**Auth:** SECURITY DEFINER

**Usage:** Called by reply-scanner cron.

---

### `fn_gmail_reply_scan_state_bump`
**Purpose:** Update last-scanned position for reply scanner.

**Signature:**
```sql
fn_gmail_reply_scan_state_bump(
  p_account text,
  p_matches integer
) RETURNS void
```

**Input:**
- `p_account`: Gmail address
- `p_matches`: Number of replies found in this scan

**Output:** None

**Side Effects:**
- UPDATE `marketing.gmail_reply_scan_state` (last_scanned_at, match counter)

**Auth:** SECURITY DEFINER

**Usage:** Called by reply-scanner cron after each scan cycle.

---

## 5. Email Settings & Chrome Extension

### `fn_email_settings_upsert`
**Purpose:** Save email signature/settings for a property.

**Signature:**
```sql
fn_email_settings_upsert(
  p_property_id bigint,
  p_payload jsonb
) RETURNS jsonb
```

**Input:**
- `p_property_id`: Property ID
- `p_payload`: JSON object with settings (signature, reply_to, etc.)

**Output:** `{ ok: true, id: N }` or `{ ok: false, error: "..." }`

**Side Effects:**
- INSERT or UPDATE in `marketing.email_settings`

**Auth:** SECURITY DEFINER (caller must verify property access)

**Usage:** Called by `/settings/email` save button.

---

### `fn_email_chrome_upsert`
**Purpose:** Save Chrome extension state (e.g., AI reply suggestions).

**Signature:**
```sql
fn_email_chrome_upsert(
  p_property_id bigint,
  p_payload jsonb
) RETURNS jsonb
```

**Input:**
- `p_property_id`: Property ID
- `p_payload`: JSON object with extension state

**Output:** `{ ok: true }`

**Side Effects:**
- INSERT or UPDATE in `marketing.email_chrome_state`

**Auth:** SECURITY DEFINER

**Usage:** Called by Chrome extension background script.

---

### `fn_email_hero_fallback`
**Purpose:** Generate fallback subject line for email campaigns.

**Signature:**
```sql
fn_email_hero_fallback(
  p_campaign_id uuid,
  p_property_id bigint
) RETURNS text
```

**Input:**
- `p_campaign_id`: Campaign UUID
- `p_property_id`: Property ID

**Output:** Fallback subject line (text)

**Side Effects:** None (read-only)

**Auth:** Public

**Usage:** Called by email template renderer when hero text is empty.

---

## 6. Email Send History & Tracking

### `fn_email_send_history_record`
**Purpose:** Log an outbound email send event.

**Signature:**
```sql
fn_email_send_history_record(
  p_property_id bigint,
  p_email text,
  p_stream text,
  p_campaign_id uuid DEFAULT NULL,
  p_funnel_id uuid DEFAULT NULL,
  p_funnel_step_no integer DEFAULT NULL
) RETURNS bigint
```

**Input:**
- `p_property_id`: Property ID
- `p_email`: Recipient email
- `p_stream`: Stream name (e.g., 'pre_arrival', 'post_stay')
- `p_campaign_id`, `p_funnel_id`, `p_funnel_step_no`: Campaign metadata

**Output:** `id` of the inserted row

**Side Effects:**
- INSERT into `marketing.email_send_history`

**Auth:** SECURITY DEFINER

**Usage:** Called by `/api/mail/send` and campaign workers.

---

### `fn_email_message_link_to_lead`
**Purpose:** Link a Gmail message to a sales lead.

**Signature:**
```sql
fn_email_message_link_to_lead(
  p_message_id text,
  p_lead_id bigint
) RETURNS jsonb
```

**Input:**
- `p_message_id`: Gmail message ID
- `p_lead_id`: Lead ID from `sales.leads`

**Output:** `{ ok: true }` or `{ ok: false, error: "..." }`

**Side Effects:**
- UPDATE `sales.email_messages` SET `lead_id = p_lead_id`

**Auth:** SECURITY DEFINER

**Usage:** Called by lead detail page "Link Email" button.

---

### `fn_email_purge_expired`
**Purpose:** Delete old email messages (GDPR compliance).

**Signature:**
```sql
fn_email_purge_expired() RETURNS jsonb
```

**Input:** None

**Output:** `{ deleted: N }` where N = row count

**Side Effects:**
- DELETE from `sales.email_messages` WHERE `created_at < now() - interval '365 days'`

**Auth:** SECURITY DEFINER

**Usage:** Called by daily cron.

---

## 7. Mail Policy Helpers

### `fn_mail_ai_features_enabled`
**Purpose:** Check if AI features (reply suggestions, summaries) are enabled for a mailbox.

**Signature:**
```sql
fn_mail_ai_features_enabled(p_mailbox_id integer DEFAULT 1) RETURNS boolean
```

**Input:**
- `p_mailbox_id`: Mailbox ID (default 1)

**Output:** `true` or `false`

**Side Effects:** None (read-only)

**Auth:** Public

**Contract:** Checks `marketing.email_settings.ai_enabled` flag. Returns `false` if no row exists.

**Usage:** Called by `/api/mail/messages` before including AI-generated summaries.

**Note:** This function was shipped in commit 0fcd446d as part of the Q3 AI policy work.

---

### `fn_mail_attachment_validate`
**Purpose:** Validate attachment size/type before upload.

**Signature:**
```sql
fn_mail_attachment_validate(
  p_filename text,
  p_size_bytes bigint,
  p_mailbox_id integer DEFAULT 1
) RETURNS jsonb
```

**Input:**
- `p_filename`: File name
- `p_size_bytes`: File size
- `p_mailbox_id`: Mailbox ID

**Output:**
```json
{
  "ok": true,
  "allowed": true,
  "reason": null
}
```
or
```json
{
  "ok": true,
  "allowed": false,
  "reason": "file_too_large | unsupported_type | ..."
}
```

**Side Effects:** None (read-only)

**Auth:** Public

**Policy:**
- Max size: 25 MB (Gmail limit)
- Blocked types: `.exe`, `.bat`, `.sh`, `.scr`

**Usage:** Called by `/api/mail/send` before accepting attachment uploads.

---

## Testing Notes

**Test coverage (as of this document):**
- `lib/gmail.ts`: Not yet tested (legacy, read-only polling)
- `lib/userGmail.ts`: Not yet tested
- `app/api/mail/send/route.ts`: Not yet tested
- `app/api/mail/reply/route.ts`: Not yet tested

**Recommended test approach:**
1. Mock `getSupabaseAdmin()` to return a stub client
2. Mock Google OAuth token endpoint (`https://oauth2.googleapis.com/token`)
3. Mock Gmail API endpoints (`https://gmail.googleapis.com/gmail/v1/...`)
4. Use existing `lib/parity/__tests__/agent.test.ts` as a template

**DB function testing:**
- Use Supabase test helpers or direct SQL calls in Jest `beforeAll`
- Seed `marketing.user_gmail_connections` with test rows
- Verify side effects by querying tables after RPC calls

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-08-14 | Initial contract documentation (28 functions) |

---

**End of document.**
