-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506183428
-- Name:    kb_phase_5_6_7_outcomes
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- KB entries: Parts 5/6/7 outcomes (promotion pipeline + GH Actions deploy + ADR 0005).
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_knowledge_base (topic, key_fact, scope, source, confidence, active) VALUES
(
  'promotion pipeline (staging → main → prod)',
  'Prod deploys go through GH Actions only. Workflow: staging branch → smoke test + backup-age check → fast-forward merge to main → triggers deploy-prod.yml → pre-deploy backup + tsc + build + vercel deploy + post-deploy smoke test (3 retries). Auto-rollback on smoke fail. Trigger via promote-staging-to-prod.yml workflow_dispatch (manual or cockpit Promote button). NO direct push to main. NO `npx vercel --prod` from CLI in normal flow (emergency rollback only with PBS approval logged). Workflow files: .github/workflows/promote-staging-to-prod.yml, .github/workflows/deploy-prod.yml. Required GH secrets: PROMOTE_PAT, VERCEL_TOKEN, COCKPIT_AGENT_TOKEN, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  'global', 'system', 'high', true
),
(
  'backup pre-deploy hook (Phase 6)',
  'Every prod deploy via deploy-prod.yml triggers a deployment_triggered backup BEFORE Vercel deploy starts (calls /api/cockpit/docs/backup). Deploy aborts if backup fails. Promotion pipeline (Phase 5) also checks backup age < 24h via /api/cockpit/backup/status BEFORE allowing fast-forward merge. Backup gate is non-bypassable except via direct workflow re-run after fix.',
  'global', 'system', 'high', true
);