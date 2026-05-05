# 05 — Deploy Package · retreat-compiler

**Status:** Stage 4 handoff documentation
**Approved scope:** rev 1 (Stage 2 approval 2026-05-04)
**Target environments:** staging first (Supabase branch + Vercel preview), prod after smoke test passes
**Owner:** PBS
**Estimated total deploy time:** 4–6 hours staging · 2 hours prod (after staging signed off)

---

## 0. Halt rules — read before touching anything

This doc is **how to deploy**, not "Claude deploys". Per SKILL.md:

- ❌ Claude never pushes to GitHub
- ❌ Claude never applies migrations to prod
- ❌ Claude never imports Make scenarios automatically
- ❌ Claude never deploys to Vercel
- ✅ Claude prepares files, writes migrations, writes Make blueprint JSON, writes runbooks
- ✅ PBS executes every write action

If anything below is unclear, halt and ask before running it.

---

## 1. Bundle structure (what gets handed off)

Target path: `~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/`
**Sandbox can't write there directly.** Mirror placed at `feature-builder/output/retreat-compiler/handoff/` (see §15). Operator copies/moves to the Desktop path.

```
retreat-compiler/
├── README.md                                  ← this file (top-level summary)
├── 00-PRE-DEPLOY-CHECKLIST.md                 ← run this first
├── 01-env/
│   ├── .env.staging.example                   ← every env var needed
│   ├── .env.production.example
│   └── secrets-vault-map.md                   ← which secret lives where
├── 02-database/
│   ├── 20260504000000_retreat_compiler_init_a1b2c3d4.sql
│   ├── 20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql
│   ├── 20260504000000_retreat_compiler_init_a1b2c3d4_seed.sql
│   ├── 20260504000000_retreat_compiler_init_a1b2c3d4_validate.sql
│   ├── rls-test-plan.md
│   └── README.md                              ← apply order + verification
├── 03-app/
│   ├── pages/                                 ← 3 retreat-funnel pages (legacy contract)
│   │   ├── retreat-detail.html
│   │   ├── retreat-configure.html
│   │   ├── retreat-checkout.html
│   │   └── lead-magnet.html
│   ├── full-site-routes.md                    ← full marketing site routing
│   ├── components-manifest.md                 ← every NEW component to create
│   └── api-contracts.md                       ← every NEW API endpoint with auth + rate limits
├── 04-pdf/
│   ├── retreat-budget.html                    ← Puppeteer template
│   ├── retreat-mid.html
│   ├── retreat-lux.html
│   └── README.md                              ← Puppeteer setup, fonts, logos
├── 05-make/
│   ├── make-scenarios.json                    ← all 5 scenarios as importable blueprints
│   ├── webhook-endpoints.md                   ← target URLs Make calls
│   └── README.md                              ← import order
├── 06-stripe/
│   ├── stripe-products.json                   ← products + prices to create
│   ├── stripe-webhooks.md                     ← endpoints + events to subscribe
│   └── README.md
├── 07-cloudbeds/
│   ├── cb-rate-bridge.md                      ← lib/pricing.ts contract (already exists)
│   ├── cb-reservation-flow.md
│   └── README.md
├── 08-klaviyo/
│   ├── flows.md                               ← 4 flows to create with triggers
│   ├── lists.md                               ← list + segment definitions
│   ├── templates/                             ← email HTML templates
│   └── README.md
├── 09-cloudflare/
│   ├── dns-records.md                         ← every DNS record per subdomain
│   ├── cache-rules.md
│   └── README.md
├── 10-vercel/
│   ├── vercel.json
│   ├── project-settings.md                    ← env, build cmd, node version
│   ├── domains-mapping.md
│   └── README.md
├── 11-runbooks/
│   ├── deploy-staging.md
│   ├── deploy-production.md
│   ├── rollback.md
│   ├── incident-response.md
│   └── operator-day-to-day.md
└── 99-tests/
    ├── smoke-test-plan.md
    ├── load-test-plan.md
    └── audit-checklist.md
```

