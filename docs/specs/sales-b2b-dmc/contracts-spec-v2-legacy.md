# Sales › B2B/DMC › Contracts + Reconciliation — Build Spec v2

> Updates v1 with: (a) human-in-the-loop reservation→partner mapping queue, (b) self-improving hints table, (c) rate-plan-anchored detection logic.
> Date: 2026-05-01 · Status: 🟢 spec locked

---

## What's new in v2

| Addition | Why |
|---|---|
| Rate plan = the gate, not source | "Leisure Partnership Agreement" rate plan is enforced at booking time. Source field depends on agent discipline. Rate plan is reliable. |
| `dmc_reservation_mapping` table | Every LPA-rate-plan reservation lands here. Reservations team maps each to a partner. No silent fallbacks. |
| `partner_mapping_hints` table | Self-improving rules. Each manual mapping generates hints. Future bookings auto-suggested with confidence score. |
| New sub-section in B2B/DMC tab | **Reconciliation Queue** — sits alongside Contracts and Performance. |

---

## 1. Updated B2B/DMC tab structure

```
05 B2B / DMC
├── Contracts          (manage 25 LPA contracts)
├── Reconciliation     ← NEW. Queue of unmapped LPA reservations.
├── B2B Inquiries      (filter of sales.inquiries)
└── Performance        (DMC scorecard — only counts mapped reservations)
```

---

## 2. The reconciliation flow — end to end

### Step 1: Detection (automatic)

A scheduled job (every hour via `pg_cron`) runs:

```sql
SELECT governance.detect_dmc_reservations();
```

Function logic:
- For every reservation created/modified in the last hour
- Where `rate_plan_name` matches any pattern in `governance.dmc_rate_plan_filters`
- Where no mapping row exists yet
- Insert into `governance.dmc_reservation_mapping` with `mapping_status='unmapped'`

Filters seeded:
- `%Leisure Partnership%` ← primary
- `%LPA%` ← short-form fallback
- `%Wholesale%` ← legacy catch-all (Owner can disable when ready)

### Step 2: Suggestion (automatic, on detection)

For each new unmapped row, the orchestrator (or a trigger) calls:

```sql
SELECT * FROM governance.suggest_dmc_partner(mapping_id);
```

Hints checked in order of specificity:
1. **email_full** — exact contact email match (highest confidence)
2. **source_id** — Cloudbeds source ID match
3. **source_name** — Cloudbeds source name match
4. **email_domain** — domain-only email match
5. **voucher_prefix** — DMC voucher code prefix match
6. **third_party_id_prefix** — Cloudbeds thirdPartyIdentifier prefix

If 1+ hint hits with `confidence_score ≥ 0.9` → `mapping_status` set to `'suggested'`, agent UI shows the suggestion pre-selected.

If multiple partners suggested with comparable confidence → status stays `'unmapped'`, agent picks manually.

### Step 3: Reservations agent reviews queue

UI: `/sales/b2b-dmc/reconciliation`

Default view: today's unmapped reservations sorted by detection time desc.

For each row, agent sees:
- Reservation ID + guest name + check-in date + rate plan
- Cloudbeds source name (if any)
- Suggested partner (if hint matched) with confidence + hints that triggered it
- Dropdown to pick partner manually (lists all 25 active contracts)
- 3 buttons: **[Confirm]** · **[Different partner]** · **[Not actually DMC]**

### Step 4: On confirmation → hint learning

When agent clicks **[Confirm]** on a suggestion:
- `mapping_status` → `'mapped_human'`
- All matched hints get `times_correct += 1` and `times_matched += 1` (confidence rises)

When agent picks **[Different partner]** instead:
- The suggested hint(s) get `times_rejected += 1` (confidence falls)
- The chosen partner gets new hints added based on this reservation's data:
  - email_full hint added if not exists
  - email_domain hint added if not exists
  - source_id hint added if not exists
  - voucher_prefix hint added (first 3-5 chars of `third_party_identifier`)

When agent picks **[Not actually DMC]**:
- `mapping_status` → `'rejected_not_dmc'`
- Reservation excluded from all DMC views forever

### Step 5: Auto-mapping (Phase 2 — disabled in Phase 1)

