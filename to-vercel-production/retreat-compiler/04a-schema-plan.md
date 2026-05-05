# 04a — Schema Plan · retreat-compiler

**Status:** Stage 2.5 design (pre-approval — do NOT apply to prod)
**Migration name:** `20260503000000_retreat_compiler_init_a1b2c3d4`
**Classification:** SAFE (all CREATE; no ALTER, no DROP, no type changes)
**Schemas:** `catalog`, `pricing`, `compiler`, `book`, `web`, `content`
**Target:** Supabase staging branch first · production after RLS tests pass

---

## 1. Schema topology — why split into 6 schemas

| Schema | Owns | Why separate |
|---|---|---|
| `catalog` | every sellable thing (rooms ref, activities, spa, F&B, transport, addons, ceremonies, workshops, vendors) | Catalog is the source of truth per item; isolating it makes re-pricing safe |
| `pricing` | pricelist, seasons, FX locks, margin floors, RM overrides | Compiler reads ONLY from here; single audit trail for prices |
| `compiler` | runs, variants, itinerary templates, deploys | Operator workspace; no public exposure |
| `book` | bookings, payments, cancellations, Cloudbeds reservation mirror | Customer-facing transactions; tight RLS |
| `web` | sites, pages, retreats, posts, campaigns, subscribers, consents | Full marketing site + campaign engine |
| `content` | series taxonomy, lunar calendar, USALI lookup | Reference data; rarely changes |

**Cloudbeds-managed data (rooms, room rates, room availability, transient products):** never mirrored. `public.rate_inventory` view (already synced by `cb_sync_*`) is the read-only bridge. Compiler joins to it in queries.

**`marketing.campaign_assets`** — already exists, reused for hero imagery + photos. No change.

---

## 2. Catalog domain · `catalog.*`

### 2.1 `catalog.vendors`

External partners: MandaLao, Green Discovery, Ock Pop Tok, White Elephant, Living Land, MotoLao, UXO Laos. Plus internal vendors (Namkhan F&B, Namkhan Spa) so margin tracking is consistent across both.

```
id, name, slug, type (internal|partner), legal_entity, country,
contact_name, contact_email, contact_phone, contact_whatsapp,
default_commission_pct, payment_terms_days, currency,
contract_url, contract_expires_on, notes,
is_active, created_at, updated_at
```

### 2.2 `catalog.vendor_rate_cards`

Versioned per vendor — flag drift risk per parent §11.

```
id, vendor_id (FK), version int, valid_from date, valid_to date,
rate_card_url, source (manual|email|portal),
notes, snapshot_jsonb, created_by, created_at
```

### 2.3 `catalog.activities` (replaces parent §4.1, expanded)

Adds: vendor split (internal vs partner), pickup logistics, weather rules, lunar windows.

```
id, name, name_lo, slug,
category enum (wellness|cultural|adventure|culinary|spiritual|workshop|ceremony),
series_tags text[],         -- mindfulness, river-tales, retreat-life, detox
duration_min int, prep_time_min int, debrief_time_min int,
capacity_min int, capacity_max int,
location_type enum (onsite|offsite|river|partner_site),
location_name text, gps_lat numeric, gps_lng numeric,
pickup_required bool, pickup_time_min int,
vendor_id (FK catalog.vendors),
cost_lak numeric, sell_price_usd numeric,
margin_pct numeric GENERATED,
seasonality text[],         -- dry|green|cool|all
weather_rules jsonb,         -- {min_temp_c, max_rain_mm, cancel_threshold}
lunar_dependent bool, lunar_window_days int,  -- ±N days from full moon
tier_visibility text[],      -- budget|mid|lux
description text, description_long_md text,
photo_urls text[], hero_asset_id (FK marketing.campaign_assets),
booking_lead_time_hr int,    -- min hours before activity start
cancellation_window_hr int,
usali_category text,         -- 'Other Operated' | 'Minor Operated'
is_active, created_at, updated_at
```

### 2.4 `catalog.spa_treatments` (replaces parent §4.2, expanded)

