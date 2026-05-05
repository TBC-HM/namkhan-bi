# Make.com Gmail → Vercel ingest

Three Gmail inboxes (`book@thenamkhan.com`, `wm@thenamkhan.com`, `reservations@thenamkhan.com`) are forwarded to:

```
POST https://namkhan-bi.vercel.app/api/sales/email-ingest
```

The endpoint inserts every email into `sales.email_messages` (full thread capture) and creates a `sales.inquiries` row for each new inbound thread. Outbound replies are linked to the inquiry by Gmail thread_id.

## What you need before importing

| Item | Where | Value |
|---|---|---|
| Vercel env var `MAKE_INGEST_TOKEN` | Vercel → namkhan-bi → Settings → Environment Variables | Pick any secret string. Same value goes in the `X-Make-Token` header in both blueprints. |
| Gmail OAuth connection × 3 | Make.com → Connections → Add → Google → Email | One connection per inbox. Sign in as `book@`, `wm@`, `reservations@` separately. |

## Step-by-step

### 1) Set the secret on Vercel

```
Vercel → Project → Settings → Environment Variables → Add
Name:  MAKE_INGEST_TOKEN
Value: <your secret> (e.g. nk-bi-make-2026-K9j2vR)
Scope: Production + Preview
```
Hit **Save**, then **Redeploy** the latest deployment so the env var loads.

### 2) Add 3 Gmail connections in Make.com

For each of the 3 mailboxes:

1. Make.com → Connections → Add → search `Email (Google)` → **Add**
2. OAuth flow → sign in as that mailbox → grant `Read messages` + `Modify labels`
3. Name it clearly: `gmail-book`, `gmail-wm`, `gmail-reservations`

### 3) Run the BACKFILL once per inbox (one-shot historical pull)

Use **`02-backfill-since-jan-2026.json`** — import once per mailbox.

For each of the 3 mailboxes:

1. Make.com → Scenarios → Create new → **Import blueprint** → upload `02-backfill-since-jan-2026.json`
2. Rename: `Backfill book@`, `Backfill wm@`, `Backfill reservations@`
3. **Module 1 (Search Emails)** → set Connection to that inbox's connection
   - `folder` → `ALL` (so we get sent mail too)
   - `query` → `after:2026/01/01`
   - `limit` → `5000` (Gmail will page; raise if needed)
4. **Module 2 (Set Variables)** → replace placeholder `REPLACE_WITH_INBOX_EMAIL` with the actual inbox address (lowercase, e.g. `book@thenamkhan.com`)
   - This is what makes the `direction` flag flip to `outbound` for emails *sent from* that mailbox
5. **Module 3 (HTTP)** → replace `REPLACE_WITH_MAKE_INGEST_TOKEN` with the secret from step 1
6. **Run once** (left side button) — watch the operations meter climb. ~3000 emails → ~10 minutes.
7. After it finishes, **disable the scenario** so it doesn't re-run.

Verify the backfill landed:
```sql
SELECT mailbox, direction, COUNT(*)
FROM sales.email_messages
GROUP BY mailbox, direction
ORDER BY mailbox, direction;
```

### 4) Set up the REALTIME watcher per inbox (ongoing, every 1–15 min)

Use **`01-realtime-watcher.json`** — import once per mailbox.

For each of the 3 mailboxes:

1. Make.com → Scenarios → Create new → **Import blueprint** → upload `01-realtime-watcher.json`
2. Rename: `Realtime book@`, `Realtime wm@`, `Realtime reservations@`
3. **Module 1 (Watch Emails)** → set Connection to that inbox's connection
   - `folder` → `INBOX`
   - `query` → `newer_than:1d`
   - `markSeen` → off (don't mark them read; you may want to read them in Gmail)
   - Trigger schedule (in scenario settings, not the module) → every **5 min** is sensible
4. **Module 3 (HTTP)** → replace `REPLACE_WITH_MAKE_INGEST_TOKEN` with the secret
5. Toggle scenario **ON**.
6. Send a test email to that mailbox from a personal account. Within ~5 min you should see it appear in `/sales/inquiries`.

### 5) (Optional) Catch outbound mail in real-time too

The realtime blueprint above watches `INBOX` only. To catch what *you* send out as you send it, duplicate the realtime scenario with these tweaks per inbox:

- `folder` → `[Gmail]/Sent Mail`
- `query` → `newer_than:1d`
- In Module 2 (Set Variables) → set `direction` to `outbound` (literal value)

Or skip this and rely on the next backfill cycle to capture sent mail (set the backfill scenario to weekly instead of one-time).

## Curl test (after step 1 + step 4)

Hit the endpoint with a fake email to confirm it inserts:

```bash
curl -X POST https://namkhan-bi.vercel.app/api/sales/email-ingest \
  -H 'X-Make-Token: <your secret>' \
  -H 'Content-Type: application/json' \
  -d '{
    "direction":   "inbound",
    "mailbox":     "book@thenamkhan.com",
    "from":        "Test Person <test@example.com>",
    "to":          "book@thenamkhan.com",
    "subject":     "Test inquiry — 3 nights river view, Aug 14–17, 2 adults",
    "body_text":   "Hello, we are 2 adults and 1 child looking for 3 nights, river view if possible. Dates 2026-08-14 to 2026-08-17.",
    "received_at": "2026-05-04T15:00:00Z",
    "message_id":  "<test-curl-001@local>",
    "thread_id":   "test-thread-001",
    "ingest_source": "manual.curl"
  }'
```

Expected response:
```json
{
  "ok": true,
  "message_id_db": "...",
  "inquiry_id": "...",
  "action": "inserted",
  "direction": "inbound",
  "inquiry_created": true,
  "triage": { "kind": "fit", "conf": 0.65 },
  "linked": true
}
```

Re-run the same curl → you should get `"action":"duplicate"` and the same ids.

## Schema reference

Tables / views the ingest writes to:

- `sales.email_messages` — full message log (in + out, threaded)
- `sales.inquiries` — one row per inbound thread
- `sales.v_email_thread` — view joining messages to inquiries

## Operational notes

- **Volume cap** — Make.com free tier is 1k operations/month. Each ingest = 3 ops (watch + setvar + http). 3 inboxes × ~10 emails/day × 3 ops = ~2.7k ops/month. Pro tier is fine.
- **Dedup** — the endpoint uses `(property_id, message_id)` unique index. Re-running a backfill is safe.
- **Threading** — inbound creates inquiry; subsequent messages in same Gmail thread (inbound or outbound) link by thread_id. Outbound mail with no matching thread is stored but `inquiry_id` is null (orphan reply).
- **Triage** — keyword-based today (free). When `lib/agents/sales/inquiryTriager` becomes a callable LLM, swap it in at line ~190 of the route.
- **Body cap** — body_text capped at 200k chars in DB, 50k in `inquiries.raw_payload`. Long Cloudbeds confirmation HTML won't bloat the inquiries table.
