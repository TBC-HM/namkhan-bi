-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506182916
-- Name:    kb_integration_decision_tree_part8
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- KB entry: integration decision tree (Part 8 of monitoring policy).
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_knowledge_base (
  topic, key_fact, scope, source, confidence, active
) VALUES (
  'integration decision tree',
  'When asked "should I add a new integration?" walk this tree: (1) Connects cockpit to a vendor for monitoring? YES → direct webhook /api/webhooks/<vendor>, done. (2) Vendor has API + dev time? YES → direct API call from agent, document in reference_library. (3) Non-developer needs to edit? YES → Zapier (cleaner OAuth than Make). (4) Complex multi-step transformation? YES → Make. (5) One-off needed today? YES → Zapier, tag TEMPORARY in architect_decisions, replace within 30 days. If none → do not add it. Cost > value. Source: documentation_staging.integration v2 Part 8.',
  'global',
  'system',
  'high',
  true
);