```
id, treatment_name, name_lo, slug,
category enum (massage|facial|body|ritual|package),
duration_min int,
sell_price_usd numeric, cost_lak numeric, margin_pct numeric GENERATED,
therapist_required int, room_required text,
capacity_per_day int,
ingredients text[], contraindications text[],
pre_treatment_form_url text,
combinable_with text[],      -- other treatment slugs
photo_urls text[], hero_asset_id (FK),
usali_category text,
is_active, created_at, updated_at
```

### 2.5 `catalog.fnb_items` (per-item; replaces parent §4.3 atomically)

```
id, item_name, name_lo, slug,
menu_section enum (breakfast|lunch|dinner|snack|drink_alc|drink_nonalc|amuse|dessert),
outlet enum (the_roots|in_villa|riverdeck|special_event|partner),
sell_price_usd numeric, food_cost_lak numeric,
food_cost_pct numeric GENERATED,
cost_pct_floor numeric DEFAULT 35,    -- flag if higher
dietary_tags text[],          -- vegan|vegetarian|gf|nut_free|dairy_free|halal
allergens text[],
spice_level int CHECK (1..5),
serves_pax int DEFAULT 1,
seasonality text[],
sourcing_local_pct int,        -- 0..100, marketing/USALI metric
photo_urls text[], hero_asset_id (FK),
usali_category text,
is_active, created_at, updated_at
```

### 2.6 `catalog.fnb_menus` (set/group menus referencing items)

```
id, menu_name, slug,
menu_type enum (set_menu|group_menu|tasting|chef_table|all_inclusive),
serves_pax int, courses int,
sell_price_usd numeric, computed_food_cost_lak numeric,
margin_pct numeric GENERATED,
items jsonb,    -- [{fnb_item_id, qty, course_no, optional}]
description, description_long_md,
photo_urls text[], hero_asset_id (FK),
usali_category text,
is_active, created_at, updated_at
```

### 2.7 `catalog.transport_options`

```
id, name, slug,
mode enum (sedan|van|minibus|bus|river_boat|long_tail|helicopter|tuk_tuk|bicycle|walk),
capacity_pax int,
duration_min int,
route_from text, route_to text,
vendor_id (FK),
sell_price_usd numeric, cost_lak numeric, margin_pct numeric GENERATED,
includes_driver bool, includes_fuel bool, includes_water bool,
luggage_max_kg int,
seasonality text[],
photo_urls text[],
usali_category text DEFAULT 'Minor Operated',
is_active, created_at, updated_at
```

### 2.8 `catalog.addons`

Photographer, single supplements, gift bags, custom flower arrangements, kids program, extra pillows, late checkout, etc.

```
id, name, slug,
addon_type enum (photo_video|supplement|gift|service|product|in_room),
sell_price_usd numeric, cost_lak numeric,
unit enum (per_pax|per_room|per_night|per_event|flat),
tier_visibility text[],
description, photo_urls text[], hero_asset_id (FK),
usali_category text,
is_active, created_at, updated_at
```

### 2.9 `catalog.ceremonies`

Alms, full moon, water blessing, welcome, closing, baci. Separated from activities because they have specific cultural rules.

```
id, name, name_lo, slug,
ceremony_type enum (alms|full_moon|baci|welcome|closing|water_blessing|merit_making),
duration_min int,
officiant_required text,    -- 'monk' | 'shaman' | 'host' | 'elder'
lunar_dependent bool, lunar_phases text[],   -- ['full', 'new']
respectful_attire_required bool,
photo_permitted bool,
sell_price_usd numeric, cost_lak numeric, margin_pct numeric GENERATED,
description, description_long_md,
photo_urls text[],
usali_category text,
is_active, created_at, updated_at
```

### 2.10 `catalog.workshops`

Weaving (Ock Pop Tok), cooking, calligraphy, foraging, pottery — separated from activities because they have materials cost + skill-level rules.

```
id, name, name_lo, slug,
workshop_type enum (weaving|cooking|calligraphy|foraging|pottery|music|other),
duration_min int,
skill_level enum (beginner|intermediate|advanced|all),
materials_provided bool, take_home_item bool,
capacity_min int, capacity_max int,
vendor_id (FK),
sell_price_usd numeric, cost_lak numeric, materials_cost_lak numeric,
margin_pct numeric GENERATED,
description, description_long_md,
photo_urls text[],
usali_category text,
is_active, created_at, updated_at
```