---

## 2. Environment variables

### 2.1 Required for any deploy

| Variable | Where it comes from | Used by | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Supabase project URL | server + client | public OK |
| `SUPABASE_ANON_KEY` | Supabase anon key | client | public OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role | server only | NEVER ship to client |
| `SUPABASE_DB_URL` | Supabase pooled connection | migrations only | not in app runtime |
| `CLOUDBEDS_CLIENT_ID` | Cloudbeds dev portal | server | scoped to property |
| `CLOUDBEDS_CLIENT_SECRET` | Cloudbeds dev portal | server | rotate annually |
| `CLOUDBEDS_PROPERTY_ID` | Cloudbeds | server | namkhan = `12345` (placeholder — confirm) |
| `CLOUDBEDS_REFRESH_TOKEN` | OAuth dance | server | survives token rotations |
| `STRIPE_SECRET_KEY` | Stripe dashboard | server | `sk_live_*` or `sk_test_*` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe dashboard | client | `pk_live_*` or `pk_test_*` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook config | server | per-endpoint |
| `KLAVIYO_PRIVATE_KEY` | Klaviyo account → API keys | server | scoped private API key |
| `KLAVIYO_PUBLIC_KEY` | Klaviyo | client | for tracking pixel |
| `MAKE_WEBHOOK_BASE` | Make.com scenario URL | server | per-env scenario set |
| `MAKE_WEBHOOK_SECRET` | self-generated 32-byte hex | both | HMAC verify on Make's side |
| `META_PIXEL_ID` | Meta Business Manager | client | per-property |
| `GA4_MEASUREMENT_ID` | Google Analytics | client | per-property |
| `GA4_API_SECRET` | GA4 measurement protocol | server | server-side events |
| `RESEND_API_KEY` | Resend | server | transactional only — Klaviyo handles marketing |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → tokens | deploy script only | scoped to DNS edit |
| `CLOUDFLARE_ZONE_ID` | Cloudflare → zone overview | deploy script only | per-domain |
| `VERCEL_TOKEN` | Vercel → tokens | deploy CLI | personal token, not team |
| `VERCEL_TEAM_ID` | Vercel team | deploy CLI | optional |
| `NEXT_PUBLIC_SITE_URL` | self | client | `https://thenamkhan.com` |
| `NEXT_PUBLIC_PROPERTY_ID` | self | client | `namkhan` |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | self | client | `USD` |
| `NEXT_PUBLIC_BASE_CURRENCY` | self | client | `LAK` |
| `FX_LOCK_DAYS` | self | server | default `7` |
| `MARGIN_FLOOR_ACTIVITIES_PCT` | self | server | default `35` |
| `MARGIN_FLOOR_ROOMS_PCT` | self | server | default `60` |
| `MARGIN_FLOOR_FNB_PCT` | self | server | default `70` |
| `COMPILER_COST_CAP_EUR` | self | server | default `0.20` per run |
| `COMPILER_MODEL` | self | server | `claude-sonnet-4-6` |
| `ANTHROPIC_API_KEY` | console.anthropic.com | server | compiler only |
| `LOG_LEVEL` | self | server | `info` prod, `debug` staging |
| `SENTRY_DSN` | Sentry | both | error monitoring (optional v1) |

### 2.2 Vault map

| Secret | Storage |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel encrypted env (server only) + 1Password vault `Namkhan Production` |
| `STRIPE_SECRET_KEY` | Vercel encrypted env + 1Password |
| `CLOUDBEDS_CLIENT_SECRET` | Vercel encrypted env + 1Password |
| `KLAVIYO_PRIVATE_KEY` | Vercel encrypted env + 1Password |
| `ANTHROPIC_API_KEY` | Vercel encrypted env + 1Password |
| `CLOUDFLARE_API_TOKEN` | 1Password only — never in Vercel |
| `VERCEL_TOKEN` | 1Password only — never in env |
| `MAKE_WEBHOOK_SECRET` | Vercel + Make scenario settings |

