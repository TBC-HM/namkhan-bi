# Hotel Business Rules

These are non-negotiable business rules that override technical convenience. Apply to all Namkhan and Donna Portals work.

## Revenue principles

- **Direct booking is primary KPI** — never reduce direct conversion to gain marginal OTA volume
- **No rate erosion** — don't drop ADR without strategic reason (high-occupancy period, last-minute strategy, group business)
- **Distribution control** — hotel controls which OTAs sell, at what rate, via channel manager
- **Rate parity** — same room, same date, same price across OTAs (with permitted direct discount)
- **Cloudbeds is sole revenue source** for Namkhan — every revenue change reflects there first

## Pricing

- BAR (Best Available Rate) is the daily anchor
- LOS (Length of Stay) discounts only for 4+ nights
- Last-minute discounts ≤72h before arrival, ≤15% off BAR
- Early bird ≥45 days, ≤20% off BAR
- Direct booking discount: max 10% off OTA, communicated as "best price guarantee + perks"

## Occupancy logic

- Target occupancy 75%+ year-round
- Dynamic pricing: increase rate when forecast occupancy >85% next 14 days
- Decrease rate (within rate floor) when forecast <50%
- Never go below rate floor — defined per season per room type
- Never close out direct booking before OTAs

## OTAs (channel rules)

- Booking.com — primary, full inventory
- Expedia — secondary, full inventory
- Agoda — Asia focus, full inventory
- Specialty (SLH, Mr & Mrs Smith) — full inventory, Namkhan only
- Direct — 100% inventory, best rate match + perks

Never propose adding a new OTA without ADR analyzing: commission, fit, expected volume, risk to direct.

## F&B (The Roots, Namkhan)

- Cost target: 28-32% of F&B revenue
- Beverage cost target: 22-26% of beverage revenue
- Wastage tracked daily, target <3%
- Menu engineering quarterly
- Local sourcing prioritized for sustainability narrative

## USALI compliance

- All revenue/expense reporting follows USALI standards
- See `cockpit/standards/usali.md` for mapping reference
- Cloudbeds → USALI mapping defined in Supabase `usali_mapping` table
- Monthly reports must reconcile to USALI categories

## Currency rules (Namkhan)

- LAK is base operational currency
- USD used for: OTA-facing rates, owner reporting, international guests
- FX rate fixed at booking time, stored on booking record
- Never mix currencies in same calculation without explicit conversion
- FX volatility tracked monthly — gain/loss reported separately

## Guest experience standards

- Response to inquiry: <4h business hours, <12h overnight
- Booking confirmation: instant
- Pre-arrival communication: 7 days before arrival
- Special requests logged in PMS, fulfilled or declined within 24h
- Post-stay survey: within 48h of checkout

## Marketing rules

- Tone: "casual luxury" (Namkhan), "premium beach club" (Donna)
- Never claim what isn't true (no "5-star" if not awarded)
- Photos: real property photos primary, AI-enhanced acceptable, AI-generated only for concepts (clearly marked)
- Reviews: respond to 100% within 7 days, never argue, always thank
- Never offer discount in exchange for review (TripAdvisor/Booking violation)

## Content rules (Namkhan YouTube/social)

- Full Moon Meditations align with lunar calendar (real moon dates)
- River Tales = Lao folklore only, never invented
- Temple/monk content: only with permission, respectful framing
- "Grace" virtual guide persona consistent across content
- SLH logo on all branded materials, bottom left
- Soho House-style typography

## Donna Portals specifics

- Beach club premium positioning — never compete on price
- Bali bed photography always included in package visuals
- 50/50 profit split structure with partners (after cost recovery)
- Equity option after 12 months of partnership
- Black + dark green color scheme for presentations

## Decisions to escalate (never auto-decide)

- Adding/removing room types
- Adding/removing OTA channels
- Changing rate floors
- Changing commission rates
- Modifying USALI mapping
- New revenue stream / package launch
- Partnership terms
- Equity discussions

These all require PBS approval via email or in-person decision.