### 2.11 Cloudbeds bridge (no new table — view only)

`public.rate_inventory` (already synced) → exposed read-only to compiler. Add view:

```
catalog.v_rooms_compilable AS
  SELECT room_type_id, room_type_name, base_rate_usd, available_count,
         max_occupancy, photos, ...
  FROM public.rate_inventory
  WHERE date >= CURRENT_DATE
    AND is_stop_sell = false
```

---

## 3. Pricing domain · `pricing.*`

### 3.1 `pricing.pricelist` (canonical · compiler reads ONLY here)

```
id, sku text UNIQUE,           -- NMK-{cat}-{nnn} format
item_name text,
source_table enum (catalog.activities|catalog.spa_treatments|catalog.fnb_items|catalog.fnb_menus|catalog.transport_options|catalog.addons|catalog.ceremonies|catalog.workshops|cloudbeds.rooms),
source_id text,                 -- uuid OR cloudbeds product id
sell_price_usd numeric, cost_lak numeric,
margin_pct numeric GENERATED, margin_floor_pct numeric,
valid_from date, valid_to date,
tier_visibility text[],         -- budget|mid|lux
property_id text DEFAULT 'namkhan',  -- multi-property ready
usali_category text,
override_reason text, override_by, override_at,  -- audit trail
is_active, created_at, updated_at,
UNIQUE (sku, valid_from, property_id)
```

### 3.2 `pricing.seasons` (replaces parent §4.6)

```
id, season_name text, property_id text DEFAULT 'namkhan',
date_from date, date_to date,
rate_multiplier numeric, min_stay int,
applies_to text[],   -- ['rooms','activities','spa','fnb','all']
is_blackout bool DEFAULT false,
created_at, updated_at
```

### 3.3 `pricing.fx_locks`

7-day FX freeze per parent §5.2.

```
id, base_currency text DEFAULT 'LAK',
quote_currency text DEFAULT 'USD',
rate numeric,
locked_at timestamptz, locked_until timestamptz,
source enum (cloudbeds|manual|api),
locked_by, run_id (FK compiler.runs nullable),
created_at
```

### 3.4 `pricing.margin_overrides` (RM audit)

Every margin-floor breach approval logged. No silent overrides.

```
id, run_id (FK compiler.runs), variant_id (FK compiler.variants),
sku text, breach_type enum (activities|rooms|fnb|spa|other),
floor_pct numeric, actual_pct numeric,
override_reason text NOT NULL,
approved_by uuid, approved_at timestamptz,
created_at
```

---

## 4. Compiler domain · `compiler.*`

### 4.1 `compiler.runs`

```
id, prompt text, parsed_spec jsonb, status enum (draft|compiling|ready|rendering|deployed|halted),
operator_id uuid, property_id text DEFAULT 'namkhan',
cost_eur numeric, tokens_in int, tokens_out int, model text,
halt_reason text, halt_at timestamptz,
created_at, updated_at
```

### 4.2 `compiler.variants`

```
id, run_id (FK), label text,    -- A | B | C
room_category text, activity_intensity text, fnb_mode text,
total_usd numeric, per_pax_usd numeric, margin_pct numeric,
occ_assumption_pct int,
day_structure jsonb,             -- [{day, title, am, pm, eve, sku[]}]
usali_split jsonb,               -- {rooms_pct, fnb_pct, activities_pct, spa_pct}
recommended bool,
created_at, updated_at
```

### 4.3 `compiler.itinerary_templates` (replaces parent §4.5)

```
id, template_name text, slug text,
theme enum, tier enum, duration_nights int,
season text[], lunar_required bool,
day_structure jsonb,             -- skeleton with SKU placeholders
property_id text DEFAULT 'namkhan',
is_active, created_at, updated_at
```

### 4.4 `compiler.deploys`

```
id, run_id (FK), variant_id (FK),
design_variant enum (A|B|C),
subdomain text, vercel_project_id text, vercel_deployment_id text,
status enum (queued|provisioning|live|failed|rolled_back),
deployed_at, rolled_back_at,
created_at, updated_at
```

---

## 5. Booking domain · `book.*`

### 5.1 `book.bookings` (replaces parent §4.8, expanded)

