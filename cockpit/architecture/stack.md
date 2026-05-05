# Architecture: Stack

Authoritative list of every system in production for **namkhan-bi**. Update on every addition/removal via ADR.

> Scope note: this file documents the stack for the `namkhan-bi` repo specifically. PBS works on other repos (e.g. Donna Portals) — those have their own stack docs. Cross-repo entries are not duplicated here.

## Core stack

| Layer | Tool | Plan | Purpose |
|---|---|---|---|
| Hosting | Vercel | Pro | Next.js hosting, edge functions, deploys (`namkhan-bi` on team `pbsbase-2825s-projects`) |
| Database | Supabase | Pro | Postgres, Auth, Storage, Realtime — project `namkhan-pms` (ref `kpenyneooigsyuuomgct`) |
| Source control | GitHub | (TBD plan) | Code, issues, Actions, PRs — `TBC-HM/namkhan-bi` |
| PMS | Cloudbeds | (existing account) | Property management, rates, reservations — **TODO: cockpit wiring not yet built** |
| Channel manager | (Cloudbeds-integrated) | — | OTA distribution |
| Payments | n/a | — | This repo is BI only — no payment flow |
| Domain | namkhan-bi.vercel.app | (Vercel-issued) | Custom domain TBD |

## Automation / orchestration

| Tool | Plan | Purpose |
|---|---|---|
| Make.com | Pro | Email intake, webhooks, glue |
| GitHub Actions | included | CI/CD, weekly audits |
| Claude Code (with Agent Teams) | Max | Dev work, subagents (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) |
| Claude API | pay-go | Orchestrator brain (via Make.com) |

## Monitoring

| Tool | Plan | Purpose |
|---|---|---|
| Vercel Speed Insights | Pro included | Real user perf |
| Vercel Web Analytics | Pro included | Traffic |
| Vercel Agent | beta (free) | AI investigation, auto-fix |
| Supabase Advisors | Pro included | Security + perf scans |
| Better Stack (or alt) | TBD — **TODO: not yet selected** | Uptime monitoring |

## External APIs we depend on

| API | Used for | Critical? |
|---|---|---|
| Cloudbeds | All Namkhan revenue data (when wired — TODO) | Yes — sole revenue source |
| Vercel API | Deployment management | Yes |
| Supabase API | DB, auth, storage | Yes |
| GitHub API | Source, issues, Actions | Yes |
| Anthropic API | Agent reasoning | Yes |
| OpenAI Whisper | Voice note transcription | No (fallback to text) |
| TikTok / Instagram public APIs | Research Arm | No |
| YouTube Analytics | Namkhan content tracking | No |

## Environments

| Env | Branch | URL | Notes |
|---|---|---|---|
| Production | `main` | `namkhan-bi.vercel.app` | Manual `npx vercel --prod --yes` — auto-deploy is OFF (see root `CLAUDE.md` § Deploy) |
| Preview | per PR | `*-git-*.vercel.app` | Auto-deploy on push |
| Local | dev | localhost | Per developer |

## Data flow (high level)

```
User → Vercel (Next.js) → Supabase (DB) — namkhan-pms project
                       ↘ Cloudbeds API (rates, availability) — TODO

Email → Make.com → Claude Code Web → GitHub PR → Vercel preview → PBS approves → Vercel prod
Vercel events → Make.com → Supabase (cockpit_incidents) → Email digest → data@thedonnaportals.com
```

## What's NOT in the stack (decisions to keep simple)

- No Notion (decided 2026-05-05)
- No Telegram (decided 2026-05-05)
- No Slack
- No Firebase / no Google Cloud Run / no AWS Lambda
- No additional CMS (use repo + markdown)
- No additional analytics (Vercel + Supabase suffice)

## Decisions that triggered changes here

- ADR 0001 — Initial cockpit architecture (4 arms + orchestrator)
- (more as added)

## Action items / TODOs

- [ ] Wire Cloudbeds API into the cockpit (currently account-level only, no automation)
- [ ] Choose uptime monitor (Better Stack vs alternative) and add log drain
- [ ] Decide custom domain (currently `namkhan-bi.vercel.app`)
- [ ] Set up `dev@` email alias for ticket intake
- [ ] Confirm GitHub plan
