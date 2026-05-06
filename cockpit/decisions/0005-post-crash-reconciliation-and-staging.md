# ADR 0005 — Post-crash Reconciliation + Staging Environment + Promotion Pipeline

**Date:** 2026-05-06
**Status:** Accepted
**Supersedes:** none
**Superseded by:** none
**Related:** ADR 0001 (cockpit architecture), ADR 0003 (docs governance v2), ADR 0004 (docs system built)

---

## Context

A concurrent Cowork session crashed mid-Phase 0. When work resumed, repo state on `main` did not match production state on Vercel + Supabase. PBS established the absolute rule: **production is the source of truth; GitHub reconciles to production, never the reverse.**

After reconciliation, Phase 4 added a full staging environment (Vercel + Supabase) so future schema/code changes can be validated before touching production. Phases 5+6+7 add the promotion pipeline + backup pre-deploy hook + this ADR.

## Decision

### 1. Staging environment (Phase 4b — shipped)

| Layer | Project | Identifier |
|---|---|---|
| Vercel | `namkhan-bi-staging` | https://namkhan-bi-staging.vercel.app |
| Supabase | `namkhan-pms-staging` | ref `hutnvqqdumjdnetkkajd`, region `eu-central-1`, $10/mo |
| Git | branch `staging` | source of truth for staging deploys |
| Schema | full clone of prod | 36 schemas, 392 tables, 742 RLS policies, 223 functions, 16 matviews — exact parity verified |
| Cockpit data seed | 1 dept + 14 identities + 17 skills + 118 role-skills + 13 active prompts (+ 1 archived Glen) + 65 KB rows + 5 standing tasks | runtime tables (tickets/incidents/audit_log/kpi_snapshots) intentionally left empty |

Staging cron jobs are **not started** (would hit live Cloudbeds + run weekly audits against prod data).

### 2. Promotion pipeline (Phase 5 — this ADR)

Replaces the manual `npx vercel --prod --yes` CLI flow.

```
feature branch → PR → Vercel preview
              → merge to staging → namkhan-bi-staging deploys
              → smoke test on staging
              → workflow_dispatch: promote-staging-to-prod.yml
                 ├── tsc + build pass
                 ├── smoke test staging URLs
                 ├── verify last Supabase backup < 24h
                 ├── fast-forward merge staging → main (no force push)
                 └── trigger deploy-prod.yml
              → deploy-prod.yml
                 ├── pre-deploy backup (deployment_triggered)
                 ├── vercel deploy --prod
                 ├── post-deploy smoke test (3 retries, 60s grace)
                 ├── notify Sentinel Sergei via /api/cockpit/webhooks/post-deploy
                 └── if failure → /api/cockpit/deploy/rollback
```

### 3. Backup pre-deploy hook (Phase 6 — this ADR)

Every prod deploy triggers a fresh Supabase documentation backup BEFORE Vercel deploy starts. Deploy aborts if backup fails. This is the GH Actions migration that was deferred when ADR 0004 shipped.

### 4. Hard rules (locked)

- **Production is source of truth.** Never roll back production to match GitHub. Always reconcile GitHub to production.
- **No direct push to main.** All commits to main land via fast-forward merge from `staging` branch.
- **No CLI prod deploys after this ADR.** All prod deploys go through `deploy-prod.yml` workflow. Local `vercel --prod` is for emergency rollback only (with PBS approval logged).
- **Staging cron jobs stay disabled.** Re-enable per-job only when isolation from prod is proven.
- **Backup gate is non-bypassable.** If backup fails, deploy halts. PBS can override only by direct GH Actions UI re-run after fixing the backup.

## Consequences

### Wins

- Schema changes get a 24-hour soak in staging before prod. No more "first time the migration runs is on prod."
- Backup is guaranteed fresh for every prod deploy (auto-rollback target).
- Cost ceiling enforced: staging adds ~$10/mo (Supabase). Vercel staging is free tier. GH Actions runtime ~free for this volume.
- Audit trail: every promotion logs to cockpit_audit_log with reason + actor.

### Losses

- Deploy speed: CLI `vercel --prod --yes` was ~90 sec. New flow is ~5–8 min including pre-checks. Acceptable for prod; emergency hotfix path via direct workflow_dispatch with `trigger=hotfix` skips smoke test.
- New required secrets: `PROMOTE_PAT` (GH PAT with `contents:write` + `actions:write`), `VERCEL_TOKEN`, `COCKPIT_AGENT_TOKEN` — all in GH Actions secrets.
- One more thing for PBS to maintain. Mitigation: Cockpit "Promote" button (future ticket) wraps `workflow_dispatch` in a UI click.

### Concurrent migrations recovery (open)

7 prod migrations applied via Supabase MCP / dashboard during the crash window have no `.sql` file in `supabase/migrations/`. Per `supabase/migrations/CONCURRENT_MIGRATIONS_TODO.md`, recovery via `npx supabase db pull --linked` writes the missing files. This is a Phase 1A blocker for the api_specialist agent (it needs accurate schema docs).

PBS to run from Mac (Docker required):
```bash
cd ~/Desktop/namkhan-bi
npx supabase db pull --linked
git diff supabase/migrations/
git add supabase/migrations/
git commit -m "chore(db): pull 7 concurrent migrations into repo"
```

## References

- `supabase/migrations/CONCURRENT_MIGRATIONS_TODO.md`
- `.github/workflows/promote-staging-to-prod.yml`
- `.github/workflows/deploy-prod.yml`
- KB: "phase 0 reconciliation — outcome" (id 62)
- KB: "phase 4a — prompt refreshes + Glen archive" (id 63)
- KB: "staging Supabase project — namkhan-pms-staging" (id 64)
- KB: "phase 4b — schema clone complete" (id 65)
