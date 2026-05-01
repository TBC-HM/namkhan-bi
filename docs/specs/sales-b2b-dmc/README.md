# Sales › B2B/DMC — Specs

Status: 🟢 specs locked, **not yet implemented**. Build pending.

## Files

| File | Purpose |
|---|---|
| `full-spec-v3.md` | Canonical spec — Contracts + Reconciliation + Partner Drill-Down + Performance |
| `partner-drilldown-spec.md` | Companion to v3 §7 — slide-in/full-page partner profile (7 tabs) |
| `contracts-spec-v2-legacy.md` | Predecessor spec, superseded by v3 (kept for history) |
| `migration-draft.sql` | DMC reconciliation schema migration — **DRAFT, not in `supabase/migrations/`**. Move to live migrations folder + rename with timestamp prefix when ready to apply. |

## Routing (when built)

- `/sales/b2b-dmc` → Contracts list (default)
- `/sales/b2b-dmc/contracts` · `/contracts/upload` · `/contracts/[id]`
- `/sales/b2b-dmc/reconciliation`
- `/sales/b2b-dmc/performance`
- `/sales/b2b-dmc/partner/[partner_id]` (canonical drill-down)

## Estimated build

- Schema migration: 1 day (review + apply `migration-draft.sql`)
- Contracts list + upload + parser: 2-3 days
- Reconciliation queue + hint learning: 2-3 days
- Partner drill-down (7 tabs): 3 days
- Performance scorecard: 1-2 days
- Backfill (historical bookings since 2025-01-01): 1 day

Total: ~10-13 days frontend + backend.

## Backlog item

F22 — Partner drill-down (~3 days frontend, called out in spec).
