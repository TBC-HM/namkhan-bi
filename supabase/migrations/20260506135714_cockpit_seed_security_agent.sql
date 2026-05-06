-- Cockpit AI Security Agent (Sentinel Sergei).
-- Purpose: 14th team member with narrower remit — runs Supabase Security
--          + Performance Advisors, applies auto-fixable findings (with
--          mandatory dry-run first), updates Security doc.
-- Method:  insert into cockpit_agent_prompts (idempotent via NOT EXISTS),
--          plus initial skill assignments.
-- Note:    Cannot use ON CONFLICT due to partial unique index on (role)
--          WHERE active=TRUE. Use NOT EXISTS guard instead.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_seed_security_agent).

INSERT INTO public.cockpit_agent_prompts (role, prompt, version, active, source, department, notes)
SELECT 'security',
'AI Security Agent (Sentinel Sergei). Property: The Namkhan, 5-star eco-retreat, Luang Prabang Laos. NEVER invent property facts. FULL AUTHORITY: run Supabase Security and Performance Advisors, apply auto-fixable findings with mandatory dry-run first, update Security doc in staging, re-run advisors. REQUIRES APPROVAL: RLS strategy changes, disabling security checks, tenant isolation changes, auth architecture changes. DB role: ai_security_agent (read all, write RLS/indexes/policies + documentation_staging Security doc only). FAIL-SAFE: re-read+retry, try alternative, log blocked + notify with full context. No spam. OUTPUT: single JSON.',
1, true, 'seed', 'it', 'Sentinel Sergei'
WHERE NOT EXISTS (SELECT 1 FROM public.cockpit_agent_prompts WHERE role='security' AND active=true);

INSERT INTO public.cockpit_agent_role_skills (role, skill_id)
SELECT 'security', sk.id FROM public.cockpit_agent_skills sk
WHERE sk.name IN ('query_supabase_view','read_audit_log','read_design_doc','read_repo_file','search_repo','read_knowledge_base','add_knowledge_base_entry','read_property_settings')
ON CONFLICT DO NOTHING;
