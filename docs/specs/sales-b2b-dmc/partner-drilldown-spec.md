# Partner Drill-Down — Deep Dive Spec

> Detailed UX + data spec for the slide-in/full-page partner profile.
> Companion doc to `sales_b2b_dmc_full_spec_v3.md` (section 7).
> Date: 2026-05-01 · Status: 🟢 spec locked, ready for build
> Implements backlog F22 (~3 days frontend)

---

## 1. Purpose

Single-screen view of EVERYTHING about a DMC partner. Eliminates the need to jump between tabs/pages. Owner/Reservations get every answer in one place:

- "When does our Asian Trails contract expire?"
- "How many bookings did Laos Autrement send us last quarter?"
- "Has Tiger Trail had any parity violations?"
- "What did Owner edit on this contract last month?"
- "Show me the signed PDF — when was it counter-signed?"

Each takes ≤2 clicks from anywhere in the app.

---

## 2. Entry points

The drill-down opens when user clicks any of these:

| Source | What user expects |
|---|---|
| Contract row in `Contracts` list | "Open this contract" |
| Partner badge on a `Reservation` | "Tell me about this partner" |
| Suggested partner in `Reconciliation` queue | "Verify this partner before I confirm" |
| Partner row in `Performance` scorecard | "Drill into the numbers" |
| Partner reference in a `Proposal` | "What contract is this proposal against?" |
| `Parity violation` row | "Which partner is leaking?" |
| Mention of partner name in `Activity feed` | "Open partner profile" |
| Direct URL `/sales/b2b-dmc/partner/[id]` | Bookmark, deep link, email |
| Search bar global → partner result | "Jump to this partner" |

---

## 3. Layout — slide-in vs full page

### Desktop (≥1280px)
- **Slide-in from right, 60% screen width**
- Backdrop is dimmed but visible (Owner can still see what they came from)
- Close button (X) top-right OR click backdrop OR ESC key
- URL updates to `/sales/b2b-dmc/partner/[id]` while drawer open
- Direct URL access opens drawer ON TOP of B2B/DMC tab

### Tablet (768–1279px)
- Slide-in 80% screen width

### Mobile (<768px)
- Full screen takeover. Back button replaces close.

### Always
- Header pinned at top (partner name + key actions)
- Tab navigation pinned below header
- Body scrolls within tab content

---

## 4. Header (sticky top)

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

### Status badge logic

| Color | Condition |
|---|---|
| 🟢 Green | `status='active'` AND no open parity violations AND days-to-expiry > 90 |
| 🟡 Amber | `status='active'` AND (open violations exist OR days-to-expiry ≤ 90) |
| 🔴 Red | `status` IN ('expired', 'terminated', 'suspended') OR repeat violations |
| ⚪ Grey | `status` IN ('draft', 'pending_countersign', 'archived') |

Tooltip on badge explains the reason.

### Header data sources (single query)

```sql
SELECT
  c.*,
  EXTRACT(DAY FROM (c.effective_to - CURRENT_DATE)) AS days_until_expiry,
  COUNT(pv.violation_id) FILTER (WHERE pv.status IN ('open','letter_drafted','followup_pending')) AS open_violations,
  COUNT(m.mapping_id) FILTER (WHERE m.mapping_status IN ('mapped_human','mapped_auto')) AS mapped_reservations_count,
  MAX(m.mapped_at) AS last_booking_mapped_at
FROM governance.dmc_contracts c
LEFT JOIN governance.parity_violations pv ON pv.hypothesised_source_contract_id = c.contract_id
LEFT JOIN governance.dmc_reservation_mapping m ON m.contract_id = c.contract_id
WHERE c.contract_id = $1
GROUP BY c.contract_id;
```

### Header action buttons

| Button | Visibility | Behavior |
|---|---|---|
| **[Edit]** | Owner + GM | Opens edit form (same fields as upload, but pre-filled). Save → updates contract row + activity log entry. |
| **[Renew]** | Owner only | Confirmation dialog. Creates new contract draft with: dates rolled +1 year, all metadata copied, version=current+1, supersedes=current.id, status=draft. Redirects to new contract for upload of new signed PDF. |
| **[⋯]** | varies | Dropdown: Suspend (Owner) · Terminate (Owner) · Email partner · Export CSV · Print profile PDF · View Cloudbeds mapping |

---

## 5. Tab 1 — Overview (default landing)

