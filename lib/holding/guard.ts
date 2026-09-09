// lib/holding/guard.ts
// Holding-access gate for holding surfaces that the middleware does not cover.
//
// WHY THIS EXISTS: middleware 403s a non-holding session on `/holding/*`, but
// that check is `pathname.startsWith('/holding')` — it does NOT match
// `/api/holding/*`. Those routes are authenticated (middleware 401s an
// anonymous /api/* request) but not holding-scoped, so any signed-in tenant
// user could read holding data by id. For an endpoint that serves TBC's
// invoices that is a cross-tenant financial leak, so the gate lives in the
// route (L22: isolation is only what the code does).
//
// Deliberately NOT built on getSessionScope(): its no-cookie fallback resolves
// to isHolding:true — it fails OPEN. This fails CLOSED on every path: no
// cookie, no user, no row, inactive row, or any thrown error => denied.
//
// Follows the existing pattern in app/api/settings/users/grant-holding/route.ts
// rather than inventing a second one.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Single shape, not a discriminated union: tsconfig has "strict": false, which
// disables narrowing on a boolean literal discriminant, so `if (!gate.ok)` would
// not expose gate.message. Denied gates carry role '' so any role check on a
// denial is false.
export type HoldingGate = {
  ok: boolean;
  status: 200 | 401 | 403;
  message: string;
  authUserId: string | null;
  email: string | null;
  role: string;
};

const DENY = (status: 401 | 403, message: string): HoldingGate =>
  ({ ok: false, status, message, authUserId: null, email: null, role: '' });

type CookiePair = { name: string; value: string };

function parseCookieHeader(header: string | null): CookiePair[] {
  return (header ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const [n, ...rest] = s.split('=');
      return { name: n, value: rest.join('=') };
    });
}

async function check(getAll: () => CookiePair[]): Promise<HoldingGate> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return DENY(401, 'auth is not configured on this deployment');

    const sb = createServerClient(url, anon, { cookies: { getAll, setAll: () => {} } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return DENY(401, 'auth required');

    const { data } = await getSupabaseAdmin()
      .from('v_holding_users_flat')
      .select('role, status, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    const row = data as { role: string; status: string; email: string | null } | null;

    if (!row || row.status !== 'active') return DENY(403, 'holding access required');
    return {
      ok: true, status: 200, message: 'ok',
      authUserId: user.id, email: row.email ?? user.email ?? null, role: row.role,
    };
  } catch {
    // Never let an auth failure read as success.
    return DENY(403, 'holding access could not be verified');
  }
}

/** Route handlers: reads the request's own Cookie header. */
export function requireHoldingFromRequest(req: Request): Promise<HoldingGate> {
  return check(() => parseCookieHeader(req.headers.get('cookie')));
}

/** Server actions / RSC: reads the request cookies via next/headers. */
export function requireHoldingFromCookies(): Promise<HoldingGate> {
  return check(() => {
    const store = cookies() as unknown as { getAll: () => CookiePair[] };
    return store.getAll().map((c) => ({ name: c.name, value: c.value }));
  });
}

/** Roles allowed to trigger an outbound send (L28). Read is looser than write. */
export function canSendOnBehalfOfHolding(role: string): boolean {
  return ['owner', 'admin', 'member'].includes(role);
}
