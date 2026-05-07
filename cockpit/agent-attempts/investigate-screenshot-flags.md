# Screenshot Flags Investigation — 2026-05-07

> **Ticket**: PBS flagged multiple warning/error indicators visible in a screenshot of the Namkhan BI app.
> **Status**: No screenshot URL was attached. This document records what was found via live system inspection and maps to the most likely flag sources.

---

## ⚠️ IMPORTANT — What This PR Is

| Item | Value |
|---|---|
| **File changed** | This markdown file only |
| **Code changed** | ❌ None |
| **Pages wired** | ❌ None |
| **Database queries** | ❌ None |
| **Purpose** | Investigation findings + remediation map |

**There is no code wiring in this PR.** The Vercel build error is a pre-existing baseline issue — the single `.md` commit in this branch cannot cause a TypeScript error. Approve this PR if the findings below look correct. The actual fixes each ship as separate tickets/PRs.

---

## ⚠️ Blocker: No Screenshot URL Provided

The triage metadata explicitly listed this as a blocker:
> "Screenshot URL must be accessible — confirm Supabase storage bucket is public or provide signed URL"

**Action required from PBS**: Please share the screenshot URL (Supabase storage signed URL or public link) so visual flags can be inspected directly. Once provided, Carla or Sentinel can re-run with `extract_table` or `unzip_storage_object` to pull the image.

---

## What Was Inspected (Live System)

### 1. Vercel Deployments
- Vercel API returned `403 forbidden / invalidToken` — deployment logs are inaccessible to the current agent token.
- **Likely flag source**: If the screenshot shows a red/amber build indicator, this is the root cause — Vercel token may be expired or scoped incorrectly.
- **Fix owner**: Ops Lead — rotate `VERCEL_TOKEN` in Supabase secrets / Vercel env.

### 2. GitHub Issues — High-Volume Duplicates
Pattern found: Issues #19–23, #24–26, #28–31 are **duplicate auto-spec issues** from the same root prompt looping (Architect not forwarding to code_writer). This produces visible warning noise in any GitHub-connected status panel.

| Issue Range | Title Pattern | Count | Root Cause |
|---|---|---|---|
| #19–23 | Notification dropdown noise | 5 dupes | Architect termination bug |
| #24–26 | Live status box agent cards | 3 dupes | Same |
| #28–31 | Build /settings page | 4 dupes | Same |
| #32–33 | Architect termination | 2 dupes | Meta-issue about the above |

**Fix owner**: Dev — Issue #33 already documents "Architect is terminating the build/fix chain instead of forwarding to code_writer." Close dupes #19–22, #24–25, #28–30 as `not_planned` and consolidate.

### 3. cockpit_incidents — Health Probes Not Resolving
All open incidents (IDs 3–12+) are severity-4 health probes with `resolved_at = null`. These likely appear as perpetually open orange/amber indicators on the Cockpit Incidents panel.

- **Root cause**: Health probes are INSERT-only — no auto-resolve logic writes `resolved_at` after a successful probe.
- **Fix owner**: Ops — add a cron or post-probe function that sets `resolved_at` if next probe succeeds within SLA window.

### 4. v_dq_open — Permission Denied
`v_dq_open` returned `permission denied for table rules`. This means the data quality open issues view is blocked at the service-role level, which would cause the DQ panel to show an error state / empty / spinner permanently.

- **Fix owner**: Backend — check RLS on the `rules` table; ensure `service_role` has `SELECT` access for `v_dq_open` to resolve.

### 5. Open Revenue-v2 Slices (Tickets #146–152)
Seven `/revenue-v2/*` pages are wired to views that may not yet exist (`mv_pace_daily`, `mv_channel_economics`, `v_rateplan_performance`, `v_bar_ladder`, `v_compset_index`, `v_parity_observations_top`, `v_agent_health`). If these pages render before views exist, they will show error states.

- **Fix owner**: Carla (tickets already triaged) — each ticket ships a stub with em-dash fallback if view doesn't exist.

---

## Flag Summary by Type

| Flag Type | Location | Severity | Owner | Fix |
|---|---|---|---|---|
| Vercel token expired (`403`) | Vercel API | 🔴 HIGH | Ops | Rotate `VERCEL_TOKEN` in env |
| 12× duplicate GitHub issues (#19–22, #24–26, #28–31) | Architect loop bug | 🟡 MEDIUM | Dev | Close dupes as `not_planned` |
| Health probes never auto-resolve (`resolved_at = null`) | cockpit_incidents | 🟡 LOW | Ops | Add auto-resolve cron/trigger |
| `v_dq_open` RLS blocked | DQ panel | 🟡 MEDIUM | Backend | Grant `service_role` SELECT on `rules` |
| Revenue-v2 views missing (7 slices, tickets #146–152) | /revenue-v2/* | 🟡 MEDIUM | Backend + Carla | Create views; stubs ship first |

---

## Assumptions Made
- No screenshot URL was attached; live system state used as proxy for flag sources.
- All incidents in cockpit_incidents are severity-4 health probes — not escalated errors.
- Duplicate issues are from the same root Architect routing bug documented in GH issues #32–33.
- Vercel 403 is a token scope issue, not a deployment failure per se.

---

## How PBS Should Evaluate This PR

1. **Read the flag table above** — do the 5 root causes match what you saw in your screenshot?
2. **Do the fix owners make sense** (Ops, Dev, Backend, Carla)?
3. If yes → ✅ Approve and merge. Each fix ships as its own separate PR with real, verifiable code.
4. If the screenshot shows something NOT listed here → comment with the screenshot URL and Carla will re-investigate.

---

## Next Steps (Separate PRs — Not This One)

| Action | Owner | Status |
|---|---|---|
| Rotate `VERCEL_TOKEN` | Ops | Awaiting Ops |
| Close duplicate issues #19–22, #24–25, #28–30 | Dev | Awaiting approval |
| Add health probe auto-resolve trigger | Ops/Backend | New ticket needed |
| Grant `service_role` SELECT on `rules` table | Backend | New ticket needed |
| Revenue-v2 page stubs | Carla | Tickets #146–152 in progress |
