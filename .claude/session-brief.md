═══════════════════════════════════════════════════════════════════════════
  READ THIS BEFORE ANY CODE CHANGE.  (ADR-307/308 · 2026-08-24)
═══════════════════════════════════════════════════════════════════════════

THE OPERATING MANUAL IS NOT IN THIS REPO.

It lives in Supabase `namkhan-pms` (kpenyneooigsyuuomgct), table
documentation.documents, doc_type='claude_md'. It is currently doc v5.1 /
version 124 and contains RIGHTS (R1-R5, A1-A4), a POWERS table, and
31 LAWS (L1-L31).

Pull it before you touch code:

    SELECT * FROM public.fn_claude_digest();

Then the hard-won lessons (importance >= 8, roughly 40 rows):

    SELECT id, memory_type, importance, content
      FROM public.cockpit_agent_memory
     WHERE active AND importance >= 8
     ORDER BY importance DESC, updated_at DESC;

If you have no Supabase MCP tool (look for `execute_sql`), SAY SO AND STOP.
Do not proceed on the repo files below. An agent without Supabase access
cannot write docs, ADRs, memory, or a push_ledger row — it will ship code
and silently skip every governance obligation. That is exactly what caused
the 2026-08-21..24 drift. The connector is a claude.ai connector; ask PBS
to enable it.

───────────────────────────────────────────────────────────────────────────
  THESE REPO FILES ARE STALE SEDIMENT — L25 SAYS NEVER FOLLOW THEM
───────────────────────────────────────────────────────────────────────────
  CLAUDE.md · AGENTS.md · ARCHITECTURE.md · DEPLOY.md · README.md
  _LOG.md · HANDOVER_* · .claude/agents/*

CLAUDE.md still claims "manual v3.1, 5 rules". Live is v124 with 31 laws.
It also says "PostgREST exposes only public" — 24 schemas are exposed
(memory 829). Treat repo markdown as a map of where code lives, never as law.

───────────────────────────────────────────────────────────────────────────
  THE FIVE THAT BITE MOST OFTEN
───────────────────────────────────────────────────────────────────────────
  L6   Canonical URLs /h/[property_id]/... — BUT the legacy unprefixed trees
       are still the LIVE implementations (/h often wraps them). Edit where
       the import chain actually lands. Never turn a live page into a
       redirect without a brief.
  L22  Property scope must NEVER default. `?? 260955` is a bug and fails
       OPEN into another tenant's data. Resolve from the route param and
       fail CLOSED. `npm run prebuild` ratchets this — see
       scripts/guard-invariants.mjs.
  L18  Ship to main through the bridge (fn_gh_push_file), which writes the
       push_ledger row and enforces the ADR-222 protected-path gate. A plain
       `git push` bypasses BOTH — every governance control lives at the
       bridge, and the bridge is optional. `vercel --prod` is banned.
  L12  A builder never grades itself. 'shipped' requires a landed push, or
       an explicit `NO-CODE:` reason on the brief (ADR-307).
  L23  Never approve your own protected-path push. Requester != approver.

───────────────────────────────────────────────────────────────────────────
  INSTRUMENTS THAT LIE (verified 2026-08-24) — CHECK, DON'T TRUST
───────────────────────────────────────────────────────────────────────────
  · deploy.deployments / promotion_log — frozen since 2026-08-22 11:39.
    For "did it ship?", use `git log origin/main`, not the DB.
  · push_ledger — only records BRIDGE pushes. Empty != nothing shipped.
    Check which identity pushed: git log --format='%ae'.
  · pg_cron — reports succeeded 1440/1440 while doing nothing.
  · fn_loop_doctor() — says "queue ok" when the queue was emptied FALSELY.
  · ai_token_meter — no rows since 2026-08-20 while builders still run.
    You cannot currently see a spend runaway coming.

  PBS standing order (memory 882): CHECK THE LIVE DEPLOYMENT BEFORE EVERY
  CHANGE, AND NEVER DESTROY. Create forward — new function + cron.alter_job
  in place, additive columns, sibling views. Never DROP, DELETE, unschedule.

═══════════════════════════════════════════════════════════════════════════
