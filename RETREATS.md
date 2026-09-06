# Namkhan Retreats — Programme & Analytics Reference

> **Status:** Live · property_id 260955 · analytics at `/operations/retreats`
> Last updated: 2026-09-07

---

## 1. The three FIT programmes

All three are sold as **FIT (Free Individual Traveller)** packages.
Pricing is **net per night**, exclusive of 10% Service Charge + 10% Lao VAT.

### Harmony & Mindfulness

| | Essential | Immersion |
|---|---|---|
| **Public rate** | $110 / person / night | $190 / person / night |
| **LPA rate** | $94 | $162 |
| Basis | Per person | Per person |
| Min / Max stay | 2 – 6 nights | 2 – 6 nights |
| Ideal guest | Solo · Wellness · Spiritual seekers | |

**Essential inclusions**
- Half-board meals (plant-rich) — lunch or dinner
- Daily yoga, Qi Gong & meditation (join-in, 60 min)
- Holistic consultation
- Massages & spa rituals (60 min)
- Infinity pool, herbal sauna & ice bath

**Immersion inclusions**
- Full-board meals (plant-rich) — lunch & dinner
- Daily yoga, Qi Gong & meditation (private, 60 min)
- Holistic consultation
- Massages & spa rituals (90 min)
- Cultural & nature activities
- Infinity pool, herbal sauna & ice bath

---

### Namkhan Detox

| | Essential | Immersion |
|---|---|---|
| **Public rate** | $130 / person / night | $210 / person / night |
| **LPA rate** | $111 | $179 |
| Basis | Per person | Per person |
| Min / Max stay | 2 – 6 nights | 2 – 6 nights |
| Ideal guest | Detox seekers · Stress relief · Advanced wellness | |

**Essential inclusions**
- Full-board detox meals & herbal infusions
- Holistic consultation & wellness support
- Daily yoga, Qi Gong & meditation (join-in, 60 min)
- Spa therapies & healing rituals (60 min)
- Cultural & eco-farm workshops
- Herbal sauna, ice bath & infinity pool

**Immersion inclusions**
- Full-board detox meals & herbal infusions
- Holistic consultation & wellness support
- Daily yoga, Qi Gong & meditation (private, 90 min)
- Spa therapies & healing rituals (90 min)
- Cultural & eco-farm workshops
- Herbal sauna, ice bath & infinity pool

---

### Serene Couples

| | Essential | Immersion |
|---|---|---|
| **Public rate** | $220 / couple / night | $320 / couple / night |
| **LPA rate** | $187 | $272 |
| Basis | Per couple | Per couple |
| Min / Max stay | 2 – 6 nights | 2 – 6 nights |
| Ideal guest | Couples · Honeymooners · Anniversaries | |

**Essential inclusions**
- Half-board meals with riverside dining for two
- Couples spa rituals & private sessions (60 min)
- Daily yoga, meditation & Qi Gong (join-in, 60 min)
- Mindful workshops & cultural activities
- Infinity pool, herbal sauna & ice bath

**Immersion inclusions**
- Full-board detox meals & herbal infusions
- Holistic consultation & wellness support
- Daily yoga, Qi Gong & meditation (private, 90 min)
- Spa therapies & healing rituals (90 min)
- Cultural & eco-farm workshops
- Herbal sauna, ice bath & infinity pool

---

## 2. Booking channels

| Channel | How identified | Notes |
|---|---|---|
| Website / Booking Engine | `source_name = 'Website/Booking Engine'` + rate plan name contains `(essential)` or `(immersion)` | Main direct channel |
| Email / direct | `source_name = 'Email'` + rate plan name pattern | Walk-ins and email enquiries |
| BookRetreats | `source_name = 'BookRetreats'` | OTA — programme attribution not in rate plan |
| Tripaneer | `source_name = 'Book Yoga Retreats by Tripaneer'` | OTA — programme attribution not in rate plan |

OTA bookings are always FIT retreats but the rate plan does not carry the programme name.
Programme and tier attribution is therefore unavailable for OTA stays.

---

