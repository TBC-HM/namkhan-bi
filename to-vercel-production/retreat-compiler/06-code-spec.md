# 06 — Code Spec · retreat-compiler (Stage 3)

**Approved scope:** rev 1 (2026-05-04)
**Branch:** `feat/retreat-compiler` off `main`
**Owner:** PBS

This is what to build. Components, API contracts, routes, file paths, contracts. Engineer or Claude Code drives the implementation against this spec.

---

## 1. File structure

```
app/
├── (root)/
│   ├── layout.tsx                       multi-site theme provider, host header → site_id
│   ├── page.tsx                         home (list of live retreats)
│   ├── retreats/page.tsx                list view
│   ├── series/[slug]/page.tsx           series hub
│   ├── journal/page.tsx                 blog index
│   ├── journal/[slug]/page.tsx          blog post
│   ├── lunar/page.tsx                   lunar calendar
│   ├── about/page.tsx
│   ├── about/team/page.tsx
│   ├── press/page.tsx
│   ├── contact/page.tsx
│   ├── faq/page.tsx
│   ├── (legal)/privacy/page.tsx
│   ├── (legal)/terms/page.tsx
│   ├── (legal)/waiver/page.tsx
│   ├── (legal)/accessibility/page.tsx
│   └── (legal)/cookies/page.tsx
├── r/[slug]/
│   ├── page.tsx                         retreat detail (SSR, ISR 5 min)
│   ├── configure/page.tsx               configurator (SSR initial, client recalc)
│   ├── checkout/page.tsx                checkout (Stripe Element)
│   └── thanks/page.tsx                  booked confirmation
├── c/[campaign-slug]/page.tsx           campaign landing (A/B/C aware via cookie)
├── free/[slug]/page.tsx                 lead magnet
├── compiler/
│   ├── page.tsx                         home (existing, keep)
│   ├── [run_id]/page.tsx                variant comparison
│   ├── [run_id]/edit/page.tsx           itinerary editor
│   ├── [run_id]/preview/page.tsx        PDF + funnel preview
│   └── [run_id]/deploy/page.tsx         design + deploy
├── sales/
│   ├── retreats/page.tsx                live retreats list
│   ├── retreats/[slug]/edit/page.tsx    live editor (no recompile)
│   ├── retreats/[slug]/recompile/page.tsx
│   ├── retreats/[slug]/history/page.tsx edit history + rollback
│   ├── campaigns/page.tsx
│   ├── campaigns/new/page.tsx
│   ├── campaigns/[id]/page.tsx
│   ├── overrides/page.tsx               margin override approvals
│   ├── seasons/page.tsx
│   ├── fx/page.tsx
│   └── vendors/page.tsx
├── api/
│   ├── compiler/
│   │   ├── parse/route.ts               POST · prompt → spec
│   │   ├── build/route.ts               POST · cost-stack + variants
│   │   ├── runs/[id]/route.ts           GET
│   │   ├── runs/[id]/itinerary/route.ts PATCH
│   │   ├── runs/[id]/render/route.ts    POST · Puppeteer
│   │   └── runs/[id]/deploy/route.ts    POST · Vercel API + DNS
│   ├── r/
│   │   ├── [slug]/quote/route.ts        POST · live config quote
│   │   ├── [slug]/configure/save/route.ts POST · share-link
│   │   └── [slug]/og/route.ts           GET · OG image
│   ├── lead/capture/route.ts            POST · anon RPC web.capture_lead
│   ├── lead/confirm/[token]/route.ts    GET · double opt-in confirmation
│   ├── checkout/
│   │   ├── session/route.ts             POST · Stripe Session
│   │   ├── webhook/route.ts             POST · Stripe webhook
│   │   └── balance-webhook/route.ts     POST · invoice webhook
│   ├── cb/
│   │   ├── availability/route.ts        GET · room avail + rates
│   │   ├── reserve/route.ts             POST · service-only
│   │   ├── cancel/route.ts              POST · service-only
│   │   └── reconcile/route.ts           GET · cron
│   ├── sales/
│   │   ├── retreats/[slug]/edit/route.ts  PATCH · live edit
│   │   ├── retreats/[slug]/recompile/route.ts POST · new run, supersede
│   │   ├── retreats/[slug]/history/[h_id]/revert/route.ts POST
│   │   ├── overrides/[id]/approve/route.ts POST
│   │   └── campaigns/[id]/launch/route.ts POST
│   ├── make/
│   │   ├── compiler-run-complete/route.ts POST out (Make webhook)
│   │   ├── compiler-deploy/route.ts     POST out
│   │   ├── lead-captured/route.ts       POST out
│   │   ├── booking-deposit-paid/route.ts POST out
│   │   └── booking-balance-due/route.ts POST out (cron)
│   └── system/
│       ├── sitemap.xml/route.ts
│       ├── robots.txt/route.ts
│       ├── rss.xml/route.ts
│       └── health/route.ts              GET · monitoring
├── middleware.ts                        host header → site_id, A/B/C cookie set, rate-limit
├── lib/
│   ├── pricing.ts                       (existing) Cloudbeds rate read
│   ├── compiler/
│   │   ├── parse.ts                     prompt → spec
│   │   ├── variants.ts                  cost-stack + variant generation
│   │   ├── margins.ts                   floor checks
│   │   ├── lunar.ts                     date-aware attachments
│   │   └── pdf.ts                       Puppeteer render
│   ├── stripe.ts                        client + helpers
│   ├── klaviyo.ts                       profile sync, event push
│   ├── make.ts                          HMAC signer, webhook caller
│   ├── cloudbeds.ts                     OAuth + reservation create
│   ├── supabase/
│   │   ├── server.ts                    server client (service role)
│   │   ├── browser.ts                   browser client (anon)
│   │   └── rls.ts                       policy helpers
│   └── analytics.ts                     web.events insert
└── components/
    ├── compiler/         see §3
    ├── retreat/          see §3
    ├── configurator/     see §3
    ├── checkout/         see §3
    ├── editor/           see §3
    ├── campaign/         see §3
    └── ui/               (existing brand kit)
```

