// app/api/settings/users/grant-holding/route.ts
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';

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
  const { data } = await admin.from('v_holding_users_flat').select('status').eq('auth_user_id', user.id).maybeSingle();
  if (!data || data.status !== 'active') return { ok: false, res: NextResponse.json({ error: 'holding admin required' }, { status: 403 }) };
  return { ok: true };
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (gate.ok === false) return gate.res;
  try {
    const body = await req.json();
    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc('fn_user_grant_holding', {
      p_auth_user_id: String(body.user_id),
      p_email: String(body.email).toLowerCase(),
      p_active: !!body.active,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