```
id, retreat_slug text, variant_id (FK compiler.variants),
public_token text UNIQUE,
guest_first_name text, guest_last_name text,
guest_email text, guest_phone text, guest_country text,
party_size int, arrival_date date, departure_date date,
nights int GENERATED,
add_ons_jsonb,                       -- [{addon_id, qty, price}]
special_requests text,
total_usd numeric, deposit_usd numeric, balance_usd numeric,
deposit_paid_usd numeric DEFAULT 0, balance_paid_usd numeric DEFAULT 0,
balance_due_date date,
fx_rate_at_book numeric, fx_lock_id (FK pricing.fx_locks),
stripe_customer_id text, stripe_session_id text,
cloudbeds_reservation_id text,
status enum (held|confirmed|deposit_paid|paid_full|cancelled|refunded|no_show),
cancellation_reason text, cancelled_at,
source_campaign_id (FK web.campaigns nullable),
referrer_url, utm_jsonb,
ip_hash text, user_agent text,
created_at, updated_at
```

### 5.2 `book.payments`

Stripe events log. Idempotent on `stripe_event_id`.

```
id, booking_id (FK),
stripe_event_id text UNIQUE, stripe_payment_intent_id text,
amount_usd numeric, fee_usd numeric, net_usd numeric,
payment_type enum (deposit|balance|addon|refund),
status enum (pending|succeeded|failed|refunded),
scheduled_for timestamptz,
processed_at timestamptz, raw_payload jsonb,
created_at
```

### 5.3 `book.cancellations`

```
id, booking_id (FK), cancelled_by enum (guest|host|system),
days_before_arrival int,
refund_pct int, refund_amount_usd numeric,
reason_code text, reason_notes text,
processed_at, created_at
```

---

## 6. Web / marketing domain · `web.*`

This is what makes the funnel a full self-standing website with campaign infrastructure.

### 6.1 `web.sites`

One row per microsite. v1: namkhan.com (root) + per-retreat subdomains. v1.1: Donna fork.

```
id, slug text UNIQUE,            -- 'namkhan-main' | 'mindfulness-summer'
domain text,                      -- 'thenamkhan.com' | 'mindfulness-summer.thenamkhan.com'
property_id text,
site_type enum (root|retreat|series|campaign|landing),
parent_site_id (FK web.sites nullable),
theme_pack text,                  -- 'namkhan' | 'donna'
brand_tokens jsonb,               -- color/font overrides
default_seo_jsonb,
favicon_url, og_image_url,
ga4_id, meta_pixel_id, klaviyo_account_id,
is_active, deployed_at,
created_at, updated_at
```

### 6.2 `web.pages`

Every page on every site — retreats, blog posts, campaigns, evergreen, legal.

```
id, site_id (FK), slug text, full_path text,
page_type enum (home|retreat|series|post|campaign_landing|legal|about|contact|press|faq|sitemap),
title text, h1 text, meta_description text,
hero_jsonb, body_md text,
modules_jsonb,                    -- ordered array of content modules
seo_jsonb, og_jsonb, schema_org_jsonb,
canonical_url text,
status enum (draft|review|live|archived),
published_at, scheduled_for, expires_at,
ab_test_id (FK web.ab_tests nullable),
ab_variant text,                  -- 'A' | 'B' | 'C' | null
created_at, updated_at,
UNIQUE(site_id, full_path)
```

### 6.3 `web.retreats`

Live retreat listings — joins compiler.runs to a public-facing record.

```
id, run_id (FK compiler.runs), variant_id (FK compiler.variants),
site_id (FK web.sites),
slug text UNIQUE, name text, tagline text,
arrival_window_from date, arrival_window_to date,
spots_total int, spots_remaining int GENERATED,
price_usd_from numeric,
series_slug text (FK content.series),
hero_asset_id (FK marketing.campaign_assets),
gallery_asset_ids uuid[],
status enum (draft|published|sold_out|expired|cancelled),
seo_jsonb,
created_at, updated_at
```

### 6.4 `web.series` (Mindfulness, River Tales, Retreat Life, Detox)

Hub page per series with cross-retreat content + lunar overlay.

```
id, slug text UNIQUE, name text, tagline text,
description_md text, color_token text,
hero_asset_id (FK), gallery_asset_ids uuid[],
lunar_aware bool DEFAULT false,
total_retreats_run int, total_alumni int,
seo_jsonb,
is_active, created_at, updated_at
```

