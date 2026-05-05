# Runbook: Database Slow

**Severity**: S2 (degraded) or S3 (warning)

## Detection

- Supabase Performance Advisor flags slow queries
- Query response time >1s on critical paths (booking, auth, search)
- DB CPU >80% sustained
- Connection pool >70% utilized

## Auto-actions (Health Arm)

1. **Pull slow query list** from Supabase API
2. **Check for new indexes** suggested by Performance Advisor
3. **Open GitHub issue** with:
   - Slow queries (top 10)
   - Suggested indexes
   - Recent schema changes correlated
4. **Notify PBS** via weekly digest (not S1)

If query time blocks site (>5s on user-facing route):
- Escalate to S2
- Email PBS immediately

## Manual actions (PBS)

1. Review issue
2. Decide:
   - Add suggested indexes (low risk, do it)
   - Refactor query (assign to Dev Arm)
   - Increase Supabase compute (cost decision)
3. For index additions: Dev Arm creates migration PR

## Never auto-do

- Add indexes directly to prod DB
- Modify queries without testing
- Increase Supabase plan / compute size

## Common causes

| Cause | Fix |
|---|---|
| Missing index on FK | Add index migration |
| Full table scan | Add WHERE/index, or pagination |
| N+1 query | Refactor to batch |
| Bloat (high churn table) | Run VACUUM, schedule maintenance |
| Connection pool exhaustion | Use pooler URL, check connection leaks |

## Monitoring

Weekly: review Performance Advisor output in audit email.
Monthly: review query trends in Supabase dashboard.

## Last updated

2026-05-05 — Initial
