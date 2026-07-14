// app/api/settings/users/update/route.ts
// PBS 2026-07-09: update a user's name/email OR archive (revoke all grants).
// Admin-gated. Rewrites auth.users + tenancy.* rows.
// PBS 2026-07-14: also accepts landing_page (per-user post-login redirect).
//   Semantics on the field:
//     - omitted       → no change
//     - '' (empty)    → clear (fall back to default in /api/auth/post-login)
//     - '/…'          → set
//   Written via fn_user_update_name_email(p_landing_page) — SECURITY DEFINER.
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => (req.headers.get('cookie') ?? '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
          const [n, ...r] = s.split('='); return { name: n, value: r.join('=') };
        }),
        setAll: () => {},
      },
    },
  );
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'auth required' }, { status: 401 }) };
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('v_holding_users_flat').select('role, status').eq('auth_user_id', user.id).maybeSingle();
  if (!data || data.status !== 'active' || !['owner', 'admin'].includes(data.role))
    return { ok: false, res: NextResponse.json({ error: 'holding admin required' }, { status: 403 }) };
  return { ok: true };
}

function validateLandingPage(input: unknown): { ok: true; value: string | null | undefined } | { ok: false; error: string } {
  // undefined = not present in body → no change (pass NULL to RPC)
  if (input === undefined) return { ok: true, value: undefined };
  if (input === null) return { ok: true, value: undefined };
  if (typeof input !== 'string') return { ok: false, error: 'landing_page must be a string' };
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, value: '' }; // clear
  if (!trimmed.startsWith('/')) return { ok: false, error: 'landing_page must start with /' };
  if (trimmed.startsWith('//')) return { ok: false, error: 'landing_page must not be protocol-relative' };
  if (/^\/[a-z][a-z0-9+.-]*:/.test(trimmed)) return { ok: false, error: 'landing_page must not contain a scheme' };
  if (trimmed.length > 512) return { ok: false, error: 'landing_page too long (max 512)' };
  return { ok: true, value: trimmed };
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.ok === false) return gate.res;
  try {
    const body = await req.json();
    const userId = String(body.user_id ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    const admin = getSupabaseAdmin();

    // Archive path: revoke every grant, keep auth row so operator can un-archive later.
    if (body.archive === true) {
      await admin.from('v_property_users_flat').select('email').eq('user_id', userId).limit(1); // ensure exists
      const { error: pErr } = await admin.rpc('fn_user_archive_property_all', { p_user_id: userId });
      if (pErr) return NextResponse.json({ error: `archive properties failed: ${pErr.message}` }, { status: 500 });
      const { error: hErr } = await admin.rpc('fn_user_archive_holding', { p_auth_user_id: userId });
      if (hErr) return NextResponse.json({ error: `archive holding failed: ${hErr.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, archived: true });
    }

    // Update path
    const name = body.name != null ? String(body.name).trim() : null;
    const email = body.email != null ? String(body.email).trim().toLowerCase() : null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }

    // Landing page — undefined = no change, '' = clear, '/…' = set
    const lp = validateLandingPage(body.landing_page);
    if (lp.ok === false) return NextResponse.json({ error: lp.error }, { status: 400 });

    // 1) auth.users
    const authPatch: Record<string, unknown> = {};
    if (email) authPatch.email = email;
    if (name) authPatch.user_metadata = { full_name: name };
    if (Object.keys(authPatch).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(userId, authPatch);
      if (error) return NextResponse.json({ error: `auth update failed: ${error.message}` }, { status: 500 });
    }

    // 2) tenancy tables via RPC (SECURITY DEFINER)
    // RPC: fn_user_update_name_email(p_user_id, p_email, p_name, p_landing_page)
    //   - NULL landing_page → no change
    //   - '' landing_page   → clear
    //   - '/…'              → set
    const { error: rErr } = await admin.rpc('fn_user_update_name_email', {
      p_user_id: userId,
      p_email: email,
      p_name: name,
      p_landing_page: lp.value === undefined ? null : lp.value,
    });
    if (rErr) return NextResponse.json({ error: `tenancy update failed: ${rErr.message}` }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