**Rule:** every value in 1Password vault `Namkhan Production` AND `Namkhan Staging`. Vercel env values match.

---

## 3. Database — apply order

### 3.1 Staging first

```bash
# from repo root, requires SUPABASE_DB_URL pointed at STAGING
psql $SUPABASE_STAGING_DB_URL \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4.sql

# verify
psql $SUPABASE_STAGING_DB_URL \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_validate.sql

# apply seed (vendors, series, lunar, USALI, legal placeholders)
psql $SUPABASE_STAGING_DB_URL \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_seed.sql

# re-run validate to confirm seed counts
psql $SUPABASE_STAGING_DB_URL \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_validate.sql
```

Expected validate output:

| Check | Expected |
|---|---|
| `catalog.vendors` count | 7 (Green Discovery, MandaLao, Ock Pop Tok, White Elephant, Living Land, MotoLao, UXO Laos) — empty until Sheet sync adds internal |
| `content.series` count | 4 (mindfulness, river-tales, retreat-life, detox) |
| `content.lunar_events` count between 2026–2030 | ~250 |
| `content.usali_categories` count | matches `gl.classes` (~12) |
| `content.legal_pages` count | 4 (privacy, terms, waiver, accessibility — placeholders) |
| RLS enabled on all new tables | true × 35+ |
| `pgrst.db_schemas` includes new schemas | true |

### 3.2 RLS test plan

Auto-run by Cowork on staging. Manual auth tests:

| Test | Expected | How |
|---|---|---|
| Anon SELECT `catalog.activities` | DENY | `curl https://STAGING/rest/v1/activities -H "apikey: $ANON"` → 401/empty |
| Anon SELECT `web.pages` where status='live' | ALLOW | same → 200 with rows |
| Anon SELECT `web.pages` where status='draft' | DENY | same with `?status=eq.draft` → empty |
| Anon RPC `web.capture_lead(email)` | ALLOW (rate-limited 60/min/IP) | 5 calls succeed, 70th fails 429 |
| Anon SELECT `book.bookings?public_token=eq.X` | ALLOW (1 row) | known token returns 1, unknown returns 0 |
| Anon SELECT `book.bookings` no token filter | DENY | always empty regardless of auth |
| Authenticated SELECT `pricing.pricelist` | ALLOW | session JWT |
| Authenticated UPDATE `pricing.pricelist` | DENY | service_role only |

### 3.3 Production

Only after staging validates AND smoke test passes AND PBS signs off in `06-prod-deploy-approval.md`. Same SQL files; replace `SUPABASE_STAGING_DB_URL` with `SUPABASE_PROD_DB_URL`.

### 3.4 Rollback (if needed)

```bash
psql $SUPABASE_DB_URL \
  -f migrations/pending/20260504000000_retreat_compiler_init_a1b2c3d4_rollback.sql
```

Drops all new tables CASCADE. Does **not** affect existing `public.*`, `marketing.*`, `gl.*`, `guest.*`. Verify `pgrst.db_schemas` resets cleanly.

---

## 4. Vercel — project setup

### 4.1 New project or existing?

Existing `cloudbeds-vercel-portal` project. Add subdomain routing in middleware.ts.

### 4.2 Build settings

| Setting | Value |
|---|---|
| Framework | Next.js |
| Node version | 20.x |
| Build command | `pnpm build` |
| Output directory | `.next` |
| Install command | `pnpm install --frozen-lockfile` |
| Root directory | `/` |
| Function memory | 1024 MB (PDF rendering) |
| Function max duration | 60 s (PDF rendering, compiler runs) |
| Edge functions | tracking pixel, OG image |

### 4.3 Domains to map

| Domain | Type | Site type |
|---|---|---|
| `thenamkhan.com` | Apex | `web.sites.site_type = 'root'` |
| `www.thenamkhan.com` | 301 → apex | redirect |
| `mindfulness-summer.thenamkhan.com` | Subdomain (wildcard) | `site_type = 'retreat'` |
| `*.thenamkhan.com` | Wildcard SSL | future retreats |
| `try.thenamkhan.com` | Subdomain | `site_type = 'campaign'` |
| `donnaportals.com` | (v1.1 — Donna fork) | reserved |

