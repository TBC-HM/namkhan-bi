// app/api/settings/users/invite/route.ts
// Sends a password-reset link to the user. First-time users click → land on
// /account/password → set their password → done.
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
  if (!gate.ok) return gate.res;
  try {
    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const admin = getSupabaseAdmin();
    const origin = new URL(req.url).origin;
    const { error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${origin}/auth/callback?next=/account/password` },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
