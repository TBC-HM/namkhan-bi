# Weekly platform snapshots

Off-Supabase backups of irreplaceable platform tables. Written by
`.github/workflows/weekly-snapshot.yml` every Sunday 02:17 UTC.

## What's in here

Two files per week:

- `YYYY-Www.sql.gz` — `pg_dump` of platform tables (compressed)
- `YYYY-Www_audit_log_30d.csv.gz` — slim 30-day slice of `cockpit_audit_log`

## What's backed up

Tables that cannot be re-synced from upstream sources:

- `documentation.*` — architecture docs, ADRs, session handoffs
- `cockpit_agent_memory` — learned rules, importance-weighted memory
- `cockpit_decisions` — architectural decisions log
- `cockpit_change_log` — DDL audit trail
- `cockpit_tickets`, `cockpit_proposals`, `cockpit_projects` — operator workflow state
- `cockpit_agent_prompts`, `cockpit_agent_skills`, `cockpit_agent_identity` — agent definitions
- `cockpit_knowledge_base` — KB rules + embeddings
- `cockpit_standing_tasks` — cron specs
- `cockpit_audit_log` (last 30 days only — full table is mostly heartbeats)

## What's NOT backed up

- Reservations, transactions, guests — rebuild from Cloudbeds
- Payroll, staff records — rebuild from Factorial / archive loaders
- F&B / POS — rebuild from Roots POS
- General ledger — rebuild from QuickBooks
- Materialized views, derived KPI tables — rebuild from base data

These have their own upstream sources of truth. Backing them up here
would be redundant with PITR (7-day) + daily Supabase backups + upstream
re-sync paths.

## Retention

Snapshots older than 26 weeks (~6 months) are auto-pruned by the same
workflow. For long-term archival, manually copy snapshots out before
they age out.

## Restoring from a snapshot

```bash
# 1. Unzip
gunzip 2026-W19.sql.gz

# 2. Connect to a branch or recovery project
#    (NEVER restore directly to production without confirming the diff)

# 3. Apply
psql "<connection-string>" < 2026-W19.sql
```

The dump uses `--no-owner --no-privileges` so it can be applied to a
fresh project. Existing rows with the same PKs will conflict — restore
to an empty target or `TRUNCATE` the target tables first.

## When this saves you

| Failure | This file vs PITR vs daily |
|---|---|---|
| Lost `documentation.documents` row 8 weeks ago | ✅ This file. PITR window is 7d. Daily backup is 7d. |
| Need to audit "what did agent_memory say on 2026-03-01" | ✅ Find the snapshot from that week |
| Critical agent prompt accidentally deleted 30 days ago | ✅ Last weekly snapshot has it |
| Entire project wipe | Use latest daily backup primarily; this is the platform-config piece you'd re-import on top |

This is belt-and-suspenders, not the primary restore path.

See `ARCHITECTURE.md` §19c for the full backup posture.
