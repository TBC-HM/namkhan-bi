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

