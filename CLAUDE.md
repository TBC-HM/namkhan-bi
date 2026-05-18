# CLAUDE.md — Repo bootstrap for Claude Code

> This file is a **bootstrap**, not the operating manual.
> The canonical manual lives in Supabase, queried at session start.

---

## Authority chain

| Surface | Holds what |
|---|---|
| Supabase `documentation.documents` doc_type='claude_md' | THE operating manual (currently v3.1) |
| Supabase `documentation.documents` doc_type='architecture' | Platform architecture |
| Supabase `cockpit_decisions` | All ADRs (append-only) |
| Supabase `cockpit_agent_memory` | Learned rules (importance ≥ 8 = hard) |
| Supabase `cockpit_change_log` | Every DDL change |
| **This file** | Pointer + 5 rules you cannot break in a coding session |
| GitHub repo | Source code, branches, PRs, CI plumbing |

**Read the canonical manual before any code change.** Use the Supabase MCP.
Project: `namkhan-pms`, id `kpenyneooigsyuuomgct`.

---

## The 5 rules you must not break

1. **Source of truth is Supabase** for data, docs, decisions, agent memory.
   GitHub is source of truth for code only. Never edit DB schema, docs, or
   memory from a file — use the MCP.

2. **Code path: any editing surface → GitHub → Vercel.** Editing surfaces:
   GitHub Codespaces (preferred), claude.ai + Supabase `fn_gh_push_file` bridge,
   local IDE (optional). **Never `vercel --prod` from any surface.** See
   claude_md §0.8.

3. **PostgREST exposes only `public`.** Never `.schema('finance')`,
   `.schema('cockpit')`, `.schema('dms')`, `.schema('core')`. Bridge with
   `public.v_*` views or `public.fn_*` SECURITY DEFINER functions. See
   claude_md §0.5. This is the #1 cause of silent failures.

4. **All property-scoped URLs under `/h/[property_id]/...`.** Property IDs:
   Namkhan=260955, Donna=1000001. New routes under
   `app/h/[property_id]/<path>` first. See claude_md §0.3.

5. **Discover before create.** Before any DDL: query
   `documentation.documents`, `cockpit_agent_memory` (importance ≥ 8),
   `public.v_change_log_recent`. Propose SQL, get PBS approval, apply. See
   claude_md §0.10.

---

## Working in this repo

### Package manager

This repo uses **npm** with `package-lock.json`. Not pnpm, not yarn.
If `npm ci` fails with "lockfile not in sync", run `npm install` to
regenerate the lockfile, then commit both `package.json` and
`package-lock.json` together. CI gates on `npm ci`, so drift between
the two files breaks every workflow.

### Editing surfaces, in preference order

| Surface | Use for |
|---|---|
| **GitHub Codespace** | Anything serious. Multi-file edits, refactors, debugging, dependency changes (forces npm install + lockfile commit). Browser VS Code with Claude Code pre-installed (see `.devcontainer/devcontainer.json`). |
| **claude.ai chat + Supabase bridge** | Small edits, single-file fixes, docs, config files. Bridge function: `public.fn_gh_push_file(owner, repo, branch, path, content, message)`. ⚠ Cannot regenerate lockfiles — use Codespace for that. |
| **Local IDE** | Optional. Same rules apply. Treated as a workstation, not a source of truth. |

### Onboarding a new contributor (10-min path)

1. PBS adds them to `TBC-HM` GitHub org.
2. PBS invites them to the claude.ai team plan.
3. They open `github.com/TBC-HM/namkhan-bi` → Code → Codespaces → Create on `main`.
4. Codespace boots (~2 min), `npm install` finishes, Claude Code is preinstalled.
5. They open this CLAUDE.md, then read the canonical manual via Supabase MCP.
6. They edit, commit, push, Vercel auto-deploys.

### Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Data | Supabase (Postgres 17, `kpenyneooigsyuuomgct`) |
| Auth | Supabase Auth |
| Hosting | Vercel (auto-deploy from `main`) |
| Package manager | **npm** (package-lock.json) |

### Commands

```bash
npm install       # installs + reconciles lockfile
npm ci            # clean install (CI uses this — fails on lockfile drift)
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

### Server-side data access

- Default client: `getSupabaseAdmin()` from `lib/supabase-admin.ts` —
  service-role, reads only from `public.*`.
- Legacy `gl` exception: `lib/supabase-gl.ts`.
- For any non-public read, create a `public.v_*` view first.

### Theme tokens (property-scoped pages only)

Use `--tbl-bg`, `--tbl-fg`, `--tbl-fg-mute`, `--tbl-border`,
`--tbl-border-strong`, `--tbl-bg-elev`.
Do NOT use `--ink-*`, `--bd-*`, `--surf-*` under `/h/[property_id]/*` —
they fall through to Namkhan globals and render black-on-black on Donna's
cream palette. See claude_md §2.6.

---

## Shipping a code change — happy path

1. Open Codespace on `main` (or use the claude.ai bridge for single-file edits).
2. Read canonical claude_md + architecture from Supabase MCP.
3. Edit. Run `npm run build` in the Codespace before pushing.
4. If you added/removed/upgraded any dependency, commit `package-lock.json`
   in the same commit as `package.json`. CI will fail otherwise.
5. Commit + push to `main` (PR if collaborative).
6. Verify with `SELECT * FROM public.v_current_prod;` after Vercel finishes.
7. If the change crosses any §0 rule, write a new `cockpit_decisions` ADR.

**Never** `vercel deploy` or `vercel --prod`. The `deploy.deployments`
audit trail is broken by CLI deploys.

---

## Communication style (PBS)

Blunt · bullets · tables · lead with answer · push back on weak logic ·
show 2–3 alternatives · never flatter · senior consultant tone.

---

**This file may be out of date. Supabase always wins.**
