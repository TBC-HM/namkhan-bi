# Runbook: Site Down

**Severity**: S1 (always). Page PBS immediately.

## Detection

Triggered by:
- Better Stack (or chosen uptime monitor) reports >2 consecutive failed pings
- Vercel deploy webhook reports failure
- Error rate >5% sustained for >2 min (Vercel monitoring)

## Auto-actions (Health Arm)

1. **Check if recent deploy** (within last 30 min)
   - If yes → auto-rollback to previous deployment via Vercel API
   - If no → skip to step 2
2. **Check Supabase status**
   - If Supabase reports outage → confirm via Supabase status page
   - If Supabase down → log incident, notify PBS (no auto-action — wait it out)
3. **Check Vercel status**
   - If Vercel-side outage → log, notify PBS
4. **Email PBS** within 60 sec of detection with:
   - What's down (URL)
   - When detected
   - What was auto-attempted
   - Current status
   - Suggested next step

## Manual actions (PBS)

If Health Arm auto-rollback didn't fix:

1. Check Vercel deployments page
2. Check Supabase logs (last 15 min)
3. Check error rate by route in Vercel
4. If isolated to one route → push hotfix or comment out feature
5. If widespread → rollback further deploys, escalate to senior dev (retainer)

## Who to call

- Senior dev on retainer: (TBD — add contact)
- Vercel support (Pro plan): vercel.com/support
- Supabase support (Pro plan): supabase.com/support

## Communication

If down >30 min:
- Status page update (if exists)
- Social media: brief, factual ("aware of issue, working on it, no booking data lost")
- Active guest comms only if booking flow affected — Cloudbeds direct email

## Post-incident

Within 48h:
1. Write RCA in `cockpit/decisions/` or `incidents/` (depending on severity)
2. Update this runbook if process needs change
3. Add test that would have caught this

## Common causes (historical)

(Empty — populate as incidents happen)

## Last updated

2026-05-05 — Initial creation
