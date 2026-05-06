# Cockpit Agent Network — current state

## What runs autonomously

| Component | Where | Trigger | What it does |
|---|---|---|---|
| **IT Manager triage** | `/api/cockpit/chat` (Vercel route) | POST from `/cockpit` chat tab | Classifies request → arm + intent + urgency + plan + recommended_agent. Writes to `cockpit_tickets`. |
| **Agent Worker** | `/api/cockpit/agent/run` (Vercel route) | (a) chat route fires it after triage, (b) pg_cron every minute, (c) manual POST | Picks up `cockpit_tickets` rows in `new`/`triaging`/`triaged`. Runs the role-specific agent prompt and writes results back. |
| **pg_cron drainer** | `cron.job` id 53 (`cockpit-agent-worker`) | every 1 min | POSTs to `/api/cockpit/agent/run` with bearer. Backstop for tickets that bypassed the chat route. |
| **Email → Ticket trigger** | `public.cockpit_email_to_ticket()` on `sales.email_messages` | INSERT (any inbound email) | If subject starts with `[cockpit]` OR recipient is in intake list → creates `cockpit_tickets` row with status='new'. |
| **Vercel deploy webhook** | `/api/cockpit/webhooks/vercel` | Vercel deploy events | On `deployment.error` → calls Vercel API to promote previous deploy (auto-rollback) + logs S1 incident. |
| **Uptime webhook** | `/api/cockpit/webhooks/uptime` | UptimeRobot/Better Stack alerts | Re-checks the URL → logs S1 incident if still down → marks resolved on recovery. |
| **Incident webhook** | `/api/cockpit/webhooks/incident` | any source POSTing | Maps source → severity → logs incident → opens GH issue if S1/S2. |

## Status flow on `cockpit_tickets`

```
new ─────► triaging ─────► triaged ─────► working ─────► completed
                                                      │
                                                      ├──► awaits_user
                                                      ├──► blocked
                                                      └──► triage_failed
```

- `new` → trigger or webhook just inserted, no AI yet
- `triaging` → chat route inserted, calling Anthropic now
- `triaged` → IT Manager done, agent worker hasn't picked up yet
- `working` → agent worker is calling the role agent
- `completed` → role agent produced advisory output, no blockers
- `awaits_user` → role agent flagged blocking questions, needs PBS
- `blocked` → role agent said "do not proceed" (rare)
- `triage_failed` → Anthropic API failure or non-JSON output

## Agent roles defined

(All are **advisory** in v1 — they produce JSON deliverables, not code.)

| Role | When IT Manager picks it | Output |
|---|---|---|
| `researcher` | arm=research; data/SQL/metric questions | findings, open questions, sources to check, confidence |
| `designer` | arm=design; brand/typography/component asks | design notes, rule violations risk, components to use, approve_to_proceed |
| `documentarian` | document/explain/spec asks | docs to write/update, draft outline |
| `reviewer` | arm=control; before-build risk check | risks (severity), must-have tests, approve_to_proceed |
| `tester` | test asks | unit/integration/e2e tests, regression risks |
| `ops_lead` | arm=ops; out-of-IT-scope asks | owner, next action, deps |
| `none` | unclear | summary, needs_human_decision |

## Webhooks — endpoints + auth

All webhook routes accept either `?secret=<COCKPIT_WEBHOOK_SECRET>` query param or `X-Cockpit-Secret: <secret>` header.

| Route | Used by | Source format |
|---|---|---|
| `/api/cockpit/webhooks/vercel` | Vercel Deploy Hooks | `{type:"deployment.error|canceled|succeeded", payload:{deployment:{...}}}` |
| `/api/cockpit/webhooks/uptime` | UptimeRobot / Better Stack | `{alertType:"down|up", url, monitor}` |
| `/api/cockpit/webhooks/incident` | anything | `{source, symptom, severity?, metadata?}` |

## Env vars on Vercel (production)

