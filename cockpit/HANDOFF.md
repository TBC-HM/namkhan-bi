# Cockpit handoff — namkhan-bi

Setup completed 2026-05-05 by Claude Opus 4.7 + PBS. This is the at-a-glance reference for "what's running, where to check, how to turn things off, what to expect this week."

For the full setup audit trail, see `cockpit/setup-log.md`. For canonical operating rules, see `CLAUDE.md` § "Cockpit operating rules".

---

## 1. What's running

| Surface | Where | Cadence | Trigger |
|---|---|---|---|
| **Weekly Audit + Digest** | `.github/workflows/weekly-audit.yml` | Mon 06:00 UTC + manual | cron + `workflow_dispatch` |
| **Daily Dependency Check** | `.github/workflows/dependency-check.yml` | Daily 05:00 UTC + manual | cron |
| **Lighthouse on PR** | `.github/workflows/lighthouse-ci.yml` | every PR to main | `pull_request` |
| **Existing CI** | `.github/workflows/ci.yml` (pre-cockpit) | every PR + push to main | unchanged |
| **Cockpit DB tables** | Supabase project `namkhan-pms` | live | RLS enabled, service_role only |

**Not yet wired:** uptime monitor (Better Stack TODO), Cloudbeds API integration, Email Intake (`dev@` alias TBD + Claude Code Web trigger TBD), Vercel Agent (manual beta enable), Make.com scenarios 01/02/03/05 (deprecated/deferred — all replaceable by GitHub Actions if/when needed).

---

## 2. Where to check what

| Need to see | Open |
|---|---|
| Audit issues | https://github.com/TBC-HM/namkhan-bi/issues?q=is%3Aissue+label%3Aaudit |
| Workflow runs | https://github.com/TBC-HM/namkhan-bi/actions |
| Latest weekly audit run | https://github.com/TBC-HM/namkhan-bi/actions/workflows/weekly-audit.yml |
| Cockpit tables | https://supabase.com/dashboard/project/kpenyneooigsyuuomgct/editor — filter `cockpit_*` |
| Vercel deployments | https://vercel.com/pbsbase-2825s-projects/namkhan-bi |
| Vercel Speed Insights / Analytics | https://vercel.com/pbsbase-2825s-projects/namkhan-bi/speed-insights · /analytics |
| Vercel Firewall rules | https://vercel.com/pbsbase-2825s-projects/namkhan-bi/firewall |
| Vercel billing / spend cap | https://vercel.com/teams/pbsbase-2825s-projects/settings/billing |
| GitHub repo secrets | https://github.com/TBC-HM/namkhan-bi/settings/secrets/actions |

---

## 3. Kill switches (how to disable any arm)

