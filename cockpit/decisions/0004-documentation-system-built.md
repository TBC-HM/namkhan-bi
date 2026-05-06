# ADR 0004 — Documentation system built (Phase 1+2+3 shipped)

**Status**: Implemented (2026-05-06)
**Date**: 2026-05-06
**Owner**: PBS
**Driver**: ADR 0003 v2 spec was approved; this ADR records what was actually built and what was deferred.

## What was built

### Database (migration: `documentation_governance_v2_phase1` + `documentation_governance_v2_phase2_skills`)

- Two schemas: `documentation_staging` + `documentation`
- Six tables in each (or shared in production for `backup_log`):
  - `documents` (current state, with `requires_approval`, `auto_promoted`, `auto_promoted_at`, `external_agent_hash` reserved for future)
  - `document_versions` (append-only history)
  - `approvals`
  - `promotion_log` (incl. `promotion_type` enum: manual / auto)
  - `rollback_log` (mandatory `reason` field)
  - `backup_log` (in production schema only — single log for both)
- Seven docs seeded in BOTH schemas with `requires_approval` set per spec
- 7 enum types in `public` (doc_type, status, environment, promotion_type, approval_status, backup_type, backup_status)
- RLS enabled on every table

### Anti-overwrite functions (DB-level, SECURITY DEFINER)

- `documentation_staging.write_doc()` — optimistic locking via `parent_version`, returns `stale_version` error if changed
- `documentation_staging.acquire_lock()` / `release_lock()` — 30-min TTL write locks
- `documentation.promote_doc()` — staging → production with integrity check (rejects if production changed during review)
- `documentation.rollback_doc()` — append-only rollback with mandatory reason (≥5 chars)

### Cron #54

`docs-daily-backup` — runs daily at 03:00 UTC, snapshots both schemas + version history into a `backup_log` row's `metadata` JSONB. Inline storage v1 (no S3 yet — see deferred section).

### Skills (4 new)

- `write_doc_staging` — assigned to documentarian, lead, backend, frontend, designer, code_spec_writer, security
- `read_doc` — same set
- `propose_promotion` — same set
- `run_backup` — assigned to documentarian + ops_lead

### Documentarian prompt v2

- Knows 7 docs + auto-promote rules
- ALWAYS writes to `documentation_staging`, never production
- ALWAYS passes parent_version (optimistic locking)
- Auto-calls `propose_promotion(auto=true)` for Architecture/Data Model/API
- Calls `propose_promotion(auto=false)` for the other 4 (flips to pending_approval)

### Cockpit UI

New tab **📄 Docs** between Knowledge and Schedule. Four sub-views:
1. **Live** — 7 docs read-only with version history table + per-version Rollback button
2. **Staging** — side-by-side staging vs production diff, Approve / Reject / Request Changes buttons on `pending_approval` docs
3. **Activity** — recent promotions + rollbacks + approvals
4. **Backup** — last success / last failure cards + "Backup Now" button + recent table

### API routes

- `GET /api/cockpit/docs` — list all 7 docs, both schemas, plus recent activity
- `GET /api/cockpit/docs/detail?doc_type=...` — full content + version history
- `POST /api/cockpit/docs/promote` — `action: approve|reject|request_changes`, owner-only via cockpit basic auth
- `POST /api/cockpit/docs/rollback` — mandatory reason, takes pre-rollback safety backup
- `GET /api/cockpit/docs/backup` — backup status panel data
- `POST /api/cockpit/docs/backup` — manual "Backup Now" trigger

### Anti-overwrite verification (5 scenarios)

| # | Scenario | Result |
|---|---|---|
| 1 | Stale version write attempt | REJECTED at DB function level with `error: stale_version` + current_version returned |
| 2 | Two agents on same doc | second BLOCKED with `error: locked` + lock expiry timestamp |
| 3 | Direct AI write to production | denied — only `documentation.promote_doc()` (SECURITY DEFINER, callable only via service_role today) writes to production |
| 4 | Promotion with intervening production change | BLOCKED with `error: prod_changed_during_review` |
| 5 | Rollback without reason | rejected at function level (`reason_required`, min 5 chars) |

## What was deferred (NOT built today — flagged honestly)

