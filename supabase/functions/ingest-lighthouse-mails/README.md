# Lighthouse Email Ingestion Edge Function

## Purpose

Ingests daily competitive rate intelligence reports from Lighthouse via Gmail, parses Excel attachments, and loads data into the `revenue.lighthouse_rateshop` table.

## Deployment

```bash
# Deploy to Supabase
supabase functions deploy ingest-lighthouse-mails

# Set secrets (one-time)
supabase secrets set GMAIL_ACCESS_TOKEN=<token_from_oauth_flow>
```

## Scheduling

Triggered daily at 03:30 UTC via pg_cron (job 139):

```sql
SELECT * FROM cron.job WHERE jobid = 139;
```

## Authentication

Uses Gmail OAuth2 with service account credentials stored in Supabase secrets:
- `GMAIL_ACCESS_TOKEN` - OAuth token (requires manual refresh ~every 60 days)

## Error Handling

- **Gmail auth failures**: Logs error and returns 500 (requires manual OAuth token refresh)
- **Parse errors**: Logs error run to `revenue.lighthouse_ingest_runs`, continues processing other attachments
- **DB conflicts**: ON CONFLICT DO UPDATE (idempotent upserts)

## Monitoring

- **DQ Rules**: R-LH-001, R-LH-002 fire CRITICAL alerts if no successful ingest in 36+ hours
- **Ingest runs**: Query `public.v_lighthouse_ingest_runs` for recent activity
- **Current data freshness**: `SELECT MAX(imported_at) FROM revenue.lighthouse_rateshop`

## Data Flow

1. Search Gmail for `from:noreply@lighthouse.app subject:"Rate Shopping Report" has:attachment newer_than:7d`
2. Download .xlsx attachments (up to 10 most recent)
3. Parse Excel sheets with SheetJS (XLSX.utils.sheet_to_json)
4. Call `public.fn_upsert_lighthouse_rateshop(p_rows, p_source_file, p_gmail_message_id)`
5. Log run to `revenue.lighthouse_ingest_runs` (success/error)

## Local Testing

```bash
# Invoke function locally with Supabase CLI
supabase functions serve ingest-lighthouse-mails

# Test with curl
curl -X POST http://localhost:54321/functions/v1/ingest-lighthouse-mails \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Dependencies

- `@supabase/supabase-js@2.39.0` - DB client
- `xlsx@0.20.0` - Excel parser (SheetJS)
- Deno std@0.168.0 - HTTP server

## Related Database Objects

- `revenue.lighthouse_rateshop` - Main data table (94k+ rows)
- `revenue.lighthouse_ingest_runs` - Run log
- `public.fn_upsert_lighthouse_rateshop()` - Batch upsert function
- `dq.rules` R-LH-001, R-LH-002 - Staleness monitors
- `public.v_lighthouse_ingest_runs` - UI view

## Troubleshooting

**"Gmail API error: 401"**  
OAuth token expired. Refresh manually and update secret:
```bash
supabase secrets set GMAIL_ACCESS_TOKEN=<new_token>
```

**"No new Lighthouse emails"**  
Check Gmail inbox for messages from noreply@lighthouse.app. Verify Lighthouse scraper is still active.

**Rows parsed but 0 upserted**  
Check Excel column mapping in `fn_upsert_lighthouse_rateshop`. Schema may have changed.
