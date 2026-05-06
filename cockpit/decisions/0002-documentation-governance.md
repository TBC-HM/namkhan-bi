# ADR 0002 — Documentation governance system v1 (SUPERSEDED by ADR 0003)

**Status**: Superseded — see [ADR 0003 — Documentation governance v2](./0003-documentation-governance-v2.md) (2026-05-06)
**Date**: 2026-05-06
**Owner**: PBS
**Driver**: PBS spec received 2026-05-06; dual-environment doc system with anti-overwrite controls.

## Context

Multi-tenant SaaS BI platform. All coding done by AI agents. Need a governance layer over docs:
- AI agents must not be able to corrupt production docs.
- Owner (PBS) is the only path to production.
- Side-by-side diff before approval.
- Full audit trail.

## Decision

Build a dual-environment documentation system in 3 phases.

### Schemas (both in `namkhan-pms` Supabase project)

| Schema | Purpose | Who writes |
|---|---|---|
| `documentation_staging` | All AI-agent writes land here first | future `ai_agent` role + service_role |
| `documentation` | Production — read-only except via approved promotion | only `promotion_service` (triggered by approval webhook) |

Both schemas have identical structure: `documents`, `document_versions`, `approvals`, `promotion_log`.

### Anti-overwrite controls (5 rules, all required)

1. **Optimistic locking** — every write declares `parent_version`; rejected if current version changed.
2. **Write locks** — `locked_by` + `locked_at`, 10-min auto-release.
3. **SHA-256 hash validation** on every write (theatre today since agents are server-side, but future-proof).
4. **No hard deletes** — old versions stay, status flips to `superseded`.
5. **Promotion integrity check** — production must be unchanged during review window or promote is BLOCKED.

### 7 core docs

1. Product Vision & Roadmap
2. PRD
3. Architecture
4. Data Model / ERD
5. API Documentation
6. Multi-Tenancy & Security
7. Integration & Deployment

### GitHub mirror

Repo: `TBC-HM/namkhan-bi-docs` (to be created).
- Branch `staging` ← auto-updated on every approved staging write.
- Branch `main` ← updated only on production promotion.
- Branch protection on `main`: no direct pushes; integrity check required.
- Auth: GitHub App (NOT PAT) for branch-protection compatibility.

### Cockpit display

3 sub-tabs under a new "Documentation" tab in `/cockpit`:
1. **Live** — production read-only, current version + last promoted + last approver.
2. **Staging** — drafts + pending approvals + side-by-side diff + Approve/Reject/Request Changes buttons.
3. **Audit** — full history filterable by doc/agent/date/action.

## Phasing

| Phase | Scope | Time | Auto-runnable |
|---|---|---|---|
| 1 | Schemas + locking + hash + RLS + 7 doc seeds | 1-2d | yes |
| 2 | Cockpit UI (Live/Staging/Audit) + diff viewer + GH App + repo + branch protection | 3-5d | partial — PBS creates repo + GH App |
| 3 | Promotion service + notifications + daily approval window + pre-commit hook | 2-3d | yes |

## Open questions (block Phase 1)

1. Same Supabase project (recommend yes) or separate?
2. Notification channel: Resend or GitHub Issue (recommend GH Issue v1, already wired)?
3. GH App vs PAT (recommend GH App)?
4. Daily approval window time (default 09:00 ICT)?
5. Initial content: do you have drafts for the 7 docs, or should agents bootstrap from CLAUDE.md + DESIGN_NAMKHAN_BI.md + cockpit/decisions/ + KB?

## Pushbacks documented

- **Hash check is theatre** today — server computes the hash itself. Keep for future-proofing (when agents externalize) but don't market it as a corruption catcher.
- **Branch protection** requires GH App; PAT bypasses it.
- **Notifications** add cost (Resend) unless we use the already-wired GH Issue email pattern.
- **AI agents currently have NO write access to ANY documentation schema** — this whole system needs an explicit grant before agents can write to staging.

## Acceptance tests (5 scenarios — must all pass before promotion to v1)

1. Stale version write attempt → REJECTED with clear error.
2. Two agents editing same doc → second BLOCKED until first releases lock.
3. Owner sees diff before approving any promotion.
4. Approved promotion only succeeds if production unchanged since review started.
5. Direct AI write to production schema → DENIED at DB level.

## Standing task

`docs_governance_setup` (slug) — fire from `/cockpit` chat: "run docs_governance_setup"

## Consequences

**Positive**:
- AI agents cannot corrupt production docs.
- Full audit + human-in-the-loop on every promotion.
- GitHub mirror gives off-platform backup + diff history.

**Negative**:
- Multi-week build before any operational benefit.
- Diff viewer + GH App + sync workflow are real engineering.
- 7 doc seeds need content — either PBS provides or agents bootstrap (lower quality).

**Mitigated by phasing**: Phase 1 alone (schema + locking) gives audit trail value with low complexity. Stop there if Phase 2 ROI doesn't justify.
