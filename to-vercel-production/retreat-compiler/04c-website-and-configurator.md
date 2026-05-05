# 04c — Website Platform + Guest Configurator + Operator Editor

**Status:** Stage 2.5 design (sibling to `04a-schema-plan.md`)
**Scope expansion:** funnel becomes a full self-standing marketing site; guest can configure room × board × tier × program; operator can edit a live retreat without re-compiling.

---

## 1. The funnel is not 3 pages anymore — it's a full website

### 1.1 Site map (per deployed property)

| Section | Pages | Purpose |
|---|---|---|
| **Home** | `/` | Brand storytelling, current featured retreat, lead magnet block, recent journal posts |
| **Retreats** | `/retreats` (list) · `/r/[slug]` (detail) · `/r/[slug]/configure` (configurator) · `/r/[slug]/checkout` (deposit) | Live retreats; per-retreat detail + booking |
| **Series** | `/series/mindfulness` · `/series/river-tales` · `/series/retreat-life` · `/series/detox` | Theme hubs; cross-retreat stories + lunar overlay |
| **Journal** | `/journal` · `/journal/[slug]` | Blog content — SEO + Klaviyo email source |
| **Lunar calendar** | `/lunar` | Cross-retreat full-moon view; subscribe to alerts |
| **About** | `/about` · `/team` · `/sebastian` · `/press` | Brand legitimacy; press kit |
| **Contact** | `/contact` | Form, WhatsApp, hours, map |
| **FAQ** | `/faq` | Cancellation, what to bring, dietary, accessibility |
| **Legal** | `/privacy` · `/terms` · `/waiver` · `/accessibility` · `/cookies` | GDPR-compliant; double opt-in flow |
| **Lead magnets** | `/free/mindful-river` · `/free/[slug]` | One per series; each has its own consent record |
| **Campaign landings** | `/c/[campaign-slug]` | Per-campaign A/B/C variants under one URL |
| **System** | `/sitemap.xml` · `/robots.txt` · `/rss.xml` · `/feed.json` · `/og-image/[slug]` | SEO + syndication |

### 1.2 Multi-site topology

| Site type | Domain pattern | Use |
|---|---|---|
| `root` | `thenamkhan.com` | Master brand site, lists all retreats |
| `retreat` | `mindfulness-summer.thenamkhan.com` | Per-retreat microsite (subdomain) — same template, single retreat focus |
| `series` | `mindfulness.thenamkhan.com` | Series hub with lunar overlay (optional v1.1) |
| `campaign` | `try.thenamkhan.com/[slug]` | Standalone campaign landing for paid traffic |
| Donna fork v1.1 | `donnaportals.com` | Same engine, theme pack swap |

All driven by `web.sites` + `web.pages`. One Next.js app, multi-tenant via host header.

### 1.3 Why this matters for campaigns

Klaviyo / Meta / Google can drop a guest on:
- a campaign-specific `/c/spring-mindfulness-2026` (A/B/C tested)
- a content piece `/journal/full-moon-meditation-guide` with a CTA to a retreat
- a series hub `/series/mindfulness` listing all upcoming
- a retreat detail `/r/mindfulness-summer`

Every page is tracked, attributable, and converts toward the same booking funnel. Not three pages — a full content/SEO/conversion engine.

---

## 2. Guest configurator (`/r/[slug]/configure`)

The new screen between retreat detail and checkout. Replaces the old single-variant booking.

### 2.1 What the guest configures

| Choice | Options | Affects price |
|---|---|---|
| **Room type** | Garden Room · River Suite · River Villa | Yes (room rate × nights × pax) |
| **Package tier** | Essential · Signature · Curated | Yes (activity intensity, spa inclusion, transport class) |
| **Board level** | Bed & Breakfast · Half Board · Full Board · All-inclusive | Yes (F&B per pax/night) |
| **Program** | Toggle each activity / ceremony / workshop on or off (some required by series) | Yes (per-activity SKU) |
| **Add-ons** | Photographer · spa pack · extra night · single supplement · airport private transfer | Yes |
| **Dates** | Within retreat window only (Cloudbeds-locked) | Possibly (high vs shoulder) |
| **Pax** | 1–8 | Yes (everything per-pax scales) |

### 2.2 What stays locked (host enforces)

