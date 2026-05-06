-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506182902
-- Name:    cockpit_ticket_architect_monitoring_3prompts
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Cockpit ticket: Architect to execute the 3 monitoring prompts.
-- Source: 05_monitoring_and_integrations_policy.md, loaded in documentation_staging.integration v2.
-- Status: blocked (Architect role doesn't exist yet — Phase 2 prerequisite).
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_tickets (
  source, arm, intent, status,
  email_subject, parsed_summary, notes
) VALUES (
  'cowork_chat',
  'health',
  'build',
  'blocked',
  '[architect] Monitoring + integrations rollout (3 sequential prompts)',
  $SUMMARY$
EXECUTOR: Architect (does not exist yet — Phase 2 prerequisite).

Three sequential prompts. Each STOPS and reports back to PBS before next.

Prompt 1 — Foundation
- Vendor tools audit (Supabase, Vercel, GitHub, Cloudbeds) → cockpit/VENDOR_TOOLS_AUDIT_<DATE>.md
- 4 webhook receivers: /api/webhooks/{vercel,github,supabase,cloudbeds-placeholder}
- Configure webhooks at each vendor (secrets in Vercel env vars)
- New page /cockpit/health
- Test: staging deploy → webhook fires → row in /cockpit/health within 30s

Prompt 2 — Event-driven triggers
- Sentinel Sergei v2 prompt (sibling parity)
- 5 wired triggers: post-deploy / post-migration / post-agent-change / GitHub alerts / backup events
- Pre-deploy backup gate functioning
- All triggers cost 🟢 or 🟡 — daily < $5

Prompt 3 — Time-based + dashboard polish
- 7 pg_cron jobs (2 placeholders for unbuilt depts)
- scheduled_task_runs table + cost tracking on /cockpit/health
- /cockpit/health final layout (5 status tiles + activity row + scheduled tasks table)
- Make/Zapier registry section
- Cost ceiling alert at $15/day (75% of $20 ceiling)

PRECONDITIONS NOT YET MET:
- Phase 1A: reference_library schema + api_specialist role (NOT built)
- Phase 2: Architect agent + build_department skill + cockpit_guardrails table (NOT built)

DOC: documentation_staging.integration v2 (status=draft, awaits PBS approval — has 5 reviewer pushbacks).

When unblocked, paste Prompt 1 to Architect. Wait for completion. Then Prompt 2. Then Prompt 3.
$SUMMARY$,
  'Park until Phase 1A and Phase 2 ship. Architect role required — not yet in cockpit_agent_identity. PBS to reconcile 5 reviewer pushbacks on the policy doc before promote.'
);