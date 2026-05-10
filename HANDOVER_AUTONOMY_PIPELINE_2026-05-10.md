# Namkhan BI — autonomy pipeline handover

**Audience:** a senior engineer brought in to make the bug-box → auto-PR loop reliable.
**State:** end-to-end pipeline works (2 PRs landed live tonight). Bottleneck is Carla's TypeScript success rate.
**Author:** Claude Opus 4.7 (1M context), session 2026-05-09 19:00 → 2026-05-10 03:30 UTC.

## TL;DR

PBS files a bug in any dept-entry page → cron creates a ticket → Kit triages → if it's `arm=dev intent=build|fix|spec` and routed to `frontend|backend|lead`, GH Action runs `scripts/agent-runner.ts` (Carla) → Carla writes code → branch pushed → Vercel preview built → bug-sweep copies preview URL into bug box → PBS clicks "✓ approve · deploy" → `/api/cockpit/approve-deploy` aliases preview to `namkhan-bi.vercel.app`.

Tonight: 2 bugs went the full chain (#17 parity agent, #19 KpiBox hover). Both **live in production right now**.

The remaining 50 queued tickets keep aborting because Carla writes broken TypeScript (~60–80% failure rate even with the retry-on-tsc-error loop just shipped in PR #232). She writes blind — no codebase search, just spec → code.

## Where everything lives

| Concern | File |
|---|---|
| Bug box UI (per-dept) | `components/dept-entry/DeptEntry.tsx` |
| Bug box API | `app/api/cockpit/bugs/route.ts` |
| Bug → ticket sweep + bug status promotion | `app/api/cockpit/bugs/sweep/route.ts` |
| Triage (Kit) | `app/api/cockpit/agent/run/route.ts` (POST queue-drain + GET cron drain) |
| Carla code-writer | `scripts/agent-runner.ts` |
| Carla GH Action workflow | `.github/workflows/agent-runner.yml` |
| Vercel cron config | `vercel.json` (every 5 min: bugs/sweep + agent/run) |
| Approve / promote | `app/api/cockpit/approve-deploy/route.ts` |
| Dismiss virtual rows | `app/api/cockpit/tickets/dismiss/route.ts` |
| Chat (Felix etc.) | `app/api/cockpit/chat/route.ts` (separate from triage path) |

DB tables: `cockpit_bugs`, `cockpit_tickets` (FK via `metadata.cockpit_bug_id`), `cockpit_audit_log`, `cockpit_agent_prompts`, `cockpit_agent_skills`, `cockpit_agent_role_skills`.

## State machine

### `cockpit_bugs.status`
`new` (red) → `acked` (orange) → `processing` (light green, has fix_link) → `done` (dark green)

DB trigger blocks `done` → other states. Sweep can flip processing → new on `triage_failed` to retry.

### `cockpit_tickets.status`
`new` → `triaging` (chat-only) → `triaged` → `working` → `awaits_user` | `completed` | `triage_failed` | `archived`

`processed_at` is stamped by trigger on terminal status. Queue drainer uses `.is('processed_at', null)` so a ticket is never picked twice.

## How a bug becomes a PR (current chain)

1. **Bug filed** — POST `/api/cockpit/bugs` from dept-entry box. Row created with status='new'.
2. **bugs/sweep cron** (every 5 min):
   - Picks 10 oldest `status='new'` bugs.
   - For each: inserts `cockpit_tickets` row (`source='cockpit_bugs', arm=dept_slug, intent='triage', status='new'`, `metadata.cockpit_bug_id=bug.id`).
   - Flips bug `new → acked`.
   - Then for `acked`/`processing` bugs, looks up the linked ticket and:
     - terminal ticket → bug `done` + copy fix_link.
     - working ticket (`triaging`/`triaged`/`working`/`awaits_user`/...) → bug `processing`. If ticket is `awaits_user` and has `preview_url`, copy preview to bug.fix_link so the **approve button** shows.
     - `triage_failed`/`failed`/`rolled_back` → bug back to `new` (red, retry).
3. **agent/run cron** (every 5 min, GET with `x-vercel-cron: 1`):
   - Selects 5 `cockpit_tickets` where `status IN ('new','triaged') AND processed_at IS NULL`.
   - For status=`new` → calls `triageMessageInline()` (uses **hardcoded** `IT_MANAGER_SYSTEM_PROMPT` — the DB prompt is for chat only).
   - Triage updates ticket: `status='triaged'`, `arm`, `intent`, `notes` JSON with the Triage object. If `recommended_agent ∈ {frontend, backend, lead}`, FORCES `arm='dev'` and `intent ∈ {build,fix,spec}` so Carla's filter sees it. Then sets `metadata.handoff_to_runner=true` and RETURNS without calling `callRoleAgent`. Important: read-only roles (designer/tester/etc.) DO go through `callRoleAgent` (analysis only, marks ticket completed).
4. **GH Action `agent-runner`** (every 10 min cron + workflow_dispatch):
   - `scripts/agent-runner.ts` selects 5 tickets where `status='triaged' AND arm IN ('dev','code') AND intent IN ('build','spec','fix') AND preview_url IS NULL AND processed_at IS NULL`.
   - Builds spec from `parsed_summary + notes + metadata`.
   - Calls Anthropic Messages API directly (`claude-sonnet-4-6`, max_tokens=16000) with strict JSON-only system prompt.
   - Bracket-balances the response to extract first JSON object (4-6 doesn't support prefill).
   - Applies edits (string-replace or full-file write, with `mkdirSync` for new dirs).
   - **`tsc --noEmit` gate** — if it fails, asks Carla to fix with the errors as feedback (PR #232). If second attempt also fails, abort + audit + delete branch.
   - On success: `git commit -F <file>` + `git push` + `gh pr create --title "<sanitized>" --body-file <file>`.
   - Stamps `processed_at` + writes `pr_url`/`preview_url` back to the ticket.
5. **Vercel preview** auto-builds from the pushed branch.
6. **bug-sweep next tick** sees ticket has `preview_url` (the runner writes the GitHub PR URL there as a temp; ideal future: write the actual `https://namkhan-xxxxxxxxxxx.vercel.app` preview URL by querying Vercel API after push completes).
7. **PBS clicks `✓ approve · deploy`** in the dept-entry bug box. POST to `/api/cockpit/approve-deploy` with `{ bug_id, deployment_url }`. The endpoint resolves the deployment via Vercel API (now uses `/v6/deployments?app=namkhan-bi` listing instead of `/v13/deployments/<host>`, which 404'd on team-scoped preview URLs), then POSTs to `/v2/deployments/<uid>/aliases` with `{alias: "namkhan-bi.vercel.app"}` — that's how Vercel "promote" works in API form. Marks ticket `completed`, bug `done` + fix_link=prod URL.

## What I fixed tonight (PRs)

| PR | What was broken |
|---|---|
| #214 | Triage Anthropic call returned prose, not JSON — DB prompt v23 had stacked CHAT MODE blocks. |
| #216 | bug-sweep created tickets with `status='triaging'` but queue drainer scanned `'new','triaged'` → orphans. |
| #217 | Triage path was using DB chat persona prompt; switched to hardcoded `IT_MANAGER_SYSTEM_PROMPT` with explicit JSON contract. |
| #218 | Kit's enum was `designer\|tester\|...\|none` — frontend/backend/lead missing. Added them + bug-box default bias toward frontend. |
| #219 | `writeFileSync` ENOENT for new dirs (added `mkdirSync({recursive:true})`); `max_tokens:4096` truncated → 16000. |
| #220 | When Kit picked frontend/backend/lead, agent/run was running `callRoleAgent` (analysis) and marking ticket completed before Carla could see it. Now hands off (status stays triaged). |
| #221 | git commit failed on backticks/quotes → switched to `-F file`. |
| #222 | `claude-sonnet-4-6` returns 400 on assistant prefill (PR #221 had tried prefill). Replaced with bracket-balanced JSON extractor. |
| #223 | GH runner had no git user.name/email → added a `git config` step. Bumped `MAX_BATCH` 3→5. |
| #225 | `gh pr create` failed silently because shell-substitution title had newlines. Sanitize title + log stderr. |
| #226 | Carla refused too many tickets ("blockers unresolved") for soft uncertainty. Updated SYSTEM_PROMPT: "ship with documented assumptions, only refuse on hard data dependencies." |
| #228 | Carla shipped (parity agent) — first end-to-end success. **LIVE.** |
| #227 | Carla shipped (KpiBox hover). **LIVE.** |
| #231 | Pre-push tsc gate; `/v6/deployments` listing for approve-deploy URL resolution (the `/v13` lookup 404'd on team-scoped preview hostnames). |
| #232 | Retry once with tsc errors fed back as feedback. |

### What's still open
- Carla aborts on most attempts because she writes blind. Even with tsc-retry-once (PR #232), retry usually fails — she rewrites stuff that breaks differently. The next session must add file-context (option **a** in §1 below — the high-impact fix).
- ~49 triaged dev tickets queued for Carla (status='triaged' arm='dev').
- ~5 PRs landed for review tonight: #224 (closed broken), #227 ✅ #19 KpiBox hover (LIVE in prod), #228 ✅ #17 parity agent (LIVE in prod), #229 (closed broken), #230 (closed broken), #234 #235 #239 #240 #241 (open, awaiting review).
- Vercel cron now auto-dispatches the GH Action runner (PR #237). GH's own schedule cron has not fired once tonight — Vercel cron is the reliable trigger.
- Failed tickets now lock with processed_at on every terminal outcome (PR #238) — no more loops.

### TOMORROW: top priority fix (PBS request)
**Give Carla file-context BEFORE she writes (option a from §1).** Concrete plan:
- In `scripts/agent-runner.ts` `processOne()`, after fetching the ticket but BEFORE `callClaude(spec)`:
  - Extract candidate keywords from the spec body (component names, route paths, helper names — anything matching `[A-Z][a-zA-Z]+` or `/[a-z][a-z-]+`).
  - For each keyword, run `grep -rl --include='*.tsx' --include='*.ts' "<keyword>" app components lib styles` (limit 3 matches each, dedupe).
  - For each top-3 matched file, read the file (cap 2000 chars per file) and embed in the spec under "## Existing context (read this BEFORE editing)".
- This grounds Carla in the actual codebase she's editing — eliminates the "imports things that don't exist" and "references components that don't exist" failure modes.
- Estimated impact: tsc pass rate jumps from ~30% → ~70%. Most of the queued 49 tickets will ship cleanly.
- Estimated effort: 30 min. No new dependencies. Pure addition to `processOne`.

After file-context lands, the queue will drain on its own via Vercel cron. PBS just opens the resulting PRs in the bug box approve buttons.

## What a specialist should look at next

### 1. Give Carla codebase context BEFORE she writes
Currently she gets `parsed_summary + notes + metadata` and is expected to produce edits blind. Top causes of TS failures:
- imports things that don't exist
- references components that don't exist
- writes test files using jest globals (jest not installed)
- assumes hooks/utilities that aren't there

Fix options (in order of pragmatism):
- **a.** Add a "context" prefix to her spec: run `grep -l "<keyword>"` for words from the spec, read top 3 matching files, prefix the spec with their content + paths. Cheap, high impact.
- **b.** Switch to multi-turn agent loop with `read_file`, `grep_codebase`, `write_file` tools. Higher cost but catches all the blind-edit issues. Anthropic's tool-use API supports this; the chat route (`app/api/cockpit/chat/route.ts`) already has the pattern via `lib/cockpit-tools.ts` skills.
- **c.** Use Claude Agent SDK directly (full filesystem + bash tool access). Heaviest but the obvious right answer long-term.

### 2. Replace `pr_url=temp` with actual Vercel preview URL
After `git push`, the runner doesn't know the preview URL yet. Currently writes `pr_url` as github URL. Should poll `/v6/deployments?meta-githubCommitRef=<branch>` until a Ready deployment appears, then write `preview_url`. That makes the bug-box approve button work without any manual stitching.

### 3. Parallel ticket processing
Currently serial (one ticket at a time, ~1min each). 50 tickets = 50 min sequentially. Two paths:
- Spawn N workflow runs (one per ticket) via `gh workflow run agent-runner --field ticket_id=N`. GH Actions concurrency limits apply.
- Inside the script: parallelize the Anthropic calls but serialize the git operations. Easier.

### 4. The 9 "architect" bugs (#16–#24)
Most of these are vague repair-list items I filed. Many are already implemented in the codebase. The runner correctly aborts because there's nothing to change. Consider: a "spec-completeness check" upfront — Kit asks PBS for clarification BEFORE handing off if the spec lacks file paths or concrete deltas.

### 5. Approval UX in chat
PBS asked: "approval should appear where the request was made — chat thread, not backend." The `/api/cockpit/bugs?dept=X` endpoint now folds `awaits_user` tickets as virtual bug rows (PR #216), so chat-created tasks surface for approval in the dept-entry bug box. That partially closes the gap. A full chat-thread approve UI would require the chat shell to subscribe to the ticket's status and render the button when it reaches `awaits_user`.

## Environment + secrets

`namkhan-bi` Vercel project (`prj_be5AGzi7cB5HnkTEvOWTzUv3YCAl`, team `pbsbase-2825s-projects`, region fra1).

Required env vars (production + GH Actions):
- `NEXT_PUBLIC_SUPABASE_URL` — `https://kpenyneooigsyuuomgct.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` — service role (NOT anon)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `VERCEL_TOKEN` (for approve-deploy to alias)
- `VERCEL_TEAM_ID` (optional, defaults inferred)
- `PROD_ALIAS` (optional, defaults to `namkhan-bi.vercel.app`)
- `COCKPIT_AGENT_TOKEN` — bearer for manual POST to `/api/cockpit/agent/run` (Vercel cron uses `x-vercel-cron` header instead).
- `GITHUB_TOKEN` (provided by GH Actions runner)

## Deploy protocol

`npx vercel --prod --yes --force` from the repo root. GitHub auto-deploy is **OFF** for this project. `--force` is mandatory because Vercel sometimes thinks "no change". After deploy, smoke-test on `namkhan-bi.vercel.app` (cache-bust with `?bust=$RANDOM`).

CI: GH Actions runs tsc + lint + build + design-doc-check on every PR. Two `tsc --noEmit` checks (one workflow has it twice — both must pass before admin-merge).

## Database safety

- Service role key never in repo. PBS handles it via Vercel env vars + GH secrets.
- DB triggers enforce: `processed_at` stamped on terminal status; `done` bugs can't revert.
- Backup tables created tonight: `cockpit_tickets_backup_pre_autonomy_20260509` (and similar for bugs/proposals).
- `enforce_ticket_evidence_on_completed` — completed dev/build/fix tickets must have `metadata.evidence.pr_url` or `.github_sha`. Don't bypass.

## Useful commands

```bash
# State of the queues
psql via supabase MCP: select status, count(*) from cockpit_bugs group by status;

# Manually fire a cron tick
curl -sS "https://namkhan-bi.vercel.app/api/cockpit/bugs/sweep"
curl -sS -H "x-vercel-cron: 1" "https://namkhan-bi.vercel.app/api/cockpit/agent/run"

# Manually run Carla
gh workflow run agent-runner --field ticket_id=""        # batch 5
gh workflow run agent-runner --field ticket_id=596       # one ticket

# Watch Carla's output
gh run list --workflow=agent-runner --limit 1
gh run view <id> --log | grep -E "agent-runner:|=== ticket|✓|note:|tsc gate:|tsc retry:"

# Promote a preview to prod by hand
npx vercel promote https://namkhan-XXXXX.vercel.app --yes
```

## What PBS cares about (operator profile)

- Hospitality data analyst, runs The Namkhan boutique hotel BI dashboard.
- Spain timezone, direct + structured comms, no filler.
- Wants the dept-entry pages (especially `/architect`) to be the ONLY surface he uses. Approvals must surface there, not in `/cockpit/tasks` backend pages.
- Brand: `$` USD prefix, `₭` LAK, em-dash `—` for empty cells, italic Fraunces for KPI values, six canonical primitives only (`<Page>`, `<KpiBox>`, `<Panel>`, `<DataTable>`, `<Brief>`, `<Lane>`).
- Locked design doc: `DESIGN_NAMKHAN_BI.md` (root). Mandatory read before any UI change. End-of-session changelog entry required.

— end of handover —
