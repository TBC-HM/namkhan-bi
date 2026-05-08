# CLAUDE.md — instructions for AI coding agents working on this repo

> Most AI agents (Claude Code, Cursor, Copilot, future Claude sessions) auto-read this file before doing anything. Anything written here applies to every AI-assisted change in this repo.

## STOP — before you touch any UI code, READ THIS

1. **Open `DESIGN_NAMKHAN_BI.md` (repo root)** — full canonical design system reference.
2. **Open `docs/11_BRAND_AND_UI_STANDARDS.md`** — full spec for `<KpiBox>`, `<DataTable>`, `<StatusPill>`, `<PageHeader>`.
3. Use canonical components only. Don't introduce new tile/table markup, hardcoded fontSize literals, hex colors, or `USD ` prefixes.
4. **Read the design-system manifesto** (locked 2026-05-09 — see § "Design system manifesto" below). PBS directive: *the canvas at `/` is the primary UI; sub-page dashboards are the exception*. **Every** route renders inside `<Page>`; six canonical primitives only; no data cemetery.

## Design system manifesto (locked 2026-05-09)

Persisted in `cockpit_knowledge_base WHERE scope = 'design_system_manifesto'` so every agent that consults KB reads it before touching UI. Seven entries (ids 483–489); never overwrite.

### The 7 binding rules

1. **Canvas first.** Primary UI = the canvas at `/`. PBS asks → agent returns a Brief (signal · good · bad · proposals) → 3-state kanban (proposal · in_process · done). Sub-page dashboards are the **exception**, not the default. When a question is best answered by a viz, render one of the 3 sample dashboard layouts (`/sample/1|2|3`); otherwise return a Brief.

2. **`<Page>` shell mandatory.** Every route renders inside `components/page/Page.tsx`. The shell owns page padding (32px sides, 64px bottom, max-width 1280, centered), eyebrow + Fraunces italic title, optional sub-pages strip, optional topRight slot for weather/user/date pills, and the SLH-affiliation footer. **Pages do not reinvent header/footer/chrome.** If you find yourself writing `<div style={{ minHeight: '100vh', padding: ... }}>`, stop and use `<Page>`.

3. **Six primitives, nothing else:**
   - `<Page>` — shell (`components/page/Page.tsx`)
   - `<KpiBox>` — locked KPI tile (`components/kpi/KpiBox.tsx`)
   - `<Panel>` — card around any chart/table/list (`components/page/Panel.tsx`)
   - `<DataTable>` — sortable rows (`components/ui/DataTable.tsx`)
   - `<Brief>` — signal+good+bad+proposals (`components/page/Brief.tsx`)
   - `<Lane>` + `<ProposalCard>` — 3-state kanban (`components/page/{Lane,ProposalCard}.tsx`)
   
   Hard rule: **no ad-hoc `<div style={{ background, border, borderRadius }}>` mimicking these.** Wrap content in `<Panel>` instead.

4. **Action overlay everywhere.** Every artifact (chart, table, KPI, brief) carries the same 4 actions, always: `✦ AI` · `⊕ Save to Reports` · `↻ Schedule` · `📁 Add to Project`. Single `<ArtifactActions>` component (TODO when wiring page-by-page). Each calls existing `/api/cockpit/*` endpoints. Never add a one-off action button outside this set.

5. **Tokens locked in `:root`.** Use CSS variables in `styles/globals.css`: `--t-xs` (10px) → `--t-3xl` (30px) for typography; brand palette `--paper`, `--paper-warm`, `--ink`, `--brass`, `--moss`. **No** inline `style={{ fontSize: 14 }}`. **No** hex colors outside `:root`. **No** system-font fallbacks (Georgia/Helvetica/Arial inline) — use Fraunces / Inter Tight / JetBrains Mono. CI greps from DESIGN_NAMKHAN_BI.md verification recipes are binding.

6. **Proposal lifecycle.** `cockpit_proposals` table is the atomic unit of agent work: `signal` + `agent_role` + `action_type` + `body` + `action_payload` + `status` (proposal | in_process | done | rejected). Trigger `proposals_bump_trust` auto-bumps `agent_trust` counters on status flips. Trust unlocks auto-run per `(agent_role, action_type)` pair after threshold (default 10) approves with zero rejects; one rejection re-locks. **Approval-required-always at start; trust meter UNLOCKS auto-run, never the other way around.**

7. **No data cemetery.** A signal without a proposal is data cemetery. A proposal without state is a chat that goes nowhere. **Every** surface answers four questions in the same language: WHAT (signal) · WHY (body) · WHAT NEXT (proposals) · WHERE WE ARE (lane state). When designing any new surface, write it as a Brief first; only fall back to a dashboard layout if the Brief literally cannot carry the answer.

