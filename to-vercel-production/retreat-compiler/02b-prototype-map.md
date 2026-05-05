# Prototype Navigation Map — retreat-compiler

## Screens

| Hash route | Screen | Purpose |
|---|---|---|
| `#/` | Home / Compiler entry | Prompt input + 4 mock recent runs + 4 preset prompts |
| `#/compile?run=R-001` | Compile in progress | 6-step animated parser → variant builder, auto-advances to result |
| `#/result?run=R-001` | Variant comparison | 3 cards (Garden / River-recommended / Villa) + USALI revenue split table |
| `#/variant?run=R-001&v=B` | Variant detail | Day-by-day itinerary (5 days) + pricing breakdown + currency lock + cancellation policy |
| `#/edit?run=R-001&v=B` | Itinerary editor | Per-day expandable inputs · live recalc · brand check list · swap inventory |
| `#/preview?run=R-001&v=B` | PDF + funnel preview | 4 tabs: 9-page PDF · lead magnet · retreat detail · checkout |
| `#/deploy?run=R-001&v=B` | Design pick + deploy | 3 design tiles (Editorial / Minimalist / Conversion) · subdomain input · bundle list |
| `#/success?run=R-001&v=B` | Deploy success | Vercel deploy log · live links · next-step checklist |
| `#/funnel/lead?slug=mindfulness-summer` | Live · Lead magnet | Public guest view · email capture · GDPR consent toggle |
| `#/funnel/detail?slug=mindfulness-summer` | Live · Retreat detail | Public guest view · hero · what's included · sticky pricing card · FAQ · review |
| `#/funnel/checkout?slug=mindfulness-summer` | Live · Checkout | Public guest view · form + add-ons · sticky 30/70 deposit summary |
| `#/funnel/booked?slug=mindfulness-summer` | Live · Booking confirmation | Stripe success · Cloudbeds reservation ID · QR code |
| `#/empty` | Empty state | No runs yet — first-use guidance |
| `#/error` | Error state | Margin floor breach with 3 resolution options + RM override |

## Test paths

1. **Happy path — operator side**
   `#/` → click preset "mindfulness 5D lux" → click `compile →` → auto-advances through `#/compile` → `#/result` → click variant B card → `#/variant` → click `render PDF + funnel →` → `#/preview` → tab through PDF / lead / detail / checkout → click `pick design + deploy →` → `#/deploy` → click design B tile → click `Ship it →` → `#/success` → click `view live retreat page →`

2. **Happy path — guest side**
   `#/funnel/lead` → enter email → `Send me the guide` (alert confirms Klaviyo trigger) → manually `#/funnel/detail` → click `Reserve your spot →` → `#/funnel/checkout` → fill form → `Pay $1,518 deposit →` → `#/funnel/booked`

3. **Edit itinerary**
   `#/result` → variant B → `#/variant` → `edit itinerary` → `#/edit` → expand Day 2, change PM slot → toggle "Include this day" → `save & preview →` → `#/preview`

4. **Margin breach error**
   `#/result` → click `trigger error` button → `#/error` → review 3 options + RM override path

5. **Empty state**
   `#/` → click `view empty state →` link → `#/empty`

6. **Reset**
   Any screen → top bar `reset` button → confirm → all localStorage cleared, returns to `#/`

## Notes for review

- **Brand tokens:** paper #efe6d3, moss #1a2e21, brass #a8854a, oxblood #6b1f1f. Fraunces serif/italic for display, Inter Tight sans for UI, JetBrains Mono for codes/SKUs/timestamps. Matches existing `/sales/inquiries` and `/sales/proposals` rev 3.
- **Logos:** Namkhan italic top-left, SLH small-caps bottom-right of PDF preview (mandatory per parent §6).
- **Lunar glyph:** rendered as small radial gradient circle next to full-moon days (Day 3 in mock).
- **No horses, no stables** — copy audited.
- **USALI mapping** visible on `#/result` (revenue split table).
- **Margin floors** referenced on `#/edit` (brand checks) and surfaced as halt condition on `#/error`.
- **Currency lock** — LAK base / USD display / 7-day FX lock surfaced on `#/variant`.
- **Cloudbeds bridge** mock'd as "live availability · 4 River Suites" on `#/funnel/checkout` (real version queries `public.rate_inventory`).
- **Mock data inferred from parent spec, not Sheet** — Mindfulness 5D Lux example. When Sheets MCP is connected, prototype will pull live tabs.
- **File size:** ~33 KB single HTML, no external JS frameworks (vanilla + Tailwind CDN), works offline once loaded, mobile-tested at 375 px.
- **Persistence:** localStorage key `proto_retreat_compiler_v1` stores prompt, picked variant, design choice, edits, subdomain. `reset` button clears it.