Once a hint reaches `confidence_score ≥ 0.95` AND `times_matched ≥ 20`:
- Future matches set `mapping_status='mapped_auto'` automatically
- Agent reviews periodically as audit, doesn't have to confirm each one
- **Phase 1: keep all auto-mapping OFF, force human confirmation always.** Owner can flip on later.

---

## 3. Reconciliation Queue UI spec

### Top KPI strip

| Tile | Source |
|---|---|
| Unmapped today | `count WHERE mapping_status='unmapped' AND detected_at >= today` |
| Unmapped backlog | `count WHERE mapping_status='unmapped'` |
| Suggested (awaiting confirmation) | `count WHERE mapping_status='suggested'` |
| Mapped this month | `count WHERE mapping_status IN ('mapped_human','mapped_auto') AND mapped_at >= month_start` |
| Avg time-to-map | `avg(mapped_at - detected_at) WHERE mapping_status LIKE 'mapped%'` — operational SLA metric |
| Hint accuracy (top hint) | top hint by `confidence_score` from `v_hint_accuracy` |

### Filter bar

```
[All] [Unmapped] [Suggested] [Mapped] [Rejected]   |   Suggested partner ▾   |   Source ▾   |   Search res ID / email / name
```

### Queue table (one row per reservation)

| Col | Source |
|---|---|
| Detected | `detected_at` ("4h ago") |
| Res ID | `reservation_id` (clickable → Cloudbeds deeplink) |
| Guest | `guest_name` + small email |
| Check-in | from `public.reservations` join |
| Rate plan | `rate_plan_name` |
| CB source | `cloudbeds_source_name` (or "—") |
| Suggested partner | partner_short_name + confidence badge (or "Pick partner ▾" if unmapped) |
| Hints matched | small badge list — "email_domain · source_name" |
| Action | **[Confirm]** · **[Other ▾]** · **[Not DMC]** |

### Bulk actions

- Select multiple rows with same suggested partner → **[Confirm all]**
- Useful when 30 Asian Trails bookings come in same morning

### Detail drawer (click row)

- Full reservation summary (dates, rooms, total, guest contact)
- Cloudbeds raw fields for debugging
- Hints that triggered the suggestion (with their accuracy stats)
- Map history (if previously rejected and re-detected)

---

## 4. SOP for reservations team

This is the **non-negotiable companion** to the system. Without it, garbage in / garbage out.

> **Daily reservations SOP — DMC reconciliation**
>
> 1. Open `/sales/b2b-dmc/reconciliation` once per shift (morning + afternoon).
> 2. Process the **Unmapped** + **Suggested** queues.
> 3. For each row:
>    - If suggested partner is correct → click **Confirm**
>    - If suggested partner is wrong → click **Other**, pick the right one
>    - If not actually DMC (e.g., direct booking with wrong rate plan applied) → click **Not DMC** + leave a note
> 4. Goal: zero unmapped older than 24 hours by end of day.
> 5. Never leave the queue. Never bulk-mark all as "Not DMC" to clear it. The hints table learns from every action.

Add to `knowledge.sop_meta` and surface in the reconciliation page sidebar.

---

## 5. Phase 1 specifics (locked)

| Setting | Phase 1 | Phase 2 future |
|---|---|---|
| Auto-mapping | **OFF for all hints** regardless of confidence | Owner can enable per-hint above 0.95 + 20 matches |
| Hint creation | Automatic on every manual mapping | Same |
| Hint deactivation | Manual only (Owner) | Auto-deactivate hints below 0.5 confidence |
| Notification on new unmapped | In-app badge on B2B/DMC tab | + Slack/Gmail digest twice daily |
| Approval | Reservations team can map directly (within their RLS role) | Same |

---

## 6. Schema summary

**6 new tables/objects** (full DDL in `migration_dmc_reconciliation.sql`):

| Object | Purpose |
|---|---|
| `governance.cloudbeds_sources_mirror` | Daily mirror of Cloudbeds `/getSources` |
| `governance.dmc_rate_plan_filters` | Patterns that flag a reservation as DMC-suspect |
| `governance.dmc_reservation_mapping` | The queue + history of every DMC reservation's mapping state |
| `governance.partner_mapping_hints` | Self-improving rules linking attributes → contract |
| `governance.detect_dmc_reservations()` | Scheduled function, runs hourly |
| `governance.suggest_dmc_partner()` | Returns ranked partner suggestions for a queue item |
| `governance.v_dmc_reconciliation_queue` | View driving the reconciliation UI |
| `governance.v_dmc_performance` | Updated to filter on `mapping_status IN ('mapped_human','mapped_auto')` only |
| `governance.v_hint_accuracy` | Diagnostic — which hints work, which don't |

