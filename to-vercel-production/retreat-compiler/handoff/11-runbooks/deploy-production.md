# Runbook · Deploy to Production

**Owner:** PBS · **Estimated time:** 60 min · **Pre-req:** staging signed off

⛔ **Per SKILL.md:** Claude does NOT execute this runbook. PBS executes every step.

## Pre-flight (run §11 of `05-deploy-package.md` 24-item checklist)

If ANY item is unchecked → halt.

## Steps

### 1. Backup prod DB

```bash
export PROD_DB_URL='postgresql://postgres:PWD@db.PROD.supabase.co:5432/postgres'
TS=$(date -u +%Y%m%d_%H%M%S)
pg_dump "$PROD_DB_URL" -F c -f "backups/prod_${TS}_pre_retreat_compiler.dump"
ls -lh "backups/prod_${TS}_pre_retreat_compiler.dump"
```

Verify backup file size > 0. Upload a copy to S3/Drive offsite.

### 2. Apply migration to prod

```bash
psql "$PROD_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4.sql 2>&1 | tee migrate-prod.log
```

Watch for errors. If any → STOP, run rollback below.

### 3. Apply seed to prod

```bash
psql "$PROD_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_seed.sql 2>&1 | tee seed-prod.log
```

### 4. Validate

```bash
psql "$PROD_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_validate.sql > validate-prod.txt
cat validate-prod.txt
```

Every check passes. Else halt + rollback.

### 5. RLS spot check on prod

```bash
# Same anon-tests as staging runbook §2, swap STAGING for PROD URLs
```

### 6. Switch Vercel env to production keys

In Vercel UI, confirm Production environment has:
- `STRIPE_SECRET_KEY=sk_live_*`
- `STRIPE_WEBHOOK_SECRET=whsec_live_*`
- `KLAVIYO_PRIVATE_KEY=pk_live_*`
- `CLOUDBEDS_*` pointing at real property
- `SENTRY_ENVIRONMENT=production`
- All `NEXT_PUBLIC_*` matching live URLs

### 7. Deploy app to prod

```bash
git checkout main
git pull
git merge feat/retreat-compiler --no-ff -m "Merge retreat-compiler v1 (rev 1, approved 2026-05-04)"
git push origin main

vercel pull --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
```

Vercel auto-aliases to `thenamkhan.com` (configured in domains).

### 8. DNS / SSL verify

```bash
# Allow 5 min for Cloudflare provisioning if first deploy
dig thenamkhan.com +short
curl -sI https://thenamkhan.com | head
```

Expect 200 + Cloudflare cert in chain.

### 9. Webhook smoke

```bash
# Stripe — send test event from Stripe dashboard → confirm webhook receives
# Klaviyo — fire test event → confirm Make scenario triggers
# Cloudbeds — read availability via /api/cb/availability → 200
```

### 10. Run prod smoke test plan

Open `99-tests/smoke-test-plan.md` — run all 20 tests against prod URL within 15 min of deploy.

If any fail → run rollback (§12 below).

### 11. Activate Make scenarios on prod

In Make UI:
1. Switch each scenario from staging → production webhook URLs
2. Switch all connections to live (Klaviyo live, Stripe live, Cloudbeds live, Slack #bookings + #retreat-compiler-prod)
3. Confirm HMAC secret matches prod env
4. Activate each scenario one-by-one, verify with synthetic event before next

### 12. Stripe webhooks — flip to live mode

In Stripe Dashboard:
1. Add live-mode endpoints (URLs unchanged but signing secret different)
2. Copy live-mode signing secret → Vercel env
3. Re-deploy if env changed
4. Send test event → verify

### 13. Update sign-off doc

Append to `03-approval.md`:

```
PROD_DEPLOY_DATE: 2026-05-DD HH:MM Asia/Vientiane
PROD_DEPLOY_BY: PBS
PROD_URL: https://thenamkhan.com
PROD_DEPLOYMENT_ID: dpl_*
ROLLBACK_WINDOW_OPEN: 24 hours
ROLLBACK_OWNER_ON_CALL: PBS
```

### 14. Monitor 24-hour rollback window

- Sentry dashboard open
- Vercel function logs tailed
- Slack #retreat-compiler-prod monitored
- Booking flow synthetic-tested every 4 hours

If incident → run `rollback.md`. If clean after 24h → close window.

## Rollback (production)

```bash
# 1. App rollback (instant)
vercel rollback --previous

# 2. DB rollback (if migration broke prod)
psql "$PROD_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql

# 3. If DB rollback insufficient, restore from backup
pg_restore -d "$PROD_DB_URL" --clean --if-exists "backups/prod_${TS}_pre_retreat_compiler.dump"

# 4. Pause Make scenarios in UI

# 5. Disable Stripe live webhook endpoints temporarily

# 6. Page PBS via Slack
```

Document the incident in `incident-log.md` with timeline, root cause, fix.