## Mandatory session ritual (locked 2026-05-03)

This is non-negotiable per the user. **Every** AI session that touches `app/`, `components/`, `styles/`, `lib/format.ts`, or talks about UI/design MUST:

### At session START
- Read `DESIGN_NAMKHAN_BI.md` end-to-end before any UI work
- If a verification grep is needed, run it (recipes in the doc, "Verification gates" section)

### At session END (before declaring work done)
- Run `date +%Y-%m-%d` to get today's date — never invent it
- Append a `### YYYY-MM-DD` heading + bullet list of changes to the "Update history" section at the bottom of `DESIGN_NAMKHAN_BI.md`
- Commit the doc update with the deploy commit
- **DO NOT skip this step.** The doc is the only authoritative source of truth across sessions; without the changelog, the next session has no idea what's canonical and rebuilds from scratch.

## Canonical components (use these, never replicate)

| Concern | Component | Path |
|---|---|---|
| KPI tile | `<KpiBox>` | `components/kpi/KpiBox.tsx` |
| Table | `<DataTable>` | `components/ui/DataTable.tsx` (must wrap in `'use client'`) |
| Status pill | `<StatusPill>` | `components/ui/StatusPill.tsx` |
| Page header | `<PageHeader>` | `components/layout/PageHeader.tsx` |
| Currency / date / empty | helpers | `lib/format.ts` (`fmtKpi`, `fmtTableUsd`, `fmtIsoDate`, `EMPTY`, ...) |

Reference page: https://namkhan-bi.vercel.app/sales/inquiries — every other page must match this typography / hierarchy / surface.

## Hard rules (no exceptions)

1. `$` prefix for currency, never `USD `. Truncate `>$1k` to `$X.Xk`, `>$1M` to `$X.XM`.
2. `₭` prefix for LAK (locked).
3. ISO `YYYY-MM-DD` for every date.
4. `—` (em-dash) for every empty cell — never `N/A`, `null`, blank, or `0`.
5. True minus `−` (U+2212) for negatives, never ASCII hyphen.
6. Italic Fraunces serif `var(--t-2xl)` for every KPI value.
7. Mono uppercase brass-letterspaced (`var(--t-xs)`, `var(--ls-extra)`, `var(--brass)`) for every header/scope label.
8. Zero hardcoded `fontSize` numeric literals. Use `var(--t-xs)`/`--t-sm`/etc.
9. Zero hardcoded brand-color hex outside `:root`. Use CSS variables.
10. Zero pre-formatted currency/pct/date strings passed where a typed prop + helper would work.

## Verification recipes (run before claiming consistency)

```bash
# 1. Type-check
npx tsc --noEmit

# 2. Zero hardcoded fontSize
grep -rE "fontSize:\s*[0-9]" app/ components/ | grep -v fuse_hidden | wc -l   # must be 0

# 3. Zero `USD ` prefix in JSX
grep -rE 'USD \{|USD [0-9]' app/ components/ | grep -v 'fuse_hidden\|//' | wc -l   # must be 0

# 4. Zero hardcoded fontFamily
grep -rE "fontFamily:\s*'(Georgia|Menlo|Helvetica|Arial)" app/ components/ | wc -l   # must be 0

# 5. CDN cache check before debugging
# Always test with `?bust=$RANDOM` on Vercel — `revalidate=60` + `force-dynamic` still cache HTML.
```

## Deploy

CLI only. `npx vercel --prod --yes` — see `DEPLOY.md`. GitHub auto-deploy is OFF.

## Concurrent-session warning

Another session is running schema/data work on this repo. Once it silently reverted CSS in commit `27e4126` (subject said "audit: getDqIssues uses v_dq_open" but diff also dropped tokens). Mitigation:
- Always re-run verification greps after `git pull`
- Use belt-and-braces (both global `:root` aliases AND scoped fallbacks) so a single revert doesn't break a page
- Coordinate or branch if doing parallel UI work

## If memory entries are missing or stale

If the AI session can't find the design system memory entries (`reference_namkhan_bi_design_system.md` or `feedback_namkhan_bi_design_session_ritual.md`), recreate them from `DESIGN_NAMKHAN_BI.md` § "Bootstrap if memory is wiped". The doc is the recovery source of truth.

---

## Cockpit operating rules (added 2026-05-05)

This repo is wired into the **IT Department Cockpit** runbook (`cockpit/` folder, `.claude/agents/`, `.github/workflows/`, Make.com scenarios, Supabase ops tables). The rules below apply on top of the design-system rules above. They are scoped to operational/agent behavior — they never override anything in the sections above.