Card grid layout. 6 cards on desktop (3×2), stacked on mobile.

### Card A — Contract status

```
┌─────────────────────────────┐
│  CONTRACT STATUS            │
│                             │
│  🟢 Active                  │
│  LPA 2026-2027              │
│                             │
│  Effective                  │
│  01 Oct 26 → 30 Sep 27      │
│                             │
│  147 days remaining         │
│  ████████░░░░░░ 60%         │
│  (progress bar of contract  │
│   year)                     │
│                             │
│  Auto-renew: NO             │
│  Next alert: 18 Jul         │
└─────────────────────────────┘
```

Sources: `dmc_contracts.effective_from`, `effective_to`, `auto_renew`, `docs.expiry_alerts` (next pending alert for this contract).

### Card B — Booking activity

```
┌─────────────────────────────┐
│  BOOKING ACTIVITY            │
│                             │
│  47 mapped · 0 unmapped     │
│  (YTD)                      │
│                             │
│  312 room nights            │
│  USD 67,200 revenue         │
│  USD 215 ADR                │
│                             │
│  Last booking 3 days ago    │
│  (15 May → 18 May)          │
│                             │
│  Trend ↑ +8% RNs vs LY      │
└─────────────────────────────┘
```

Sources: `dmc_reservation_mapping` joined to `public.reservations` for revenue/ADR.

### Card C — Parity health

```
┌─────────────────────────────┐
│  PARITY HEALTH              │
│                             │
│  ✅ 0 open violations        │
│                             │
│  Last scan today 06:00      │
│  Last violation: 3 mo ago   │
│  (resolved 04 Feb 26)       │
│                             │
│  Total ever: 2              │
│  Letters sent: 1            │
│                             │
│  [Run targeted scan →]      │
└─────────────────────────────┘
```

Sources: `parity_violations` filtered by `hypothesised_source_contract_id`.

### Card D — Anti-publication clause

```
┌─────────────────────────────┐
│  ANTI-PUBLICATION CLAUSE    │
│                             │
│  ✅ Present in contract      │
│                             │
│  ▼ Show clause text         │
│  ─────────────────────────  │
│  "LPA pricing is not        │
│  intended for publication   │
│  on Company websites and    │
│  cannot be on-sold to OTA   │
│  & Bedbank platforms..."    │
│                             │
│  Enforcement: Hard          │
│  termination clause         │
└─────────────────────────────┘
```

Sources: `dmc_contracts.has_anti_publication_clause`, `anti_publication_clause_text`, `enforcement_strength`.

### Card E — Pricing posture

```
┌─────────────────────────────┐
│  PRICING POSTURE            │
│                             │
│  Basis: NETT                │
│  Group surcharge: +20%      │
│  (6+ keys threshold)        │
│  Extra bed: USD 50          │
│  Commission: n/a            │
│                             │
│  Authorised channels:       │
│  • B2B                      │
│  • Retail offline           │
│                             │
│  Publication allowed: NO    │
│  OTA resale allowed: NO     │
│  Bedbank allowed: NO        │
└─────────────────────────────┘
```

Sources: `dmc_contracts.pricing_basis`, `group_surcharge_pct`, `extra_bed_rate_usd`, `authorised_channels`, three boolean flags.

### Card F — Action items

Dynamic list of items needing attention. Examples:

```
┌─────────────────────────────┐
│  ACTION ITEMS               │
│                             │
│  ⚠ 2 unmapped reservations  │
│  may belong to this partner │
│  → [Review queue]           │
│                             │
│  📅 Renewal alert in 90d    │
│  → [Schedule renewal call]  │
│                             │
│  ✓ All contract fields      │
│  complete                   │
└─────────────────────────────┘
```

For Tiger Trail-style (incomplete data), shows:
```
  ❌ Missing: contact email
  ❌ Missing: VAT number
  ❌ Missing: address
  → [Edit contract]
```

---

## 6. Tab 2 — Contract

Full contract terms. Editable inline (Owner only).

### Sections

1. **Identity**
   - Legal name · Short name · Type · Country · VAT · Website · Address (multiline)

2. **Contact**
   - Name · Title · Email · Phone · WhatsApp

3. **Lifecycle**
   - Contract code · Type · Signed date · Effective from · Effective to · Auto-renew · Termination notice days · Status

4. **Pricing**
   - Basis (NETT/Commissionable) · Commission % · Group surcharge % · Group threshold keys · Extra bed rate

