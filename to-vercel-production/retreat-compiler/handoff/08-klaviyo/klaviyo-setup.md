# Klaviyo setup · retreat-compiler

**Account:** Namkhan production (separate sandbox for staging)
**Owner:** PBS
**Sync source of truth:** `web.subscribers.lifecycle_stage`
**Reverse sync:** Klaviyo opens/clicks/bounces → `web.email_sends`

## Lists

| List ID env var | Name | Source |
|---|---|---|
| `KL_LIST_ALL` | All Subscribers | every `web.subscribers` row with `lifecycle_stage != 'unsubscribed'` |
| `KL_LIST_MINDFULNESS` | Series · Mindfulness | `interest_series` contains `mindfulness` |
| `KL_LIST_RIVER_TALES` | Series · River Tales | `interest_series` contains `river-tales` |
| `KL_LIST_RETREAT_LIFE` | Series · Retreat Life | `interest_series` contains `retreat-life` |
| `KL_LIST_DETOX` | Series · Detox | `interest_series` contains `detox` |
| `KL_LIST_CUSTOMERS` | Customers — Booked | `lifecycle_stage IN ('customer','alumni')` |
| `KL_LIST_ALUMNI_REPEAT` | Alumni — Repeat Eligible | booked >90 days ago, no booking <90 days |
| `KL_LIST_EU` | EU Residents | country in EU-27 |

Mirror via Make scenario `lead.captured` action `klaviyo_list_add` + nightly reconcile job `lifecycle_stage` → list membership.

## Flows

### 1. Welcome — Mindful River (Mindfulness series)

| Step | Trigger / Wait | Email |
|---|---|---|
| 1 | List subscribe → immediate | "Welcome — your guide is on its way" |
| 2 | +30 min | "Day 1 audio · breath as anchor" |
| 3 | +1 day | "Day 2 audio · the river's tempo" |
| 4 | +2 days | "Day 3 audio · the body softens" |
| 5 | +3 days | "Day 4 audio · stillness" |
| 6 | +4 days | "Day 5 audio · seeing" |
| 7 | +5 days | "Day 6 audio · returning" |
| 8 | +7 days | "Day 7 audio + retreat invitation" — first CTA |
| 9 | +14 days, if no booking | "What guests say" — social proof |
| 10 | +21 days, if no booking | "One last invitation · September retreat" |

### 2. Welcome — River Tales

6 emails over 14 days. Story-led, no audio. CTA email #4 + #6.

### 3. Welcome — Retreat Life

6 emails over 14 days. Long-stay focus. CTA email #5.

### 4. Welcome — Detox

6 emails over 14 days. Body-reset focus. CTA email #4.

### 5. Booking confirmation flow

Trigger: event `Booked Retreat`

| Step | Wait | Email |
|---|---|---|
| 1 | Immediate | Booking confirmation + PDF itinerary attached |
| 2 | -30 days from arrival | "Your balance is paid" + packing notes |
| 3 | -14 days | What to bring · flight tips |
| 4 | -7 days | Practical info · WhatsApp on arrival |
| 5 | -1 day | "Tomorrow" — single line, signed by Sebastian |

### 6. Pre-arrival packing — standalone

Trigger: 14 days before `arrival_date` (date-based).

### 7. Post-stay NPS

Trigger: 3 days after `departure_date`.

| Step | Wait | Email |
|---|---|---|
| 1 | Immediate | "How was it?" — single NPS rating |
| 2 | +5 days, if rated 9–10 | "Tell others" — review prompts (Google, TripAdvisor) |
| 3 | +14 days | Alumni invitation — discount code for next retreat |

### 8. Win-back

Trigger: no engagement 90 days, lifecycle_stage=`engaged` or `qualified`.

| Step | Wait | Email |
|---|---|---|
| 1 | Day 0 | "We've been quiet — here's what's new" |
| 2 | +14 days, if no open | "Last note · 10% off your next retreat" |
| 3 | +30 days, if no open | move to `lifecycle_stage='churned'`, suppress |

### 9. Lunar alert (cron-driven)

Trigger: cron job fires `Full Moon` event 7 days before each lunar event in `content.lunar_events`. Filter to subscribers in `KL_LIST_MINDFULNESS` or `KL_LIST_RETREAT_LIFE` AND consented.

Single email per moon. Subject pattern: "Full moon over the Namkhan · Sept 27".

## Templates

Stored in `08-klaviyo/templates/` (HTML). Use Namkhan brand tokens via inline CSS (Klaviyo HTML editor doesn't support custom fonts properly — fall back to Soho House-adjacent web-safe stack).

| Template | Purpose |
|---|---|
| `welcome-mindful-river-day1.html` | first email of Mindfulness welcome flow |
| `booking-confirmation.html` | order receipt with PDF link |
| `pre-arrival-packing.html` | what to bring |
| `post-stay-nps.html` | review prompt |
| `lunar-alert.html` | 7-day lunar heads-up |
| `winback-90d.html` | re-engagement |

## Account-level setup

- **Sender domain:** `mail.thenamkhan.com` (subdomain) — DKIM + SPF in `09-cloudflare/dns-records.md`
- **Reply-to:** `bookings@thenamkhan.com`
- **Default sender name:** `Namkhan · Sebastian`
- **Footer:** address (Luang Prabang), unsubscribe link, "GDPR — manage preferences"
- **Preference center:** custom; 4 toggles per series + frequency

## DPA

Klaviyo DPA template signed and stored in `01-env/dpa-klaviyo.pdf` (placeholder; sign via Klaviyo dashboard before EU traffic).