- Dates fixed to retreat window (lunar logic preserved on Mindfulness/Retreat Life)
- Required ceremonies for the series (Mindfulness = sunset meditation Day 1, full moon ceremony, closing meditation — non-removable)
- Property (Namkhan only — Donna fork ships in v1.1)
- Currency display USD; payment LAK at FX-locked rate
- Cancellation policy non-negotiable
- Tier visibility — partner activities only available on Signature / Curated

### 2.3 UX rules

- Live total in sticky right rail; recalcs on every toggle
- Margin floor checked client-side as preview, server-validated on submit
- "Your version" badge appears once guest changes anything from default
- Compare-to-recommended banner: "$2,290 default · $2,140 your version · save $150 / pax"
- Below-margin floor: configurator silently raises to floor (not a guest-visible error)
- Save & share: configurator state encoded in URL → guest can text/email their version
- Operator override: sales link can pre-load a specific configuration via signed token

### 2.4 New screens (add to prototype rev 2)

| Hash route | Screen |
|---|---|
| `#/funnel/configure?slug=...` | Configurator with toggle stack + sticky total |
| `#/funnel/configure-share` | Confirmation: "Your version saved · share this link" |

These slot between `#/funnel/detail` and `#/funnel/checkout`.

---

## 3. Operator retreat editor (`/sales/retreats/[slug]/edit`)

Today's mockup has `#/edit?run=R-001&v=B`. That edits the *compile run* before deploy. We also need post-deploy live edit.

### 3.1 What can be edited live (no re-compile)

| Field | Why live-editable |
|---|---|
| Hero copy, tagline, gallery | Pure presentation |
| FAQ entries | Pure content |
| Linked journal posts | Cross-link |
| Lead-magnet copy | Marketing test |
| Spots remaining | Operations |
| Status (publish / sold out / cancelled) | Operations |
| Add-on availability | Inventory |

### 3.2 What requires re-compile (locked behind a "re-compile" button)

| Field | Why |
|---|---|
| Pricing structure | Affects margin floors, USALI mapping |
| Activity inclusion | Affects pricelist SKU stack |
| Day structure | Affects PDF + JSON contract |
| Date window | Affects rate-season multiplier and Cloudbeds availability |
| Variant catalog (which room types are bookable) | Affects guest configurator |

Re-compile creates a new `compiler.runs` row, supersedes the previous one, and re-deploys with same subdomain. Public booking links remain valid (token unchanged); Cloudbeds reservations preserved.

### 3.3 Edit history + rollback

Every live edit writes to `web.pages_history` (JSON snapshot). Operator can revert any edit within 90 days. Re-compiles are versioned in `compiler.runs.parent_run_id`.

---

## 4. Schema deltas vs `04a-schema-plan.md`

These are additions, not replacements. All SAFE class.

### 4.1 `compiler.variants` — add room/board/program matrix

Already has `room_category, activity_intensity, fnb_mode`. Expand to publish a *menu of options* rather than one fixed combo:

```
ALTER COLUMN day_structure          jsonb  -- already exists
ADD    COLUMN bookable_rooms       jsonb  -- [{room_type_id, sell_price_usd_per_night, max_pax, photos}]
ADD    COLUMN bookable_boards      jsonb  -- [{level, per_pax_per_night_usd, items}]
ADD    COLUMN bookable_program     jsonb  -- [{sku, title, default_on, required, sell_price_usd_per_pax}]
ADD    COLUMN bookable_addons      jsonb  -- [{addon_id, default_off, ...}]
ADD    COLUMN guest_savings_floor_usd numeric  -- can never go below this total
```

### 4.2 `book.bookings` — store guest configuration

Replace single `add_ons_jsonb` with full configuration:

```
ALTER COLUMN add_ons_jsonb          DROP NOT NULL  -- still allowed for legacy
ADD    COLUMN config_jsonb         jsonb NOT NULL DEFAULT '{}'
   -- {room_type_id, board_level, program_skus[], addon_ids[],
   --  pax_count, single_supplement, dates, ...}
ADD    COLUMN config_total_usd     numeric  -- recomputed at submit
ADD    COLUMN config_source enum (default|guest_custom|operator_preload)
ADD    COLUMN config_share_token   text UNIQUE NULL  -- guest-shareable URL
```

### 4.3 New table — `web.pages_history` (operator edit audit + rollback)

```
id, page_id (FK web.pages), edited_by uuid,
field_path text,                  -- e.g. 'modules[2].body_md'
value_before jsonb, value_after jsonb,
edit_type enum (live|compile|rollback),
reverted_from_id uuid (FK web.pages_history nullable),
edited_at, expires_at,            -- 90 days then archived
created_at
```

