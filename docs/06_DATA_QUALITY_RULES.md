# 06 — Data Quality Rules

> Rule library for the DQ agent (Phase 2). Each rule: trigger, severity, escalation.
> Current state: rules listed below; agent that enforces them is NOT yet built.
> Agent will be built once the dashboard is in daily use and false-positives can be tuned with Paul.

## Why this matters

The Namkhan front desk has Lao operators with low literacy in English PMS interfaces.
**Operator errors are systemic, not occasional.** Examples already observed in production:

- Wrong category set on F&B item (`Inside Activity` used for activity bookings)
- Empty `item_category_name` on 297 transactions in a single month
- 82% of all historical reservations have NULL `market_segment`
- Wrong rate plan selected → rate diverges from BAR by 30%+
- Items posted to wrong reservation → ledger leaks
- Garbage descriptions (e.g. typos like `MInibar Billing` propagated through PMS for years)

**The DQ agent's job:** crawl historical data, apply rules below, surface a daily fix list, eventually close the loop with operator-side training (Phase 1 SOPs).

## Severity levels

| Level | Description | SLA | Notification |
|---|---|---|---|
| **CRITICAL** | Blocks reporting / revenue | Same-day fix | Slack/Telegram immediately |
| **HIGH** | Distorts KPIs visibly | 48h | Daily digest 09:00 |
| **MEDIUM** | Hygiene; degrades long-term insight | Within week | Weekly digest |
| **LOW** | Nice-to-have | Monthly | Monthly cleanup |

## Rule library

### Reservations
| ID | Rule | Severity | Action |
|---|---|---|---|
| R-001 | `market_segment` is NULL | HIGH | Reservations Manager to set |
| R-002 | `source_name` is NULL | HIGH | Reservations Manager |
| R-003 | `rate_plan` not in active rates | CRITICAL | Revenue + IT |
| R-004 | `check_in_date > check_out_date` | CRITICAL | Bug — IT |
| R-005 | `adults = 0 AND children = 0` | HIGH | Reservations |
| R-006 | Reservation in-house but no folio charges | CRITICAL | Front Office |
| R-007 | Cancellation without `cancellation_date` | MEDIUM | Reservations |
| R-008 | Lead time = 0 (likely walk-in mis-coded) | LOW | Reservations |
| R-009 | Rate < 50% of BAR for that date | HIGH | Revenue |
| R-010 | Rate > 200% of BAR for that date | HIGH | Revenue |
| R-011 | `nights` doesn't match `check_out − check_in` | CRITICAL | Bug — IT |
| R-012 | `total_amount` is 0 but reservation is checked-out | HIGH | Front Office |

### Guests
| ID | Rule | Severity |
|---|---|---|
| G-001 | `guest_country` missing on checked-out guest | HIGH |
| G-002 | `guest_email` invalid format | MEDIUM |
| G-003 | Duplicate guest profile (same name + DOB) | LOW |
| G-004 | `guest_email` is NULL on a booking with email source (Direct/Web) | HIGH |

### Folios / Transactions
| ID | Rule | Severity |
|---|---|---|
| F-001 | Transaction `usali_dept = 'Unclassified'` for >$50 | MEDIUM |
| F-002 | `currency` not in approved list | HIGH |
| F-003 | Negative folio without adjustment reason | HIGH |
| F-004 | Folio posted to closed reservation | CRITICAL |
| F-005 | `item_category_name` is NULL on F&B items >$10 | MEDIUM |
| F-006 | Item description contains "TEST" / "DELETE" / placeholder | HIGH |
| F-007 | Same item posted >5x to same reservation in same hour | LOW (likely retry / typo) |

### Housekeeping (BLOCKED — scope missing)
| ID | Rule | Severity |
|---|---|---|
| H-001 | Room status not updated > 24h | MEDIUM |
| H-002 | Checkout room still "Dirty" at 16:00 | HIGH |
| H-003 | OOO/OOS without reason note | MEDIUM |

### Operator-error patterns (to be detected by agent v2)
| ID | Pattern | Severity |
|---|---|---|
| OE-001 | Same operator posts charges to multiple guests within 30s | HIGH |
| OE-002 | Charge amount = exactly previous charge (likely double-tap) | HIGH |
| OE-003 | Item name doesn't match item category (e.g. "Margarita" under "Spirits" not "Cocktails") | MEDIUM |
| OE-004 | Reservation moved >3 times in one day | LOW |
| OE-005 | Rate adjusted manually >5% post-checkin | MEDIUM |

## Escalation flow

```
Rule violation detected
  ↓
Logged to data_quality_log table
  ↓
CRITICAL → Slack/Telegram → Paul + dept head
HIGH     → 09:00 daily digest → dept head
MEDIUM   → weekly summary → dept head
LOW      → monthly cleanup list → Paul
```

## Remediation tracking

Each violation has status: `open / in_progress / fixed / waived`.
Waiver requires Paul's approval and reason logged.
**Top KPI:** open violations beyond SLA, by department.

## What's already in place

- `dq_known_issues` table seeded with 5 broad categories
- `operational_overrides` table for pinning facts (Tent 7 closed)
- USALI classifier flags `Unclassified` line in monthly P&L (transparent leakage)

## What's missing (to build in Phase 2)

- DQ agent (edge function) that runs all rules above on schedule
- `data_quality_log` table for individual violation records
- Slack/Telegram webhook integration
- DQ dashboard tab (currently a grey placeholder)
- Operator-error fingerprinting (OE-rules above)
