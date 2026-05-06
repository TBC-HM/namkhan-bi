-- Cockpit standing tasks (pre-defined ticket templates PBS can fire).
-- Purpose: queue up named, reusable tasks (site_design_sweep, setup_staging_env,
--          documentation_sweep, deploy_to_staging_first, docs_governance_setup)
--          that PBS activates from /cockpit chat with "run <slug>".
-- Method:  cockpit_standing_tasks table + ticket_template JSONB; chat route
--          regex-detects "run <slug>" and inserts a real cockpit_tickets row.
-- Author:  PBS via Claude (Cowork) · 2026-05-06
-- Applied via Supabase MCP on 2026-05-06 (migration: cockpit_standing_tasks).

CREATE TABLE IF NOT EXISTS public.cockpit_standing_tasks (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  ticket_template JSONB NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at     TIMESTAMPTZ,
  run_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.cockpit_standing_tasks ENABLE ROW LEVEL SECURITY;

-- Initial 5 standing tasks. Full text per task lives in cockpit/decisions/0003-* + KB.
INSERT INTO public.cockpit_standing_tasks (slug, name, description, ticket_template) VALUES
('site_design_sweep',
 'Site design sweep — adapt all pages to canonical pattern',
 'Walks every namkhan-bi page (80+) and proposes patches to match canonical layout (reference: /revenue/compset).',
 jsonb_build_object('arm','design','intent','investigate','parsed_summary','SITE DESIGN SWEEP — see ADR + KB topic "CANONICAL PAGE PATTERN"')),
('setup_staging_env',
 'Set up staging/test environment + daily deploy gate',
 'Create namkhan-bi-staging Vercel project + namkhan-pms-staging Supabase project + daily approval window.',
 jsonb_build_object('arm','health','intent','build','parsed_summary','STAGING ENV SETUP — see ADR 0003+0004')),
('deploy_to_staging_first',
 'Refine deploy procedure — staging-first',
 'After staging env exists, make staging-first the default deploy path.',
 jsonb_build_object('arm','health','intent','document','parsed_summary','STAGING-FIRST DEPLOY DOC')),
('documentation_sweep',
 'Documentation sweep — verify every feature has its docs',
 'Audit repo for missing ADRs / changelog entries / runbooks per feature shipped in last 30 days.',
 jsonb_build_object('arm','control','intent','document','parsed_summary','DOC SWEEP — see KB topic "documentation policy LOCKED"')),
('docs_governance_setup',
 'Documentation governance v2 — staging/prod + auto-promote + rollback + 3-tier backup',
 'Multi-week build of dual-environment doc system per ADR 0003.',
 jsonb_build_object('arm','control','intent','build','parsed_summary','DOCS GOVERNANCE v2 — see ADR 0003 + 0004'))
ON CONFLICT (slug) DO NOTHING;
