// app/api/settings/users/delete/route.ts
// PBS 2026-07-13: HARD delete a user. Verifies confirm_email matches the target
// user's email, then revokes all grants + destroys the auth.users row via
// admin.auth.admin.deleteUser(). Irreversible. Also archives tenancy rows first
// so any downstream FK constraints don't block the auth delete.
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
    const confirmEmail = String(body.confirm_email ?? '').trim().toLowerCase();
    if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    if (!confirmEmail) return NextResponse.json({ error: 'confirm_email required' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // Look up the auth user + verify the confirm_email matches (case-insensitive).
    const { data: authUser, error: gErr } = await admin.auth.admin.getUserById(userId);
    if (gErr || !authUser?.user) {
      return NextResponse.json({ error: `user not found: ${gErr?.message ?? 'no user'}` }, { status: 404 });
    }
    const targetEmail = (authUser.user.email ?? '').trim().toLowerCase();
    if (!targetEmail) return NextResponse.json({ error: 'target has no email' }, { status: 400 });
    if (targetEmail !== confirmEmail) {
      return NextResponse.json({ error: 'confirm_email does not match user email' }, { status: 400 });
    }

    // 1) revoke property grants (best-effort; ignore missing rows).
    await admin.rpc('fn_user_archive_property_all', { p_user_id: userId });
    // 2) revoke holding grant (best-effort).
    await admin.rpc('fn_user_archive_holding', { p_auth_user_id: userId });

    // 3) hard-delete the auth row. This is irreversible.
    const { error: dErr } = await admin.auth.admin.deleteUser(userId);
    if (dErr) return NextResponse.json({ error: `auth delete failed: ${dErr.message}` }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
