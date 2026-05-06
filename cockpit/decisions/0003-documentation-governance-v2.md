# ADR 0003 — Documentation governance v2 (auto-promote + rollback + 3-tier backup)

**Status**: Proposed (awaits approval before Phase 1 build) · Supersedes [ADR 0002](./0002-documentation-governance.md)
**Date**: 2026-05-06
**Owner**: PBS
**Driver**: PBS spec v2 received 2026-05-06; adds auto-promotion, rollback, 3-tier backup, PITR, restore drill on top of v1.

## What changed from v1

| Area | v1 | v2 |
|---|---|---|
| Approval | All 7 docs require manual approval | 4 manual + 3 auto-promote |
| Rollback | not in scope | any version, anytime, mandatory reason |
| Backup | not in scope | 3-tier (deployment-triggered + daily + manual) + PITR |
| Restore drill | not in scope | quarterly, calendar entry, pass/fail tracking |
| Cockpit views | 3 (Live, Staging, Audit) | 4 (+ Backup Status) |
| New tables | — | `rollback_log`, `backup_log`; `auto_promoted` flag on `documents`; `promotion_type` enum on `promotion_log` |

## Scope (7 docs, split by approval mode)

| # | Doc | Approval mode |
|---|---|---|
| 1 | Product Vision & Roadmap | manual |
| 2 | PRD | manual |
| 3 | Architecture | **auto-promote** |
| 4 | Data Model / ERD | **auto-promote** |
| 5 | API Documentation | **auto-promote** |
| 6 | Multi-Tenancy & Security | manual |
| 7 | Integration & Deployment | manual |

`requires_approval` flag in DB controls routing. Auto-promote logs `promotion_type=auto`, sets `auto_promoted=true` + `auto_promoted_at`, owner sees a 48-hour banner in cockpit Live view.

## Schemas

Both `documentation_staging` and `documentation` (identical structure):
- `documents` (incl. `auto_promoted`, `auto_promoted_at`, `requires_approval`)
- `document_versions`
- `approvals` (status enum now includes `auto_approved`)
- `promotion_log` (new field: `promotion_type` enum: `manual` | `auto`)
- `rollback_log` (new table)
- `backup_log` (new table)

## Anti-overwrite (5 rules — unchanged from v1)

