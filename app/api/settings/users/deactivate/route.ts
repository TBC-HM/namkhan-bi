// app/api/settings/users/deactivate/route.ts
// PBS 2026-07-13: soft-delete a user. Sets tenancy.property_users.status='inactive'
// on every property_id + tenancy.holding_users.status='inactive'. The auth.users
// row STAYS so the operator can re-activate later. Reuses the existing archive
// RPCs already used by EditUserModal.
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

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.ok === false) return gate.res;
  try {
    const body = await req.json();
    const userId = String(body.user_id ?? '').trim();
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    const admin = getSupabaseAdmin();

    // 1) revoke all property grants
    const { error: pErr } = await admin.rpc('fn_user_archive_property_all', { p_user_id: userId });
    if (pErr) return NextResponse.json({ error: `deactivate properties failed: ${pErr.message}` }, { status: 500 });

    // 2) revoke holding grant
    const { error: hErr } = await admin.rpc('fn_user_archive_holding', { p_auth_user_id: userId });
    if (hErr) return NextResponse.json({ error: `deactivate holding failed: ${hErr.message}` }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