### 6.5 `web.posts` (blog/journal — content marketing for SEO + Klaviyo)

```
id, site_id (FK), slug text, title text,
author_name text, author_avatar_url text,
excerpt text, body_md text, hero_asset_id (FK),
series_slug text (FK content.series nullable),
related_retreat_ids uuid[],
tags text[], reading_time_min int,
status enum (draft|review|live|archived),
published_at, klaviyo_synced_at timestamptz,
seo_jsonb, og_jsonb,
created_at, updated_at
```

### 6.6 `web.campaigns` (named campaign with goals + UTMs)

```
id, name text, slug text UNIQUE,
campaign_type enum (launch|nurture|reactivation|seasonal|evergreen|ad),
channel enum (email|paid_search|paid_social|organic|referral|direct),
target_audience_jsonb, goal enum (lead|booking|nps|revenue),
goal_target int, goal_value_usd numeric,
utm_source text, utm_medium text, utm_campaign text,
utm_content_default text, utm_term_default text,
budget_usd numeric, spent_usd numeric DEFAULT 0,
starts_at, ends_at,
linked_retreat_id (FK web.retreats nullable),
linked_series_slug text (FK content.series nullable),
klaviyo_flow_id text, meta_campaign_id text, google_ads_campaign_id text,
status enum (draft|scheduled|live|paused|completed),
created_at, updated_at
```

### 6.7 `web.campaign_pages` (one campaign → many landing pages, A/B/C)

```
id, campaign_id (FK), page_id (FK web.pages),
variant text,                     -- A|B|C
traffic_split_pct int,
visits int DEFAULT 0, conversions int DEFAULT 0,
created_at, updated_at
```

### 6.8 `web.ab_tests`

```
id, name text, hypothesis text,
page_id (FK), metric text,
started_at, ended_at,
winner_variant text, statistical_significance numeric,
status enum (running|stopped|inconclusive|winner_chosen),
created_at, updated_at
```

### 6.9 `web.subscribers` (lifecycle-aware leads)

```
id, email text UNIQUE, first_name text, last_name text,
phone text, country text,
source_page_id (FK web.pages nullable),
source_campaign_id (FK web.campaigns nullable),
utm_jsonb,
lifecycle_stage enum (new|engaged|qualified|customer|alumni|churned|unsubscribed),
interest_series text[],            -- mindfulness|river-tales|...
language text DEFAULT 'en',
klaviyo_id text, klaviyo_synced_at,
last_email_open_at, last_email_click_at,
booking_count int DEFAULT 0, ltv_usd numeric DEFAULT 0,
notes text,
created_at, updated_at
```

### 6.10 `web.consents` (GDPR — required, not optional)

```
id, subscriber_id (FK), consent_type enum (marketing|analytics|cookies|whatsapp|sms),
granted bool, granted_at, revoked_at,
ip_hash text, user_agent text, page_id (FK),
double_opt_in_token text, double_opt_in_confirmed_at,
created_at
```

### 6.11 `web.email_sends` (Klaviyo write-back)

```
id, campaign_id (FK), subscriber_id (FK),
klaviyo_message_id text,
sent_at, delivered_at, opened_at, clicked_at, bounced_at, unsubscribed_at,
revenue_attributed_usd numeric DEFAULT 0,
created_at
```

### 6.12 `web.events` (pixel + GA4 mirror for first-party analytics)

```
id, session_id text, subscriber_id (FK nullable),
event_type enum (page_view|lead_capture|cta_click|video_play|scroll_depth|booking_start|booking_complete),
page_id (FK nullable), retreat_id (FK nullable), campaign_id (FK nullable),
ip_hash text, country text, device text,
referrer_url text, value_usd numeric,
properties_jsonb,
occurred_at,
created_at
```

### 6.13 `web.assets_index` (search/filter view over `marketing.campaign_assets`)

No new storage — just a materialized view for fast media-picker queries.

---

## 7. Content / reference domain · `content.*`

### 7.1 `content.series`

```
slug PK, name text, name_lo text,
description_md text, color_token text,
lunar_aware bool, default_themes text[],
photo_urls text[],
is_active, created_at, updated_at
```