5. **Channels & permissions**
   - Authorised channels (multi-select chips) · Publication allowed · OTA resale · Bedbank resale

6. **Anti-leakage**
   - Has anti-pub clause (Y/N) · Anti-pub clause text (textarea, expandable) · Termination clause text · Enforcement strength

7. **Cancellation**
   - Policy text · Structured tiers (table editor)

8. **Special offers**
   - Free text · Rebate program (JSON editor for structured rules e.g. Green Season 18%)

9. **Rate sheet** — DEDICATED SUB-SECTION

#### Rate sheet sub-section

Renders the 9-row × 3-column grid:

| Room type | High Nett | Green Nett | Peak Nett |
|---|---|---|---|
| Art Deluxe | 190 | 190 | 250 |
| Art Deluxe Family | 200 | 200 | 270 |
| Explorer Glamping | 180 | 180 | 240 |
| Riverfront Glamping | 240 | 240 | 300 |
| Art Deluxe Suite | 230 | 230 | 285 |
| Riverview Suite | 275 | 275 | 320 |
| Riverfront Suite | 310 | 310 | 360 |
| Sunset Luang Prabang Villa | 550 | 550 | 600 |
| Sunset Namkhan Villa | 550 | 550 | 600 |

Toggle: **[LPA Nett] [Public Rate ++]** — switches column data source.

Each cell editable inline (Owner only). Edit triggers update to `dmc_contract_rates` + activity log entry with diff.

If contract has non-standard rates (rare), cells differ from master sheet — flag with subtle highlight.

10. **Notes** — free text, multi-line

### Footer
Save button (only enabled if changes detected). Cancel reverts.

---

## 7. Tab 3 — Bookings

All mapped reservations for this partner.

### Top filter strip

```
[Last 90 days ▾]  [All room types ▾]  [Confirmed only]   [Search guest...]
```

Date filter options: Last 7d / 30d / 90d / 6 months / 12 months / YTD / All time / Custom range.

### KPI tiles above table

