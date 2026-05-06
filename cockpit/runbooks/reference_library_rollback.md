# Reference Library — Rollback Runbook

**Owner:** PBS
**Created:** 2026-05-06 (Phase 1A closure)
**Scope:** rolling back the `reference_library` schema, Atlas Anders agent, or any subset thereof.

Three rollback paths, ordered from least invasive to most. Pick based on what's broken.

---

## Decision tree

```
Is the cockpit /api/cockpit/agent/run endpoint returning errors after a deploy?
   YES → Path A (Vercel deploy rollback)
Is Atlas Anders giving wrong / hallucinated answers, but the routing/auth still works?
   YES → Path C (Atlas deactivation only)
Is the reference_library schema corrupt (constraint violation, RLS blocking valid reads, etc)?
   YES → Path B (DB schema drop with service-role bypass)
```

---

## Path A — Vercel deploy rollback (least invasive, ~2 min)

Reverts the *code* that calls Atlas / renders /cockpit/docs-registry, without touching DB. Use when a frontend or API route bug ships.

### Detect
- `/cockpit` returns 500
- `/cockpit/docs-registry` blank or errors
- Sentinel post-deploy webhook reports failure

### Execute
```bash
# List recent deploys (find last known good)
npx vercel ls namkhan-bi --token=$VERCEL_TOKEN

# Promote a previous deployment
npx vercel rollback https://namkhan-XXXXXXXXX.vercel.app --token=$VERCEL_TOKEN
```

OR via Vercel dashboard:
1. https://vercel.com/pbsbase-2825s-projects/namkhan-bi/deployments
2. Find last green deploy → "..." → Promote to Production

### Verify
- `curl -s https://namkhan-bi.vercel.app/api/health` → 200
- `curl -s https://namkhan-bi.vercel.app/cockpit?bust=$RANDOM` → 200

### Audit
```sql
INSERT INTO cockpit_audit_log (agent, action, target, success, metadata, reasoning)
VALUES ('pbs', 'vercel_rollback', 'namkhan-bi prod', true,
        jsonb_build_object('reason','...','reverted_to_sha','...'),
        'Phase 1A reference_library rollback path A.');
```

### When this is enough
The DB tables stay intact. Atlas Anders prompt stays active. Only the deployed code reverts.

---

## Path B — DB schema drop (full rollback, irreversible without backup, ~10 min)

Removes the 3 tables, the agent, the skills, the role mappings, the cron job. Use when reference_library schema is fundamentally wrong and you need to redesign.

### Pre-requisites
- A recent backup MUST exist (Supabase auto-backup or PITR). Verify last backup < 24h via `/api/cockpit/backup/status`.
- PBS approval logged in audit_log BEFORE running.
- Service-role connection (Supabase MCP, Studio, or direct psql with service_role key).

### Execute (single migration, atomic)

```sql
-- File: supabase/migrations/{ts}_rollback_phase_1a_reference_library.sql
-- Rollback Phase 1A. Source: cockpit/runbooks/reference_library_rollback.md.

BEGIN;

-- 1. Drop the cron job FIRST (prevents stale tickets from firing)
DELETE FROM cron.job WHERE jobname = 'reference_library_staleness_check';

-- 2. Drop DELETE-prevention triggers (they would block the table drops below)
DROP TRIGGER IF EXISTS tg_reference_sources_no_delete ON public.reference_sources;
DROP TRIGGER IF EXISTS tg_reference_entries_no_delete ON public.reference_entries;
DROP FUNCTION IF EXISTS public.tg_prevent_reference_delete();

-- 3. Drop tables (CASCADE handles FK to reference_audit_log + RLS policies)
DROP TABLE IF EXISTS public.reference_audit_log CASCADE;
DROP TABLE IF EXISTS public.reference_entries CASCADE;
DROP TABLE IF EXISTS public.reference_sources CASCADE;

-- 4. Drop enums (only if no other tables use them — they're dedicated to reference_library)
DROP TYPE IF EXISTS public.reference_status_enum;
DROP TYPE IF EXISTS public.reference_source_type_enum;
DROP TYPE IF EXISTS public.reference_category_enum;

-- 5. Remove Atlas Anders agent
UPDATE public.cockpit_agent_prompts
SET active = false, status = 'archived', archived_at = NOW(),
    archived_reason = 'Phase 1A reference_library rollback', can_be_reactivated = true
WHERE role = 'api_specialist';

UPDATE public.cockpit_agent_identity
SET tagline = 'Archived — Phase 1A reference_library rollback'
WHERE role = 'api_specialist';

-- 6. Remove the 4 reference_library skills + their grants
DELETE FROM public.cockpit_agent_role_skills
WHERE skill_id IN (
  SELECT id FROM public.cockpit_agent_skills
  WHERE name IN ('query_reference_library','create_reference_source','update_reference_entry','verify_reference_entry')
);

UPDATE public.cockpit_agent_skills
SET active = false
WHERE name IN ('query_reference_library','create_reference_source','update_reference_entry','verify_reference_entry');

-- 7. Mark the 4 KB entries inactive (don't hard-delete per audit policy)
UPDATE public.cockpit_knowledge_base
SET active = false
WHERE topic IN (
  'reference library exists — query before guessing',
  'credentials never stored in reference_library',
  'staleness threshold defaults to 90 days',
  'Phase 1A reference_library shipped 2026-05-06'
);

-- 8. Audit
INSERT INTO public.cockpit_audit_log (agent, action, target, success, metadata, reasoning)
VALUES (
  'pbs',
  'rollback_phase_1a',
  'reference_library + atlas_anders',
  true,
  jsonb_build_object('runbook','cockpit/runbooks/reference_library_rollback.md','path','B'),
  'Full Phase 1A rollback. Reason: <fill in>.'
);

COMMIT;
```

