-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506181013
-- Name:    kb_cockpit_initial_users_and_sso_intent
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- KB entry: initial cockpit user roster + SSO intent.
-- Source: PBS via Cowork chat 2026-05-06. Linked ticket #21.
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_knowledge_base (
  topic, key_fact, scope, source, source_ticket_id, confidence, active
) VALUES (
  'cockpit users + SSO plan',
  'Initial cockpit user allowlist (email-based, Google SSO target): pb@thenamkhan.com (PBS owner), rom@thenamkhan.com, rm@thenamkhan.com, xl@thenamkhan.com. Future plan (ticket #21, parked 2026-05-06, revisit in 48h): replace Basic Auth with Supabase Auth Google provider, domain-restrict to @thenamkhan.com + explicit allowlist. Roles to design: owner / gm / revenue_manager / finance / ops / viewer. Phase 1 = SSO + domain allowlist; Phase 2 = role table + per-route guards; Phase 3 = per-page UI gating. Auth currently DISABLED in middleware.ts pending this work.',
  'global',
  'system',
  21,
  'high',
  true
);