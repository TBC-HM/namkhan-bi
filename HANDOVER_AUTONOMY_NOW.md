# Namkhan BI autonomy pipeline — HANDOVER (current state, 2026-05-10 morning)

**Read this first.** Supersedes `HANDOVER_AUTONOMY_PIPELINE_2026-05-10.md` (last-night version).

## TL;DR — what's broken right now

PBS files bugs in `/architect`. Bugs reach the queue. Triage works. **Carla (the code-writer) cannot ship reliably** — she writes broken TypeScript ~70% of the time. The retry-with-tsc-feedback loop helps a little but not enough. Every cron tick wastes ~5 Anthropic calls on tickets that abort.

The pipeline runs end-to-end. The output is unusable.

## Right-now numbers

```sql
-- bugs
done: 2  (#17 parity, #19 KpiBox — LIVE in prod, approved by PBS)
processing: 16  (in-flight, no preview yet → no approve button)

-- tickets (from cockpit_bugs source, processed_at IS NULL)
new: 1
triaged: 52  (49 with arm='dev' intent='build|fix' — Carla's queue)
awaits_user: 1
```

**Carla's performance overnight:**
- ~5 cycles × 5 tickets = ~25 attempts
- 4 PRs shipped (#234 #235 #239 #240 #241 — open, awaiting your review)
- Rest aborted on tsc gate, even with retry-once-with-feedback (PR #232)

## What's actually wired and working

| Layer | State |
|---|---|
| Bug filing in dept-entry box | ✅ works |
| `bugs/sweep` cron (every 5 min) | ✅ fires; creates ticket from new bug; promotes bug status |
| Triage (`agent/run` GET cron + handoff to runner) | ✅ works for code roles (frontend/backend/lead) — they leave at status='triaged', stamped `metadata.handoff_to_runner=true` so triage doesn't re-pick |
| Triage drainer skip-handoff filter | ✅ implemented (PR #237) |
| GH Action `agent-runner` workflow | ⚠️ Schedule cron unreliable — only fires intermittently. Vercel cron auto-dispatch works when invoked manually but appears to skip on real cron ticks. **NEEDS INVESTIGATION** (see § Next steps) |
| Carla writing code | ❌ **The bottleneck.** Writes blind, breaks TS, aborts on `tsc --noEmit`. |
| `tsc` gate + retry once | ✅ implemented (PR #231 #232). Catches broken patches. Retry rarely succeeds. |
| Lock on every terminal outcome | ✅ implemented (PR #238). Failed tickets stamp `processed_at`, so the same broken ticket isn't re-picked forever. |
| Approve-deploy endpoint | ✅ works (PR #231 used `/v6/deployments?app=` URL lookup; previously was `/v13/deployments/<host>` which 404'd) |
| Bug box approve button | ✅ surfaces when bug.fix_link is a `https://namkhan-XXX.vercel.app` preview |

## The single concrete fix that will move the needle

**Add file-context grep to `scripts/agent-runner.ts` `processOne()` BEFORE `callClaude(spec)`.**

Carla currently sees: `parsed_summary + notes + metadata`. She has no visibility into the actual codebase. So she:
- imports things that don't exist
- references components that don't exist (`<Tooltip>`, `<Section>`, etc.)
- writes test files using jest globals (jest is not installed)
- assumes hooks/utilities (`useHoverBridge`) that aren't there

**Concrete patch:**
```ts
// In processOne, BEFORE await callClaude(spec):

import { execSync as exec } from 'node:child_process';

// Extract candidate keywords from the spec
const keywords = (spec.match(/\b[A-Z][a-zA-Z]+\b/g) ?? [])
  .concat(spec.match(/\/[a-z][a-z-]+\/[a-z-]+/g) ?? [])
  .filter((k, i, a) => a.indexOf(k) === i)
  .slice(0, 8);

// Find files and read their content
const contextFiles: string[] = [];
for (const kw of keywords) {
  try {
    const files = exec(
      `grep -rl --include='*.tsx' --include='*.ts' "${kw.replace(/[^\w-]/g, '')}" app components lib styles 2>/dev/null | head -3`,
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim().split('\n').filter(Boolean);
    for (const f of files) {
      if (contextFiles.includes(f)) continue;
      contextFiles.push(f);
      if (contextFiles.length >= 8) break;
    }
  } catch { /* keyword had no matches */ }
  if (contextFiles.length >= 8) break;
}

const contextBlock = contextFiles.length > 0
  ? '\n\n## Existing context (read this BEFORE editing)\n\n' +
    contextFiles.map((f) => {
      const content = readFileSync(f, 'utf8').slice(0, 2000);
      return `### ${f}\n\`\`\`\n${content}\n\`\`\``;
    }).join('\n\n')
  : '';

const finalSpec = spec + contextBlock;
const out = await callClaude(finalSpec);
```

Estimated impact: tsc pass rate 30% → 70%. Most of the queued 49 tickets will ship cleanly. Effort: 30 min including testing.

## Other open items (in priority order)

1. **Investigate why Vercel auto-dispatch isn't reliable.** See `app/api/cockpit/agent/run/route.ts` `maybeDispatchRunner()`. It works when called manually with `x-vercel-cron: 1` header but appears to skip on actual Vercel cron ticks. Either GITHUB_TOKEN scope, missing await, or silent throw. Logging is sparse.
2. **GH cron schedule.** Just bumped to `*/5` (PR pending merge as of writing). Was `*/10`. GH Actions schedule cron is unreliable — fired only twice in 12 hours overnight.
3. **`pr_url` should be the actual Vercel preview URL, not the GH PR URL.** After `git push`, the runner doesn't know the preview URL. Need to poll `/v6/deployments?meta-githubCommitRef=<branch>` until Ready, then write the actual preview URL. This makes the bug-box approve button work without manual stitching.
4. **Most of PBS's "architect" bugs (#16–#24) are vague repair-list items.** Many are already implemented. Carla refuses or aborts. Consider a "spec-completeness check" — Kit asks PBS for clarification BEFORE handoff if spec lacks file paths or concrete deltas.
5. **Approve UX in chat.** PBS prefers approval to surface in the chat thread, not a backend page. The `awaits_user` virtual-bug fold (PR #216) partially solves this but doesn't render in chat.

## Files map

```
app/api/cockpit/bugs/route.ts           -- bug box GET/POST/PATCH/DELETE
app/api/cockpit/bugs/sweep/route.ts     -- bug→ticket sweep (every 5 min)
app/api/cockpit/agent/run/route.ts      -- triage entry, queue drainer, dispatch GH runner
app/api/cockpit/approve-deploy/route.ts -- alias preview to namkhan-bi.vercel.app
app/api/cockpit/tickets/dismiss/route.ts -- "X" handler for virtual rows
app/api/cockpit/team/route.ts           -- /cockpit/team page (filter must include all runner actions)
app/api/cockpit/chat/route.ts           -- chat (Felix etc.) — separate from triage path
scripts/agent-runner.ts                 -- Carla — the bottleneck. Edit this for file-context fix.
.github/workflows/agent-runner.yml      -- GH Action workflow. cron: */5
vercel.json                             -- crons (bugs/sweep + agent/run, both */5)
components/dept-entry/DeptEntry.tsx     -- bug-box UI. Approve button is here.
```

## Auth + secrets

| Var | Where | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Vercel + GH secrets | Triage + Carla |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + GH secrets | Read/write all DB |
| `SUPABASE_SERVICE_ROLE_KEY` (GH: `SUPABASE_SERVICE_KEY`) | Vercel + GH secrets | Bypass RLS |
| `VERCEL_TOKEN` | Vercel | Approve-deploy aliases |
| `GITHUB_TOKEN` | Vercel | maybeDispatchRunner workflow_dispatch |
| `COCKPIT_AGENT_TOKEN` | Vercel | Manual POST to agent/run (not used by cron) |

## How to verify the chain manually (in order)

```bash
# 1. Sweep new bugs into tickets
curl -sS "https://namkhan-bi.vercel.app/api/cockpit/bugs/sweep"

# 2. Triage new tickets + auto-dispatch runner
curl -sS -H "x-vercel-cron: 1" "https://namkhan-bi.vercel.app/api/cockpit/agent/run"

# 3. Manually fire the runner (if auto-dispatch didn't)
gh workflow run agent-runner --field ticket_id=""

# 4. Watch progress
gh run list --workflow=agent-runner --limit 3
gh run view <id> --log | grep -E "agent-runner:|=== ticket|✓|note:|tsc gate:"

# 5. State check
# (requires Supabase MCP or service role)
SELECT status, count(*) FROM cockpit_bugs GROUP BY status;
SELECT status, arm, count(*) FROM cockpit_tickets WHERE source='cockpit_bugs' AND processed_at IS NULL GROUP BY status, arm;
```

## Tonight's PR list (live PRs from this session)

Live in prod (PBS approved + promoted):
- #227 — KpiBox tile hover-bridge (bug #19)
- #228 — Parity scraping agent revival (bug #17)

Open, awaiting review:
- #234 — KPI tooltip across depts
- #235 — Date pill picker
- #239 — Taxonomy design update (ticket #586)
- #240 — Leakage opportunity timestamps (ticket #590)
- #241 — Poster report redesign (ticket #591)

Closed broken:
- #224, #229, #230 — failed Vercel build, Carla wrote uncompilable code

Infra fixes (merged tonight):
- #214 #216 #217 #218 #219 #220 #221 #222 #223 #225 #226 #228 #231 #232 #233 #236 #237 #238 #245

## What PBS wants from the next session

1. Ship the file-context fix to `scripts/agent-runner.ts` (top priority, see § "single concrete fix")
2. After deploy, fire the runner manually 5–10 times (GH Action workflow_dispatch). Each batch processes 5 of the 49 queued tickets.
3. Open PRs for the resulting branches (Carla's branch-push works; `gh pr create` is flaky and PBS tonight had to open them manually).
4. Report back: how many of the 49 shipped clean? Which ones still failed and why?

The pipeline IS the right architecture. The only thing keeping it from working unattended is Carla's blind-edit failure rate.

— end of handover —
