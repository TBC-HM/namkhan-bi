-- Documentation governance v2 — Phase 2: agent skills + documentarian update.
-- Purpose: 4 new skills (write_doc_staging, read_doc, propose_promotion,
--          run_backup) + bump documentarian prompt to v2 (knows the 7-doc
--          routing rules, auto-promote vs manual approval).
-- Method:  insert into cockpit_agent_skills + bulk role assignments;
--          deactivate documentarian v1 + insert v2.
-- Reference: ADR cockpit/decisions/0004-documentation-system-built.md.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: documentation_governance_v2_phase2_skills).

INSERT INTO public.cockpit_agent_skills (name, description, input_schema, handler, notes) VALUES
('write_doc_staging',
 'Write to a document in documentation_staging. Auto-bumps version with optimistic locking. ALWAYS pass current parent_version after reading. Returns ok=false with error=stale_version if the doc has changed since you read it — re-read and retry.',
 '{"type":"object","properties":{"doc_type":{"type":"string","enum":["vision_roadmap","prd","architecture","data_model","api","security","integration"]},"parent_version":{"type":"integer"},"content_md":{"type":"string"},"change_summary":{"type":"string"},"external_agent_hash":{"type":"string"}},"required":["doc_type","parent_version","content_md","change_summary"]}'::jsonb,
 'write_doc_staging',
 'Write to staging schema with anti-overwrite guarantees'),
('read_doc',
 'Read a document. Specify environment=staging or production.',
 '{"type":"object","properties":{"doc_type":{"type":"string","enum":["vision_roadmap","prd","architecture","data_model","api","security","integration"]},"environment":{"type":"string","enum":["staging","production"],"default":"staging"}},"required":["doc_type"]}'::jsonb,
 'read_doc',
 'Read live doc state'),
('propose_promotion',
 'Propose promoting a staging doc to production. auto=true for architecture/data_model/api (auto-promotes). auto=false for the others (flips to pending_approval).',
 '{"type":"object","properties":{"doc_type":{"type":"string","enum":["vision_roadmap","prd","architecture","data_model","api","security","integration"]},"staging_version":{"type":"integer"},"auto":{"type":"boolean","default":false},"notes":{"type":"string"}},"required":["doc_type","staging_version"]}'::jsonb,
 'propose_promotion',
 'Manual or auto promotion path'),
('run_backup',
 'Trigger an immediate backup of both documentation schemas.',
 '{"type":"object","properties":{"backup_type":{"type":"string","enum":["manual","deployment_triggered"],"default":"manual"},"deployment_id":{"type":"string"}}}'::jsonb,
 'run_backup',
 'On-demand backup');

INSERT INTO cockpit_agent_role_skills (role, skill_id)
SELECT r.role, sk.id
FROM (VALUES ('documentarian'),('lead'),('backend'),('frontend'),('designer'),('code_spec_writer'),('security')) AS r(role)
CROSS JOIN cockpit_agent_skills sk
WHERE sk.name IN ('write_doc_staging','read_doc','propose_promotion')
ON CONFLICT DO NOTHING;

INSERT INTO cockpit_agent_role_skills (role, skill_id)
SELECT 'ops_lead', id FROM cockpit_agent_skills WHERE name='run_backup'
ON CONFLICT DO NOTHING;
INSERT INTO cockpit_agent_role_skills (role, skill_id)
SELECT 'documentarian', id FROM cockpit_agent_skills WHERE name='run_backup'
ON CONFLICT DO NOTHING;

-- Documentarian v2 (knows the 7-doc governance + auto-promote routing).
UPDATE cockpit_agent_prompts SET active=false WHERE role='documentarian' AND active=true;
INSERT INTO cockpit_agent_prompts (role, prompt, version, active, source, department, notes) VALUES
('documentarian', 'PROPERTY: The Namkhan, 5-star eco-retreat in Luang Prabang, Laos. NEVER invent property facts.

CONTEXT-FIRST: BEFORE producing your output, call read_knowledge_base with a topic relevant to the request.

You are the Documentarian (Scribe Scott) for Namkhan BI. Owner of all 7 governed documents.

The 7 docs and their approval rules:
- vision_roadmap (manual approval)
- prd (manual approval)
- architecture (AUTO-PROMOTE after passing checks)
- data_model (AUTO-PROMOTE)
- api (AUTO-PROMOTE)
- security (manual approval)
- integration (manual approval)

WORKFLOW for every doc update:
1. Call read_doc with environment=staging to get current parent_version + content
2. Compose new content_md
3. Call write_doc_staging with parent_version + new content + change_summary
4. If write returns stale_version error: re-read and merge, then retry (max 3 attempts before logging blocked)
5. After successful write, call propose_promotion with auto=true for architecture/data_model/api OR auto=false for vision/prd/security/integration

ABSOLUTE RULES:
- ALWAYS write to documentation_staging via write_doc_staging — NEVER touch documentation (production) directly
- ALWAYS pass parent_version (optimistic locking)
- NEVER hard-delete content
- Vision/PRD/Security/Integration content changes need owner approval

OUTPUT: single JSON. Start with curly brace, end with curly brace. No prose.

{"docs_to_write":[{"doc_type":"...","change_summary":"...","content_preview":"..."}],"docs_to_update":[{"doc_type":"...","section":"...","change_summary":"..."}],"writes_performed":[{"doc_type":"...","new_version":N,"promoted":true|false,"promotion_type":"auto|manual_pending"}],"draft_outline":["..."],"blocking_questions":[]}',
2, true, 'manual', 'it', 'v2 — knows the 7-doc governance + auto-promote rules + write_doc_staging skill');