Indexed `(page_id, edited_at DESC)`.

### 4.4 New table — `web.retreats_versions` (re-compile chain)

```
id, retreat_id (FK web.retreats), run_id (FK compiler.runs),
version int,
parent_version_id uuid (FK self nullable),
superseded_at, supersedes_url_redirect bool DEFAULT true,
created_at
```

Existing public URLs always resolve to latest live version.

### 4.5 New table — `web.configurations` (saved guest configs, share-link engine)

```
id, retreat_id (FK), share_token text UNIQUE,
config_jsonb,
total_usd numeric,
created_by_email text NULL,
ip_hash text, created_at,
expires_at,                        -- 30 days unless converted
converted_to_booking_id (FK book.bookings nullable)
```

Operators can pre-load a configuration into the share-link engine and send it directly: "Sebastian put this together for you."

---

## 5. Configurator pricing engine

### 5.1 Server endpoint

```
POST /api/r/[slug]/quote
body: { room_type_id, board_level, program_skus[], addon_ids[], pax, dates }
→ { total_usd, per_pax_usd, line_items[], margin_check, valid_for_seconds }
```

- Reads ONLY from `pricing.pricelist`
- Validates margin floors server-side; never trusts client total
- Returns `valid_for_seconds` (default 600); guest must re-quote after
- Logs every quote to `web.events` (event_type='configure_quote')

### 5.2 Client UI (sticky rail)

```
Total                                   $2,140
Default                                 $2,290
Your version                            -$150

Configuration:
  • River Suite × 4 nights              $1,840
  • Half Board × 4 nights × 8 pax       $1,920
  • Sound bath × 8 pax                  $480
  • Full moon ceremony × 8 pax          [included]
  • Spa pack × 8 pax (off)              -
  • Photographer (off)                  -

Deposit (30%)                           $642
Balance (70%, due Aug 26)               $1,498
```

### 5.3 Shareable URL

Configuration encoded short-form: `/r/mindfulness-summer/configure?c=A2-HB-3-1-0`
Or signed token for operator-built ones: `/r/mindfulness-summer/configure?t=eyJhbG...`

---

## 6. Campaign engine — concretely

### 6.1 Campaign creation flow (operator)

1. `/sales/campaigns/new` — pick goal, audience, channel
2. Pick or create landing pages (use `web.pages` page-builder)
3. Set A/B/C split (default 50/50 or 33/33/34)
4. Klaviyo flow link (optional — auto-detected from `klaviyo_flow_id`)
5. Meta Pixel + Google Ads campaign IDs (manual paste from those platforms)
6. UTM defaults auto-generated; can be overridden
7. Schedule launch
8. Live dashboard at `/sales/campaigns/[id]`

### 6.2 Live attribution

Every guest action on every page is tagged with:
- `utm_*` from URL
- `campaign_id` from cookie (set on first hit)
- `subscriber_id` once email captured
- `booking_id` on conversion

Stored in `web.events`. Mirrors GA4 + Meta but is first-party (survives cookie loss for 30 days via session ID).

### 6.3 Klaviyo bridge

- New subscriber → `web.subscribers` row → Make webhook → Klaviyo API create profile + add to list
- Email open/click webhook from Klaviyo → `web.email_sends` upsert
- Booking → Klaviyo "Booked Retreat" event with revenue + retreat slug → fires post-booking flows (welcome series, pre-arrival, post-stay NPS)
- Lifecycle stage (`web.subscribers.lifecycle_stage`) is the single source of truth for segmentation; Klaviyo lists are mirrored from it

### 6.4 What Make does (the only thing it does)

- Listens for `web.subscribers` insert → Klaviyo profile + welcome email
- Listens for `book.bookings` deposit_paid → Cloudbeds reserve + Slack ping + Klaviyo event
- Listens for `book.bookings` balance_due (cron 30 days pre-arrival) → Stripe charge + reminder email
- Listens for `web.campaigns` status='live' → Slack ping marketing channel + GA4 annotation

No business logic in Make. Logic lives in Postgres + Edge Functions. Make is pure plumbing.

---

## 7. Pages routing — Next.js app structure

