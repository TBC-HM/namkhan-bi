-- Cockpit knowledge base — Authority Matrix + DB Role Separation + Fail-Safe.
-- Purpose: lock the spec rules into KB so every agent reads them at run time.
-- Method:  4 INSERT rows into public.cockpit_knowledge_base.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_kb_authority_matrix).

INSERT INTO public.cockpit_knowledge_base (topic, key_fact, scope, source, confidence) VALUES
('AGENT AUTHORITY MATRIX LOCKED',
 'Two AI agent classes have execution authority. AI Dev Agent (lead/frontend/backend/reviewer/tester) — full authority on bug fixes, approved feature implementation, behavior-preserving refactors, updating Architecture/Data-Model/API/Integration docs to match reality, applying advisor auto-fixes, re-running checks, triggering deploys. Requires owner approval for: changes to Vision/PRD/Security docs CONTENT, architectural changes, new external integrations, overriding failed gates, disabling checks/backups, tenant-isolation migrations. AI Security Agent (Sentinel Sergei, role=security) — full authority on running Supabase Advisors, applying auto-fixable findings (RLS/indexes/SECURITY DEFINER) with mandatory dry-run, updating Security doc, re-running advisors. Requires approval for: RLS strategy changes, disabling security checks, tenant isolation changes, auth architecture.',
 'global', 'system', 'high'),
('DB ROLE SEPARATION LOCKED',
 'Five DB roles: (1) ai_dev_agent — write to documentation_staging + application schemas (with RLS), CANNOT write production docs (uses promotion_service). (2) ai_security_agent — read all, write to RLS/indexes/security policies + documentation_staging Security doc only, CANNOT write production docs. (3) promotion_service — triggered by gates+(auto-promotion OR owner approval), writes documentation production. (4) backup_service — read all, write backup storage. (5) owner — full access via cockpit, can override any gate (logged with reason).',
 'global', 'system', 'high'),
('FAIL-SAFE PRINCIPLE LOCKED',
 'When AI agent cannot proceed: (1) DO NOT escalate immediately. (2) Re-read context, retry. (3) Try alternative. (4) Only after 3rd attempt: log status=blocked + notify owner with full context. Implementation: agent worker tracks attempts in cockpit_tickets.iterations; status flips to blocked when iterations >= 3; only then does owner alert fire. Prevents notification spam.',
 'global', 'system', 'high'),
('agent autonomy v2 - my pushbacks',
 'Three flags on autonomy spec: (1) Supabase advisor auto-fixable findings are NOT all safe to auto-apply (adding RLS to existing tables can break legit queries). Sentinel Sergei must DRY-RUN every fix and produce a diff for owner review even if auto-fixable. v1=always dry-run; v2=whitelist truly-safe patterns. (2) Re-run advisors needs Supabase Management API + cron, not in MCP scope today. Needs webhook/service worker. (3) Owner can override any gate needs explicit override UI in cockpit (button + reason field). Add to docs governance Phase 2.',
 'global', 'system', 'medium')
ON CONFLICT DO NOTHING;