```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ 47 RES     │ │ 312 RNS    │ │ USD 67,200 │ │ USD 215    │
│ ↑ 8% LY    │ │ ↑ 9% LY    │ │ ↑ 14% LY   │ │ ↑ 5% LY    │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

### Table

| Col | Source |
|---|---|
| Booking date | `reservations.created_at` |
| Check-in / Check-out | `reservations.check_in_date`, `check_out_date` |
| Nights | computed |
| Guest | `reservations.guest_name` + small `guest_email` |
| Room type | `reservations.room_type` |
| Rate plan | `reservations.rate_plan_name` |
| ADR USD | `reservations.adr` (or computed from total/nights) |
| Total USD | `reservations.total_usd` (FX converted if LAK) |
| Status | confirmed/cancelled/no-show — with color badge |
| Mapping | confidence + method (e.g. "0.94 · email_domain") |
| Mapped by | user · date |
| Cloudbeds | deeplink icon — opens reservation in Cloudbeds in new tab |

### Row click
Opens reservation detail drawer (existing UX) on top of partner drill-down. Stack of drawers.

### Bulk actions
Export selected to CSV. (No bulk re-mapping — would be dangerous.)

### Footer
Pagination · "Showing 47 of 47 reservations" · Total revenue USD across filter scope.

---

## 8. Tab 4 — Parity

### Top KPIs

```
┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ 0 OPEN VIOLATIONS  │ │ 2 RESOLVED EVER    │ │ 1 LETTER SENT EVER │
└────────────────────┘ └────────────────────┘ └────────────────────┘
```

### Sub-section A — Open violations

If 0:
> ✅ No open violations for this partner. Last scan: today 06:00 ICT.

If >0:
Table:
| Detected | Channel | Observed rate | Our BAR | Variance | Confidence | Status | Age |
|---|---|---|---|---|---|---|---|
| 2 days ago | booking_com | USD 162 | USD 190 | -14.7% | 0.91 | letter_drafted | 2d |

Click row → drawer with full violation details + URL to reproduce + draft letter preview + Owner approve/reject.

### Sub-section B — Resolved violations (collapsed by default)

Same table layout, status filter = resolved. Useful for compliance audit history.

### Sub-section C — Letters sent

Timeline:
- 2026-04-12 — Market manager email — "Rate parity inquiry — Booking.com observation" — sent by Owner — partner responded 2 days later
- 2026-04-15 — Cease-and-desist — Owner approved + sent — partner removed listing 5 days later

Click letter → preview + download.

### Action buttons
- **[Run targeted scan now]** — manually trigger `parity_agent` for this partner only
- **[Draft cease-and-desist]** — Owner-only — opens template pre-filled with partner data + clause text

---

## 9. Tab 5 — Performance

Partner-specific scorecard (separate from cross-partner Performance sub-section in section 8 of v3 spec).

### Layout

Top: KPI table (this period vs LY same period vs mandate)

| Metric | This period | LY same | Mandate | Status |
|---|---|---|---|---|
| Room nights YTD | 312 | 287 | — | ↑ 8% |
| Revenue USD YTD | 67,200 | 58,900 | — | ↑ 14% |
| ADR USD | 215 | 205 | ≥180 | ✅ |
| Cancellation % | 6.2% | 8.1% | ≤15% | ✅ |
| Lead time days | 47 | 52 | — | shorter |
| % of total wholesale revenue | 18% | 16% | — | ↑ |
| Mapping confidence avg | 0.94 | n/a | ≥0.85 | ✅ |
| Unmapped LPA bookings (suspect this) | 2 | n/a | 0 (DQ) | ⚠ |

### Charts

1. **Monthly RN trend** — line chart, this year vs LY, 12 months
2. **Room type mix** — donut chart of bookings by room type
3. **Lead-time distribution** — histogram of days between booking and check-in
4. **Top 10 guest origin countries** — bar chart of nationalities sent by this DMC

### Drill data
Each chart click → filtered Bookings tab.

---

## 10. Tab 6 — Activity

Chronological event feed. Most recent first.

### Event types tracked

- Contract signed / amended
- Rate sheet edited (with diff)
- Status changed (active → suspended, etc.)
- Renewal alerts fired
- Parity violations detected / resolved
- Letters sent (link to letter)
- Bookings (compressed: "12 new bookings this week" — clickable to Bookings tab)
- Mapping queue actions ("Reservation X mapped → Asian Trails — Maria — 14:32")
- Manual edits to any field (with old → new diff)

### Filter strip
```
[All events ▾]  [Last 30 days ▾]  [By Maria ▾]  [Search...]
```

Event types as multi-select chips: Contract / Rates / Status / Alerts / Parity / Letters / Bookings / Mappings / Edits.

### Layout
Vertical timeline. Each event card:
- Icon (event type)
- Timestamp
- Actor (user OR agent name)
- Description
- Optional expand to see full detail (e.g., diff for edits)

### Sources
This tab needs an `activity_log` view that unions:
- `dmc_contracts` UPDATE history (via audit triggers — TODO add to migration)
- `parity_violations` events
- `dmc_reservation_mapping` events with `contract_id`
- `docs.expiry_alerts` events for this contract

A single view e.g. `governance.v_partner_activity`:

```sql
CREATE VIEW governance.v_partner_activity AS
  SELECT 'contract_edit' AS event_type, c.contract_id, ... 
  FROM ... -- audit log
  UNION ALL
  SELECT 'parity_detected' AS event_type, ...
  UNION ALL
  SELECT 'mapping' AS event_type, ...
  ORDER BY event_at DESC;
