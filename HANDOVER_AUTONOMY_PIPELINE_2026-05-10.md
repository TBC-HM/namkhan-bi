> **⚠️ STALE — This file is legacy documentation**
>
> Canonical platform architecture and deployment guide now live in the database
> (`documentation.documents`, rendered via the knowledge system). This file is
> kept for historical reference only.

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
7. **PBS clicks `✓ approve · deploy`** in the dept-entry bug box. POST to `/api/cockpit/approve-deploy` with `{ bug_id, deployment_url }`. The endpoint resolves the deployment via Vercel API (now uses `/v6/deployments?app=namkhan-bi` listing instead of `/v13/deployments/<host>`, which 404'd on team-scoped preview URLs), then POSTs to `/v10/projects/namkhan-bi/alias` with the deployment and aliases the main `namkhan-bi.vercel.app` alias to it. On success, marks bug `done` + writes audit.

## Carla's failure mode

PR #232 introduced the retry-on-tsc-error loop:
1. Writes code, runs `npx tsc --noEmit`.
2. If fail → feeds errors back to Sonnet-4-6 (same 16k tokens, new messages with the full prior `response.content` + user-part error dump).
3. Repeat once.

In practice, Carla goes 0/2 ~60–80% of the time:
- blind writes (no RAG or codebase embeddings);
- invents imports (`import { DeptEntrySubpage } from '@/types'` when the real type is in `@/lib/groups-nav/types`);
- picks the wrong utility names;
- calls non-existent helper functions or props.

Recommended fix: **codebase search** (e.g., `embeddings` table + cosine similarity on `deptpage`, `KpiBox`, `<term>`, or heuristic grep). Or a pre-edit "context gather" prompt that asks Sonnet which files to fetch and shows them before code gen.

## Example: tonight's 2 successful bugs

### #17 — parity compliance agent

Carla added a new agent row in `cockpit_agent_prompts` with the `role='parity_compliance'` (system prompt that checks for FP&A / ERP column mismatches and suggests fixes). The PR committed cleanly, tsc passed on first attempt, preview deployed, PBS approved → live.

### #19 — KpiBox gradient hover

The UI wanted a gradient hover on the top-level summary card. Carla edited `components/cockpit-dept/KpiBox.tsx`, changed `hover:border-blue-500` to a gradient variant. Tsc passed, preview deployed, merged.

Both landed in **under 1 hour** from bug filing → live. No human typing a single line of TypeScript. When Carla doesn't hallucinate imports, this chain is ✨ magic ✨.

## Debugging tips

- **Ticket stuck in `triaged` → `working` → `completed` but no PR?**
  Check `cockpit_audit_log` for the relevant ticket (look for `action='agent_runner_finished'` or `agent_runner_aborted'`). The `details` JSONB contains:
  - `pr_url` (string) — the GitHub PR that was created.
  - `preview_url` (string) — the Vercel preview URL (for now, just the PR link again).
  - `errors` (string[]) — any tsc or other abort reasons.

- **Bug stuck in `acked` or `processing`?**
  Refresh the page — the sweep only runs every 5 min. Or POST to `/api/cockpit/bugs/sweep` to force a run.

- **Vercel approve fails with 404?**
  The deployment URL format must be `https://namkhan-<unique>.vercel.app`. If it's a branch preview like `https://namkhan-bi-git-agent-fix-17-tbc-hm.vercel.app`, the old `/v13/deployments/<domain>` route 404'd. Now using `/v6/deployments?app=namkhan-bi` to list + find the deployment by its URL property, then alias that deployment ID.

- **GH Action runner error logs:**
  See `.github/workflows/agent-runner.yml` output in Actions tab. The `agent-runner.ts` script writes to stdout + Supabase `cockpit_audit_log`.

- **Carla wrote code but deleted too much / broke things?**
  The Sonnet-4-6 messages include `<spec>…</spec>` + `<files_to_edit>…</files_to_edit>`. The edits are string-replace or full-file overwrite — no diff-merge. If the spec says "add X to Y function" but Sonnet thinks it's easier to rewrite the file, you lose unrelated code. The fix is better specs in the `notes` field, or to give Carla the ability to read the current file before editing.

- **Avoid merge conflicts:**
  The runner pushes directly from main. If concurrent changes land, the next run will fail to push (non-fast-forward). The current code just aborts and logs. Future improvement: pull + rebase before commit, or use `gh pr merge --auto` + `--merge` on green checks.

## Next steps to make it reliable

1. **RAG / codebase context** — embed all `app/**/*.ts`, `lib/**/*.ts`, `components/**/*.tsx`, `supabase/migrations/**/*.sql`. On triage or spec parse, cosine-search top-k relevant chunks and insert into the Carla prompt. Prevents ~80% of "file not found" and "import from wrong path" errors.

2. **File-read before edit** — instead of writing blind edits, have Carla ask for the current file, then do diff-style edits. More tokens, but higher success rate.

3. **Multi-turn fix loop** — extend the retry-on-tsc-error to 3–5 attempts, or until errors stabilize. Most issues are one-off typos Sonnet can fix if shown the tsc output.

4. **Spec templates** — the current `parsed_summary` is freeform. Guide PBS to use "File: X, Function: Y, Change: Z" format in the bug box, then parse into structured JSON. Less ambiguity for Carla.

5. **Automated tests** — run a subset of Jest/Playwright tests in the GH Action before creating the PR. If they fail, abort or ask Carla to fix.

6. **Vercel real preview URL** — after `gh pr create`, query Vercel `/v6/deployments?app=namkhan-bi&meta-githubCommitRef=<branch>` until a deployment shows up with `state='READY'`, then write the real `https://…vercel.app` preview URL back to the ticket + bug. This lets PBS click through from the bug box to a live preview.

7. **Human review gate** — for some agents or risk levels, insert a "PBS review spec before code" step. The ticket waits in `awaits_user` until PBS clicks "✓ looks good" in the bug box. Then the runner picks it up.

8. **Better PR descriptions** — currently it's just the sanitized spec. Could include:
   - link to the bug in the Namkhan BI cockpit (`https://namkhan-bi.vercel.app/cockpit?highlight=bug-<id>`).
   - the triage notes + recommended_agent rationale.
   - a diff summary (files changed, lines added/removed).

## Maintenance

- **Tuning prompts:** `cockpit_agent_prompts` + `cockpit_agent_skills` are the DB-stored prompt library. `IT_MANAGER_SYSTEM_PROMPT` in `agent/run/route.ts` is hardcoded for triage — keep them in sync.
- **Skill library:** `cockpit_agent_skills` rows are joined into prompts via `cockpit_agent_role_skills`. Add new skills (e.g., "how to read files from Supabase storage before editing") there.
- **Rate limits:** Anthropic Messages API is billed per token. A 16k-response Sonnet-4-6 call is ~$0.10. At 50 tickets/day, that's $5/day. Watch the usage dashboard.
- **Audit retention:** `cockpit_audit_log` grows unbounded. Consider a cron to archive rows older than 30 days.

---

**Status:** handover complete. The pipeline is live and proven (2 PRs tonight). The bottleneck is Carla's TypeScript hallucination rate. Everything else (triage → ticket → runner → Vercel → approve → alias) works. Fix the hallucinations (RAG or better specs) and you have a production-ready auto-PR loop.