### Operator
PBS — self-employed hospitality data analyst, Spain. Communication: direct, short, structured. Bullets and tables over prose. Push back when logic is weak.

### What this repo is
The Namkhan BI app — business intelligence surface for The Namkhan boutique hotel (Laos, SLH-affiliated). Sole revenue source: Cloudbeds PMS. Production URL: `namkhan-bi.vercel.app` (custom domain TBD).

### Stack (authoritative)
| Layer | Tech |
|---|---|
| Frontend | Next.js / React |
| Hosting | Vercel (Pro) — `namkhan-bi` on team `pbsbase-2825s-projects` |
| Database | Supabase (Pro) — project `namkhan-pms` |
| PMS | Cloudbeds (TODO: cockpit wiring) |
| CI/CD | GitHub Actions + Vercel CLI deploys (auto-deploy OFF) |
| Monitoring | Vercel Speed Insights, Web Analytics, Vercel Agent |
| Automation | Make.com (Pro) |
| AI orchestration | Claude Code + Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) |

Do not introduce new tools without an ADR in `cockpit/decisions/`.

### Reading order for any task
1. This file end-to-end
2. `DESIGN_NAMKHAN_BI.md` (repo root) — canonical design system, rules above
3. `cockpit/glossary.md` — what terms mean
4. `cockpit/constraints.md` — what you cannot do
5. `cockpit/standards/` — task-specific standard (`brand-namkhan.md`, `usali.md`, `hotel-rules.md`, `security.md`, `code.md`)
6. `cockpit/decisions/` — recent ADRs
7. The actual code

`cockpit/standards/design-tokens.md` defers to `DESIGN_NAMKHAN_BI.md` for this repo. The locked design rules in the sections above win on any conflict.

### Hard constraints (never violate)
- Never push directly to `main` — always PR.
- Never modify production database schema without approval.
- Never touch payment, auth, or booking-write code without approval.
- Never commit secrets or `.env` files.
- Never invent data — if Supabase or Cloudbeds doesn't return it, say so.
- Never disable tests to make a PR green.
- Never auto-merge PRs touching: `/auth/`, `/payment/`, `/booking/`, `/api/admin/`, schema migrations.
- Always include a rollback plan in PR description.

### Hotel/business rules
- Follow USALI for any accounting/reporting (see `cockpit/standards/usali.md`).
- Cloudbeds is the sole revenue source for Namkhan — never propose changes that bypass it.
- Currency: LAK base, USD reporting. Prefix `$` for USD, `₭` for LAK (matches design rules above).
- Prioritize occupancy without rate erosion or distribution-control loss.
- Direct booking growth is a primary KPI — never reduce it.
- Never invent room counts, prices, or guest data — query Cloudbeds or Supabase.

### Brand
- Active brand for this repo: **Namkhan** — see `cockpit/standards/brand-namkhan.md` and the locked rules in `DESIGN_NAMKHAN_BI.md`.
- `cockpit/standards/brand-donna.md` is parked in the folder for future cross-repo reuse but is NOT active here.

### Output format when responding to PBS
- Bullets and tables, not paragraphs.
- Lead with the answer, not the reasoning.
- If something in PBS's idea is wrong, say so directly with reasoning.
- Never apologize unnecessarily or add filler.
- Show 2–3 alternatives when relevant.

### Agent roles (when running as a team)
| Role | Owns | Cannot do |
|---|---|---|
| Lead | Decomposition, synthesis, final PR | Direct code (delegates) |
| Frontend | UI, components, styling | Backend logic, schema |
| Backend | API routes, business logic | UI, schema migrations without approval |
| Designer (read-only) | Design-token + brand enforcement | Modify code — flags only |
| Tester | Playwright, unit tests, regression | Modify production code |
| Reviewer | Security, deps, perf, correctness | Modify code — flags only |
| Researcher | Investigation, analysis | Modify code |

### Email / ticket conventions (Dev Arm)
- Tickets are created from email (intake address: TODO — `dev@` alias not yet set).
- Digest / alert email: `data@thedonnaportals.com`.
- If ticket intent is unclear, ask 1–3 clarifying questions before building.
- Always ship a preview URL, never auto-merge to production for non-trivial changes.
- Reply format: brief summary → what was done → preview link → what PBS needs to decide.

### When you're stuck
1. Re-read this file and `cockpit/glossary.md`.
2. Check `cockpit/decisions/` for prior similar work.
3. Query Supabase `cockpit_tickets` for related past tickets.
4. Still stuck: stop, document the blocker in the ticket, escalate via email — don't guess.

### Updating this file
Append updates with a date heading at the bottom of the relevant section and a reason. Don't rewrite history. Major changes need an ADR in `cockpit/decisions/`.
