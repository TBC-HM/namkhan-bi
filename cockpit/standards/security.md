# Security Standards

## Authentication

- All admin routes protected by Supabase Auth
- MFA required for all admin users
- Session timeout: 24h for admin, 7d for guest accounts
- Password requirements: 12+ chars, complexity enforced
- No password resets via email-only — require MFA confirmation

## Authorization

- RLS (Row Level Security) enabled on every table containing user data
- `service_role` key never exposed to client
- API routes verify session before any data access
- Admin actions audited (logged to `audit_log` table)

## Data protection

- PII encrypted at rest (Supabase default)
- PII never logged in app logs
- Backups encrypted (Supabase default + verified)
- PITR enabled (7-day window minimum)

## Secrets management

- All secrets in environment variables
- Production secrets in Vercel + Supabase, never in repo
- `.env*` files in `.gitignore`
- GitHub Secret Scanning enabled
- Rotation: API keys quarterly, DB passwords annually, on suspicion immediately

## Network

- HTTPS everywhere (HSTS enabled)
- Vercel firewall rules: rate limiting on auth/booking routes
- Supabase: network restrictions to Vercel IPs (where possible)
- No DB access from public internet

## Dependencies

- Dependabot auto-PR for patch updates
- Manual review for minor and major
- High/critical vulnerabilities: fix within 7 days
- Run `npm audit` weekly via GitHub Action

## Monitoring

- Failed login attempts >100/24h → alert
- Unusual auth patterns (geo, device) → alert
- Any `service_role` usage outside server context → alert
- DB advisors red issues → ticket

## Compliance

- GDPR: data export + delete API endpoints required
- Privacy policy current and linked
- Cookie consent for analytics (where applicable)
- Data retention: bookings 7 years, logs 90 days, marketing emails until unsub

## Incident response

See `cockpit/runbooks/security-incident.md`.

## Things that must never happen

- Service role key in browser
- Plaintext passwords anywhere
- Customer payment data stored locally (use Stripe / payment provider)
- Public S3-style bucket without explicit decision
- Disabled RLS on tables with user data
- API endpoints without auth check on data routes

## Auto-actions allowed

- Patch dependency updates auto-merge after CI green
- Block deploy if security advisor red
- Auto-revert deploy if security regression detected

## Auto-actions never allowed

- Auto-modify auth code
- Auto-modify RLS policies
- Auto-grant permissions
- Auto-rotate secrets