| Arm | Kill switch |
|---|---|
| Weekly Audit + Digest | GH → Actions → Weekly Audit + Digest → **⋯ Disable workflow**. Or delete `.github/workflows/weekly-audit.yml`. |
| Daily Dependency Check | Same path; disable or delete `dependency-check.yml`. |
| Lighthouse on PR | Disable `lighthouse-ci.yml`. |
| Anthropic spend (digest) | Revoke the `cockpit-gh-actions` Anthropic API key (https://console.anthropic.com/settings/keys). Workflow falls back to a "missing keys" digest. |
| Vercel runtime cost | Hard cap is set at €30/month. To halt all execution: pause project at https://vercel.com/pbsbase-2825s-projects/namkhan-bi/settings/general → Pause Project. |
| Cockpit DB writes | Revoke the GH `SUPABASE_SERVICE_KEY` secret. Or in Supabase Dashboard, rotate the JWT secret (Project Settings → API → Reset JWT). |
| Make.com (deprecated) | Delete the imported "04 Weekly Audit Mailer (Cockpit)" scenario in Make. Webhook URL becomes 404. No effect on the cockpit pipeline. |

---

## 4. Where logs live

| Source | Log location |
|---|---|
| GitHub workflow runs | `gh run view <run-id> --log` or https://github.com/TBC-HM/namkhan-bi/actions |
| Audit artifacts (90-day retention) | Each weekly run uploads `audit-result.json`, `incidents.json`, `kpi.json`, `digest.md`, `anthropic-response.json`, `kpi-snapshot.json` |
| Cockpit ops history | `SELECT * FROM cockpit_audit_log ORDER BY created_at DESC` (via Supabase MCP or SQL editor). Currently 0 rows — fills as agents act. |
| Cockpit incidents | `SELECT * FROM cockpit_incidents ORDER BY detected_at DESC`. Empty until incident logger wired. |
| Cockpit weekly KPIs | `SELECT * FROM cockpit_kpi_snapshots ORDER BY date DESC`. 1 row from 2026-05-05 (first run). |
| Vercel deploy + runtime | https://vercel.com/pbsbase-2825s-projects/namkhan-bi/logs |
| Setup audit trail (this project) | `cockpit/setup-log.md` (10K+ words; full Phase 0–7 record) |

---

## 5. What you'll receive in email

| When | What | From |
|---|---|---|
| Every Monday ~06:01 UTC | New GitHub Issue **"📊 Weekly Cockpit Audit — YYYY-MM-DD"** with 6-section digest | github.com (subscribed because you're repo admin) |
| Daily, only if vulnerabilities are found | GitHub Action failure email for `Dependency Check` | github.com |
| Per failed deploy / incident | Nothing yet (incident logger + deploy watcher are deferred — Make scenarios 01 + 05 not built; replace with GH Actions later if needed) | — |
| Lighthouse PR comments | None as a separate email — surfaces inline in PR conversation | — |

If GitHub email volume becomes too noisy: https://github.com/notifications → **Manage notifications** → mute repo or set "Custom" subscription.

---

## 6. First-week tuning checklist

Run through these as days 1–7 of cockpit operation. None are urgent.

- [ ] **Day 1 — verify Monday digest arrives.** First scheduled run is the Monday after 2026-05-05. If no email by 07:00 UTC, check `gh run list --workflow=weekly-audit.yml`.
- [ ] **Day 1 — rotate the Anthropic API key.** It was pasted in chat during setup. Replace via https://console.anthropic.com/settings/keys → revoke `cockpit-gh-actions` → create new → `gh secret set ANTHROPIC_API_KEY --repo TBC-HM/namkhan-bi --body '<new>'`.
- [ ] **Day 1 — patch the critical npm vulnerability** flagged in audit Issue #1.
- [ ] **Day 1–2 — Vercel dashboard hardening.** Walk through `cockpit/runbooks/vercel-hardening.md` (spending cap → speed insights → web analytics → firewall rules).
- [ ] **Day 2 — delete the Make.com scenario** "04 Weekly Audit Mailer (Cockpit)" if you imported it (deprecated; the GH Actions pipeline handles digest now). Free up Make ops budget for future scenarios.
- [ ] **Day 3 — read the first digest critically.** Adjust `weekly-audit.yml` `system` prompt if the tone/structure is off (the prompt lives inline in the workflow file, ~line 100). Push the change to main; next Monday picks it up.
- [ ] **Day 4 — add `@vercel/analytics` client install** on `feat/leads-and-cockpit-redo` (paired branch with Speed Insights). Snippet in `cockpit/runbooks/vercel-hardening.md`.
- [ ] **Day 5 — pick an uptime monitor.** Better Stack free tier or alternative. Add a single monitor on `https://namkhan-bi.vercel.app`. Then optionally build Make.com scenario 02 OR replace with a tiny GH Actions cron pinging the URL.
- [ ] **Day 6 — provision `dev@` email alias** (Google Workspace alias on whatever domain you settle on, forwarded to your inbox). Then revisit Make scenario 03 / Email Intake — but only after confirming the Claude Code Web trigger endpoint with current Anthropic docs.
- [ ] **Day 7 — review `cockpit_kpi_snapshots` trends.** Should have 2 rows (last Monday + first Monday post-cron). Eyeball whether the columns capture the metrics you actually want; widen the schema if anything important is missing.

---

## 7. What's deliberately not built (and why)

| Component | Status | Re-enable when |
|---|---|---|
| Email Intake (Make 03) — `dev@` → ticket → Claude Code Web | Deferred | `dev@` alias provisioned + Claude Code Web trigger endpoint confirmed via Anthropic docs |
| Uptime Watcher (Make 02) | Deferred | Uptime monitor chosen |
| Deploy Watcher (Make 01) | Deferred | High-leverage but optional. Replace with a GH Actions workflow listening on Vercel webhooks if/when needed. |
| Incident Logger (Make 05) | Deferred | Same. |
| `research_agent` Supabase role + anonymized views (`02-readonly-role.sql` + `03-views.sql`) | Skipped | Research Arm has a real consumer. Co-design grants with explicit REVOKEs for `guests`, `transactions`, `house_accounts`, `app_users`, etc. |
| Cloudbeds cockpit wiring | TODO | Decide what cockpit reads from Cloudbeds. Currently account-level only. |
| Custom domain | TODO | When you decide. All references in cockpit point to `namkhan-bi.vercel.app` — search/replace when the domain is assigned. |
| `pr-checks.yml` workflow | Skipped | Tests + Playwright populated. Then add a focused `tests.yml` (don't reintroduce `pr-checks.yml` as-shipped — duplicates `ci.yml`). |
| Vercel Agent | Manual | Confirm beta access in your Vercel dashboard. |

---

## 8. Repo state at handoff

```
chore/cockpit-foundation (= main as of 2026-05-05 21:50 UTC)
└── 7 cockpit commits + 18 PBS local-only commits, all now on origin/main:
    2ee102b chore(cockpit): retire Make.com from weekly digest, run pipeline in GH Actions
    eda7277 chore(cockpit): best-effort Make.com blueprint for scenario 04 + import checklist
    ac69f40 chore(cockpit): Phase 5 Vercel hardening runbook + checklist
    7906f4f chore(cockpit): add Make.com scenario specs + Phase 4 walkthroughs
    5a67acc chore(cockpit): add weekly-audit, dependency-check, lighthouse PR workflows
    f9b0b11 chore(cockpit): add foundation — CLAUDE.md cockpit section, cockpit/, .claude/agents/
    + 18 PBS local commits (marketing/sales/finance/ops work)
```

The cockpit branch (`chore/cockpit-foundation`) and `main` are at the same commit — pushed together. No PR needed; integration is direct.

If/when you want to clean history later (e.g., separate the cockpit work from the marketing/sales commits), do it on a new branch — don't rewrite `main` history now that it's published.

---

## 9. Quick reference — terminal one-liners

```bash
# Manually trigger the weekly audit (gives you a fresh issue + kpi row)
gh workflow run weekly-audit.yml --ref main --repo TBC-HM/namkhan-bi

# Tail the latest run
gh run watch $(gh run list --workflow=weekly-audit.yml --repo TBC-HM/namkhan-bi --limit 1 --json databaseId -q '.[0].databaseId') --repo TBC-HM/namkhan-bi

# See the latest cockpit kpi row
# (via psql with $DATABASE_URL set, or Supabase SQL editor)
SELECT date, security_red, security_warn, raw_data->>'digest' AS digest_md
FROM cockpit_kpi_snapshots
ORDER BY date DESC LIMIT 1;

# Disable a workflow
gh workflow disable weekly-audit.yml --repo TBC-HM/namkhan-bi

# Re-enable a workflow
gh workflow enable weekly-audit.yml --repo TBC-HM/namkhan-bi

# Update a secret
gh secret set ANTHROPIC_API_KEY --repo TBC-HM/namkhan-bi --body 'sk-ant-...'
```

---

End of handoff.
