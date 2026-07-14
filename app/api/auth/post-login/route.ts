// app/api/auth/post-login/route.ts
// PBS 2026-07-14: post-login redirect resolver.
// The client login page calls this immediately after a successful
// signInWithPassword() to figure out where to send the operator.
//
// Priority ladder:
//   1) tenancy.holding_users.landing_page (per-user override, set via
//      /settings/users/[user_id] edit modal)
//   2) is_owner / holding role in ('owner','admin') → /holding/ceo
//   3) any active property grant → '/'  (property-scoped home)
//   4) fallback → '/login?err=no_access'
//
// The client passes through any ?next=… query param the middleware set
// when it kicked an unauthenticated request to /login — that always wins
// over the ladder so deep-links keep working.
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

function safeAbsPath(x: string | null | undefined): string | null {
  if (!x) return null;
  const trimmed = x.trim();
  if (!trimmed.startsWith('/')) return null;
  // reject protocol-relative and anything with a scheme
  if (trimmed.startsWith('//') || /^\/[a-z][a-z0-9+.-]*:/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nextParam = safeAbsPath(typeof body?.next === 'string' ? body.next : null);

    // Read the just-set session cookie via the SSR client.
    const cookieHeader = req.headers.get('cookie') ?? '';
    const cookieList = cookieHeader.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [n, ...r] = s.split('=');
      return { name: n, value: r.join('=') };
    });
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieList, setAll: () => {} } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      return NextResponse.json({ redirect_to: nextParam ?? '/login?err=auth_required' });
    }

    // Explicit ?next=… deep-link always wins.
    if (nextParam && nextParam !== '/' && nextParam !== '/login') {
      return NextResponse.json({ redirect_to: nextParam });
    }

    const admin = getSupabaseAdmin();

    // 1) per-user landing_page override
    const { data: holdRow } = await admin
      .from('v_holding_users_flat')
      .select('role, status, landing_page')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    const override = safeAbsPath(holdRow?.landing_page ?? null);
    if (override) {
      return NextResponse.json({ redirect_to: override, source: 'user_override' });
    }

    // 2) holding owner/admin → /holding/ceo
    if (holdRow?.status === 'active' && holdRow.role && ['owner','admin'].includes(holdRow.role)) {
      return NextResponse.json({ redirect_to: '/holding/ceo', source: 'owner_default' });
    }

    // 2b) holding member → /holding/ceo (they have cross-property view)
    if (holdRow?.status === 'active' && holdRow.role) {
      return NextResponse.json({ redirect_to: '/holding/ceo', source: 'holding_default' });
    }

    // 3) property-scoped user → '/' (their tenant-rewritten home)
    const { data: props } = await admin
      .from('v_property_users_flat')
      .select('property_id, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1);
    if ((props ?? []).length > 0) {
      return NextResponse.json({ redirect_to: '/', source: 'property_default' });
    }

    // 4) no grants at all
    return NextResponse.json({ redirect_to: '/login?err=no_access', source: 'no_grants' });
  } catch (e) {
    return NextResponse.json({ redirect_to: '/', error: (e as Error).message }, { status: 200 });
  }
}