Initial hints seeded: 5 contracts × ~2 hints each (email_full + email_domain) = 10 hints from existing seed data.

---

## 7. Updated open questions

Original 4, refined:

1. ~~How to link `public.reservations` to DMC partners~~ → **Answered.** Rate plan = gate, human queue + hints = answer.
2. **Cron cadence** — hourly is my recommendation. Confirm or change.
3. **Reservations role** — does an `app.has_role('reservations')` function exist, or do we use generic `authenticated`? RLS policy depends on this.
4. **Voucher / third-party identifier patterns** — does Cloudbeds capture DMC voucher numbers in `third_party_identifier`, or somewhere else? Worth a 5-min check by Carl in Cloudbeds UI.
5. **Backfill** — for historical reservations (last 12 months), do we run a one-time backfill so the Performance scorecard has data? Suggest yes, ~30 minutes manual mapping for hundreds of bookings using bulk-confirm. Confirm.
6. **Multi-source DMCs** — if Tiger Trail can come through Cloudbeds tagged as both "Tiger Trail" AND "Wholesale" depending on who booked, we need multiple `source_name` hints per contract. Already supported by schema. Just flagging.

---

## 8. Updated backlog

| ID | Item | Effort | Owner |
|---|---|---|---|
| F17 | Sales pillar route + B2B/DMC tab + Contracts sub-section UI | 2 days | Frontend |
| F18 | `contract-parser` Edge Function | 1 day | Backend |
| F19 | Contract review queue UI | 0.5 day | Frontend |
| F20 | Contract detail drawer (5 tabs) | 1.5 days | Frontend |
| F21 | DMC Performance sub-section | 1 day | Frontend |
| F22 | `partner_code` field on `public.reservations` | obsolete — replaced by F23 | — |
| **F23** | **Reconciliation queue UI + bulk-confirm** | **2 days** | **Frontend** |
| **F24** | **`detect_dmc_reservations` cron job + webhook hook** | **0.5 day** | **Backend** |
| **F25** | **Hint suggestion engine integration in reconciliation UI** | **1 day** | **Backend + Frontend** |
| **F26** | **Backfill script: process historical reservations through detect → suggest → bulk-confirm UI** | **0.5 day script + manual review time** | **Backend + Reservations team** |
| **F27** | **SOP: "Daily DMC reconciliation"** added to `knowledge.sop_meta` | **30 min** | **Consultant** |

Total: ~7 days frontend + 2 days backend + ~30 min SOP work.

---

## 9. What this changes upstream

- `parity_agent` — when hypothesising leakage source, now joins through `dmc_reservation_mapping` to find which contracts have actual reservation flow → focuses scrutiny on active partners
- `compset_rate_scan_agent` — unaffected
- `lead_scoring_agent` — when an inbound enquiry email matches a hint, can pre-fill "From: [Partner Name]" in the response template
- `data_quality_agent` — gets a new rule: `flag_reservations_with_dmc_rate_plan_unmapped_over_24h`

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Reservations team ignores the queue, backlog grows | DQ rule alerts after 24h. SOP. Surface unmapped count on Owner dashboard. |
| Wrong rate plan applied to direct bookings → false detections | "Not DMC" reject flow exists. Each rejection improves filter quality. |
| Same DMC books under multiple sources / emails | Multiple hints per contract supported. Self-improving. |
| Hint table drift — partner changes contact email mid-year | Old hint stays active, new one added on first booking. Old one's confidence drops as it stops matching. Self-correcting. |
| Cloudbeds doesn't expose third_party_identifier reliably | Voucher prefix hint becomes weak signal. Email/source hints carry the load. |
| One DMC partner = multiple Cloudbeds sources (lazy tagging) | Multiple `source_id` and `source_name` hints per contract supported. |
| Reservations agent maps to wrong partner accidentally | Audit trail shows `mapped_by` + `mapped_at`. Owner can re-map any reservation. Hint accuracy stats catch patterns of bad mappings. |