1. Optimistic locking via `parent_version`
2. Write locks (`locked_by`, 30-min auto-release — extended from v1's 10-min)
3. SHA-256 hash validation
4. No hard deletes (status → `superseded`)
5. Promotion integrity check (production unchanged since review)

## Rollback

- Button on every historical version in Live view, 7 docs
- Mandatory `reason` field
- Triggers backup BEFORE rollback executes (safety snapshot)
- Logged in `rollback_log`
- GitHub commit on relevant branch with format: `docs(rollback/<doc_type>): rolled back to v<Y> from v<X>`
- Never deletes data — version history preserved
- Available at any time, any version

## Backup — 3 tiers

### A. Deployment-triggered (primary protection)
- Hook in GitHub Actions on merge to main
- Captures both schemas
- Target: S3-compatible (Backblaze B2 recommended at $1-5/mo, alternative AWS S3)
- Retention: last 30 deployments
- Naming: `backup_<deployment_id>_<timestamp>.sql.gz`
- **Backup must complete BEFORE deploy is marked successful**
- Failure HALTS deploy, alerts owner

### B. Daily scheduled (baseline)
- Cron at 03:00 UTC
- Full snapshot of both schemas
- Retention: 30 days rolling
- Independent of deploy activity

### C. Manual (on-demand)
- "Backup Now" button in cockpit Backup Status panel
- Use case: before major changes, before bulk operations

### Plus: Supabase PITR + GitHub mirror as backup layers

- Supabase PITR (Pro plan) — 7-day recovery window — protects against logical corruption between snapshots.
- GitHub markdown files in `namkhan-bi-docs` repo — readable backup that survives complete Supabase failure.

### Quarterly restore drill

- IT team performs test restore from latest backup every 90 days
- Verifies integrity, completeness, restore time
- Pass/Fail logged in cockpit Backup Status panel
- Mechanism: pg_cron job opens a GH Issue every 90 days as the "calendar" (we don't have a calendar integration)

## Database role separation (RLS) — v2.1 (Authority Matrix)

| Role | Permissions |
|---|---|
| `ai_dev_agent` | write access to `documentation_staging` + application schemas (with RLS); CANNOT write to `documentation` (production) — uses `promotion_service` |
| `ai_security_agent` | read all schemas; write to security policies / RLS / indexes; write to `documentation_staging` (Security doc only); CANNOT write production docs directly |
| `promotion_service` | triggered by passing all gates + (auto-promotion rule OR owner approval); write access to `documentation` (production) |
| `backup_service` | read all, write to backup storage only |
| `owner` | full access via cockpit; can override any gate (logged with reason) |

Cockpit checks role on every action. AI agents NEVER write directly to production.

## Agent Authority Matrix (locked spec)

### AI Dev Agent (umbrella for lead / frontend / backend / reviewer / tester)

**FULL AUTHORITY — execute without asking**:
- Bug fixes (code + doc update + deploy through gates)
- Implementing approved features from PRD
- Refactoring that preserves behavior
- Updating Architecture, Data Model, API, Integration & Deployment docs to match reality
- Resolving advisor findings that have safe auto-fixes
- Re-running checks after fixes
- Triggering deployments after gates pass

**REQUIRES OWNER APPROVAL — propose, do NOT apply**:
- Changes to Vision, PRD, Security & Multi-Tenancy docs (content)
- Architectural changes that alter system design (not just implementation)
- New external integrations not listed in approved roadmap
- Overriding any failed gate
- Disabling any check or backup
- Schema migrations that affect tenant isolation

### AI Security Agent (Sentinel Sergei, role=security)

**FULL AUTHORITY**:
- Running Supabase Security & Performance Advisors
- Applying auto-fixable findings (missing RLS on new tables, missing FK indexes, weak `SECURITY DEFINER`) — **with mandatory dry-run first**
- Updating Security & Multi-Tenancy doc in staging to reflect new/fixed policies
- Re-running advisors to confirm fixes
- Logging all actions with before/after state

**REQUIRES OWNER APPROVAL**:
- Changes to RLS *strategy* (logic, not just adding policies)
- Disabling any security check
- Tenant isolation model changes
- Authentication/authorization architecture changes

### Fail-Safe Principle (applies to all agents)

If an AI agent cannot proceed (gate blocks, conflict, ambiguous decision):
1. **DO NOT escalate to owner immediately**
2. First attempt: re-read context, retry with corrected approach
3. Second attempt: try alternative solution
4. Third attempt: log as `blocked` and notify owner with full context

Implementation: agent worker tracks attempts in `cockpit_tickets.iterations`; status flips to `blocked` when iterations >= 3; only then does the owner alert fire.

This prevents owner notification spam from agents that just need to think harder.

### v2 pushbacks I logged in KB

- Supabase advisor "auto-fixable" findings are NOT all safe to auto-apply (e.g. adding RLS to existing tables can break legitimate queries). Sentinel Sergei must DRY-RUN every fix and produce a diff for owner review, even if marked auto-fixable. v1 = always dry-run; v2 = whitelist of truly-safe patterns.
- "Re-run advisors to confirm" needs Supabase Management API + cron — not in MCP scope today; needs a webhook or service worker.
- "Owner can override any gate" — needs an explicit override UI in cockpit (button + reason field), not just a flag. Add to docs governance Phase 2 cockpit work.

## Cockpit (4 views, all under a new "Documentation" top-level)

| View | What |
|---|---|
| **Live** | 7 doc tabs, read-only · current version + last promoted + last approver + promotion type · rollback button per historical version · 48h auto-promoted banner · download MD/PDF |
| **Staging** | 7 doc tabs · current draft + pending approvals · side-by-side diff · Approve/Reject/Request Changes buttons · pending counter |
| **Audit** | full history · filter by writes/approvals/promotions/rollbacks/backups · filter by doc/agent/date/action |
| **Backup Status** | last successful backup · last failed · "Backup Now" button · quarterly drill status (Pass/Fail/Overdue) |

## Phasing

| Phase | Scope | Time | Auto-runnable |
|---|---|---|---|
| 1 | Both schemas + locking + hash + RLS + auto-promote rule engine + rollback service + daily backup cron + enable PITR + 7 doc seeds | 3-4d | yes |
| 2 | Cockpit 4 views + diff viewer + GH App + namkhan-bi-docs repo + branch protection + sync workflow + **migrate deploy to GH Actions** | 4-5d | partial — PBS creates repo + GH App + B2 bucket |
| 3 | Promotion service (manual + auto) + deployment-triggered backup hook in GH Actions + S3-compatible target + notifications + quarterly drill cron + pre-commit hook | 2-3d | yes |

## Open questions (block Phase 1)

| # | Question | Recommendation |
|---|---|---|
| 1 | Backup target | Backblaze B2 ($1-5/mo) for isolation; Supabase Storage as cheapest |
| 2 | Migrate deploy from CLI to GH Actions? | Yes — required for backup gate |
| 3 | Enable Supabase PITR now? | Yes — already on Pro, just toggle |
| 4 | Notifications | GH Issue v1 (free, wired); Resend v2 |
| 5 | Initial doc content | Agents bootstrap from CLAUDE.md + DESIGN_NAMKHAN_BI.md + decisions/ + KB; PBS reviews before publish |
| 6 | GitHub auth | GH App (branch protection compatibility), NOT PAT |
| 7 | Auto-promote "code-derived" check | v1 trust agent · v2 add fingerprint check |

## Pushbacks documented

1. **External S3-compatible storage** — adds new infra. Either provision Backblaze B2 (cheapest, ~$1-5/mo) or use Supabase Storage as v1.
2. **"Backup must complete before deploy"** — only feasible if deploy moves to GH Actions. Today is `npx vercel --prod --yes` with no hook. Phase 2 includes the migration.
3. **"Doc generated from code" auto-promote check** — non-trivial. Trust the agent in v1; add content-fingerprint diff in v2.
4. **Quarterly drill calendar entry** — no calendar integration. Use pg_cron + GH Issue every 90 days as the "calendar".
5. **Hash validation is theatre today** — server computes its own hashes. Keep for future-proofing (when agents externalize) but don't oversell as corruption-catcher.
6. **30-min write lock TTL (v2)** — reasonable for human-in-the-loop edits but agents typically commit in <1min. Lock will rarely fire. Keep value but understand it's a safety net not a typical case.

## Standing task

`docs_governance_setup` — already updated to v2 spec. Fire from `/cockpit` chat:

```
run docs_governance_setup
```

## Acceptance criteria (12 — all must pass before declaring v2 shipped)

1. AI agent attempting stale write → REJECTED with clear error
2. Two agents editing same doc → second BLOCKED until lock released
3. Owner sees diff before approving any manual promotion
4. Approved promotion only succeeds if production unchanged since review
5. Direct write to production schema by AI agent → DENIED at DB level
6. Auto-promotion logs visible and reversible via rollback
7. Rollback executes, logs reason, triggers backup beforehand
8. Deployment to production triggers backup; failed backup HALTS deployment
9. Daily scheduled backup runs and logs successfully
10. Manual "Backup Now" button creates valid restorable backup
11. Full audit trail visible in cockpit
12. Quarterly drill GH Issue auto-creates every 90 days

## Consequences

**Positive**:
- AI agents cannot corrupt production docs
- Auto-promote unblocks the 3 docs that change most often (Architecture, Data Model, API)
- Rollback gives "undo" guarantee at any time
- 3-tier backup + PITR + GitHub mirror = strong disaster recovery
- Quarterly drill ensures backups actually work

**Negative**:
- Multi-week build (~10 working days) before any operational benefit
- New external dependency (Backblaze B2 or similar)
- Deploy procedure migration from CLI to GH Actions is a real change
- 7 doc seeds need content (agents bootstrap is OK but not perfect)

**Mitigated by phasing**:
- Phase 1 alone gives audit + locking + rollback + daily backup with low complexity
- Phase 2 adds the cockpit views — actually usable
- Phase 3 closes the loop with deployment-triggered backups + notifications
- Stop after any phase if ROI doesn't justify continuing

## Acceptance test scenarios (5 anti-overwrite + backup tests)

Anti-overwrite:
1. Stale version write attempt → REJECT
2. Concurrent agent lock conflict → BLOCK
3. Hash mismatch rejection → REJECT
4. Promotion with intervening production change → BLOCK
5. Direct AI write to production → DENY at DB level

Backup:
1. Deployment-triggered backup succeeds → deploy proceeds
2. Deployment-triggered backup fails → deploy halts
3. Daily scheduled backup runs at 03:00 UTC and logs success
4. Manual "Backup Now" creates restorable backup
5. Quarterly drill restores cleanly within target time

## Related

- ADR 0002 (v1 spec, superseded)
- KB: `documentation policy LOCKED`, `documentation requirements per feature`, `agents who own documentation`, `docs governance v2 - auto promote`, `docs governance v2 - rollback`, `docs governance v2 - backup tiers`, `docs governance v2 - DB roles`, `docs governance v2 - 4 cockpit views`, `docs governance v2 - my pushbacks`
- Standing task slug: `docs_governance_setup`