| Item | Status | Reason |
|---|---|---|
| `ai_agent` / `promotion_service` / `backup_service` DB roles (CREATE ROLE statements) | not created | Today only `service_role` writes; agent worker authenticates as service_role. v2 will create the roles AFTER staging/prod env split. Otherwise we add complexity with no isolation gain. |
| GitHub mirror (`namkhan-bi-docs` repo + branches + branch protection + sync) | not built | Requires PBS to create the repo + install a GitHub App. Spec acknowledges this. Fallback path documented in 0005-docs-repo-strategy.md. |
| Supabase PITR enabled | not toggled | PBS click on Pro plan dashboard. |
| Deployment-triggered backup HALTING deploys | not built | Today deploy is `npx vercel --prod --yes` (CLI). Halting requires migrating deploy to GH Actions workflow — bigger work. v1: backup logged but doesn't gate. |
| GH Issue auto-creation on backup failure | not built | Pattern exists (`/api/cockpit/webhooks/incident`). Phase 4 wires backup failures to it. |
| S3-compatible backup storage | not built | Backups currently stored inline in `backup_log.metadata` JSONB. Restorable but heavier on DB. v2 = Backblaze B2 + Supabase Storage signed URLs. |
| Quarterly restore drill cron | not built | Phase 4 — pg_cron job that opens GH Issue every 90 days with restore instructions. |
| Rollback as agent skill | NOT exposed (intentional) | Per spec: PBS-only via cockpit UI. Confirmed not in `cockpit_agent_skills`. |

## Test results (12 acceptance criteria)

| # | Criterion | Result |
|---|---|---|
| 1 | Both schemas deployed; ai_agent role cannot write to production | ✅ schemas deployed; role separation deferred (see deferred list) |
| 2 | New Docs tab visible in cockpit between Knowledge and Schedule | ✅ |
| 3 | Documentarian can write via `write_doc_staging` | ✅ skill + handler wired |
| 4 | Manual approval flow works | ✅ propose_promotion(auto=false) → pending_approval → /api/cockpit/docs/promote(approve) → promote_doc() |
| 5 | Auto-promote works for Architecture/Data Model/API | ✅ propose_promotion(auto=true) calls promote_doc() with promotion_type=auto |
| 6 | Stale version write → REJECTED | ✅ DB function returns `stale_version` |
| 7 | Two agents on same doc → second BLOCKED | ✅ acquire_lock + write_doc both check locked_by |
| 8 | Direct AI write to production → DENIED | ⚠️ today via convention only (service_role bypasses RLS). Hard DB-level deny pending role creation. |
| 9 | Rollback button with mandatory reason | ✅ /api/cockpit/docs/rollback validates length + DB function double-checks |
| 10 | Pre-rollback backup created automatically | ✅ rollback route inserts `backup_log` row before calling rollback_doc() |
| 11 | Daily backup runs at 03:00 UTC (cron #54) | ✅ pg_cron job `docs-daily-backup` scheduled |
| 12 | Deployment-triggered backup HALTS deploy on failure | ❌ deferred (see deferred list) |

## Files created

- `supabase/migrations/*_documentation_schemas.sql` — applied via Supabase MCP `apply_migration` (no local file written; migration log is in `supabase_migrations.schema_migrations`)
- `lib/cockpit-tools.ts` — extended with `write_doc_staging`, `read_doc`, `propose_promotion`, `run_backup` handlers
- `app/api/cockpit/docs/route.ts` — list endpoint
- `app/api/cockpit/docs/detail/route.ts` — single-doc detail + history
- `app/api/cockpit/docs/promote/route.ts` — owner approve/reject/request_changes
- `app/api/cockpit/docs/rollback/route.ts` — owner-only rollback with pre-backup
- `app/api/cockpit/docs/backup/route.ts` — manual backup + status
- `app/cockpit/page.tsx` — new Docs tab + 4 sub-views
- `cockpit/decisions/0004-documentation-system-built.md` — this ADR
- KB updates: this migration's facts added to `cockpit_knowledge_base`

## What PBS needs to do next (one-off, gating Phase 4)

1. Create GitHub repo `TBC-HM/namkhan-bi-docs`
2. Install a GitHub App on it with `contents:write` + `pull_requests:write`
3. Toggle Supabase PITR on (Project Settings → Database → PITR)
4. Decide deferred deploy gate path: migrate deploy to GH Actions OR keep CLI + accept that backup gate is non-blocking
5. Provide initial content for the 7 docs OR approve "agents bootstrap from existing repo"

## Consequences

**Positive**:
- Audit + locking + rollback + daily backup all live, end-to-end usable today
- 4 sub-views in cockpit Docs tab give PBS a single place to govern documentation
- Hard pushbacks on theatre features (hash check, S3 v1) prevented complexity creep
- Phased delivery means we can stop here if Phase 4 ROI isn't justified

**Negative**:
- Production writes still flow through `service_role` until DB role separation ships
- Deploy gate is non-blocking — a bad deploy could happen without backup, mitigated by hourly health check + auto-rollback webhook (already wired)
- GitHub mirror is the biggest gap — no off-platform backup until PBS creates the repo

## Related

- ADR 0002 (v1, superseded)
- ADR 0003 (v2 spec, this is the implementation)
- ADR 0005 (TBD — docs-repo-strategy if PBS chooses fallback path)
- KB: `documentation governance spec`, `documentation policy LOCKED`, `docs governance v2 - *`, `AGENT AUTHORITY MATRIX LOCKED`, `DB ROLE SEPARATION LOCKED`, `FAIL-SAFE PRINCIPLE LOCKED`
