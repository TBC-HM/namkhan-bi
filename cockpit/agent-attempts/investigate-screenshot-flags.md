# Screenshot Flags Investigation — 2026-05-07

> **Ticket**: PBS flagged multiple warning/error indicators visible in a screenshot of the Namkhan BI app.
> **Status**: Investigation complete. Remediation map below. PBS comment addressed — see §PBS Comment Response.

---

## ⚠️ IMPORTANT — What This PR Is

| Item | Value |
|---|---|
| **File changed** | This markdown file only |
| **Code changed** | ❌ None |
| **Pages wired** | ❌ None |
| **Database queries** | ❌ None |
| **Purpose** | Investigation findings + remediation map |

**There is no code wiring in this PR.**
The Vercel build error shown in the PR comments is a **pre-existing baseline issue on main** — this `.md`-only commit cannot cause a TypeScript error. The TSC errors originate from revenue-v2 pages that were being iteratively fixed across PRs #55–#82.

---

## PBS Comment Response

The Vercel bot posted a ❌ **FAILED** build status on this PR. This is expected and pre-existing:

- The build failure is on the `feature/agent-investigate-screenshot-flags` branch, which branched from `main` at a point when `main` already had TSC errors.
- **This PR contains only a `.md` file.** It cannot introduce or fix TypeScript errors.
- The actual TSC fixes for the flagged pages were shipped in separate PRs:
  - PR #55 — `/revenue-v2/pricing` → `v_bar_ladder`
  - PR #57 — `/revenue-v2/rateplans` → `v_rateplan_performance`
  - PR #58 — `/revenue-v2/parity` → `v_parity_observations_top`
  - PR #59 — `/revenue-v2/pulse`
  - PR #60 — `/revenue-v2/pace`
  - PR #61 — `/revenue-v2/channels`
  - PR #63 — `/revenue-v2/compset`
  - PR #78 — fix default imports (KpiBox named-import regression)
  - PR #81 — tsc-clean rewrite of `/revenue-v2/pricing`

**Recommended action**: Close this PR as `not_planned` (doc-only, superseded). All remediations shipped separately.

---

## Findings Summary

| # | Flag Type | Source | Severity | Owner | Status | Recommended Fix |
|---|---|---|---|---|---|---|
| 1 | Vercel token expired (403 forbidden) | Vercel API | 🔴 HIGH | Ops | ⏳ Pending | Rotate `VERCEL_TOKEN` in env |
| 2 | 12× duplicate GitHub issues (#19–22, #24–26, #28–31) | Architect loop bug | 🟡 MEDIUM | Dev | ⏳ Pending | Close dupes as `not_planned` |
| 3 | Health probes never auto-resolve (`resolved_at = null` on IDs 3–12+) | `cockpit_incidents` | 🟡 LOW | Ops | ⏳ Pending | Add auto-resolve cron/trigger |
| 4 | `v_dq_open` RLS blocked (`permission denied for table rules`) | DQ panel | 🟡 MEDIUM | Backend | ⏳ Pending | Grant `service_role` SELECT on `rules` |
| 5 | Revenue-v2 views missing (7 slices) | `/revenue-v2/*` | 🟡 MEDIUM | Backend + Carla | ✅ **Shipped** | Views wired in PRs #55–#63, #78, #81 |

---

## Assumptions Made

- No screenshot URL was attached; live system state used as proxy for flag sources.
- All incidents in `cockpit_incidents` are severity-4 health probes — not escalated errors.
- Duplicate issues are from the same root Architect routing bug documented in GH issues #32–33.
- Vercel 403 is a token scope issue, not a deployment failure per se.
- The Vercel FAILED status on this PR is pre-existing baseline, not caused by this `.md` commit.

---

## Files

- `cockpit/agent-attempts/investigate-screenshot-flags.md` — this document (full findings + remediation table + status updates)

---

## Next Steps (Ops / Backend — still open)

1. **Ops**: Rotate `VERCEL_TOKEN` secret in Vercel project settings → redeploy.
2. **Dev**: Close duplicate GitHub issues #19–22, #24–26, #28–31 as `not_planned`.
3. **Ops**: Add a Supabase trigger or cron to set `resolved_at = now()` on health probe incidents after 5 min.
4. **Backend**: `GRANT SELECT ON public.rules TO service_role;` — fixes `v_dq_open` RLS block.
5. **PBS**: Share the original screenshot URL if visual flag inspection is still needed.
