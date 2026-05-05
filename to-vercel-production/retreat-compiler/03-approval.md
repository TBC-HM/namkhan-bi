STATUS: approved · revision 1
DECISION: approve
COMMENTS: PBS approved 2026-05-04 with scope expansion — guest configurator (room × tier × board × program toggles), full marketing site (not 3-page funnel), operator retreat editor with re-compile chain. All deltas captured in 04c-website-and-configurator.md. Proceed to Stage 2.5 staging dry-run, then Stage 3 code spec + Make blueprints, then Stage 4 deploy handoff.

REVISION 1 NOTES (Stage 1 build, scheduled run 2026-05-03):
- Brief authored from parent spec `feature-builder/inbox/retreat-compiler-spec.md` + addendum 01
- Mockup built using app CSS tokens (paper / moss / brass / oxblood), Fraunces serif italic + Inter Tight + JetBrains Mono — matches `/sales/inquiries` rev 3
- 14 screens covering: prompt entry, compile progress, 3-variant comparison, variant detail, itinerary edit, PDF + funnel preview (4-tab), deploy with design A/B/C pick, success state, public lead magnet, public retreat detail, public checkout, booking confirmation, empty state, error state (margin breach + RM override)
- Mock data inferred from parent spec: Mindfulness 5D Lux, full moon Sept 27 2026, 8 pax, 3 variants ($1,890 / $2,290 / $2,890 per pax)
- USALI revenue split surfaced on result screen (Rooms 58% / F&B 17% / Activities 19% / Spa 6%)
- Lunar glyph auto-attached on Day 3 (Mindfulness theme rule)
- Margin floor breach modeled in error screen with 3 resolution paths (re-price / drop variant / RM override)
- 30/70 deposit + Stripe + Cloudbeds reservation flow modeled end-to-end on guest side

OPEN BLOCKERS (cannot resolve in this stage):
- Sheet "Namkhan Packages 1.2" not connected via Sheets MCP — Phase 0 mapping deferred
- `/content/series/*.json` lunar calendar + series taxonomy not present in repo — needed before Phase 1 seed
- Stripe account topology (one vs per-property) — affects webhook reconciliation logic

---

PROTOTYPE: file:///Users/paulbauer/Documents/Claude/Projects/cloudbeds%20Vercel%20portal/feature-builder/output/retreat-compiler/02-prototype.html
BRIEF: ./01-brief.md
SCREEN MAP: ./02b-prototype-map.md

NOTE: prototype hosted as file://. Once `PROTOTYPES_REPO_PATH` is configured (SETUP.md step 6), this URL will be replaced with `https://prototypes.thenamkhan.com/retreat-compiler/` for phone testing. Until then, open the file:// URL in Chrome on your Mac.

INSTRUCTIONS:
1. Open the prototype URL above in Chrome
2. Click through the test paths in `02b-prototype-map.md`:
   - Operator happy path (prompt → compile → variant → edit → preview → deploy → success)
   - Guest happy path (lead → detail → checkout → booked)
   - Margin breach error (result → trigger error → resolution options)
   - Empty state, reset
3. Read `01-brief.md` (max 800 words)
4. Set DECISION above to: approve | revise | reject
5. Add COMMENTS if revising — include screen + change request

PARSER REGEX: DECISION:\s*(approve|revise|reject)
