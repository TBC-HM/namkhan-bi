# Runbook: Deploy Failed

**Severity**: S2 (build failure, prod still up) or S1 (deploy that took prod down — see site-down.md)

## Detection

Vercel webhook fires on deployment status `ERROR` or `CANCELED`.

## Auto-actions (Health Arm)

1. **Check what failed**
   - Build error → don't retry (won't help)
   - Network/transient → retry once after 60s
2. **Identify if prod still up**
   - If yes → S2: log, comment on PR, notify PBS via daily digest
   - If no → S1: trigger site-down runbook, auto-rollback
3. **Post details to PR**
   - Build log excerpt
   - Likely cause (parsed from log)
   - Suggested fix

## Manual actions (PBS)

If S2 (prod up but deploy stuck):
- Read PR comment from Health Arm
- If fix is obvious → reply with instruction or commit fix
- If unclear → assign to Dev Arm: "Investigate and fix deploy failure on PR #X"
- Dev Arm will open follow-up commit

## Common failure modes

| Cause | Fix |
|---|---|
| TypeScript error | Fix type, push commit |
| Missing env var | Add in Vercel settings |
| Module not found | Check package.json, run `npm install` |
| Build timeout | Optimize build or split |
| Vercel quota exceeded | Check usage, upgrade or wait |

## When to escalate

- 3+ retries fail
- Quota issues
- Anything pointing to Vercel infrastructure

Escalate to: senior dev retainer, Vercel support.

## Last updated

2026-05-05 — Initial