---

## 2. API contracts

### 2.1 Compiler

**`POST /api/compiler/parse`** — session
```
Request:  { prompt: string }
Response: { runId: string, parsed: { duration_nights, theme, tier[], season[], pax, lunar_required }, warnings: string[] }
Errors:   400 invalid prompt, 429 rate limit
```

**`POST /api/compiler/build`** — session
```
Request:  { runId: string }
Response: { variants: Variant[], usaliSplit: object, marginCheck: { passed: bool, breaches: [...] } }
Errors:   400 missing run, 422 margin floor breach, 503 Cloudbeds unreachable
Note:     halts if breaches > 0 unless RM override on file
```

**`GET /api/compiler/runs/[id]`** — session
```
Response: { run, variants[], deploy?, costEur }
```

**`PATCH /api/compiler/runs/[id]/itinerary`** — session
```
Request:  { variantId, dayStructure: jsonb }
Response: { variant, recomputedTotal, marginCheck }
```

**`POST /api/compiler/runs/[id]/render`** — session
```
Request:  { variantId, designVariant: 'A'|'B'|'C' }
Response: { pdfUrl, funnelHtmlUrls: { lead, detail, configure, checkout } }
Note:     cached by (run_id, variant_id, design_variant)
```

**`POST /api/compiler/runs/[id]/deploy`** — session
```
Request:  { variantId, designVariant, subdomain }
Response: { deployId, vercelDeploymentId, status: 'queued'|'live'|'failed', logsUrl }
Side effects: creates compiler.deploys row, fires Vercel deploy hook,
              calls Cloudflare DNS API, pings Make compiler.deploy webhook
```

### 2.2 Public retreat / configurator

**`GET /r/[slug]`** — none, SSR
```
Response: HTML (Next.js page)
Cache:    s-maxage=300, stale-while-revalidate=86400
```

