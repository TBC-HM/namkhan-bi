# Sales › B2B/DMC — Full Tab Spec v3

> Consolidates contracts, reconciliation, and partner drill-down into one coherent build.
> Date: 2026-05-01 · Status: 🟢 spec locked, ready for build
> Supersedes spec v1 + v2 (kept in repo for history)

---

## Table of contents

1. [Tab structure](#1-tab-structure)
2. [Information architecture](#2-information-architecture)
3. [Routing](#3-routing)
4. [Top-level KPI strip](#4-top-level-kpi-strip)
5. [Sub-section A — Contracts](#5-sub-section-a--contracts)
6. [Sub-section B — Reconciliation Queue](#6-sub-section-b--reconciliation-queue)
7. [Sub-section C — Partner Drill-Down (cross-cutting)](#7-sub-section-c--partner-drill-down)
8. [Sub-section D — Performance](#8-sub-section-d--performance)
9. [Backfill — historical bookings since 2025-01-01](#9-backfill)
10. [Schema summary](#10-schema-summary)
11. [Agent integration](#11-agent-integration)
12. [Backlog](#12-backlog)
13. [Open questions](#13-open-questions)

---

## 1. Tab structure

```
Sales › 05 B2B / DMC
├── A. Contracts            — manage 25 LPAs (upload, list, detail)
├── B. Reconciliation       — map LPA-rate-plan reservations to partners
├── C. Partner Drill-Down   — opens from any partner reference (slide-in or full page)
├── D. Performance          — DMC scorecard (revenue, RNs, parity, mapping health)
└── E. Inquiries (Phase 2)  — B2B email triage
```

---

## 2. Information architecture

The same data appears in 3 places, optimised for different intent:

| Place | Intent |
|---|---|
| Contracts list | "Show me my contract paperwork — what's expiring, what needs renewal" |
| Reconciliation queue | "Show me bookings I haven't mapped to a partner yet" |
| Partner drill-down | "Tell me everything about Asian Trails — contract + history + bookings + parity status" |

The drill-down is the **integration view**. It pulls from `dmc_contracts`, `dmc_contract_rates`, `dmc_reservation_mapping`, `parity_violations`, `public.reservations` — and presents one coherent partner story.

It opens from:
- Clicking a partner name anywhere in the app
- Clicking a contract row in Contracts list
- Clicking a suggested partner in Reconciliation queue
- Clicking a partner row in Performance scorecard
- Clicking a `governance.parity_violations` row that references a contract

---

## 3. Routing

| URL | Purpose |
|---|---|
| `/sales/b2b-dmc` | Default to Contracts list |
| `/sales/b2b-dmc/contracts` | Contracts list (KPI strip + filters + table) |
| `/sales/b2b-dmc/contracts/upload` | Single + batch upload |
| `/sales/b2b-dmc/contracts/[contract_id]` | Contract detail (legacy from v1, redirects to drill-down) |
| `/sales/b2b-dmc/reconciliation` | Reconciliation queue |
| `/sales/b2b-dmc/performance` | DMC scorecard |
| `/sales/b2b-dmc/partner/[partner_id]` | **Partner drill-down (canonical URL)** |

Drill-down is **always slide-in (60% screen) from the right** when triggered from inside another view. Direct URL access opens it as a full page.

---

## 4. Top-level KPI strip

Persistent across all sub-sections (matches Inquiries tab styling):

| Tile | Source | Mandate |
|---|---|---|
| Active contracts | `count WHERE status='active'` | — |
| Expiring < 90d | `v_dmc_contracts_expiring` | review 90d |
| Open parity violations | `parity_violations WHERE status IN ('open','letter_drafted','followup_pending')` | OTA parity ±2% |
| Unmapped reservations | `dmc_reservation_mapping WHERE mapping_status='unmapped'` | DQ SLA 24h |
| RNs YTD via DMCs | `count(reservations) WHERE mapping_status IN ('mapped_human','mapped_auto') AND year=current` | — |
| DMC revenue YTD | sum, USD via FX | RevPAR floor 85 |

---

## 5. Sub-section A — Contracts

(Unchanged from v2 — covered in `sales_b2b_dmc_contracts_spec_v2.md`. Summarised here.)

### List view
- KPI strip + filter bar + 11-column table
- Status badge derived from days-to-expiry + open violations count
- Bulk actions: export CSV, email partner, mark for review

### Upload zone
- **Single PDF**: drag-drop → `contract-parser` Edge Function → review form → save
- **Batch**: up to 25 PDFs in queue → review each → bulk-save
- **Manual**: blank form for contracts without PDF

### Detail
- Replaced by partner drill-down (section 7). Clicking a contract row opens drill-down with Contract tab pre-selected.

---

## 6. Sub-section B — Reconciliation Queue

(Unchanged from v2. Summarised.)

### Detection
Hourly `pg_cron` calls `governance.detect_dmc_reservations()` — flags any reservation with rate plan matching `dmc_rate_plan_filters` patterns.

### Queue UI
- Top KPI tiles (unmapped today, backlog, suggested, mapped this month, avg time-to-map, top hint accuracy)
- Filter bar
- One-row-per-reservation table with **[Confirm] / [Other] / [Not DMC]** actions
- Bulk-confirm for same suggested partner
- Detail drawer per row

### Hint learning
Every action updates `partner_mapping_hints` accuracy stats. Self-improving.

### SOP requirement
Reservations team processes queue twice per shift. Goal: zero unmapped >24h. Surface the backlog count painfully on the Owner dashboard.

---

## 7. Sub-section C — Partner Drill-Down

This is the **payoff view**. Single partner, full story, slide-in from right.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← back        ASIAN TRAILS LAOS         [Edit]  [Renew]  [⋯]   │
│  ─────────────────────────────────────────────────────────────  │
│  🟢 Active · LPA 2026-2027 · expires 30 Sep 2027 (147 days)      │
│  Type: DMC · Country: 🇱🇦 Laos · VAT: 569983920900               │
│  Address: 4th Floor, Premier Building, Vientiane                 │
│  Contact: Mr. Santixay Vongsanghane · Inbound Manager            │
│  ✉ santixay@asiantrailslaos.com · 📞 +856 21 410444              │
│  ─────────────────────────────────────────────────────────────  │
│  [ 1 Overview ] [ 2 Contract ] [ 3 Bookings ] [ 4 Parity ]      │
│  [ 5 Performance ] [ 6 Activity ] [ 7 Documents ]                │
└─────────────────────────────────────────────────────────────────┘
```

7 tabs within the drill-down. Each pulls from existing tables — no new schema needed.

### Tab 1 — Overview (default)

Summary card grid:

| Card | Content |
|---|---|
| **Contract status** | Active · effective 01 Oct 26 → 30 Sep 27 · 147 days remaining · auto-renew NO |
| **Booking activity** | 47 mapped reservations YTD · 312 RNs · ADR USD 215 · last booking 3 days ago |
| **Parity health** | 0 open violations · last scan today 06:00 · 2 historical violations resolved |
| **Anti-publication clause** | ✅ Present — verbatim text in expandable card |
| **Pricing posture** | NETT · group surcharge +20% · 6+ keys threshold · extra bed USD 50 |
| **Renewal countdown** | 147 days · auto-alerts at 90/60/30/14/7/1 day · last alert: not yet |
| **Action items** | List of pending items (e.g., "Tiger Trail-style: VAT missing", "Address requires verification") |

### Tab 2 — Contract

Full contract terms:
- All metadata fields (legal name, type, country, VAT, address, contact)
- Effective dates and signed dates
- Pricing posture and policies
- **Rate sheet** — the 9-room × 3-season grid from `dmc_contract_rates`. Editable inline (Owner only). Toggle LPA Nett / Public Rate display.
- Anti-publication clause text (verbatim)
- Termination clause text (verbatim)
- Cancellation policy (text + structured tiers)
- Special offers (Green Season rebate program, AQTOL collaboration, etc.)
- Notes
- **Footer actions**: [Edit fields] [Suspend] [Terminate] [Renew → creates new contract draft for next year, dates rolled forward]

### Tab 3 — Bookings

All mapped reservations for this partner.

Table columns:
- Booking date · check-in · check-out · nights
- Guest name + email
- Room type
- ADR USD · total USD
- Mapping confidence + method (`mapped_human` 1.0, `mapped_auto` 0.95, etc.)
- Mapped by + when
- Cloudbeds source on this res

Filters:
- Date range (default last 90 days, can extend back to 2025-01-01)
- Room type
- Check-in window (5d / 30d / 90d / YTD)
- Status (confirmed / cancelled / no-show)

Top of table:
- Aggregate KPI: total RNs, total revenue USD, ADR USD, cancellation rate, avg LOS
- Compared vs same-period-LY if data available

Click a row → Cloudbeds deeplink to that reservation's full details.

### Tab 4 — Parity

All `parity_violations` rows where `hypothesised_source_contract_id = this.contract_id`.

Sub-sections:
- **Open violations** — list with severity, observed rate, our BAR, channel, hypothesis confidence, age, action status
- **Resolved violations** — historical
- **Letters sent** — copy of every market-mgr email + cease-and-desist sent regarding this partner
- **Action buttons**: [Run targeted scan now] [Draft cease-and-desist]

If 0 violations ever: green "Clean record since {detection_start_date}".

### Tab 5 — Performance

Partner-specific scorecard:

| Metric | Value | LY same period | Mandate |
|---|---|---|---|
| Room nights YTD | 312 | 287 | — |
| Revenue USD YTD | 67,200 | 58,900 | RevPAR floor 85 |
| ADR USD | 215 | 205 | ADR floor 180 |
| Cancellation rate | 6.2% | 8.1% | ceiling 15% |
| Direct bookings via this DMC | 0 (DMC only) | 0 | — |
| Lead time avg days | 47 | 52 | — |
| % of total wholesale revenue | 18% | 16% | — |
| Avg confidence of mapping | 0.94 | n/a | — |
| Unmapped LPA bookings (suspect this partner) | 2 | n/a | DQ |

Charts:
- Monthly RN trend YTD vs LY
- Room type mix donut
- Lead-time histogram
- Top 10 guest sources within this DMC (countries / cities)

### Tab 6 — Activity

Timeline of every event affecting this partner:
- Contract signed (with PDF link)
- Contract amendments
- Rate sheet edits
- Renewal alerts fired
- Parity violations detected/resolved
- Letters sent
- Bookings (compressed — show count per week with click-through to Bookings tab)
- Manual edits by Owner/GM with diff
- Mapping queue actions (e.g., "Reservation X mapped to Asian Trails — Maria — 14:32")

Filterable by event type. Useful for audit trails and Owner reviews.

### Tab 7 — Documents

- **Signed PDFs**: current + historical versions (amendments)
- Embedded PDF viewer
- Download button
- Replace PDF (creates new version, doesn't overwrite)
- Other docs: addendums, rate amendments, anti-publication breach evidence (if attached)

### Top-level partner actions

Always visible in the drill-down header regardless of tab:
- **[Edit]** — opens edit form (Owner+GM)
- **[Renew]** — creates new contract draft pre-filled with current data + dates rolled forward (Owner only)
- **[⋯]** menu:
  - Suspend partner
  - Terminate partner (Owner only, confirmation dialog quoting termination notice)
  - Email partner (opens Gmail compose pre-filled with contact)
  - Export partner data CSV
  - Print partner profile PDF
  - View Cloudbeds source mapping

---

## 8. Sub-section D — Performance

Cross-partner scorecard. Doesn't replace partner drill-down — it complements it.

### Default view: ranked table
Columns: partner · type · RNs YTD · revenue USD YTD · ADR · cancellation % · open parity violations · mapping confidence avg · last booking · trend arrow vs LY.

Sort by any column. Defaults to revenue desc.

### Top filters
- Date range
- Active contracts only / all
- Country
- Partner type (dmc, wholesaler, bedbank, etc.)

### Charts
- Top 10 partners by revenue YTD (bar chart)
- Revenue concentration: % of DMC revenue from top-N partners (Pareto curve)
- Mapping health: % of LPA reservations mapped within 24h, by month

### Click partner row → opens drill-down

---

## 9. Backfill

Now that all reservations since 2025-01-01 are imported and rate plan was fixed last year:

### Backfill function

```sql
SELECT governance.detect_dmc_reservations(since_ts := '2025-01-01'::timestamptz);
```

This will create mapping rows for **every historical LPA-rate-plan reservation** dating back to 2025-01-01.

### Pre-backfill verification (DO BEFORE RUNNING)

Carl runs this query first:

```sql
SELECT
  rate_plan_name,
  count(*) as res_count,
  min(check_in_date) as earliest,
  max(check_in_date) as latest,
  count(distinct source_id) as distinct_sources
FROM public.reservations
WHERE check_in_date >= '2025-01-01'
GROUP BY rate_plan_name
ORDER BY res_count DESC;
```

**Expected output**: list of every distinct rate plan name used since 2025. Confirm:
- "Leisure Partnership Agreement" (or exact variant) is the dominant pattern for DMC bookings
- No legacy variants slipped through ("Wholesale Rates", "DMC Net", "LPA 2024-25", etc.)
- If variants found → add patterns to `dmc_rate_plan_filters` BEFORE running backfill

### Backfill workflow

1. Verify rate plan names (above)
2. Run `detect_dmc_reservations(since_ts := '2025-01-01')` → expect 500-2000 rows in queue
3. Hint engine pre-suggests partners using current 10 seeded hints (5 contracts × 2 hints each)
4. **Reservations team processes the backfill queue** — bulk-confirm where suggestion is correct (likely 60-80% hit rate after a few sessions as hints learn)
5. Estimated time: 2-4 hours of focused work spread over a week (not in one go)

### What about reservations from DMCs we no longer have contracts for?

These will land in queue as unmapped, no suggestion (no hints for archived DMCs).

**Decision: create archive contracts retroactively.**

For each historical-only DMC partner identified during backfill:
- Reservations team flags it as a new option in queue: "Add archive partner: [name]"
- Creates a `dmc_contracts` row with `status='terminated'`, effective dates from booking data, all other fields blank
- Hints created from email/source patterns
- Future bookings auto-detected if any (shouldn't happen, but safety net)

This way: every historical booking ends up mapped, drill-down works for legacy partners too, no orphan data.

### Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rate plan name drift detected during verification | medium | Add patterns to filter table before backfill |
| 200+ "ghost partners" surface (legacy or test bookings) | medium | Archive contract creation flow handles. Bulk-create from queue. |
| Reservations team overwhelmed by queue size | high | Time-box. Process in 30-min sessions. Bulk-confirm where possible. Don't try to do all in one day. |
| Hint accuracy poor in early days because few hints exist | high | Expected. As mappings increase, suggestions improve. First 50 confirmations are slow; next 500 are fast. |
| False positives — direct bookings tagged with LPA rate plan | low-medium | "Not DMC" reject flow. Each rejection improves filter quality. |

### Owner-visible KPI during backfill

Backfill mode displays a banner: *"Historical reconciliation in progress — 1,247 of 1,890 bookings mapped (66%)"* on the B2B/DMC tab. Disappears when backlog cleared.

---

## 10. Schema summary

All schemas already in 3 migrations:

| Migration | Tables/Functions | Status |
|---|---|---|
| `phase2_00_dmc_contracts.sql` | `dmc_contracts`, `dmc_contract_rates`, `parity_violations` + 3 views | ✅ delivered |
| `phase2_01_compset_schema.sql` | 6 compset tables + 3 views | ✅ delivered |
| `phase2_02_dmc_reconciliation.sql` | `cloudbeds_sources_mirror`, `dmc_rate_plan_filters`, `dmc_reservation_mapping`, `partner_mapping_hints` + 3 views + 2 functions | ✅ delivered |

**Plus needed for v3 build (small additions):**

```sql
-- Add to phase2_00 or new migration
ALTER TABLE governance.dmc_contracts
  ADD COLUMN cloudbeds_source_id text,
  ADD COLUMN cloudbeds_source_label text,
  ADD COLUMN version int DEFAULT 1,
  ADD COLUMN supersedes_contract_id uuid REFERENCES governance.dmc_contracts(contract_id),
  ADD COLUMN superseded_by_contract_id uuid REFERENCES governance.dmc_contracts(contract_id);

-- Already covered: contract_drafts, dmc_upload_log (in spec v1)
```

---

## 11. Agent integration

Agents that read from this tab's data:

| Agent | What it reads | What it writes |
|---|---|---|
| `parity_agent` | `dmc_contracts` (anti-pub clause for letter), `dmc_reservation_mapping` (which contracts are active in real bookings) | `parity_violations` (linked to contract_id) |
| `compliance_agent` | `dmc_contracts` (effective dates) | `docs.expiry_alerts` for renewals |
| `lead_scoring_agent` | `partner_mapping_hints` (match inbound emails to known partners) | `proposals` (pre-fill partner in B2B response) |
| `data_quality_agent` | `dmc_reservation_mapping` (unmapped older than 24h) | DQ violation entries |
| `proposal_outcome_agent` | All approval data linked to DMC contracts | Performance scorecard data |

### Agent strip on B2B/DMC tab header

```
● AGENTS · LIVE   ⊕ Parity Watchdog · daily 06:00   ⊕ Compliance · daily 06:00
                  ⊕ Lead Scoring · on inbound       ⊕ Data Quality · every 4h
```

Click any → drawer with last 7 runs, hit-rate, current status. Re-uses `08 Agents` tab UX.

---

## 12. Backlog

| ID | Item | Effort | Owner |
|---|---|---|---|
| F17 | Sales pillar route + B2B/DMC tab structure | 1 day | Frontend |
| F18 | `contract-parser` Edge Function | 1 day | Backend |
| F19 | Contract upload UI (single + batch) | 1 day | Frontend |
| F20 | Contract review queue UI (parsed-but-unsaved) | 0.5 day | Frontend |
| F21 | Contracts list view + KPI strip | 1 day | Frontend |
| **F22** | **Partner drill-down (slide-in + 7 tabs)** | **3 days** | **Frontend** |
| F23 | Reconciliation queue UI + bulk-confirm | 2 days | Frontend |
| F24 | `detect_dmc_reservations` cron + webhook | 0.5 day | Backend |
| F25 | Hint suggestion engine integration | 1 day | Backend + Frontend |
| F26 | Backfill workflow + UI banner | 1 day script + manual review time | Backend + Reservations |
| F27 | SOP: "Daily DMC reconciliation" → `knowledge.sop_meta` | 30 min | Consultant |
| F28 | Performance scorecard view | 1.5 days | Frontend |
| F29 | Add `cloudbeds_source_id` + version cols to `dmc_contracts` | 1 hour | Backend |
| F30 | Cloudbeds `/getSources` daily sync to `cloudbeds_sources_mirror` | 0.5 day | Backend |
| F31 | Archive partner creation flow (for historical DMCs) | 1 day | Frontend + Backend |

**Total: ~14.5 days frontend + 4 days backend + ongoing reservations team time for backfill.**

Critical path:
- F17 → F21 → F22 (drill-down) → F23 (reconciliation) → F26 (backfill) — front-end build sequence
- F18 → F19 → F20 — contract upload flow (parallel with above)
- F24 → F25 — detection + suggestions (backend foundation)

---

## 13. Open questions

1. **Rate plan name verification** — Carl runs the SQL above before backfill. Confirm exact pattern(s).
2. **Reservations role in RLS** — does `app.has_role('reservations')` exist? If not, create role + policy or fall back to `app.is_top_level()`.
3. **Drill-down navigation pattern** — slide-in (60% screen) on desktop, full page on mobile. Confirm or override.
4. **Renew flow specifics** — when Owner clicks [Renew], creates new contract draft for next year. Auto-roll dates by 1 year, copy all fields, status=draft. New PDF upload required to activate. Confirm logic.
5. **Cloudbeds source sync** — daily from `/getSources`, or webhook-triggered when sources changed? Daily is simpler.
6. **Archive partner creation** — should reservations team be allowed to create new contracts (even archive ones) during backfill? Or queue requests for Owner approval? Suggestion: queue for Owner. Avoids contract proliferation.

---

## What this DOES NOT cover

- B2B Inquiries sub-section (separate spec needed when Phase 1 stable)
- Per-partner email automation (Phase 2 — when Gmail connector live)
- DMC-specific rate plan management beyond the 3 master seasons (would require schema extension if any partner needs custom seasons)
- Multi-property scenarios (Namkhan-only for now)

These are flagged as future work, not Phase 1 scope.