Wildcard SSL via Cloudflare → Vercel Custom Domains. SSL provisioning ~5 min per new subdomain.

### 4.4 Environment variables (set in Vercel dashboard)

Three environments: `Development`, `Preview`, `Production`. Production gets the prod values; preview gets staging. Development is local only — `.env.local`.

---

## 5. Cloudflare — DNS + cache

### 5.1 Records (root site)

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `@` | `76.76.21.21` (Vercel) | Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | Proxied |
| CNAME | `*` | `cname.vercel-dns.com` | Proxied (wildcard subdomain → Vercel) |
| TXT | `_vercel` | (verification token from Vercel) | DNS only |
| MX | (existing — don't touch) | — | — |

### 5.2 Page rules / cache

| Match | Rule |
|---|---|
| `*.thenamkhan.com/*` | Standard cache; bypass on cookie `_vercel_jwt` |
| `*.thenamkhan.com/api/*` | Bypass cache (every request hits origin) |
| `*.thenamkhan.com/r/*` | Cache 5 min on edge, revalidate on deploy |
| `*.thenamkhan.com/_next/static/*` | Cache 1 year (immutable) |
| `*.thenamkhan.com/og-image/*` | Cache 7 days |

### 5.3 Cache purge on deploy

Make scenario `compiler.deploy` triggers Cloudflare API to purge `https://{subdomain}.thenamkhan.com/r/{slug}*` after Vercel deploy completes.

---

## 6. Stripe — products + webhooks

### 6.1 Products to create (one-time setup)

Create as **Stripe products with metadata-driven pricing** — not one product per retreat.

| Product | metadata | Price |
|---|---|---|
| `Retreat Booking — Deposit` | `property=namkhan`, `type=deposit` | dynamic |
| `Retreat Booking — Balance` | `property=namkhan`, `type=balance` | dynamic |
| `Retreat Add-on` | `property=namkhan`, `type=addon` | dynamic |
| `Retreat Refund` | `property=namkhan`, `type=refund` | dynamic |

Dynamic pricing means each `book.bookings` row creates a Stripe Checkout Session with a custom `price_data` block. No SKU explosion in Stripe.

### 6.2 Webhook endpoints

| Endpoint | Events | Notes |
|---|---|---|
| `https://thenamkhan.com/api/checkout/webhook` | `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded` | Idempotent on `stripe_event_id`; signed with `STRIPE_WEBHOOK_SECRET` |
| `https://thenamkhan.com/api/checkout/balance-webhook` | `invoice.paid`, `invoice.payment_failed` | For 70% balance auto-charge |

### 6.3 Payment plan

- 30% deposit charged at booking (Stripe Checkout Session)
- 70% balance scheduled via `payment_intent` for `arrival_date - 30 days`, charged via cron + webhook. Stored as `book.payments` row with `scheduled_for`.
- Cancellation: refund logic per `book.cancellations` rules — not in Stripe automation, in our webhook handler.

### 6.4 Topology decision required

**Open question:** one Stripe account + property metadata, OR separate accounts per property (Namkhan vs Donna).

**Default chosen:** one Stripe account, property metadata. Reconciliation simpler in `book.payments` queries. If Donna needs separate fiscal entity, add second account in v1.1.

---

## 7. Cloudbeds — bridge

### 7.1 What's already in place

`lib/pricing.ts` + `public.rate_inventory` synced by `cb_sync_*` jobs (existing, nothing new).

### 7.2 What we add

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /api/cb/availability` | Read room availability + rates per date range | session |
| `POST /api/cb/reserve` | Create reservation on Stripe webhook success | service-only (called from webhook handler) |
| `POST /api/cb/cancel` | Cancel reservation on `book.cancellations` insert | service-only |
| `GET /api/cb/reconcile` | Nightly job — diff `book.bookings` vs Cloudbeds reservations | service-only (cron) |

### 7.3 Reservation reconcile cron

Nightly 02:00 Asia/Vientiane. Diff `book.bookings.cloudbeds_reservation_id IS NOT NULL` against Cloudbeds API. Flag mismatches in `book.reconcile_alerts` table (add to migration, see §3 — already in `04a-schema-plan.md` §5.3 cancellations + per parent §11 sidecar).

---

## 8. Make.com — scenarios

### 8.1 Five scenarios

| Scenario | Trigger | Actions |
|---|---|---|
| `compiler.run_complete` | Webhook from `/api/compiler/runs/[id]/render` | Slack ping operator + email link |
| `compiler.deploy` | Webhook from `/api/compiler/runs/[id]/deploy` | Vercel deploy hook + Cloudflare cache purge + Slack |
| `lead.captured` | Webhook from `/api/lead/capture` | Klaviyo profile create + add to series list + Slack desk |
| `booking.deposit_paid` | Webhook from Stripe handler | Cloudbeds reserve + Slack ping owner + Klaviyo "Booked" event |
| `booking.balance_due` | Cron 30 days pre-arrival | Stripe charge + reminder email |

### 8.2 Make → Cloudbeds + Klaviyo modules

- Cloudbeds: HTTP module (Cloudbeds doesn't have a native Make app); use stored OAuth token from Vercel env
- Klaviyo: native Make module exists, use it
- Stripe: native Make module
- Slack: native Make module
- Vercel: HTTP to Deploy Hook URL
- Cloudflare: HTTP to Purge URL

### 8.3 Blueprint files

`05-make/make-scenarios.json` — exported blueprints, importable via Make UI ONE AT A TIME.

**Per SKILL.md:** Claude does NOT auto-import. Operator imports each scenario in the Make UI manually, sets Make-side connections (Cloudbeds OAuth, Klaviyo, Stripe, Slack channels) per scenario.

### 8.4 HMAC verification

Every scenario verifies `MAKE_WEBHOOK_SECRET` HMAC on inbound payloads from app. App computes HMAC on outbound. Per SKILL.md security: never trust unsigned webhooks.

---

## 9. Klaviyo — flows + lists

### 9.1 Flows to create (manual setup)

| Flow | Trigger | Purpose | Emails |
|---|---|---|---|
| Welcome — Mindful River | List subscribe `Series · Mindfulness` | Lead nurture | 8 touches over 21 days |
| Welcome — River Tales | List subscribe `Series · River Tales` | Lead nurture | 6 touches over 14 days |
| Welcome — Retreat Life | List subscribe `Series · Retreat Life` | Lead nurture | 6 touches over 14 days |
| Welcome — Detox | List subscribe `Series · Detox` | Lead nurture | 6 touches over 14 days |
| Booking confirmation | Event `Booked Retreat` | Pre-arrival sequence | confirm + 30/14/7/1 day pre-arrival reminders |
| Pre-arrival packing | 14 days before `arrival_date` | What to bring + flights advice | 1 |
| Post-stay NPS | 3 days after `departure_date` | Review request + alumni discount | 2 |
| Win-back | No engagement 90 days | Re-engagement | 3 over 30 days |
| Lunar alert | Event `Full Moon` (cron) | Series=Mindfulness lunar opt-ins only | 1 per moon |

### 9.2 Lists + segments

| List | Members |
|---|---|
| `All Subscribers` | every consenting `web.subscribers` |
| `Series · Mindfulness` | subscribers with `mindfulness` in `interest_series` |
| `Series · River Tales` | … |
| `Series · Retreat Life` | … |
| `Series · Detox` | … |
| `Customers — Booked` | `lifecycle_stage IN ('customer','alumni')` |
| `Alumni — Repeat Eligible` | booked >90 days ago, no recent booking |
| `EU Residents` | `country IN (eu_27_codes)` — for double opt-in legal |

### 9.3 Lifecycle sync direction

`web.subscribers.lifecycle_stage` is source of truth → Klaviyo lists mirrored from it via Make scenario nightly. Reverse (Klaviyo → web) only for opens/clicks/bounces.

---

## 10. Vercel deploy commands

### 10.1 Staging

```bash
# from repo root
vercel link --project=cloudbeds-vercel-portal
vercel pull --environment=preview
vercel build
vercel deploy --prebuilt
# → https://cloudbeds-vercel-portal-{hash}-paulbauer.vercel.app
```

### 10.2 Production

```bash
vercel pull --environment=production
vercel build --prod
vercel deploy --prebuilt --prod
# → https://thenamkhan.com (after domain alias)
```

### 10.3 Per-retreat subdomain alias

Each `compiler.deploys` insert calls Vercel API to alias `{subdomain}.thenamkhan.com` to the latest production deployment. Cloudflare wildcard already handles SSL.

```bash
vercel alias set $LATEST_PROD_URL mindfulness-summer.thenamkhan.com
```

This is in the deploy Make scenario, not manual.

---

## 11. Pre-deploy checklist (run before any `vercel deploy --prod`)

| ☐ | Check |
|---|---|
| ☐ | `pnpm build` passes locally with no warnings |
| ☐ | All migrations applied to staging successfully |
| ☐ | RLS test plan all green on staging |
| ☐ | Smoke test plan completed on staging (§13) |
| ☐ | Stripe in test mode on staging, live mode env vars NOT in staging |
| ☐ | Klaviyo flows manually tested on staging account |
| ☐ | Make scenarios imported, connections configured, HMAC verified |
| ☐ | Cloudflare DNS records propagated (check `dig`) |
| ☐ | All env vars set in Vercel for Production environment |
| ☐ | `02-prototype.html` review completed by PBS |
| ☐ | Margin floors set correctly in env (35 / 60 / 70) |
| ☐ | Sheet sync run successful (catalog tables seeded) |
| ☐ | `content.lunar_events` covers next 24 months |
| ☐ | Series taxonomy approved by PBS (placeholder seed replaced) |
| ☐ | Legal pages (privacy / terms / waiver / accessibility) reviewed by counsel |
| ☐ | GDPR double opt-in flow tested with EU IP |
| ☐ | Sentry / log monitoring active |
| ☐ | Slack channel `#retreat-compiler-prod` created and Make scenarios point at it |
| ☐ | Owner phone number set for booking-paid Slack ping |
| ☐ | Backup of prod DB taken pre-migration |
| ☐ | Rollback runbook reviewed |

---

## 12. Smoke test plan (run on staging before prod, on prod within 15 min after deploy)

| # | Test | Expected |
|---|---|---|
| 1 | Hit home page | 200, hero loads, 3 retreat cards listed |
| 2 | Hit `/r/mindfulness-summer` | 200, hero, sticky pricing card, FAQ |
| 3 | Hit `/r/mindfulness-summer/configure` | 200, default config loads, total = $2,290 |
| 4 | Toggle off "Sound bath" | total recalcs to $1,810 (= $2,290 − $480) |
| 5 | Toggle on "Spa pack" | total recalcs upward |
| 6 | Switch room from River Suite to Garden | total recalcs downward |
| 7 | Submit configurator form | redirects to `/checkout?config_id=…` |
| 8 | Hit `/r/mindfulness-summer/checkout` | Stripe Checkout Session opens |
| 9 | Pay with test card `4242 4242 4242 4242` | webhook fires; `book.bookings` row appears with status `deposit_paid` |
| 10 | Cloudbeds reservation appears in CB dashboard | yes, with reservation ID populated in `book.bookings.cloudbeds_reservation_id` |
| 11 | Klaviyo profile created with metadata | `interest_series=mindfulness`, `booking_count=1` |
| 12 | Pre-arrival flow triggered | first email queued in Klaviyo |
| 13 | Submit lead-magnet form `/free/mindful-river` | profile created with `lifecycle_stage=new`, double opt-in email sent |
| 14 | Click double opt-in link | `web.consents.double_opt_in_confirmed_at` populates, welcome email triggers |
| 15 | Hit operator `/sales/retreats/mindfulness-summer/edit` | live editor loads |
| 16 | Edit hero copy → save | `web.pages_history` row inserted, public page reflects change within 60s |
| 17 | Click "Re-compile" with no real changes | new `compiler.runs` row, supersedes previous, public URL still resolves |
| 18 | Hit `/c/spring-mindfulness-2026` | A/B variant served, `web.events` event_type=campaign_landing logged |
| 19 | Hit `/sitemap.xml` | XML returns with all live retreats + posts |
| 20 | Cancel a booking via operator UI | refund flows per cancellation policy, Cloudbeds reservation cancelled, `book.cancellations` row inserted |

If any test fails on prod within 15 min: run `runbooks/rollback.md`.

---

## 13. Rollback runbook (summary; full in `11-runbooks/rollback.md`)

| Failure | Action | Time to recover |
|---|---|---|
| Vercel deploy ships broken JS | `vercel rollback` to previous deployment | 30 sec |
| Migration corrupted prod data | Apply rollback SQL, restore from backup if needed | 10 min – 2 hr |
| Stripe webhook misconfigured | Re-add endpoint with new secret, replay events from Stripe dashboard | 15 min |
| Cloudbeds reservation drift | Run `/api/cb/reconcile` manually + alert PBS | 30 min |
| Klaviyo flooding subscribers | Pause flow in Klaviyo UI, fix Make scenario, resume | 5 min |
| Cloudflare cache serving stale | Cloudflare → Purge Everything | 30 sec |
| RLS too restrictive (legitimate users blocked) | Apply emergency policy patch, alert | 5 min |
| RLS too loose (data leak risk) | Disable RLS bypass, force re-deploy of policies | 15 min, **incident** |

Every rollback action logged in `incident-log.md` (also tracked).

---

## 14. Operator day-to-day runbook

| Task | Path | Frequency |
|---|---|---|
| Compile new retreat | `/compiler` | Per launch |
| Edit live retreat hero/copy | `/sales/retreats/[slug]/edit` | Ad-hoc |
| Re-compile retreat | `/sales/retreats/[slug]/recompile` | When prices/dates change |
| Approve margin override | `/sales/overrides` | Per breach |
| Create campaign | `/sales/campaigns/new` | Per launch |
| Review pipeline / bookings | `/sales/inquiries` + `/sales/bookings` | Daily |
| Reconcile Cloudbeds | nightly cron, alerts only | Auto |
| Refund booking | `/sales/bookings/[id]/cancel` | Ad-hoc |
| Add new vendor | `/sales/vendors` (or seed via Sheet) | Rare |
| Add new activity | seed via Sheet (then sync) | Per offering change |
| Update season multipliers | `/sales/seasons` | Per season turn |
| Lock new FX rate | nightly cron, manual override `/sales/fx` | Per FX event |

---

## 15. Sandbox limitation — handoff folder

Target `~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/` is outside the sandbox. Mirror created at:

```
/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/feature-builder/output/retreat-compiler/handoff/
```

Operator step: copy or symlink that folder to the Desktop path:

```bash
mkdir -p ~/Desktop/namkhan-bi/to-vercel-production
cp -R \
  "/Users/paulbauer/Documents/Claude/Projects/cloudbeds Vercel portal/feature-builder/output/retreat-compiler/handoff/" \
  ~/Desktop/namkhan-bi/to-vercel-production/retreat-compiler/
```

Or update SKILL.md to point handoff at the in-repo path going forward (recommended — Desktop is fragile).

---

## 16. Cost forecast

### 16.1 Monthly run cost (steady-state, per property)

| Service | Tier | Cost/mo |
|---|---|---|
| Vercel | Pro | $20 (one team account; includes preview envs) |
| Supabase | Pro | $25 (includes 8 GB DB, daily backups) |
| Cloudflare | Pro | $20 |
| Resend | Free | $0 (under 3k/mo transactional) |
| Klaviyo | Email 1k contacts | $30 |
| Stripe | per-tx | 1.4% + €0.25 (variable, baked into pricing) |
| Anthropic API (compiler) | per-run | ~$0.20 × 50 runs/mo = $10 |
| Cloudbeds API | included in Cloudbeds subscription | $0 |
| Sentry | Free | $0 (under 5k errors) |
| Make.com | Core | $9 |
| 1Password | already exists | $0 |
| **Total fixed** | | **~$114/mo** |
| **Stripe variable** | per booking | ~$30 per $2,290 booking |

### 16.2 Per-retreat compile cost

- Compiler model usage: ~€0.18 per run (within €0.20 cap)
- PDF render (Puppeteer): ~€0.001 (Vercel function cycles)
- Vercel deploy: free
- Cloudflare DNS update: free
- Klaviyo flow setup: included in tier

### 16.3 At scale (10 retreats live, 200 bookings/mo)

| | $/mo |
|---|---|
| Fixed | $114 |
| Klaviyo (10k contacts) | $150 |
| Stripe fees (200 × $30) | $6,000 (taken from gross revenue, not opex) |
| Vercel scale fees | +$50 if function hours exceed Pro tier |
| **Operating** | **~$314/mo** |

---

## 17. Open items still blocking prod (gate before §11 checklist)

1. **Sheet "Namkhan Packages 1.2"** — Sheets MCP still not connected. Seed for `catalog.activities`, `spa_treatments`, `fnb_items`, `pricelist` cannot land. Workaround: paste CSV exports into `feature-builder/output/retreat-compiler/sheet-snapshot/` for one-time seed.
2. **Series taxonomy + lunar dates** — placeholder seed in migration. PBS-approved list needed before Mindfulness/Retreat Life campaigns ship.
3. **Stripe topology decision** — defaulted to single account + property metadata. PBS confirm or override.
4. **Legal pages** — placeholder seed. Counsel review of privacy / terms / waiver / accessibility before EU traffic ships.
5. **Cloudbeds property ID** — placeholder `12345` in env example. Confirm real ID.
6. **Domain ownership** — `thenamkhan.com` and `donnaportals.com` confirmed registered, transferred to Cloudflare?
7. **GDPR DPA** — required if processing EU resident data. Klaviyo has a DPA template; sign and store.
8. **Backup strategy for prod DB** — Supabase Pro includes daily; confirm RTO/RPO meets needs.

---

## 18. Stage 4 sign-off

PBS executes:

```
05-deploy-package.md REVIEWED: ✅ / ❌
00-PRE-DEPLOY-CHECKLIST.md COMPLETED: ✅ / ❌
RLS TESTS GREEN (staging): ✅ / ❌
SMOKE TEST GREEN (staging): ✅ / ❌
PROD DEPLOY APPROVED: ✅ / ❌
DEPLOY DATE/TIME (Asia/Vientiane): ____________
EXECUTED BY: PBS / ____________
ROLLBACK WINDOW: 24 hours
```

Once PBS sets PROD DEPLOY APPROVED, runbook `runbooks/deploy-production.md` is executed by PBS (not Claude).

---

## 19. What's NOT in v1 (v1.1+ defer list)

- Multi-language (FR/DE/LO)
- Donna fork
- Native iOS/Android (PWA only)
- Group lead-time discounts (≥6 pax automated)
- WhatsApp Business API outbound
- E-signature waivers (DocuSign Click)
- Multi-property reporting dashboard
- Affiliate / referral program
- Loyalty / alumni discounts beyond email coupon codes
- Native video hosting (Vimeo embed only v1)

---

**End of deploy doc.**
Next: PBS reviews, sets `PROD DEPLOY APPROVED`, executes `runbooks/deploy-production.md`. Pipeline ends here for Claude.