**`POST /api/r/[slug]/quote`** — anon (rate-limited 30/min/IP)
```
Request:  { roomTypeId, boardLevel, programSkus[], addonIds[], pax, dates: {arrival, departure} }
Response: { totalUsd, perPaxUsd, lineItems[], marginCheck: 'pass'|'auto_raised', validForSeconds: 600 }
Errors:   400 invalid combo, 410 retreat sold out, 422 dates outside window
```

**`POST /api/r/[slug]/configure/save`** — anon (rate-limited 10/min/IP)
```
Request:  { config: object, email?: string }
Response: { shareToken: string, shareUrl: string, expiresAt: timestamp }
Note:     30-day expiry; converts to booking on checkout
```

**`GET /api/r/[slug]/configure?t=<shareToken>`** — anon
```
Response: { config: object, validUntil: timestamp }
```

### 2.3 Lead capture

**`POST /api/lead/capture`** — anon (rate-limited 5/min/IP)
```
Request:  { email, firstName?, country?, sourcePageId?, consents: string[] }
Response: { ok: bool, optInRequired: bool, doubleOptInToken? }
Side effects: web.subscribers insert, web.consents insert,
              if EU: send double-opt-in email,
              else: fire Make lead.captured webhook
```

**`GET /api/lead/confirm/[token]`** — anon
```
Response: HTML confirmation page; web.consents updated; Klaviyo welcome flow triggered
```

### 2.4 Checkout

**`POST /api/checkout/session`** — anon (validates configurator quote token)
```
Request:  { slug, configToken, guestInfo: {firstName,lastName,email,phone,country}, agreeWaiver: bool }
Response: { checkoutUrl: string, bookingId: uuid, expiresAt: timestamp }
Side effects: book.bookings insert (status='held'), Stripe Checkout Session, 15-min hold
```

**`POST /api/checkout/webhook`** — Stripe (signed)
```
Events handled:
  - checkout.session.completed       → status='deposit_paid', fire booking.deposit_paid Make webhook
  - payment_intent.succeeded         → mirror to book.payments
  - payment_intent.payment_failed    → status='held', alert
  - charge.refunded                  → book.cancellations
Idempotent on stripe_event_id
```

**`POST /api/checkout/balance-webhook`** — Stripe invoice webhook for 70% balance

### 2.5 Cloudbeds bridge

**`GET /api/cb/availability?from&to&roomType?`** — session
```
Response: { rates: [{date, roomTypeId, ratePerNightUsd, available}], fxRate }
Cache:    none, always fresh
```

**`POST /api/cb/reserve`** — service only (called from Stripe webhook handler)
```
Request:  { bookingId }
Response: { cloudbedsReservationId, status }
```

**`GET /api/cb/reconcile`** — service only (cron 02:00 Asia/Vientiane)
```
Response: { checked: int, mismatches: [...], alertsCreated: int }
```

### 2.6 Operator (sales/* — all session-required)

**`PATCH /api/sales/retreats/[slug]/edit`** — live edit
```
Request:  { fieldPath: string, valueAfter: jsonb }
Allowed paths: /modules/*, /hero, /tagline, /faq/*, /spots_remaining, /status, /addon_visibility
Disallowed:    /pricing, /day_structure, /dates, /room_types  (require recompile)
Response: { pageId, historyId, valueBefore, valueAfter, expiresAt: '+90 days' }
Side effects: web.pages_history insert; ISR revalidate /r/[slug]
```

**`POST /api/sales/retreats/[slug]/recompile`**
```
Request:  { newPrompt?: string, dateShift?: int }
Response: { newRunId, supersedesRunId, deployStatus }
Side effects: new compiler.runs row, web.retreats_versions insert, redirects preserved
```

### 2.7 System

