# Runbook · Rollback

⛔ Use only when production is failing in a way users can see, or data integrity is at risk. Otherwise → forward-fix.

## Decision tree

```
production broken?
├── frontend only · users see error pages or 500s
│     → vercel rollback --previous              [§1]
├── API endpoint broken · webhook/booking failing
│     → vercel rollback --previous + Stripe webhook pause     [§1 + §3]
├── DB migration corrupted data
│     → SQL rollback + restore backup if needed     [§2]
├── Make scenario flooding/duplicating
│     → Pause Make scenarios in UI                  [§4]
├── Stripe charging wrong amounts
│     → Pause Stripe live webhook + halt new bookings    [§3 + §5]
└── Subscriber data exposed (RLS hole)
      → Disable affected RLS policies, force re-deploy     [§6]
```

## §1 App rollback (Vercel)

```bash
cd "/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal"
vercel rollback --previous
# Or specify a deployment ID
vercel rollback dpl_xxx
```

Recovery: ~30 sec. DNS unchanged; users see previous build immediately.

## §2 DB rollback

### 2a · Reverse migration (no data loss if migration is idempotent)

```bash
export PROD_DB_URL='postgresql://postgres:PWD@db.PROD.supabase.co:5432/postgres'
psql "$PROD_DB_URL" \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql
```

This drops `catalog/pricing/compiler/book/web/content` schemas CASCADE. Existing `public/marketing/guest/gl` untouched.

### 2b · Restore from backup (if data lost)

```bash
pg_restore -d "$PROD_DB_URL" --clean --if-exists \
  "backups/prod_$(ls -t backups | head -1)"
```

Recovery: 10 min – 2 hr depending on DB size.

## §3 Stripe pause

```bash
# Disable live-mode endpoints temporarily
stripe webhook_endpoints update we_LIVE_ID --disabled
```

Or in Stripe Dashboard → Webhooks → Disable. New bookings → checkout will still create Sessions, but our webhook won't process completion → bookings stay in `held` status. Customers will see "we'll send confirmation soon" message.

After fix: re-enable, replay events from Stripe dashboard.

## §4 Make scenario pause

In Make UI → each scenario → toggle off. Synchronous flows (Stripe webhook → Make → Cloudbeds reserve) will fail open: bookings still recorded in `book.bookings`, but Cloudbeds reservations queued for manual creation.

After fix: re-enable, replay queued from `book.bookings` where `cloudbeds_reservation_id IS NULL`.

## §5 Halt new bookings

Set Vercel env `MAINTENANCE_MODE=true` and redeploy:

```bash
vercel env add MAINTENANCE_MODE production
# value: true
vercel deploy --prod
```

App middleware respects this flag → returns 503 with friendly maintenance page on `/r/*/configure`, `/r/*/checkout`, `/api/checkout/*` paths. Other pages still serve.

Alternative quicker: Cloudflare Page Rule → temporarily redirect `/api/checkout/*` to maintenance page.

## §6 RLS emergency

If a privacy regression is suspected (e.g. anon can read PII):

```sql
-- Disable specific policy
DROP POLICY IF EXISTS web_subscribers_anon_select ON web.subscribers;
ALTER TABLE web.subscribers FORCE ROW LEVEL SECURITY;

-- Or fully lock down
REVOKE ALL ON ALL TABLES IN SCHEMA web FROM anon;
```

Then patch policy file, redeploy. **Mark as P0 incident.**

## §7 Cloudflare cache flush

If stale page versions persist after deploy:

```
Cloudflare Dashboard → Caching → Configuration → Purge Everything
```

Or selective:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -d '{"files":["https://thenamkhan.com/r/mindfulness-summer*"]}'
```

## §8 DNS revert

If a wrong DNS change ships:

```
Cloudflare Dashboard → DNS → DNS Records → undo
```

DNS propagation: TTL-bound. With Cloudflare proxy ON and TTL=Auto, typically <60s.

## Aftermath checklist

| ☐ | Step |
|---|---|
| ☐ | Document timeline in `incident-log.md` (when broke, when noticed, when rolled back, when fixed) |
| ☐ | Identify root cause (5-whys) |
| ☐ | Add regression test |
| ☐ | Update runbook if rollback was harder than expected |
| ☐ | Notify affected customers if booking-impacting |
| ☐ | Schedule retro within 1 week |
