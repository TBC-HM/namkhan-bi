# Cockpit setup log

Append-only log of every action taken by the setup runbook in this repo.
Source: `/Users/paulbauer/Desktop/cockpit-setup/SETUP.md`.

## 2026-05-05

### Phase 0 — Pre-flight checks

- 20:16 — created `cockpit/` directory and this log file.
- 20:16 — ran tool/version checks:
  - claude 2.1.119 ✅ (>= 2.1.32)
  - git 2.39.3 ✅
  - node v24.15.0 ✅ (>= 20)
  - gh 2.92.0, authenticated as `pbsbase` ✅
  - vercel CLI: not on PATH, available via `npx vercel`; `npx vercel whoami` → `pbsbase-2825` ✅
  - supabase CLI: not on PATH, available via `npx supabase`; account has 3 projects, **linked project = `namkhan-pms` (ref `kpenyneooigsyuuomgct`)** ✅
- 20:16 — verified `~/.claude/settings.json` contains `"CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"` ✅
- 20:16 — repo state inspected:
  - git remote: `https://github.com/TBC-HM/namkhan-bi.git`
  - existing `CLAUDE.md` at repo root (4390 bytes, locked design-system rules) — **collision** with cockpit `CLAUDE.md`, must merge not overwrite
  - no existing `cockpit/` directory ✅
  - no existing `.claude/agents/` directory ✅
  - existing `.github/workflows/` directory — must check for filename collisions in Phase 3
  - existing `supabase/` directory with migrations + functions
  - existing `.vercel/project.json` → `namkhan-bi` (org `team_vKod3ZYFgteGCHsam7IG8tEb`)
  - existing `.env.local` (not committed) and `.env.example`
- Outstanding: awaiting user answers to inputs questionnaire before Phase 1.

### Inputs collected from PBS (20:30)

| # | Input | Value |
|---|---|---|
| 1 | GitHub repo | `https://github.com/TBC-HM/namkhan-bi.git` |
| 2 | Vercel project | `namkhan-bi` on team `pbsbase-2825s-projects`; prod URL `namkhan-bi.vercel.app` |
| 3 | Supabase project | `namkhan-pms` (ref `kpenyneooigsyuuomgct`) |
| 4 | Make.com Pro | active |
| 5 | `dev@` email | TODO (alias not yet set) |
| 6 | Digest/alerts email | `data@thedonnaportals.com` |
| 7 | Domain | `namkhan-bi.vercel.app` (custom domain TBD) |
| 8 | Better Stack / uptime | TODO |
| 9 | Brand / Figma | use existing `DESIGN_NAMKHAN_BI.md`; cockpit `design-tokens.md` defers to it |
| 10 | Cloudbeds API | available; cockpit wiring TODO |
| 11 | `CLAUDE.md` collision | merge approved — cockpit content appended as new section |

### Phase 1 — Foundation files (started 20:30)