| Var | Used by | Set? |
|---|---|---|
| `ANTHROPIC_API_KEY` | chat triage + agent worker | ✅ pre-existing |
| `NEXT_PUBLIC_SUPABASE_URL` | all routes | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client (chat tab) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | all server routes | ✅ |
| `COCKPIT_USERNAME` / `COCKPIT_PASSWORD` | Basic Auth on `/cockpit` + `/api/cockpit/*` | ✅ |
| `COCKPIT_AGENT_TOKEN` | bearer for agent worker | ✅ |
| `COCKPIT_WEBHOOK_SECRET` | webhook auth | ✅ |
| `NEXT_PUBLIC_SITE_URL` | chat → worker self-call URL | ✅ |
| `VERCEL_TOKEN` | deploy webhook auto-rollback | ✅ (CLI session token, expires; rotate from https://vercel.com/account/tokens for permanent) |
| `GITHUB_TOKEN` | incident webhook → open GH issue | ✅ (gh CLI token, scoped to your account) |

## Cron jobs in Supabase

| Jobid | Name | Schedule | Purpose |
|---|---|---|---|
| 53 | `cockpit-agent-worker` | `* * * * *` (every minute) | Drains cockpit_tickets queue |

Existing weekly digest cron is via GitHub Actions (`weekly-audit.yml`) — runs Mondays 06:00 UTC, posts an issue to the repo with KPIs + npm audit + Lighthouse + AI digest.

## How to use it

### Send a request via web chat
1. Open `https://namkhan-bi.vercel.app/cockpit` (login: `pbs` / `<password>`)
2. Chat tab → type a request → Send
3. Within ~10s: ticket appears in left rail with arm + status badges, summary expands with IT Manager triage
4. Within ~60s: a second update appears with the role agent's deliverable (e.g., research findings, design check, test plan)

### Send a request via email
1. Send to any of these addresses with subject `[cockpit] <request>`:
   - `pbsbase+cockpit@gmail.com`
   - `pbsbase+dev@gmail.com`
2. Within ~5 min (Gmail poll interval): ticket appears in `/cockpit`
3. Within ~60s after that: triage + agent work appear

### See what happened
- `/cockpit` → Logs tab → filter by ticket id or agent
- Or in Supabase SQL: `SELECT * FROM cockpit_audit_log ORDER BY created_at DESC LIMIT 20`

## What still needs human input

These require PBS to do something one-time:

| Action | Time | Why |
|---|---|---|
| Vercel hardening (spending cap + firewall) | 15 min | Cost & abuse control. See `cockpit/runbooks/PIECE_2_VERCEL_HARDENING.md` |
| Vercel Deploy Hooks → paste webhook URL | 1 min | Needed for auto-rollback |
| UptimeRobot signup + add monitor + paste webhook URL | 5 min | Needed for site-down alerts |
| Decide: dev intake email address | — | If you want a dedicated email instead of `pbsbase+cockpit@gmail.com` |

URLs to paste:
- Vercel Deploy Hooks: `https://namkhan-bi.vercel.app/api/cockpit/webhooks/vercel?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba`
- UptimeRobot: `https://namkhan-bi.vercel.app/api/cockpit/webhooks/uptime?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba`
- Generic incident receiver: `https://namkhan-bi.vercel.app/api/cockpit/webhooks/incident?secret=ec5ca8f900b0d0611f8c8b64632202113736ce7627e0bbba`

## What NOT yet automated (intentional v1 boundaries)

- **Code-writing agents** — designer/reviewer/tester all return advisory JSON, not code patches. Adding code-writing requires sandbox + safety boundaries (write to a branch, never main). Out of scope for v1.
- **Auto-PR open** — the Dev Arm spec says "ticket → PR" but that whole flow is parked until Claude Code Web trigger or a dedicated worker is set up.
- **Multi-step agent loops** — current worker is one role per ticket, one shot. No back-and-forth between researcher and designer yet.
- **Slack / WhatsApp intake** — only chat tab + email today.