**`GET /api/system/health`** — monitoring (no auth, public; doesn't expose internals)
```
Response: { ok: true, timestamp, dbHealthy: bool, cloudbedsReachable: bool, stripeReachable: bool }
```

---

## 3. Components manifest (NEW components to create)

### 3.1 `components/compiler/`

| Component | Props | Purpose |
|---|---|---|
| `PromptParser` | `value, onCompile` | one-line input + presets |
| `VariantCard` | `variant, recommended, onSelect` | result-screen card |
| `ItineraryGrid` | `dayStructure, editable, onSave` | day-by-day editable matrix |
| `MarginBadge` | `pct, floor, breach?` | inline margin indicator |
| `UsaliSplit` | `splitJsonb` | revenue split table |
| `DesignVariantTile` | `id, label, preview, selected, onSelect` | A/B/C tile |
| `DeployPanel` | `runId, variantId, design` | subdomain + ship button |
| `LunarBadge` | `eventDate, type` | full-moon glyph |

### 3.2 `components/retreat/`

| Component | Props | Purpose |
|---|---|---|
| `RetreatHero` | `retreat, parallax?` | landing hero with image overlay |
| `RetreatSummary` | `retreat` | what's included / not included |
| `PricingCard` | `retreat, sticky?` | "from $X" sticky card |
| `RetreatFAQ` | `items[]` | accordion FAQ |
| `RetreatTestimonials` | `reviews[]` | guest quotes |
| `RetreatGallery` | `assets[]` | masonry grid |
| `LunarOverlay` | `events[]` | overlay on detail page if Mindfulness/Retreat Life |
| `RelatedRetreats` | `seriesSlug, excludeId` | cross-sell cards |

### 3.3 `components/configurator/`

| Component | Props | Purpose |
|---|---|---|
| `RoomPicker` | `rooms[], selectedId, onSelect` | room type selector with photos + price |
| `BoardLevelToggle` | `levels[], selected, onChange` | BB / HB / FB / AI radio |
| `ProgramToggleList` | `program[], selected[], onChange` | activity toggles (some required) |
| `AddonsList` | `addons[], selected[], onChange` | photographer / spa / etc |
| `LiveTotalRail` | `quote, defaultTotal, sticky?` | sticky right rail with line items |
| `ShareLinkButton` | `slug, config` | save + copy share URL |
| `ConfigureToCheckoutCTA` | `valid, total, onContinue` | bottom mobile CTA |

### 3.4 `components/checkout/`

| Component | Props | Purpose |
|---|---|---|
| `GuestInfoForm` | `value, onChange` | first/last/email/phone/country/special requests |
| `BookingSummary` | `booking, configToken` | sticky right rail |
| `WaiverCheckbox` | `agreed, onChange` | required waiver + GDPR |
| `StripeCheckoutButton` | `bookingId` | "Pay $X deposit" → redirects to Stripe |
| `BookedConfirmation` | `bookingId` | success state with QR |

### 3.5 `components/editor/`

| Component | Props | Purpose |
|---|---|---|
| `LiveEditTextField` | `pageId, fieldPath, value` | inline edit with debounced save |
| `LiveEditMarkdown` | `pageId, fieldPath, valueMd` | MD editor with preview |
| `LiveEditMedia` | `pageId, fieldPath, assetId` | media picker (marketing.campaign_assets) |
| `EditHistoryDrawer` | `pageId` | shows last 90 days of edits |
| `RevertButton` | `historyId` | restores prior value |
| `RecompileBanner` | `lockedFields[]` | warns when edit requires recompile |

### 3.6 `components/campaign/`

| Component | Props | Purpose |
|---|---|---|
| `CampaignBuilder` | — | new-campaign wizard |
| `AbVariantEditor` | `pageId, variant` | edits one A/B variant |
| `CampaignDashboard` | `campaignId` | visits/conversions/revenue/ROAS |
| `UtmBuilder` | `defaults, onGenerate` | URL builder with copy |
| `KlaviyoFlowSelect` | `value, onSelect` | dropdown of flows from Klaviyo API |

### 3.7 Reused existing components

`AgentsHub`, `IcsAttacher`, `BrandTokenProvider`, `Logo`, `Banner`, `Subnav`, `Card`, `Pill`, `Tbl`, `KpiCard`, `AgentChip` — all from `/sales/inquiries` rev 3.

---

## 4. Middleware behavior (`middleware.ts`)

```
1. Read host header → resolve web.sites by domain
2. Set request header: x-site-id, x-site-type, x-property-id
3. If campaign URL (/c/[slug]):
   - Read or set ab_variant cookie (1-year, sample weighted by web.campaign_pages.traffic_split_pct)
   - Append to URL search params for SSR
4. Rate-limit by IP for /api/* (60/min default, override per route)
5. If draft / preview: require auth cookie; else 404
6. Log to web.events (event_type='page_view') via async fire-and-forget
```

---

## 5. Cron jobs (Vercel cron)

| Schedule | Path | Purpose |
|---|---|---|
| `0 2 * * *` | `/api/cb/reconcile` | nightly Cloudbeds reconcile |
| `0 3 * * *` | `/api/cron/balance-charge` | charge 70% balances due in 30 days |
| `*/30 * * * *` | `/api/cron/rate-recheck` | re-check Cloudbeds rates for active deploys |
| `0 4 * * *` | `/api/cron/fx-lock` | refresh FX rate (Cloudbeds API), insert pricing.fx_locks |
| `0 5 * * 1` | `/api/cron/lunar-alert` | weekly lunar event preview to subscribers |
| `0 1 * * *` | `/api/cron/sheet-sync` | optional Sheets MCP sync if enabled |

All cron paths require `CRON_SECRET` header (Vercel cron auto-signs).

---

## 6. Background jobs (Edge Functions)

| Function | Trigger | Purpose |
|---|---|---|
| `pdf-render` | Stripe webhook + compiler render | Puppeteer PDF to Vercel Blob |
| `og-image` | request to `/og-image/[slug]` | dynamic OG image, cached 7 days |
| `klaviyo-sync` | web.subscribers insert/update | mirror to Klaviyo |
| `analytics-flush` | every 30s | batch web.events inserts |

---

## 7. Telemetry / observability

Required tags on every server log: `request_id`, `site_id`, `route`, `latency_ms`, `db_calls`, `cache_hit`.

| Metric | Source | Alert threshold |
|---|---|---|
| API p95 latency | Vercel | >800ms |
| Compiler run cost | `compiler.runs.cost_eur` | >€0.20/run |
| Configurator quote latency | `web.events` | p95 >300ms |
| Stripe webhook delivery failure | webhook log | >1 in 1 hour |
| Cloudbeds reconcile mismatches | `book.reconcile_alerts` | >5/day |
| Klaviyo sync failures | `web.email_sends.bounced_at IS NULL` rate | >2% |

---

## 8. Build + test

| Tool | Config | Purpose |
|---|---|---|
| Next.js | `app/` router, RSC | runtime |
| TypeScript | strict | type safety |
| pnpm | already in repo | install |
| Vitest | unit tests | margin logic, parse logic |
| Playwright | E2E | smoke test plan §12 of deploy doc |
| Biome | lint/format | replace ESLint+Prettier (already chosen) |
| Husky | pre-commit | lint + typecheck |

---

## 9. Performance budgets

| Page | Budget | Tooling |
|---|---|---|
| Home | LCP < 1.5s mobile | Vercel Edge Cache + ISR |
| Retreat detail | LCP < 1.8s | SSR + ISR 5min |
| Configurator | TTI < 2.5s, recalc < 200ms | client component, debounced |
| Checkout | TTI < 2s | Stripe Element lazy load |
| Compiler app (operator) | TTI < 3s | not user-critical, OK |

---

## 10. What NOT to build in v1 (re-stated)

Multi-language, Donna fork, native apps, group lead-time discounts, WhatsApp Business outbound, e-sig waivers, multi-property reporting, affiliate, alumni discounts beyond coupons, native video. All defer to v1.1+.