- 20:30 — confirmed `cockpit/` had only `setup-log.md` from Phase 0 (no other pre-existing files)
- 20:30 — confirmed `.claude/` did not exist in repo
- 20:31 — appended "Cockpit operating rules" section to repo root `CLAUDE.md` (existing content untouched)
- 20:32 — `rsync` of `/Users/paulbauer/Desktop/cockpit-setup/cockpit/` → `cockpit/` with `--exclude='setup-log.md'` (preserved this running log). Files added: `README.md`, `constraints.md`, `glossary.md`, `architecture/stack.md`, `decisions/0001-cockpit-architecture.md`, `runbooks/{db-slow,deploy-failed,site-down}.md`, `standards/{brand-donna,brand-namkhan,code,design-tokens,hotel-rules,security,usali}.md`
- 20:32 — `rsync` of `/Users/paulbauer/Desktop/cockpit-setup/.claude/agents/` → `.claude/agents/`. Files added: `designer.md`, `documentarian.md`, `researcher.md`, `reviewer.md`, `tester.md`
- 20:33 — adjustments for namkhan-bi context:
  - rewrote `cockpit/architecture/stack.md` (vercel project, supabase project, domain `namkhan-bi.vercel.app`, Cloudbeds + uptime marked TODO, removed `thedonnaportals.com`/`thenamkhan.com`/`pbsbase.com` references)
  - rewrote `cockpit/standards/design-tokens.md` to defer to `DESIGN_NAMKHAN_BI.md` and root `CLAUDE.md`
  - added scope note to `cockpit/glossary.md` (this repo is Namkhan; Donna entries kept as cross-repo reference)
  - added scope note to `.claude/agents/designer.md` (Donna conditionals preserved but don't fire here)
- 20:33 — left untouched (intentional, per instructions): `cockpit/standards/brand-donna.md`, `cockpit/standards/hotel-rules.md` (still mentions Donna in cross-repo context), `cockpit/decisions/0001-cockpit-architecture.md` (historical record), other cockpit files
- 20:34 — full diff shown to user; approved to commit on a fresh branch off `main`

### Phase 1 — Branch surgery (20:35)

User directed cockpit foundation to land on a fresh branch off `main` (not on `chore/sync-cloud-schema` which has unrelated WIP). Steps taken:

1. Backed up Phase 1 files to `/tmp/phase1-cockpit-backup/` (CLAUDE.md, cockpit/, .claude/) — 22 files total
2. Reverted CLAUDE.md to HEAD via `git checkout HEAD -- CLAUDE.md`; removed `cockpit/` and `.claude/` directories from working tree
3. Verified working tree was back to user's pre-Phase-1 chore/sync-cloud-schema WIP
4. `git stash push -u -m "WIP: chore/sync-cloud-schema pre-cockpit-foundation 2026-05-05"` — captured tracked-file modifications (24 files)
5. `git checkout main` — switched cleanly. Note: local `main` is **19 commits ahead of origin/main**
6. `git pull origin main` — already up to date
7. `git checkout -b chore/cockpit-foundation` — new branch off local `main`
8. Restored Phase 1 files from `/tmp/phase1-cockpit-backup/`. One snag: `.claude/` already existed (Claude Code created `settings.local.json` for the session); fixed via `mv .claude/.claude/agents .claude/agents && rmdir .claude/.claude`
9. `git add CLAUDE.md cockpit .claude/agents` (intentionally NOT adding `.claude/settings.local.json`)

### Phase 1 — Concurrent-session interference (20:46)

Before I could `git commit`, a concurrent same-user agent moved HEAD off `chore/cockpit-foundation`:

| Time | Event |
|---|---|
| 20:46:25 (UTC ~18:45:39) | concurrent session: `chore/cockpit-foundation → main` (auto-stashed my staged Phase 1 changes as `stash@{0}`) |
| 20:46:25 | concurrent session: `main → feat/email-cockpit-and-leads` |
| 20:46:25 | concurrent session: commit `3c81c4e feat(sales): email cockpit + dynamic categories + leads schema` — bundled my 22 Phase 1 files into its commit alongside 12 unrelated sales files |
| ~20:51 | concurrent session: `git reset --hard origin/main` on feat/email-cockpit-and-leads — discarded `3c81c4e`, leaving it as orphan |
| 20:53:01 | concurrent session: created `feat/leads-and-cockpit-redo` from origin/main, committed `12b78d2 feat(sales): leads + email cockpit + dynamic categories + speed insights` (Phase 1 files NOT in this one — clean) |

User intervention: at 20:48 user closed the concurrent session per Claude Code's `ps aux` check (no second `claude` CLI process found).

State at recovery time (20:54):
- `chore/cockpit-foundation` still at `3f9d2c1` (clean — no Phase 1 commit landed)
- `feat/leads-and-cockpit-redo` HEAD = `12b78d2` (does NOT contain Phase 1 files — verified)
- Orphan commit `3c81c4e` still in object store (recoverable for ~30 days)
- Phase 1 backup intact at `/tmp/phase1-cockpit-backup/`
- Stashes: `stash@{0}` auto-stash partial Phase 1 (kept as safety net), `stash@{1}` original sync-cloud-schema WIP

### Phase 1 — Recovery via option A (20:54)

User chose option A: re-create Phase 1 commit on `chore/cockpit-foundation` from `/tmp` backup, leave `feat/leads-and-cockpit-redo` alone.

1. Confirmed only one `claude` CLI process (PID 86303) — concurrent session is dead.
2. Found 2 blocking modifications on working tree (`package.json` + `package-lock.json` adding `jszip`, `mammoth`, `pdf-parse`, `xlsx` — real user work). Stashed under: `WIP on feat/leads-and-cockpit-redo: 4 deps (jszip,mammoth,pdf-parse,xlsx) + lockfile — saved by cockpit setup phase 1` (now at top of stash list).
3. `git checkout chore/cockpit-foundation` — clean.
4. Restored Phase 1 files from `/tmp/phase1-cockpit-backup/`: CLAUDE.md (175 lines), cockpit/ (16 files), .claude/agents/ (5 files). Total 22.
5. Updated this log with the surgery + interference + recovery story.
6. About to `git add CLAUDE.md cockpit .claude/agents` and commit with the original approved message.
7. Phase 1 commit landed: `f9b0b11 chore(cockpit): add foundation — CLAUDE.md cockpit section, cockpit/, .claude/agents/` (22 files, 1900 insertions, 0 deletions). Not pushed.
8. Verified `chore/sync-cloud-schema` switchback works: applied `stash@{2}` cleanly (113 file mods restored), then re-stashed and switched back. User can resume that branch with `git checkout chore/sync-cloud-schema && git stash pop stash@{2}`.

### Phase 2 — Supabase setup (21:10)

Target project: `namkhan-pms` (ref `kpenyneooigsyuuomgct`).

Pre-flight analysis flagged that **`02-readonly-role.sql` as-written is unsafe** — it grants `SELECT ON ALL TABLES IN SCHEMA public TO research_agent`, which would include `guests` (4,135 PII rows), `transactions` (76,553 financial rows), `house_accounts`, `reservations`, `app_users`, `payment_methods`, `add_ons`, `tax_fee_records`, etc. The file's own comments suggest uncommenting REVOKEs for sensitive tables, but they're all commented out by default.

User approved my recommendation: **apply 01-tables.sql + RLS, skip 02 and 03 entirely** (defer until the Research Arm is actually being built and we can co-design grants/views).

Applied via Supabase MCP `apply_migration` (name: `cockpit_foundation_tables_with_rls`):

| Table | Columns | Indexes | RLS | Comment |
|---|---|---|---|---|
| `cockpit_tickets`       | 16 | 4 | ✅ | every email/voice/cron/webhook request |
| `cockpit_decisions`     | 10 | 3 | ✅ | ADRs and significant agent choices |
| `cockpit_incidents`     | 13 | 4 | ✅ | production incidents (severity 1-4) |
| `cockpit_kpi_snapshots` | 16 | 2 | ✅ | daily uptime/perf/security KPI rollup |
| `cockpit_audit_log`     |  9 | 3 | ✅ | who/what/when for every agent action |

Plus:
- Trigger function `cockpit_set_updated_at()` and trigger `cockpit_tickets_updated_at` on `BEFORE UPDATE` of `cockpit_tickets`.
- Foreign keys: `cockpit_decisions.ticket_id`, `cockpit_decisions.superseded_by`, `cockpit_audit_log.ticket_id` → `cockpit_tickets.id` / `cockpit_decisions.id`.
- All 5 tables have RLS enabled with **no policies** — service_role bypasses RLS by default in Supabase, so API routes will work; anon and authenticated correctly get nothing (matches the project's existing security posture where anon SELECT was revoked from `guests` and `transactions` on 2026-05-05).

Verification:
- `SELECT count(*) FROM cockpit_tickets` → `0` (table exists, empty as expected)
- Trigger `cockpit_tickets_updated_at` and function `cockpit_set_updated_at` both present.

**Skipped, marked TODO:**
- `02-readonly-role.sql` — defer until Research Arm consumer exists; co-design grants then with explicit REVOKEs for PII/financial tables.
- `03-views.sql` — defer; will need bespoke anonymized views for `reservations` / `transactions` / `guests` when Research Arm is built (the example views in the source file reference a non-existent `bookings` table).

No password set for `research_agent` because the role wasn't created.

### Phase 3 — GitHub Actions (21:30)

User chose option A: copy 3 workflows + lighthouserc.json with scrubs/softens; skip `pr-checks.yml` (overlaps existing `ci.yml` and would fail until tests + Playwright exist).

Existing repo workflows preserved, untouched:
- `ci.yml` — lint + typecheck + build on PR & push-to-main
- `design-doc-check.yml` — soft-warn for UI changes without `DESIGN_NAMKHAN_BI.md` update
- `supabase-diff.yml` — PR-only, path-filtered to `supabase/`

New workflows added (4 files, no collisions):

| File | Trigger | Purpose | Adjustments |
|---|---|---|---|
| `.github/workflows/weekly-audit.yml` | cron Monday 06:00 UTC + manual dispatch | Health Arm — npm audit + Lighthouse + Supabase advisor → audit-report.md artifact + optional Make.com webhook | URLs scrubbed: `thedonnaportals.com` + `thenamkhan.com` removed; only `https://namkhan-bi.vercel.app` audited |
| `.github/workflows/dependency-check.yml` | cron daily 05:00 UTC + manual | Daily `npm audit --audit-level=high` + `npm outdated` informational | none |
| `.github/workflows/lighthouse-ci.yml` | every PR to main | Wait for Vercel preview → Lighthouse → temporary-public-storage artifact | none (uses softened thresholds via lighthouserc.json) |
| `.github/lighthouserc.json` | (config) | Lighthouse thresholds for both PR + weekly | perf/a11y/seo/best-practices changed from `error` → `warn` so cold-start variance on Vercel previews doesn't randomly block PRs |

**Skipped — TODO for a later phase:**
- `pr-checks.yml` — runs lint + typecheck + `npm test` + Playwright e2e on every PR. Skipped because:
  - lint/typecheck/build are already covered by existing `ci.yml`
  - `npm test` script doesn't exist → would fail every PR
  - Playwright not installed → e2e job would fail
- **Re-enable when:** the Tester agent (`.claude/agents/tester.md`) has populated unit tests + a `playwright.config.ts` is in the repo. At that point, add a focused `tests.yml` (don't re-introduce `pr-checks.yml` as-written — it duplicates `ci.yml` work).

#### GitHub secrets — TO ADD MANUALLY by PBS

Settings → Secrets and variables → Actions → New repository secret. Add the following:

| Secret | Used by | Required? | How to get value |
|---|---|---|---|
| `SUPABASE_URL` | `weekly-audit.yml` (advisor query) | **Required** for weekly audit to succeed | `https://kpenyneooigsyuuomgct.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `weekly-audit.yml` (advisor query) | **Required** for weekly audit to succeed | Supabase Dashboard → Project Settings → API → `service_role` key (secret — paste only into GitHub Secrets, never into a file) |
| `MAKE_AUDIT_WEBHOOK` | `weekly-audit.yml` (notify Make scenario) | Optional now, **required after Phase 4 scenario `04-weekly-audit-mailer`** | Webhook URL from Make.com when that scenario is built |
| `LHCI_GITHUB_APP_TOKEN` | `lighthouse-ci.yml` (status comments) | Optional | Install Lighthouse CI GitHub App on the repo, copy the per-repo token |
| `VERCEL_TOKEN` | (none of these 3 workflows directly) | Optional in Phase 3; will be needed in Phase 4/5 for deploy-watcher + speed insights | https://vercel.com/account/tokens |

Note: the runbook also lists `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_*` secrets but those were only referenced by the skipped `pr-checks.yml`. Don't add them yet.

#### Verification path (after PBS adds the required secrets)
1. GitHub → Actions → "Weekly Audit" → "Run workflow" (manual dispatch) — should succeed end-to-end with green steps; `audit-report.md` artifact attached.
2. GitHub → Actions → "Dependency Check" → "Run workflow" — should succeed (or fail with a clear `npm audit` finding).
3. Open any test PR against main — "Lighthouse on PR" should fire after the Vercel preview is ready (≤10 min).

