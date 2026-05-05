# Pre-Deploy Checklist · retreat-compiler

Run before `vercel deploy --prod`. Halt on any unchecked item.

## A. Code

| ☐ | Item |
|---|---|
| ☐ | `pnpm typecheck` clean |
| ☐ | `pnpm lint` clean |
| ☐ | `pnpm build` clean (no warnings) |
| ☐ | `pnpm test --run` green |
| ☐ | E2E smoke run on Playwright local — green |
| ☐ | PR reviewed by PBS or designated reviewer |
| ☐ | No `console.log`, no `// TODO HACK`, no leftover scaffolding |

## B. Database

| ☐ | Item |
|---|---|
| ☐ | Forward migration applied to staging cleanly |
| ☐ | Rollback migration tested on staging copy |
| ☐ | Seed migration applied to staging cleanly |
| ☐ | Validate query all checks pass |
| ☐ | RLS test plan all green on staging |
| ☐ | Prod DB backup taken within last 4 hr |
| ☐ | `pgrst.db_schemas` merge re-run if other sessions added schemas |

## C. Environment

| ☐ | Item |
|---|---|
| ☐ | All Vercel Production env vars set per `.env.example` |
| ☐ | All secrets in 1Password vault `Namkhan Production` |
| ☐ | `STRIPE_SECRET_KEY` is `sk_live_*` in prod, `sk_test_*` in staging |
| ☐ | `KLAVIYO_PRIVATE_KEY` is live in prod, sandbox in staging |
| ☐ | `CLOUDBEDS_PROPERTY_ID` confirmed real ID (not placeholder) |
| ☐ | `MAKE_WEBHOOK_SECRET` matches Vercel + Make UI |
| ☐ | `CRON_SECRET` set |
| ☐ | `NEXT_PUBLIC_*` URLs match production domain |

## D. Stripe

| ☐ | Item |
|---|---|
| ☐ | 4 products created with metadata (`property=namkhan`, `type=*`) |
| ☐ | Live-mode webhook endpoint at `/api/checkout/webhook` |
| ☐ | Live-mode webhook signing secret in Vercel env |
| ☐ | Balance webhook endpoint at `/api/checkout/balance-webhook` |
| ☐ | Customer portal enabled with branding |
| ☐ | Tax settings reviewed |
| ☐ | Test card flow ran on staging |
| ☐ | 3DS card flow ran on staging |
| ☐ | Refund flow ran on staging |

## E. Cloudbeds

| ☐ | Item |
|---|---|
| ☐ | OAuth refresh token captured |
| ☐ | `public.rate_inventory` syncing live (last sync within 30 min) |
| ☐ | `lib/pricing.ts` reads correctly on staging |
| ☐ | Test reservation created → flowed to Cloudbeds dashboard |
| ☐ | Reconcile cron tested with dry-run |

## F. Klaviyo

| ☐ | Item |
|---|---|
| ☐ | 8 lists created with IDs in env vars |
| ☐ | 9 flows created and tested with dummy profile |
| ☐ | Welcome — Mindful River first email sent + received |
| ☐ | Booking confirmation flow tested |
| ☐ | Sender domain verified (DKIM + SPF) |
| ☐ | Preference center deployed |
| ☐ | DPA signed |

## G. Make

| ☐ | Item |
|---|---|
| ☐ | 5 scenarios imported from blueprint JSON |
| ☐ | Each scenario's connections set (Klaviyo / Stripe / Slack / Cloudbeds) |
| ☐ | HMAC verification confirmed working |
| ☐ | Each scenario tested with synthetic event |
| ☐ | Slack channels created and bots invited |
| ☐ | All scenarios activated |

## H. Cloudflare

| ☐ | Item |
|---|---|
| ☐ | DNS records per `09-cloudflare/dns-records.md` |
| ☐ | Wildcard SSL provisioned |
| ☐ | Page rules / cache rules applied |
| ☐ | Bot Fight Mode ON |
| ☐ | Rate limits configured per `/api/*` |
| ☐ | DKIM + SPF records for Resend + Klaviyo |
| ☐ | DMARC record (`p=quarantine`) |

## I. Vercel

| ☐ | Item |
|---|---|
| ☐ | `vercel.json` committed |
| ☐ | Build settings match (Node 20, pnpm) |
| ☐ | Production environment env complete |
| ☐ | Custom domains mapped (`thenamkhan.com`, `*.thenamkhan.com`) |
| ☐ | Cron jobs visible in Vercel UI |

## J. Content

| ☐ | Item |
|---|---|
| ☐ | Sheet "Namkhan Packages 1.2" synced to `catalog.*` and `pricing.pricelist` |
| ☐ | `content.series` 4 rows seeded |
| ☐ | `content.lunar_events` covers next 24+ months |
| ☐ | `content.usali_categories` mirrors `gl.classes` |
| ☐ | `content.legal_pages` reviewed by counsel (replace placeholders!) |
| ☐ | At least 1 retreat published (`web.retreats.status='published'`) |
| ☐ | Hero imagery in `marketing.campaign_assets` |
| ☐ | At least 3 journal posts live (for `/journal` page) |

## K. Compliance

| ☐ | Item |
|---|---|
| ☐ | GDPR double opt-in tested with EU IP |
| ☐ | Cookie consent banner tested |
| ☐ | Privacy / Terms / Waiver / Accessibility pages reviewed by counsel |
| ☐ | Sender domain SPF/DKIM/DMARC pass |
| ☐ | Klaviyo DPA signed |
| ☐ | Cloudbeds DPA referenced in privacy policy |

## L. Monitoring

| ☐ | Item |
|---|---|
| ☐ | Sentry project created (`namkhan-retreat-compiler`) |
| ☐ | Sentry DSN in Vercel env |
| ☐ | Alert rules: API p95 >800ms, error rate >2% |
| ☐ | Slack `#retreat-compiler-prod` created |
| ☐ | Make alert routing → Slack |
| ☐ | Vercel deploy notifications → Slack |
| ☐ | Owner phone number for booking-paid Slack ping confirmed |

## M. Operations

| ☐ | Item |
|---|---|
| ☐ | `runbooks/deploy-production.md` reviewed by PBS |
| ☐ | `runbooks/rollback.md` reviewed by PBS |
| ☐ | `runbooks/operator-day-to-day.md` shared with sales team |
| ☐ | 24-hour rollback window blocked on PBS calendar |
| ☐ | On-call rotation set (PBS for v1) |
| ☐ | Backup of prod DB taken pre-deploy |

## N. Final

| ☐ | Item |
|---|---|
| ☐ | All open questions in `01-brief.md` resolved (or accepted as v1.1) |
| ☐ | Stripe topology decision confirmed (single account default) |
| ☐ | Subdomain strategy confirmed (root v1.0, retreat subdomains v1.1) |
| ☐ | `03-approval.md` reflects current scope |
| ☐ | Smoke test plan (`99-tests/smoke-test-plan.md`) ready to run post-deploy |

## Sign-off

```
ALL ITEMS CHECKED: ✅
DEPLOYED TO PROD BY: PBS
DATE: 2026-05-DD HH:MM Asia/Vientiane
ROLLBACK WINDOW: 24 hours
NEXT REVIEW: 24h post-deploy
```
