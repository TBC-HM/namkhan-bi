# Runbook · Deploy to Staging

**Owner:** PBS · **Estimated time:** 90–120 min · **Frequency:** every PR before prod merge

## Prerequisites

- All env vars set in Vercel `Preview` environment (see `01-env/.env.example`)
- Supabase staging branch created (or staging project)
- Stripe keys in **test mode**
- Cloudbeds sandbox property credentials ready (or live property if no sandbox available — confirm with PBS)
- Klaviyo staging account or test list created
- Make scenarios stub-imported and pointed at staging webhook URLs

## Steps

### 1. Apply DB migration to staging

```bash
cd "/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal"
export STAGING_DB_URL='postgresql://postgres:PWD@db.STAGING.supabase.co:5432/postgres'

psql "$STAGING_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4.sql
psql "$STAGING_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_seed.sql
psql "$STAGING_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_validate.sql > validate-output.txt
```

Open `validate-output.txt`. Every row's `actual` must match `expected`. If any miss → halt, fix, rollback if needed:

```bash
psql "$STAGING_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql
```

### 2. RLS test plan

```bash
# Anon SELECT on catalog (should DENY)
curl -s "https://STAGING.supabase.co/rest/v1/activities?select=name" \
  -H "apikey: $STAGING_ANON_KEY" | jq
# expect: empty array or 401

# Anon SELECT on web.pages where status=live (should ALLOW)
curl -s "https://STAGING.supabase.co/rest/v1/pages?select=full_path&status=eq.live" \
  -H "apikey: $STAGING_ANON_KEY" | jq

# Anon SELECT on web.pages where status=draft (should DENY/empty)
curl -s "https://STAGING.supabase.co/rest/v1/pages?select=full_path&status=eq.draft" \
  -H "apikey: $STAGING_ANON_KEY" | jq

# Anon RPC capture_lead (should ALLOW)
curl -s -X POST "https://STAGING.supabase.co/rest/v1/rpc/capture_lead" \
  -H "apikey: $STAGING_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_email":"smoke@example.com","p_country":"DE","p_consents":["marketing"]}'
# expect: { subscriber_id, opt_in_required: true, double_opt_in_token }

# Anon SELECT booking by token (should ALLOW one row)
curl -s "https://STAGING.supabase.co/rest/v1/bookings?public_token=eq.KNOWN_TOKEN" \
  -H "apikey: $STAGING_ANON_KEY" | jq
```

If anything fails → halt and fix RLS policies before deploying app.

### 3. Build + deploy to Vercel preview

```bash
git checkout feat/retreat-compiler
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm test --run

vercel link --project=cloudbeds-vercel-portal
vercel pull --environment=preview
vercel build
vercel deploy --prebuilt
```

Note the preview URL printed at end — looks like `https://cloudbeds-vercel-portal-{hash}-paulbauer.vercel.app`.

### 4. Smoke test on preview URL

Open `99-tests/smoke-test-plan.md` — run all 20 tests against the preview URL. Track in checklist.

If any fail → fix locally, push, redeploy preview, re-test.

### 5. Make staging scenarios

In Make UI:
1. Each scenario imported from `05-make/make-scenarios.json`
2. Webhook URLs configured to staging endpoint
3. Connections set: Klaviyo (staging account), Stripe (test mode), Slack (#staging-test channel), Cloudbeds (sandbox)
4. HMAC secret matches `MAKE_WEBHOOK_SECRET` in Vercel env
5. Each scenario activated

### 6. Sign-off

Update `03-approval.md` once smoke + RLS pass:

```
STAGING_DEPLOY_SIGNED_OFF: <date> <name>
STAGING_URL: https://cloudbeds-vercel-portal-{hash}-paulbauer.vercel.app
STAGING_DB_BRANCH: <Supabase branch ID>
```

Proceed to `deploy-production.md` only after PBS reviews staging smoke.

## Rollback (staging)

If staging is broken in a way that blocks PR review:

```bash
# Revert app
vercel rollback --previous

# Revert DB
psql "$STAGING_DB_URL" -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql

# Pause Make scenarios in UI
```

Document what broke in `incident-log.md` so prod path is informed.
