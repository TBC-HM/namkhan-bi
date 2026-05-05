# Gmail OAuth setup — 10-15 min, one-time

**Goal**: connect your Gmail mailboxes (`pb@thenamkhan.com` etc.) directly to your Vercel app, no Make.com involvement. After this is done, a cron job runs every 15 min and pulls new emails into `sales.email_messages` automatically.

---

## What you need to do

### Step 1 — Create Google Cloud project (3 min)

1. Open https://console.cloud.google.com/projectcreate
2. Project name: `Namkhan BI` → Create
3. Wait ~30 seconds for the project to provision
4. Make sure the project is selected in the top bar

### Step 2 — Enable Gmail API (1 min)

1. https://console.cloud.google.com/apis/library/gmail.googleapis.com
2. Click **ENABLE**

### Step 3 — Configure OAuth consent screen (3 min)

1. https://console.cloud.google.com/apis/credentials/consent
2. **User Type**: pick **Internal** if your Workspace allows (only Namkhan accounts can use). If "Internal" is greyed out (no Workspace billing), pick **External** + add yourself as a test user later.
3. App name: `Namkhan BI`
4. User support email: `pb@thenamkhan.com`
5. Developer contact: same
6. Save and Continue
7. **Scopes** screen — click **Add or Remove Scopes** → search `gmail.readonly` → tick `https://www.googleapis.com/auth/gmail.readonly` → also tick `userinfo.email` and `openid` → Save
8. Save and Continue
9. (Only if External) **Test users** — add `pb@thenamkhan.com` (and any other namkhan email you want to connect)
10. Save and Back to dashboard

### Step 4 — Create OAuth 2.0 Client (2 min)

1. https://console.cloud.google.com/apis/credentials
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `namkhan-bi-vercel`
5. **Authorized redirect URIs** → Add URI:
   ```
   https://namkhan-bi.vercel.app/api/auth/gmail/callback
   ```
6. Click **CREATE**
7. A modal pops up with **Client ID** + **Client secret**. Copy both — you'll need them in step 5.

### Step 5 — Add the OAuth secrets to Vercel (2 min)

Open https://vercel.com/pbsbase-2825s-projects/namkhan-bi/settings/environment-variables and add **two** new env vars (Production + Preview + Development):

| Name | Value |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | the Client ID from step 4 (looks like `1234567890-abc...apps.googleusercontent.com`) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | the Client secret from step 4 |

Already set (no action needed):
| Name | Value |
|---|---|
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://namkhan-bi.vercel.app/api/auth/gmail/callback` ✓ |
| `CRON_SECRET` | `nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS` ✓ |
| `MAKE_INGEST_TOKEN` | `nk-bi-make-2026-Z3kT9pXqR7vL2NwY8mHsB4` ✓ (kept for fallback) |

**After adding the two new vars, click Redeploy on the latest production deployment** (Deployments → ⋯ → Redeploy) so they load.

### Step 6 — Connect a Gmail account via the admin page (1 min)

1. Open in your browser:
   ```
   https://namkhan-bi.vercel.app/admin/gmail-connect?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS
   ```
2. Click **Connect Gmail account →**
3. Google sign-in popup → sign in as `pb@thenamkhan.com`
4. Grant the read-only Gmail scopes
5. You'll land back on `/admin/gmail-connect` with a green "Connected pb@thenamkhan.com" banner.

Repeat step 6 with each mailbox you want to ingest (sign out of pb@ in Google first, then click Connect again, sign in as `book@`, etc.).

### Step 7 — Trigger the first poll manually

Once at least one mailbox is connected:

```
https://namkhan-bi.vercel.app/api/cron/poll-gmail?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS
```

Response shows `{ ok: true, results: [{ email, seen, inserted, skipped, ... }] }`. First run pulls everything since `2026-01-01` (up to 500 messages).

For a bigger one-shot backfill:
```
https://namkhan-bi.vercel.app/api/cron/poll-gmail?key=nk-cron-okiHhcX8y_N4uHjP6vXHcVb7YfYS&force_email=pb@thenamkhan.com&since=2026-01-01&limit=2000
```

### Step 8 — Verify

- `/inbox` → real threads, real subjects, real senders
- `/sales/inquiries` → Decision Queue + InquiryFeed populated with real guests
- Cron schedule: `*/15 * * * *` (every 15 min) — already in `vercel.json`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| OAuth error "redirect_uri_mismatch" | Re-check Authorized redirect URIs in Google Cloud — must match `https://namkhan-bi.vercel.app/api/auth/gmail/callback` exactly |
| OAuth error "access_denied" | If your app is "External", you must be a Test user — add yourself in OAuth consent screen → Test users |
| `/admin/gmail-connect?key=...` shows "Connect" button greyed out | URL missing `?key=` — paste the CRON_SECRET |
| Cron returns 401 | Wrong CRON_SECRET. Generate a fresh one: `python3 -c 'import secrets;print("nk-cron-"+secrets.token_urlsafe(20))'` then update Vercel env var |
| Cron returns "no connections" | You haven't completed step 6 yet OR the connection row has `paused=true` |
| Some messages not inserted (skipped count high) | Dedupe — same `message_id` already exists. Normal on subsequent polls. |

## Architecture summary

```
Google Workspace inbox (pb@thenamkhan.com)
        ↓ refresh_token stored once
sales.gmail_connections (Supabase)
        ↓ Vercel cron */15 * * * *
/api/cron/poll-gmail
        ↓ Gmail API: list + get full messages
sales.email_messages + sales.inquiries
        ↓ /inbox UI + /sales/inquiries UI
```

No Make.com. No external paid services. Free Vercel cron + free Gmail API quota (1B units/day, way more than needed).