```
app/
├── (root)/
│   ├── page.tsx                                     // home
│   ├── retreats/page.tsx                            // list
│   ├── series/[slug]/page.tsx                       // series hub
│   ├── journal/page.tsx                             // index
│   ├── journal/[slug]/page.tsx                      // post
│   ├── lunar/page.tsx
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── faq/page.tsx
│   └── (legal)/
│       ├── privacy/page.tsx
│       ├── terms/page.tsx
│       ├── waiver/page.tsx
│       └── accessibility/page.tsx
├── r/[slug]/
│   ├── page.tsx                                     // retreat detail
│   ├── configure/page.tsx                           // configurator
│   └── checkout/page.tsx                            // deposit
├── c/[campaign-slug]/page.tsx                       // campaign landing (A/B/C aware)
├── free/[slug]/page.tsx                             // lead magnet
├── sales/                                           // operator app (existing)
│   ├── retreats/page.tsx                            // list
│   ├── retreats/[slug]/edit/page.tsx                // live editor
│   ├── retreats/[slug]/recompile/page.tsx          // re-compile flow
│   ├── campaigns/page.tsx                           // list
│   ├── campaigns/new/page.tsx                       // create
│   └── campaigns/[id]/page.tsx                      // dashboard
├── compiler/                                        // existing from rev 1
│   └── ...
├── api/
│   ├── r/[slug]/quote/route.ts                      // configurator pricing
│   ├── r/[slug]/configure/save/route.ts             // share-link save
│   ├── lead/capture/route.ts
│   ├── checkout/session/route.ts
│   ├── checkout/webhook/route.ts                    // Stripe
│   ├── cb/availability/route.ts                     // Cloudbeds bridge
│   ├── cb/reserve/route.ts                          // Cloudbeds bridge
│   ├── compiler/...
│   ├── sales/retreats/[slug]/edit/route.ts          // live edit
│   ├── sales/retreats/[slug]/recompile/route.ts
│   └── make/...
└── (system)/
    ├── sitemap.xml/route.ts
    ├── robots.txt/route.ts
    ├── rss.xml/route.ts
    └── og-image/[slug]/route.ts
```

---

## 8. Build order (revised)

| Phase | Deliverable | Days |
|---|---|---|
| 0 | Sheet sync + content seed (vendors, series, lunar) | 2 |
| 1 | Catalog + pricing schemas + RLS + seed | 3 |
| 2 | Cloudbeds bridge view + room mirror | 2 |
| 3 | Compiler v1 (single-variant output) | 4 |
| 4 | Compiler v2 (publishes bookable matrix to variants) | 2 |
| 5 | PDF generator | 3 |
| 6 | Public retreat detail page | 2 |
| 7 | **Guest configurator** (room × board × program × addons) | 4 |
| 8 | Checkout + Stripe + Cloudbeds reserve | 4 |
| 9 | **Full marketing site** (home, series, journal, lunar, about, contact, FAQ, legal) | 4 |
| 10 | **Campaign engine** (creation, A/B/C, attribution, Klaviyo bridge) | 4 |
| 11 | **Operator retreat editor** (live edit + recompile + history) | 3 |
| 12 | Lead magnet + double opt-in flow | 2 |
| 13 | Make scenarios + Slack + Klaviyo wiring | 2 |
| 14 | Deploy automation + multi-site routing | 3 |

**Total v1 (full):** ~44 working days. ~9 weeks one engineer or ~5 weeks with PBS + 1.

---

## 9. What this does NOT do (defer to v1.1+)

- Multi-language (EN only v1; FR/DE in v1.1 with Donna)
- WhatsApp Business API (collect opt-in only, send via Klaviyo SMS in v1)
- E-signature waivers (v1 = checkbox; v1.1 = HelloSign/DocuSign Click)
- Group lead-time discounts ≥6 pax (parent §5.2 group rate trigger) — model in v1.1
- Multi-tier referral program (Donna scope)
- Native iOS app (PWA only v1)
- Video hosting (Vimeo embed only v1; native v1.2)

---

## 10. Open questions added by this addendum

4. **Configurator floor** — does PBS want an absolute minimum total (e.g. "never below $1,200/pax") on top of margin floor? Default: margin floor only.
5. **Live edit grants** — only PBS + Sebastian, or all sales seats? Default: sales seat = live edit OK; only PBS = recompile.
6. **Multi-site root + retreat domains** — both deploy day 1, or root site v1.0 and retreat subdomains v1.1? Default: root v1.0, retreat subdomains v1.1 (uses one domain pattern `thenamkhan.com/r/[slug]` until then).
