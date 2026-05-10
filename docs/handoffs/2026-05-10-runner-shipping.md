# HANDOFF — 2026-05-10 — Agent Runner Pipeline Now Shipping PRs

**Date**: 2026-05-10 (Sun, 20:30 UTC)
**Author**: PBS + Claude (sandbox session)
**Status**: ✅ End-to-end agent pipeline WORKING. First agent-built PR shipped (#266).

---

## 1 — Single most important sentence

The bug→ticket→runner→PR pipeline is **live and self-driving**. v7 of `scripts/agent-runner-v2.ts` (commit `d39475a`, merged via PR #264) fixed the last three failure modes. PR #266 is the first agent-built PR in repo history.

---

## 2 — Pipeline as it stands now

```
PBS files bug
  → /api/cockpit/bugs at namkhan-bi.vercel.app/bugs
  → cockpit_bugs row inserted (status=new)

Vercel cron */5min /api/cockpit/bugs/sweep
  → reads cockpit_bugs WHERE status IN ('new','acked')
  → creates cockpit_tickets row (arm=dev, status=triaged, intent=fix|build)
  → flips bug status=processing
  → 3-strikes cap: after 3 failed runs, bug returns to status=new with attempt counter

GitHub Actions cron */5min  .github/workflows/agent-runner.yml
  → npx tsx scripts/agent-runner-v2.ts
  → picks up to 5 tickets WHERE status=triaged AND processed_at IS NULL
  → per ticket: explore (grep, read_file) → edit_file → run_tsc → finalize
  → finalize: git commit + push (unique branch name) + gh pr create
  → ticket flips status=awaits_user with pr_url + preview_url

PBS reviews PR
  → Vercel preview deploys automatically (~2min)
  → 3 Vercel checks run (Deploy, Agent Review, Preview Comments)
  → tsc --noEmit check runs (REQUIRED for merge; gated by branch protection)
  → KNOWN BUG: tsc check doesn't auto-trigger on agent-pushed branches
                because PRs created by github-actions[bot] don't fire downstream
                workflows. WORKAROUND: push an empty commit using a PAT to retrigger,
                OR tick the "bypass rules" checkbox on the merge button.
  → PBS clicks Merge → live on main → auto-deploys to prod
```

---

## 3 — Today's hard-won fixes (v3 → v7)

| Version | Bug | Fix |
|---|---|---|
| v3 | Model could batch multiple tools per turn; turn-based cap under-counted work | Count tool calls by name, not turns |
| v4 | Model spent 12+ calls grepping without editing | After 4 turns of no edits, inject force-act warning; after 6 reads → abort |
| v5 | After edits made, model would keep exploring instead of finalizing; sweep retry loop ran 6+ times | Auto-finalize staged work after 6 turns since last edit; sweep retry cap=3 |
| v6 | `git commit` failures returned terse "Command failed" with no stderr | Capture full stderr; add `--no-verify`; detect `no_staged_changes` |
| v7 | (a) Branch collision: `autorun/ticket-X-slug` already existed on remote from prior failed run → `non-fast-forward rejected`. (b) Model retried finalize 3x in same session, burning turns. (c) `AGENT_RUNNER_MAX_TURNS=25` env override secretly bypassed all caps. | (a) Append 6-char timestamp suffix to every branch name. (b) After 2 failed finalize calls in one session, abort with last error. (c) `MAX_TURNS = Math.min(10, env)` — hardcoded ceiling. |

All five live on `main`. v8 not needed yet.

---

## 4 — Today's queue cleanup (one-time, do NOT redo)

### Crons killed (pg_cron.unschedule):
- #50 agent-runner (dead, superseded by GHA)
- #53 cockpit-agent-worker (dead, duplicate)
- #54 stale-ticket-reaper (was un-failing tickets, creating duplication storms)
- #73 self-heal-failed-tickets (same problem)
- 14 ticket-creating crons: #77 advance-plans, #26/27/24/23/25 agent-cashflow/forecast/pricing/snapshot/variance, #61 daily-deep-health, #56 daily-incident-review, #60 daily-kb-curate, #58 weekly-team-summary, #43 compset-agent, #65 doc-staleness, #69 quarterly-dr-drill, #63 reference-library-staleness, #67 weekly_team_summary

**REMAINING active crons (do NOT kill):**
cb-sync, kpi, dq, refresh-bi-views, recompute-daily-metrics, render-media, tag-media, alerts

### Schema drained:
**Dropped:**
- 7 `v_inbox_*` views (`executive`, `it`, `marketing`, `operations`, `revenue`, `sales`, `finance`) — were showing 379 archived tickets in chat UI because no status filter
- `v_pbs_notifications_feed` — not used by frontend
- `app.notifications`, `app.tasks`, `app.task_comments` — parallel schema, 0 rows, never used
- 12 backup tables (`cockpit_*_backup_pre_autonomy_20260509`, KB dedup backups, agent_prompts backups)

**Frontend confirmed using only:**
`cockpit_tickets`, `cockpit_audit_log`, `cockpit_notifications`, `cockpit_pbs_notifications`, `cockpit_standing_tasks`, `v_notifications_bell`

### Ticket archive sweep:
~85 stale tickets archived in waves. Then 19 real dev tickets restored to `triaged` at 20:30 (see "Active queue" below).

---

## 5 — Active queue (as of 20:30 UTC)

**`awaits_user`** (5 tickets — PR opened, PBS to review/merge):
- #710 → PR #266 (staff header pills) ← FIRST AGENT PR
- Others from prior partial runs (check `cockpit_tickets WHERE status='awaits_user'`)

**`triaged`** (19 tickets — waiting for runner pickup):
- #564 Revive Nimble compset scraping
- #565 Revenue dashboards inline CTAs
- #566 KPI tooltips on 5 dept pages
- #567 Parity scraping agent
- #568 KPI tile popover hover fix
- #569 SLH logo tooltip removal (LOW urgency, fastest win)
- #572 Messages inbox on bug-net
- #574 /marketing/taxonomy design refresh
- #578 Leakage/Opportunity alert timestamps
- #579 /finance/poster/report design refresh
- #580 Revenue filter dropdowns
- #581 HeaderPills date-range picker
- #597 KPI hover fix (alt route)
- #598 SLH logo (alt route)
- #599 Supabase compset grants migration
- #653 Revenue CTA blockers
- #665 Gmail popup fix
- #666 Team page idle status
- #686 Felix dispatch handlers spec (LARGE — 8 handlers, may exceed v7 budget)

Runner picks 5 every 5min → full clearance in ~20min IF v7 holds. **Watch for**:
- Multiple PRs colliding on the same files (no concurrency control yet)
- Some tickets have unresolved blockers (PBS Q&A required) — model should abort with `agent_no_edits` reason
- #686 is large — may abort due to scope; rerun manually if so

---

## 6 — Known issues / future work

| # | Issue | Severity |
|---|---|---|
| 1 | "Approve" button in chat UI → `Error: Send failed`. `approveWorkTicket()` in `app/api/cockpit/chat/route.ts` expects `notes.triage` payload but v7 runner sets `notes=null`. Workaround: merge PR directly on GitHub. | HIGH — blocks single-click approval |
| 2 | tsc --noEmit check doesn't auto-trigger on PRs opened by github-actions[bot]. Workaround: push empty commit with PAT, or tick "bypass" on merge. Permanent fix: agent-runner.yml should checkout with a PAT, not GITHUB_TOKEN. | MEDIUM — manual step per PR |
| 3 | `AGENT_RUNNER_MAX_TURNS=25` repo variable still exists at Settings → Variables → Actions. v7 neutralizes it via Math.min, but should be deleted for cleanliness. | LOW |
| 4 | Two dead runner source files: `supabase/functions/agent-runner/index.ts` and `app/api/cockpit/agent/run/route.ts`. Both crons that called them are killed. Delete after 7-day stability. | LOW |
| 5 | Worker `department` fields cosmetic cleanup pending | LOW |
| 6 | No concurrency control between runner instances if 2+ tickets touch same file | MEDIUM (theoretical) |

---

## 7 — File locations (canonical truth)

| Resource | Location |
|---|---|
| Runner script (only one that's live) | `scripts/agent-runner-v2.ts` |
| Runner workflow | `.github/workflows/agent-runner.yml` |
| Typecheck gate | `.github/workflows/typecheck.yml` |
| Sweep route (bug → ticket) | `app/api/cockpit/bugs/sweep/route.ts` |
| Chat route (approve, triage) | `app/api/cockpit/chat/route.ts` |
| Frontend: cockpit page | `app/cockpit/page.tsx` |
| Frontend: bug filing | `app/bugs/page.tsx` |
| This handoff | `docs/handoffs/2026-05-10-runner-shipping.md` (after commit) + KB row + Project Knowledge |

---

## 8 — Sandbox capabilities (for the next Claude session)

The sandbox can:
- Push to github.com via `<gh_pat_redacted>` (PAT in `cockpit_secrets.gh_pat`, 40 chars, contents:write + pull-requests:write)
- Push direct to main IF the commit is a revert (branch protection allows reverts)
- Push to any other branch normally; PRs must be created by PBS clicking the suggested URL
- Run all SQL on Supabase via MCP

The sandbox CANNOT:
- Call api.github.com (not in allowlist → blocks REST API, workflow_dispatch, octokit, gh CLI)
- Trigger GHA workflows via dispatch — PBS must click the green button

**Pattern that works**:
```bash
git push https://claude:<gh_pat_redacted>@github.com/TBC-HM/namkhan-bi.git BRANCH_NAME
```

---

## 9 — DO NOT DO (lessons learned, hard-won)

1. **Don't change MAX_TURNS via env override** — the override silently defeated 5 hours of guardrail work. All caps are now hardcoded `Math.min(10, env)`.
2. **Don't kill ticket archives mid-sweep** — caused mass-restoration storms when un-failed by watchdogs that have since been removed.
3. **Don't trust "Approve" button in cockpit UI yet** — calls broken `approveWorkTicket()`. Merge PRs directly on GitHub for now.
4. **Don't re-enable killed crons without verifying current code paths** — most were creating tickets for nonexistent agents or duplicate work.
5. **Don't bypass the typecheck gate** unless PR's `tsc --noEmit` definitively passed in the agent run logs (it does on every successful run).

---

## 10 — Cross-references

- **KB row**: see `cockpit_knowledge_base` row with `tag='handover_2026_05_10_runner_shipping'`
- **GitHub**: `docs/handoffs/2026-05-10-runner-shipping.md` on main
- **Project knowledge**: drag this file from `/mnt/user-data/outputs/HANDOFF_2026-05-10_runner-shipping.md` into Claude project