```

(Detailed DDL in next migration `phase2_03_audit_log`.)

---

## 11. Tab 7 — Documents

### Layout

Left side: list of documents. Right side: viewer.

### Document types stored

- Signed contract PDF (current version)
- Signed contract PDF (historical versions for amendments)
- Addendums
- Rate amendments (separate signed docs)
- Anti-publication breach evidence (screenshots, page snapshots)
- Termination / suspension correspondence
- Other (free upload)

### Per-document actions
- Preview embedded
- Download
- Replace (creates new version, doesn't overwrite)
- Delete (Owner only, soft-delete with confirmation)
- Tag/categorize

### Versioning
Each contract change that requires a new signed PDF creates a new document row. Timeline shows: v1 (original), v2 (rate amendment Mar 2027), v3 (extension Aug 2027). Old versions stay accessible for legal/audit.

### Storage path
All documents in `documents-confidential` bucket:
```
{property_id}/dmc_contracts/{partner_slug}/{document_type}/{filename}
```

E.g.: `260955/dmc_contracts/asian_trails/signed_lpa/v1_signed_2026-03-13.pdf`

---

## 12. Data integrity guards

### Schema-level
- `dmc_contracts.contract_code` is unique
- Effective_from < effective_to (CHECK constraint to add)
- `version` field auto-increments on supersession
- Soft-deletes only — no hard DELETE on contracts (set status='terminated' instead)

### UI-level
- Edit form validates all changes before save
- Confirmation dialog for destructive actions (terminate, delete document)
- All actions logged to activity feed automatically

### RLS
- Read: any authenticated user
- Write: Owner + GM (per `app.is_top_level()`)
- Reservations role: read-only on contracts, write on mappings only

---

## 13. Performance considerations

### Heaviest queries
- Tab 3 Bookings (joins reservations + mapping)
- Tab 5 Performance (aggregations across reservations YTD)
- Tab 6 Activity (multiple table union)

### Mitigation
- All KPI tile data: cached in `kpi.partner_snapshots` materialized view, refreshed hourly
- Bookings tab: paginated, default 30 rows
- Activity: filter to last 90 days by default, lazy-load older events on scroll
- Charts: use Recharts (already in stack), data via tRPC queries

### Initial load target
< 800 ms for desktop drill-down to first paint with all 6 cards on Overview tab.

---

## 14. Empty states

Each tab has a sensible empty state:

| Tab | When empty | Display |
|---|---|---|
| Overview | New contract, no activity | Cards still render, with "—" placeholders and "Awaiting first booking" |
| Contract | Always populated | n/a |
| Bookings | No mapped bookings yet | "No bookings mapped to this partner yet. New bookings will appear after reconciliation." |
| Parity | No violations ever | "✅ Clean record. No parity violations detected since {first_scan_date}." |
| Performance | No bookings | "Insufficient data — at least 1 booking required for performance metrics." |
| Activity | No events (very new) | "Contract created on {date}. Activity will appear here as events occur." |
| Documents | Only contract PDF | Shows the one PDF + "Upload additional document" button |

---

## 15. Mobile-specific behaviors

- Header collapses on scroll (just partner name + status badge stay visible)
- Tabs scroll horizontally if needed (touch-friendly)
- Cards in Overview stack 1-column
- Tables become card-list views (no horizontal scroll)
- Edit mode opens full-screen modal instead of inline

---

## 16. Backlog (drill-down specific)

| ID | Item | Effort |
|---|---|---|
| F22a | Drill-down shell + slide-in animation + URL routing | 0.5 day |
| F22b | Header + status badge + action buttons | 0.5 day |
| F22c | Tab 1 Overview — 6 cards | 0.5 day |
| F22d | Tab 2 Contract + rate sheet inline edit | 0.5 day |
| F22e | Tab 3 Bookings + filters | 0.5 day |
| F22f | Tab 4 Parity (depends on parity_agent + UI) | 0.25 day |
| F22g | Tab 5 Performance + charts | 0.5 day |
| F22h | Tab 6 Activity (depends on `v_partner_activity` view) | 0.5 day |
| F22i | Tab 7 Documents + versioning | 0.5 day |

**Total: ~3 days frontend + supporting backend work for activity view.**

---

## 17. Open questions

1. **Edit history retention** — keep full audit trail of every field edit forever, or compress after 1 year? Suggest forever for legal compliance. Confirm.
2. **Renewal flow specifics** — when [Renew] clicked, does new contract auto-publish to active when PDF uploaded, or always require Owner manual activation? Suggest manual activation. Confirm.
3. **Deeplink to Cloudbeds reservation** — what's the URL pattern for Cloudbeds reservation deeplinks for Namkhan? `https://hotels.cloudbeds.com/connect/{property_id}/reservation/{reservation_id}` or different?
4. **Print profile PDF** — needed in Phase 1, or Phase 2? Adds report-renderer dependency. Suggest Phase 2.
5. **"Email partner" Gmail compose** — opens Gmail.com with mailto: link, or use Gmail API to draft inside our app? mailto: simpler. Confirm.

---

## 18. What this DOES NOT cover

- The Contracts list view itself (covered in v3 spec section 5)
- Reconciliation queue (covered in v3 spec section 6)
- Cross-partner Performance scorecard (covered in v3 spec section 8)
- Backfill workflow (covered in v3 spec section 9)
- Inquiries B2B sub-section (Phase 2)
- Multi-property scenarios (Namkhan-only)

These are flagged out of scope for THIS doc; covered elsewhere or future.