Seed: `mindfulness`, `river-tales`, `retreat-life`, `detox`, `couples`, `family`.

### 7.2 `content.lunar_events` (2026–2030 full + new moons, Laos timezone)

```
id, event_date date, event_type enum (full_moon|new_moon|first_quarter|last_quarter),
event_time_local time, lunar_phase_pct numeric,
buddhist_holiday text,           -- if coincides
description text,
created_at
```

### 7.3 `content.usali_categories` (lookup, aligns with existing `gl.classes`)

```
slug PK, display_name text, usali_section text, usali_department text,
is_revenue_center bool,
created_at
```

Seed mirrors `gl.classes` (already in repo) — single source of truth, this is just exposed to web for SEO/marketing tagging.

### 7.4 `content.legal_pages` (privacy, terms, waiver, cancellation, accessibility)

```
slug PK, title text, body_md text, version text,
effective_date date, supersedes_version text,
language text DEFAULT 'en',
created_at, updated_at
```

---

## 8. Indexes (justified)

| Index | Query benefited | Est rows |
|---|---|---|
| `pricing.pricelist (sku, valid_from)` | compiler queries by SKU within window | 200–800 |
| `pricing.pricelist (tier_visibility, valid_from)` | compiler tier filter | same |
| `catalog.activities (series_tags GIN)` | series-page rollups | 50–150 |
| `catalog.activities (lunar_dependent, seasonality GIN)` | lunar/season filter | same |
| `compiler.runs (operator_id, created_at DESC)` | "my recent runs" list | 10–50/op |
| `web.retreats (slug)` | public page SSR | 20–200 |
| `web.retreats (status, arrival_window_from)` | "live retreats" list | same |
| `web.pages (site_id, full_path)` | router lookup | 200–2000 |
| `web.subscribers (email)` | dedupe on capture | 5K–50K |
| `web.subscribers (lifecycle_stage, last_email_open_at)` | Klaviyo segmentation | same |
| `book.bookings (public_token)` | guest URL access | 100–5K |
| `book.bookings (guest_email, status)` | guest history | same |
| `book.payments (stripe_event_id)` | webhook idempotency | 1K–20K |
| `web.events (occurred_at DESC, event_type)` | analytics queries | 100K+/yr |
| `content.lunar_events (event_date)` | compiler resolves lunar window | ~250 |

---

## 9. RLS policy summary

**All tables ENABLE ROW LEVEL SECURITY.** Default deny.

| Schema | Anon SELECT | Anon INSERT | Anon UPDATE | Authenticated SELECT | service_role |
|---|---|---|---|---|---|
| `catalog.*` | ❌ | ❌ | ❌ | ✅ all | full |
| `pricing.*` | ❌ | ❌ | ❌ | ✅ all | full |
| `compiler.*` | ❌ | ❌ | ❌ | ✅ own runs only | full |
| `book.bookings` | ✅ by `public_token` only (single row) | ❌ | ❌ | ✅ all | full |
| `book.payments` | ❌ | ❌ | ❌ | ✅ joined to own bookings | full |
| `web.sites` | ✅ where `is_active` | ❌ | ❌ | ✅ all | full |
| `web.pages` | ✅ where `status='live'` | ❌ | ❌ | ✅ all | full |
| `web.retreats` | ✅ where `status='published'` | ❌ | ❌ | ✅ all | full |
| `web.posts` | ✅ where `status='live'` | ❌ | ❌ | ✅ all | full |
| `web.subscribers` | ❌ | ✅ rate-limited via RPC `web.capture_lead()` | ❌ | ✅ all | full |
| `web.consents` | ❌ | ✅ via RPC only | ❌ | ✅ all | full |
| `web.events` | ❌ | ✅ via RPC `web.track()` (rate-limited 60/min/IP) | ❌ | ✅ all | full |
| `web.campaigns` | ❌ | ❌ | ❌ | ✅ all | full |
| `content.*` | ✅ all (reference data) | ❌ | ❌ | ✅ all | full |

Anon mutations always go through SECURITY DEFINER RPCs (`web.capture_lead`, `web.track`, `book.start_booking`, `book.confirm_booking_via_stripe_webhook`), never raw INSERT.

---

## 10. PostgREST exposure (merge — don't overwrite)

