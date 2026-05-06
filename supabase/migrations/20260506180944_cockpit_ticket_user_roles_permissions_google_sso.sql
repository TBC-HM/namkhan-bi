-- Recovered from supabase_migrations.schema_migrations on 2026-05-06.
-- Version: 20260506180944
-- Name:    cockpit_ticket_user_roles_permissions_google_sso
-- Source:  prod kpenyneooigsyuuomgct (canonical)
-- Method:  supabase db dump --data-only --schema supabase_migrations + parse + split

-- Cockpit ticket: user roles + permissions + Google SSO.
-- Source: PBS via Cowork chat 2026-05-06.
-- Status: awaits_user (parked, IT Manager to revisit in 48h).
-- Author: PBS via Claude (Cowork) · 2026-05-06.

INSERT INTO public.cockpit_tickets (
  source, arm, intent, status,
  email_subject, parsed_summary, notes
) VALUES (
  'cowork_chat',
  'dev',
  'build',
  'awaits_user',
  '[cockpit] User roles + permissions + Google SSO',
  $SUMMARY$
USER ROLES + PERMISSIONS + GOOGLE SSO — design + build.

Scope (3 items):
1. User role + permission structure
   - Roles to support (initial set, expand later): owner (PBS), gm (resort manager), revenue_manager, finance, ops, viewer
   - Permission matrix: which pages each role sees, which actions each role can take
   - Storage: settings.users + settings.user_roles (or auth metadata)
   - Enforce in middleware + per-API-route + per-page guards

2. Google SSO sign-in (replaces / supplements Basic Auth)
   - Use Supabase Auth Google provider (already on stack)
   - Allowlist by domain (@thenamkhan.com) + explicit user list below
   - Magic-link cookie path stays for ops continuity
   - Re-enable middleware once SSO works

3. Initial allowlisted users
   - rom@thenamkhan.com
   - rm@thenamkhan.com
   - xl@thenamkhan.com
   - pb@thenamkhan.com (owner / PBS)

Owner action expected:
- IT Manager (Captain Kit) revisit in the next 48 hours and propose a phased build plan
- Phase 1 = SSO + domain allowlist (lowest risk, removes Basic Auth)
- Phase 2 = role table + per-route guards
- Phase 3 = per-page UI gating

Open questions for the revisit:
- Per-property scoping or single-property only? (Donna future)
- View-only links (signed URL) for external partners?
- Audit log of every login + role change?
$SUMMARY$,
  'Park until 2026-05-08. IT Manager (it_manager) owns the revisit. Auth currently DISABLED in middleware.ts (PBS unblock 2026-05-06) — re-enabling depends on Phase 1 of this ticket.'
);

-- Confirm
SELECT id, status, email_subject, created_at FROM public.cockpit_tickets ORDER BY id DESC LIMIT 1;