## 3. Cloudbeds rate plan structure

Each programme × tier is a separate rate plan in Cloudbeds.
Rate plan name format: `[Programme Name] ([Tier])`, e.g.:

- `Harmony & Mindfulness Retreat (essential)`
- `Namkhan Detox Retreat (Immersion)`
- `Serene Couples Retreat (essential)`

The nightly rate is structured as:

```
Rate plan nightly rate = Base room rate (BAR) + Programme upcharge
```

The programme upcharge is the `pricePublic` value from the table above ($110 / $130 / $190 / $210 / $220 / $320 depending on programme and tier).

**Old rate plan names** that still appear on some folios:
- `Retreat Packages Base Rate` — predecessor to the current named plans
- `Heart of Laos Journey (4N/5D)` — old product line name
- `Namkhan Balance Mini (2N/3D)` — old product line name

---

## 4. Revenue split — rooms vs. package

**Current state in Cloudbeds (as of 2026-09-07):**
The entire nightly rate posts as `category: rate`, `usali_dept: Rooms`, `usali_subdept: Transient`.
This means all retreat revenue — including the meals, spa, and activity component — is credited to Rooms.

**What should happen:**
- **Room component** = nightly rate − programme upcharge → Rooms
- **Package component** = programme upcharge × nights → F&B + Spa + Activities

**How the analytics page calculates the split:**
```
packageRevenue = pricePublic × nights
roomRevenue    = total_amount − packageRevenue
```

The "Revenue split" table on `/operations/retreats` shows this per programme × tier.

**To fix in Cloudbeds:**
Use rate plan included items (back-office posting only, not shown in booking engine)
to split the nightly rate into a room charge and a retreat package charge posting
to separate USALI departments. The mechanism exists — some folios already show
`Harmony & Mindfulness (Essential Tier Price per Day)` posting to `Other Operated / Spa`.
Needs to be applied consistently across all six rate plans.

---

## 5. Analytics page

**URL:** `/operations/retreats` (redirects from `/h/260955/operations/retreats`)
**File:** `app/operations/retreats/page.tsx`
**Data source:** `pms.v_reservations` + `pms.v_transactions` (silver views, read-only)

### FIT identification logic

A reservation is a FIT retreat if ANY of these is true:
1. `source_name` is `BookRetreats` or `Book Yoga Retreats by Tripaneer`
2. `rate_plan` (lowercase) contains `(essential)` or `(immersion)`
3. `reservation_id` appears on a folio with a retreat add-on product
   (description matches: *heart of laos*, *namkhan balance*, *namkhan detox*,
   *namkhan harmony*, *serene couples*, *retreat package*)

### Sections

| Section | What it shows |
|---|---|
| FIT programmes | 3-column panel: pricing + inclusions per programme × tier |
| FIT performance | KPI tiles: revenue, ADR/night, avg LOS, add-on/stay, cancellation rate, package revenue, room revenue |
| Revenue split | Programme × tier table: total / package / room / extra spend with % footer |
| By programme | Stays, revenue, ADR/night, avg LOS, cancellations per programme |
| Monthly revenue | SVG bar chart by check-in month |
| All retreat bookings | Full feed — every stay confirmed + cancelled, cancelled shown struck-through |
| Add-on spend | Non-room folio charges on retreat folios, top 15 by value |

---

## 6. Group retreats (separate scope)

**eVigeosport** and other group organisers booking multiple rooms are NOT included
in the FIT retreat analytics. They will have their own page under Operations > Groups
when built. Do not mix group and FIT retreat data.

---

## 7. Open items

| # | Issue | Status |
|---|---|---|
| 1 | Revenue posting — all rate posts to Rooms, should split at Cloudbeds level | Open — requires Cloudbeds rate plan config change |
| 2 | OTA bookings (BookRetreats / Tripaneer) — programme and tier not in rate plan | Open — no fix available without OTA providing it |
| 3 | Old rate plan names (Heart of Laos, Namkhan Balance) — attribution uncertain | Informational |
| 4 | Group retreats page | Not started |
