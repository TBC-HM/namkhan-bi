# Backlog: Rate Plans Page — Option C (Strategic Overhaul)

**Status:** PARKED · **Owner:** Claude · **Estimated effort:** 4–6 hours
**Depends on:** Option B deployed first
**Created:** 2026-05-02 · **Decided by Paul:** "B now and remember C. for later"

---

## What Option C adds beyond B

### 1. Rate plan reconciliation (`v_rate_plan_mapping`)
Bridge the **40% orphan rate** between `rate_plans` master (100 rows) and `reservations.rate_plan` free-text (293 distinct lifetime values).

Approach options:
- **Manual mapping table** (Paul/RM curates `rate_plan_aliases (alias text, master_rate_id text)`) — clean but ongoing maintenance burden
- **Fuzzy match** (similar to `v_commission_lookup` for OTAs) — auto, ~85% accuracy, breaks on edge cases
- **Hybrid** — fuzzy match suggests, manual override stored in alias table — best ROI

### 2. Channel mix per plan
For each plan, show: % Direct / % Booking / % Expedia / % Synxis / % Other
Joins `reservations.rate_plan` × `reservations.source_name`.
**Why it matters:** Tells you which plans are sold where. Useful for parity audits — if "Advance Purchase Rate" sells 70% on Booking.com, parity violation likely.

### 3. Cannibalization detector
Plans with overlapping names/intent that compete:
- "NKMembers Non Refundable Rate" vs "Non Refundable" — same product, different price?
- "Advance Purchase Rate" vs "NKMembers Advance Purchase Rate" — member discount being offered to non-members?

Logic: pairs of plans where ADR delta < 10% AND name similarity > 70% AND both have bookings.

### 4. Comparison period support (`?cmp=`)
When user picks `?cmp=stly` or `?cmp=pp`, show vs columns for:
- Bookings Δ
- Revenue Δ
- ADR Δ
- Cancel rate Δ

Pattern is already in lib/period.ts — just need to wire it in the rateplans page.

### 5. Plan lifecycle dashboard
For each plan, show the trajectory:
- Bookings/revenue per month, last 12 months
- "Trending up / flat / declining" badge
- "Launched" date (first ever booking) vs "Retired" suggestion

### 6. Auto-retirement recommendations
For each sleeping plan, score retirement confidence:
- Days idle (90+/180+/365+)
- Lifetime revenue
- Cloudbeds `is_active` flag
- Whether room types still exist

Output: ranked list with action button "Mark for retirement" → writes to a queue Paul reviews monthly.

---

## Why this is parked, not done now

1. **No fuzzy-match infra yet for rate plans.** OTAs got a lookup table because there are ~10 OTAs. Rate plans have 293 distinct values — fuzzy matching at scale needs more design (trigram index? embeddings?).
2. **B already moves the needle.** Top 3 = 51% revenue, 67 sleeping plans, plan-type rollup — these alone unlock 80% of the decisions Paul actually needs to make on rate plans.
3. **C requires manual ongoing work** (mapping table maintenance) — better to validate B is enough first.

---

## Trigger to re-prioritize

Pull C off the backlog if Paul ever:
- Asks "which channel sells the Advance Purchase rate?" (channel mix)
- Asks "is the Member rate cannibalizing direct bookings?" (cannibalization)
- Wants plan retirement automation
- Wants STLY/prior-period comparison on rate plans specifically

---

## Files (when built)

```
sql/
  rateplan_mapping.sql              -- alias table + fuzzy match function
app/revenue/rateplans/
  page.tsx                          -- v3 with comparison, channel mix, cannibalization
components/rateplans/
  PlanLifecycleSparkline.tsx
  CannibalizationCard.tsx
docs/
  17_RATE_PLAN_TAXONOMY.md          -- Paul's mapping rules + plan-type definitions
```
