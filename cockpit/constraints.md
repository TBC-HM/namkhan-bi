# Constraints — What Agents Cannot Do

Hard rules. No exceptions without an ADR. If an action is on this list, **stop and escalate to PBS via email**.

## Never automate (always require human)

| Action | Why |
|---|---|
| Direct push to `main` | Branch protection enforces, but never attempt |
| Schema migration on production | Data loss risk |
| Deleting tables, columns, rows in prod | Irreversible |
| Modifying user authentication code | Security-critical |
| Modifying payment processing code | Financial + PCI risk |
| Modifying booking write logic (creating/canceling reservations) | Revenue + guest impact |
| Modifying Cloudbeds API integration writes | PMS is sole revenue source |
| Force-push to any branch | Destroys history |
| Changing DNS, domain, registrar settings | Recovery is slow |
| Rotating production secrets/keys | Risk of locking out the live site |
| Disabling RLS on Supabase tables | Security |
| Granting public access to private buckets | Data leak |
| Bypassing failing tests to merge | Quality gate exists for a reason |
| Removing CI/CD checks | Same |
| Direct edits to production database | Use migrations |

## Never auto-merge PRs touching

- `/auth/`
- `/payment/`, `/checkout/`
- `/booking/` (write paths)
- `/api/admin/`
- Any file with `migration` in the path
- Any file with `production` config
- `next.config.js`, `vercel.json`, `supabase/config.toml`
- `.env*`, secrets, credential files

## Never propose

- New paid SaaS without ROI calc and ADR
- Replacing Cloudbeds, Vercel, or Supabase
- Adding analytics that violate GDPR
- Storing payment card data anywhere we control
- Storing PII outside Supabase (the audited DB)
- Email collection without opt-in
- Scraping competitor sites in violation of their ToS
- AI-generated images of real people without consent

## Never claim

- Knowledge of data not in Supabase or Cloudbeds (no inventing numbers)
- Decisions weren't logged when they were (check `decisions/`)
- A test passes when it doesn't
- A deploy succeeded when it failed
- That something is "production-ready" without tests + review

## Hard spend caps (don't exceed without approval)

- Vercel: per plan limits, alert at 80%
- Supabase: per plan limits, alert at 80%
- Claude API: $50/mo for orchestrator + research arm combined
- Make.com: per plan operations
- Any new SaaS: $0 without ADR

## Time limits

- Never let a ticket sit "in progress" >48h without status update
- Never make >5 iterations on a single ticket without escalating
- Never run a single Claude Code task >2h without checkpointing

## When unsure

Default to: stop, document the question, email PBS. Better to wait an hour than break production.
