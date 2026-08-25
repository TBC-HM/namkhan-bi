// app/p/onboarding/[token]/page.tsx
// Customer-facing onboarding portal — public surface.
//
// 2026-08-25 (onboarding-engine-v1 §0.V3 work order): the portal originally
// shipped at /onboarding/[token], which middleware.ts redirects to /login for
// unauthenticated visitors (PUBLIC_PATHS never included it). middleware.ts is a
// protected path (governance.protected_paths; decision #7 is scoped to
// sitemap/robots only), so instead of widening PUBLIC_PATHS the portal is
// mounted under the existing public token prefix '/p/' — same pattern as the
// proposal and room token surfaces. The page itself 404s on a bad token via
// fn_onboarding_get_by_token.
// fn_onboarding_start_from_contract now emits /p/onboarding/<token> links.
// The legacy /onboarding/[token] route is left in place (auth-walled).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export { default } from '../../../onboarding/[token]/page';