### Verify
```sql
SELECT count(*) AS sources FROM information_schema.tables WHERE table_schema='public' AND table_name='reference_sources'; -- 0
SELECT count(*) FROM cockpit_agent_prompts WHERE role='api_specialist' AND active=true; -- 0
SELECT count(*) FROM cron.job WHERE jobname='reference_library_staleness_check'; -- 0
```

### Verify post-rollback the cockpit still works
- /cockpit/team — should show 13 agents (Atlas archived)
- /cockpit/docs-registry — Section C (Reference Library) shows 0 systems (page still renders)
- Existing chat with Captain Kit — works (he won't try to route to Atlas anymore — UPDATE his routing prompt to remove api_specialist option, or live with Atlas-as-archived which the prompt will avoid)

### What's NOT recoverable from this rollback
- The 21 reference_entries content. Re-seeding would require re-running the Phase 1A seed migration.
- Atlas Anders prompt v1 (still in DB as archived — `can_be_reactivated=true` so it CAN come back).

---

## Path C — Atlas Anders deactivation only (Atlas misbehaves, schema fine, ~2 min)

Disables Atlas while keeping the library tables + data intact. Use when Atlas's prompt produces bad output but the library itself is healthy.

### Execute
```sql
-- Disable Atlas's active prompt
UPDATE public.cockpit_agent_prompts
SET active = false, status = 'archived', archived_at = NOW(),
    archived_reason = 'Atlas misbehaved — temporary deactivation pending v2 prompt',
    can_be_reactivated = true
WHERE role = 'api_specialist';

-- Audit
INSERT INTO public.cockpit_audit_log (agent, action, target, success, metadata, reasoning)
VALUES ('pbs', 'deactivate_atlas_anders', 'cockpit_agent_prompts', true,
        jsonb_build_object('runbook','cockpit/runbooks/reference_library_rollback.md','path','C'),
        'Atlas deactivated; library tables retained.');
```

### Effect
- Captain Kit will no longer route to api_specialist (no active prompt → triggers fallback)
- Other 14 agents lose the `query_reference_library` skill via their grants — wait NO, the grants are independent. Other agents can still call query_reference_library. Atlas just can't write/verify.
- Schema + 21 entries remain readable on `/cockpit/docs-registry` Section C.

### Reactivate
```sql
UPDATE public.cockpit_agent_prompts
SET active = true, status = 'active', archived_at = NULL, archived_reason = NULL
WHERE role = 'api_specialist' AND can_be_reactivated = true AND archived_reason LIKE 'Atlas misbehaved%';
```

---

## Common gotchas

- **DELETE-prevention triggers block direct DELETE** even from service_role unless the role is in the allowed list (`postgres`, `supabase_admin`, `service_role`). The migration in Path B works around this by dropping the triggers first.
- **`reference_library_staleness_check` cron must be killed BEFORE table drops** — otherwise the cron tries to insert tickets referencing nonexistent tables and errors loudly in `cron.job_run_details`.
- **Captain Kit's prompt v9** still mentions `skill_creator` and other roles. If Path B is used, either remove `api_specialist` from his routing options OR rely on the dynamic team query (the prompt tells him to check `cockpit_agent_identity` for active agents).
- **Backups:** Path B is destructive. Confirm `/api/cockpit/backup/status` shows a backup < 24h old before executing. Supabase PITR (Pro plan, 7-day window) is the secondary safety net.

## After any path

1. Update `cockpit_audit_log` with reason
2. Open a GitHub issue tagged `rollback` documenting what failed
3. If Path B: schedule a Phase 1A v2 redesign before retry
4. If Path C: write Atlas v2 prompt, test in staging, then promote
