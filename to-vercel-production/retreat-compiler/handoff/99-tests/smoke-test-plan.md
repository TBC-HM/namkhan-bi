# Smoke Test Plan · retreat-compiler

**Run on:** staging before prod sign-off · prod within 15 min of deploy
**Tooling:** browser + `curl` + Stripe CLI + Cloudbeds dashboard + Klaviyo
**Time:** ~30 min for full pass

If any test fails on prod within 15 min → run `runbooks/rollback.md`.

## A. Public site

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Home loads | `GET https://thenamkhan.com/` | 200, hero renders, retreats list shows 1+ live retreat |
| 2 | Retreat detail | `GET /r/mindfulness-summer` | 200, hero/pricing/FAQ render, sticky CTA visible |
| 3 | Sitemap | `GET /sitemap.xml` | 200 XML, includes all live retreats + posts |
| 4 | Robots | `GET /robots.txt` | 200, allows public, disallows /sales/* /api/* |
| 5 | RSS | `GET /rss.xml` | 200, valid feed with recent journal posts |
| 6 | OG image | `GET /og-image/r/mindfulness-summer.png` | 200 PNG, ~1200×630 |
| 7 | Lunar calendar | `GET /lunar` | 200, shows next 12 months of full moons |
| 8 | Series hub | `GET /series/mindfulness` | 200, hub page with related retreats |
| 9 | Legal page | `GET /privacy` | 200, content from `content.legal_pages` |
| 10 | 404 page | `GET /nonexistent-page-xyz` | 404 with branded layout |

## B. Configurator

| # | Test | Steps | Expected |
|---|---|---|---|
| 11 | Configurator loads | `GET /r/mindfulness-summer/configure` | 200, default config = $2,290 total |
| 12 | Quote API · default | `POST /api/r/mindfulness-summer/quote` body `{}` | 200, `total_usd: 2290`, `marginCheck: pass` |
| 13 | Toggle off Sound bath | `POST /api/r/.../quote` body `{programSkus: ["nmk-cer-002","nmk-cer-008","nmk-trn-001"]}` (drop NMK-SPA-019) | total decreases by ~$480 |
| 14 | Switch room to Garden | `POST` body `{roomTypeId: "garden"}` | total decreases ~$1,200 |
| 15 | Switch board to Half | `POST` body `{boardLevel: "half"}` | total decreases ~$240 |
| 16 | Margin floor breach attempt | `POST` body simulating sub-floor combo | API returns 200 with `marginCheck: 'auto_raised'` and silently raised total |
| 17 | Save share link | `POST /api/r/mindfulness-summer/configure/save` body `{config:{}}` | 200, `shareToken`, `shareUrl: /r/.../configure?t=<token>` |
| 18 | Reload share link | `GET /r/mindfulness-summer/configure?t=<token>` | 200, configuration restored |

## C. Checkout

| # | Test | Steps | Expected |
|---|---|---|---|
| 19 | Lead magnet · EU IP | `POST /api/lead/capture` body `{email:"smoke-eu@example.com",country:"DE"}` from EU IP (use VPN or x-forwarded-for header) | 200, `optInRequired:true`, double-opt-in email sent |
| 20 | Lead magnet · non-EU | same with `country:"SG"` | 200, `optInRequired:false`, immediate Klaviyo profile |
| 21 | Confirm DOI link | `GET /api/lead/confirm/<token>` | 200 confirmation page, `web.consents.double_opt_in_confirmed_at` set |
| 22 | Checkout session | `POST /api/checkout/session` valid body | 200, `checkoutUrl`, booking row inserted with status `held` |
| 23 | Stripe test card | Pay with `4242 4242 4242 4242` | webhook fires, booking status → `deposit_paid` |
| 24 | Stripe SCA card | Pay with `4000 0027 6000 3184` | 3DS challenge appears + completes |
| 25 | Cloudbeds reservation | After §23 completes | Cloudbeds dashboard shows reservation, `book.bookings.cloudbeds_reservation_id` populated within 60s |
| 26 | Klaviyo profile | After §23 | Klaviyo profile shows `Booked Retreat` event |
| 27 | Pre-arrival flow | After §23 | Klaviyo flow `Booking confirmation` fired, first email queued |
| 28 | Refund flow | Refund test charge in Stripe dashboard | webhook fires, `book.cancellations` row inserted |

## D. Operator side

| # | Test | Steps | Expected |
|---|---|---|---|
| 29 | Compiler home | `GET /compiler` (auth) | 200, recent runs list, prompt input |
| 30 | Compile prompt | Submit `5 day mindfulness retreat — lux only — green season — 8 pax` | run created, animation plays, lands on `/result` with 3 variants |
| 31 | Variant detail | Click variant B | day-by-day shows, USALI split visible, margin all-clear |
| 32 | Edit itinerary | Click `edit itinerary`, change Day 2 PM | save → recomputed total updates |
| 33 | Render PDF + funnel | Click `render PDF + funnel →` | preview tabs show; PDF stored to Vercel Blob |
| 34 | Pick design + deploy | Click design B → `Ship it →` | Vercel deploy fires, subdomain alias created |
| 35 | Live retreat editor | `GET /sales/retreats/mindfulness-summer/edit` | 200, edit form loads |
| 36 | Live edit hero copy | Change tagline, save | `web.pages_history` row inserted, public page reflects within 60s |
| 37 | Re-compile | Click `Re-compile` | new `compiler.runs` row, supersedes previous; public URL still resolves |
| 38 | Edit history | `GET /sales/retreats/mindfulness-summer/history` | shows last 10 edits with revert buttons |
| 39 | Revert edit | Click revert on last edit | original value restored, new history row created |

## E. Campaigns

| # | Test | Steps | Expected |
|---|---|---|---|
| 40 | Campaign create | `/sales/campaigns/new` → fill form | campaign created, A/B/C variant pages created |
| 41 | Campaign landing | `GET /c/spring-mindfulness-2026` | 200, A/B variant served per cookie, `web.events` event_type=campaign_landing logged |
| 42 | UTM persistence | Visit with `?utm_source=google&utm_campaign=spring` | UTM cookie set, propagated to subsequent page views |
| 43 | A/B variant assignment | Hard-refresh 5x | same variant served (cookie sticky) |

## F. Cron + monitoring

| # | Test | Steps | Expected |
|---|---|---|---|
| 44 | Health check | `GET /api/system/health` | 200, all services reachable |
| 45 | Cloudbeds reconcile | `GET /api/cb/reconcile?dry_run=true` (cron secret header) | 200, returns count of bookings checked |
| 46 | FX lock cron | `GET /api/cron/fx-lock` (cron secret header) | 200, new `pricing.fx_locks` row inserted |

## G. Performance + accessibility

| # | Test | Tool | Expected |
|---|---|---|---|
| 47 | LCP home | Lighthouse | < 1.5s mobile, < 1.0s desktop |
| 48 | LCP retreat detail | Lighthouse | < 1.8s mobile |
| 49 | Configurator TTI | Lighthouse | < 2.5s |
| 50 | Accessibility | Lighthouse | a11y score ≥ 95 on home + retreat detail |
| 51 | Cumulative layout shift | Lighthouse | < 0.1 |

## Pass criteria

All 51 tests must pass on prod within 15 min of deploy. Any fail → rollback.
