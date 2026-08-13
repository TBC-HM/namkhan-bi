# CLAUDE.md — TBC-HM/namkhan-bi (The Beyond Circle platform)

> Multi-tenant hotel SaaS: Next.js 14 App Router + Supabase (PG17, project
> `kpenyneooigsyuuomgct`) + Vercel auto-deploy from `main`.
> The operating manual is canonical in Supabase (`documentation.documents`,
> doc_type=`claude_md`) and its digest is auto-injected at session start.
> If no "SESSION CONTEXT" block appeared above this message, run:
> `SELECT * FROM public.fn_agent_context('claude', 8, 4000);` before substantive work.
>
> **PRECEDENCE on any conflict: live DB -> this file -> any other repo doc.**
> DEPLOY.md, ARCHITECTURE.md, README.md, _LOG.md, HANDOVER_* are 2026-05
> sediment — historical only, do NOT follow them.

## Invariants (breaking one = incident)

1. **Supabase is the source of truth** for schema, docs, decisions (ADRs), and
   agent memory. GitHub is truth for code only. Never mutate schema/docs/memory
   by editing repo files — use the MCP. Never read `/tmp/` or local paths for
   architectural truth.

2. **Ship ONLY via git push -> Vercel auto-deploy.** `vercel deploy` /
   `vercel --prod` is banned (and blocked in `.claude/settings.json`).
   Agents push to `main` through the `deploy_github` skill (it verifies the
   prior push landed before allowing the next). Humans may use PRs.

3. **PostgREST exposes only `public`.** Non-public reads go through
   `public.v_*` views or `public.fn_*` SECURITY DEFINER functions, GRANTed to
   `authenticated` + `service_role`, **never `anon`** (ADR-277). Every
   migration creating a public object MUST end with
   `REVOKE ALL ON <obj> FROM anon;`. Bridge objects bypass RLS — each must
   filter `property_id` itself. Symptom of violation: page renders $0/empty
   while the same SQL via MCP returns rows.

4. **Tenancy.** `getSupabaseAdmin()` is service-role and **bypasses RLS** —
   isolation is only what you write. Any API route touching tenant data MUST
   (a) scope by `property_id` and (b) verify the caller's access with
   `requirePropertyAccess()` (`.claude/rules/tenancy.md`). `property_id` from
   query/body is untrusted input. **No property_id defaults** — `?? 260955`
   is a bug. Property IDs (Namkhan 260955, Donna 1000001) come from route
   params / `useCurrentProperty()`, never hardcoded.

5. **URL law + layer reality.** New property pages live under
   `app/h/[property_id]/<dept>/<sub>`. Legacy unprefixed trees
   (`app/revenue`, `app/finance`, ...) are still the LIVE implementations and
   many `/h` pages are wrappers importing them — check the import chain and
   edit the real file. Never convert a live legacy page to a redirect without
   an approved brief. Links you emit must be canonical `/h/...` or `/holding/...`.

6. **Discover before create.** Before any DDL or new module/agent/skill:
   check the architecture doc, `cockpit_agent_memory` (importance >= 8), and
   `public.v_change_log_recent`; propose SQL; get PBS approval; apply via MCP.
   `supabase/migrations/` in this repo is DEAD (stale since 2026-05) — do not
   add files there.

## Commands

```bash
npm install        # npm ONLY (package-lock.json) — not pnpm, not yarn
npm ci             # what CI runs; fails on lockfile drift — commit both files together
npm run dev        # localhost:3000
npm run build      # runs prebuild gates (it2-orphans, tenancy ratchet)
npx tsc --noEmit   # REQUIRED before push: Vercel builds IGNORE ts/lint errors
```

- **No test runner exists.** Never claim "tests pass". Verify with
  `tsc --noEmit` + manual route checks.
- Deploy verification: `SELECT * FROM public.v_deployments ORDER BY created_at
  DESC LIMIT 1;` must be Ready (or `GET /api/health`).

## Data access gotchas

- Server reads: `getSupabaseAdmin()` from `lib/supabaseAdmin.ts`.
  `lib/supabase/server.ts`'s docstring says "anon" — it actually re-exports
  the **service-role** singleton. Don't trust that comment.
- **Never import `@/lib/supabase` in a `'use client'` file** — in the browser
  it silently downgrades to anon -> empty results (28 legacy violations exist;
  the prebuild ratchet blocks new ones).
- For any non-public read, create the `public.v_*` bridge first (invariant 3).

## Conditional rules (auto-load on matching paths)

| File | Loads when touching | Contains |
|---|---|---|
| `.claude/rules/tenancy.md` | `app/api/**`, `app/h/**`, `lib/**` | requirePropertyAccess pattern, scope law, ratchet rules |
| `.claude/rules/database.md` | `supabase/**`, `db/**`, `lib/data*`, `app/api/**` | bridge/GRANT recipe, capacity/RN/currency/cancellation rules, view-DDL law |
| `.claude/rules/frontend.md` | `app/**`, `components/**` | theme tokens, JSX-in-RSC crash, SDK-import rule, settings-tabs canon |
| `.claude/rules/deploy.md` | `.github/**`, `scripts/**`, `package.json` | push protocol, green-main gate, build-check verification |
| `.claude/rules/agents.md` | `app/api/cockpit/**`, `scripts/*agent*`, `prompts/**` | queue-only execution, prompts-live-in-DB, cost caps, slice law |

## When PBS asks for something

| Request | Do |
|---|---|
| Add field/table/column | Invariant 6 -> propose migration -> approval -> apply via MCP -> bump docs |
| Build a feature | Locate in module taxonomy + completion queue -> schema support? -> agent binding? -> bridge needed? |
| Why is X broken? | `v_change_log_recent` -> `cockpit_audit_log` -> empty page + working SQL = invariant-3 bridge gap |
| State of Y? | Query the canonical table. Never answer from repo docs or memory |
| Decide Z | 2-3 options with ROI/risk -> PBS chooses -> append ADR |

Style: blunt, bullets/tables, lead with the answer, push back on weak logic, no flattery.

<!-- sync: constitution digest injected by SessionStart hook; this file reviewed like code (owner: PBS). -->