Append to `pgrst.db_schemas`: `catalog, pricing, compiler, book, web, content`.

Final list:
```
public, graphql_public, marketing, guest, gl, catalog, pricing, compiler, book, web, content
```

Per existing convention in `qb-deploy/phase2_99_expose_pgrst.sql` — re-merge with whatever other Claude sessions added since last edit.

---

## 11. Seed strategy (Phase 0)

| Source | Target | Method | Owner |
|---|---|---|---|
| Sheet "Namkhan Packages 1.2" — Activities tab | `catalog.activities` | CSV import + dedupe by name+vendor | PBS |
| Sheet — Spa tab | `catalog.spa_treatments` | CSV import | PBS |
| Sheet — F&B tab | `catalog.fnb_items` + `catalog.fnb_menus` | split-load | PBS |
| Sheet — Pricing tab | `pricing.pricelist` | derived from above + manual SKU assign | PBS |
| Sheet — Day structures | `compiler.itinerary_templates` | jsonb conversion | compiler |
| Hard-code | `content.series` | seed SQL (this migration) | this PR |
| Hard-code | `content.lunar_events` 2026–2030 | seed SQL (this migration) | this PR |
| Hard-code | `content.usali_categories` | seed SQL (this migration) | this PR |
| Hard-code | `content.legal_pages` (placeholders) | seed SQL (this migration) | this PR |
| External vendors list | `catalog.vendors` | seed SQL (Green Discovery, MandaLao, Ock Pop Tok, White Elephant, Living Land, MotoLao, UXO Laos) | this PR |

**Sheet → SQL is blocked** until Sheets MCP connected. Seed SQL for hard-coded content lands in this migration regardless.

---

## 12. RLS test plan (auto)

For every new table:

| Test | Expected |
|---|---|
| Anon SELECT on `catalog.activities` | DENY |
| Anon SELECT on `web.pages WHERE status='live'` | ALLOW |
| Anon SELECT on `web.pages WHERE status='draft'` | DENY |
| Anon INSERT on `web.subscribers` (direct) | DENY |
| Anon RPC `web.capture_lead(email, consent)` | ALLOW (rate-limited) |
| Anon SELECT on `book.bookings WHERE public_token = $1` | ALLOW (single row) |
| Anon SELECT on `book.bookings` (no token filter) | DENY |
| Authenticated SELECT on all `catalog.*` | ALLOW |
| Authenticated UPDATE on `pricing.pricelist` | DENY (service_role only) |

Cowork auto-runs anon tests on staging. Authenticated tests are manual against staging session.

---

## 13. Halts / blockers (do not migrate until resolved)

1. **Sheet not connected** — seed for catalog.* and pricing.pricelist cannot land. Migration creates empty tables, content.* tables seed fully.
2. **`series` taxonomy + lunar dates source** — hard-coded in this migration as placeholders. Replace with PBS-approved list before campaign launch.
3. **Stripe topology decision** — affects `book.payments.stripe_event_id` uniqueness scope. Default: single Stripe account, multi-property metadata.
4. **`property_id` everywhere** — schema is multi-property ready (Donna fork). v1 ships with `'namkhan'` only.

---

## 14. Migration files

| File | Purpose |
|---|---|
| `migrations/pending/20260503000000_retreat_compiler_init_a1b2c3d4.sql` | Forward DDL |
| `migrations/pending/20260503000000_retreat_compiler_init_a1b2c3d4_rollback.sql` | Reverse DDL (DROP CASCADE) |
| `migrations/pending/20260503000000_retreat_compiler_init_a1b2c3d4_seed.sql` | Hard-coded content seed (vendors, series, lunar, USALI) |
| `migrations/pending/20260503000000_retreat_compiler_init_a1b2c3d4_validate.sql` | Post-seed COUNT queries |

**Apply order on staging:**
1. Apply forward DDL · verify no errors
2. Apply seed · run validate
3. Run RLS test plan (Cowork auto)
4. Manual smoke: `web.capture_lead` RPC, public-token booking access
5. Sign off → repeat on prod after Stage 2.5 approval (`05-schema-approval.md`)

**NEVER apply to prod automatically.** Per SKILL.md: "NEVER apply migrations to prod, auto-import Make scenarios."
