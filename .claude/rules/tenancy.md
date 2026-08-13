paths: app/api/**, app/h/**, lib/**

# Tenancy rules

Threat model: service-role client bypasses RLS on every path that matters.
The ONLY isolation is what you write here. Middleware protects /h/<id> pages;
it does NOT protect /api/*.

MUST:
- Every API route that reads/writes tenant data MUST start with:
  const propertyId = await requirePropertyAccess(req, rawPropertyId); // lib/tenancy.ts — 403s if no grant
  rawPropertyId from query/body/params is UNTRUSTED until this returns.
- Every query on a tenant table MUST carry .eq('property_id', propertyId) from the verified value — never a constant, never PROPERTY_ID.
- New embedding surfaces (campaign->asset style FKs) MUST use the ADR-184 recipe: composite FK carrying property_id + tenant-guard trigger.

MUST NOT:
- No ?? 260955 / ?? 1000001 defaults. Missing property_id = 400, not Namkhan.
- No literal 260955/1000001 in code (route params / useCurrentProperty() only). Prebuild ratchet fails the build if the count rises above baseline.
- No 'use client' file may import @/lib/supabase (silent anon downgrade).
- Never widen getSessionScope() fallbacks — no-cookie/error must resolve to NO access, not holding-all.

Known traps (do not "fix" casually):
- lib/supabase/server.ts docstring says anon — it re-exports the service-role singleton. Fixing lib/supabase.ts:19's ?? anonKey fallback to throw would turn 28 legacy client files into a build-time key leak. Migrate importers first.
- lib/session-scope.ts canSeeProperty exists with zero call sites — wire it, don't reinvent it.
- middleware.ts public-bypass list (19 prefixes): each claims an in-route secret gate. If you add a prefix, the gate is YOUR responsibility — add it in the route, verified, not as a comment.
