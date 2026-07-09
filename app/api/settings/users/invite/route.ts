// app/api/settings/users/invite/route.ts
// PBS 2026-07-09 v2: use resetPasswordForEmail which ACTUALLY sends the email
// via Supabase Auth. admin.generateLink only returns the URL — no email fired.
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
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const origin = new URL(req.url).origin;

    // Try inviteUserByEmail first (works for never-signed-in users, sends invite email).
    const admin = getSupabaseAdmin();
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/account/password`,
    });
    if (!invErr) return NextResponse.json({ ok: true, mode: 'invite_sent' });

    // If user already exists, fall back to resetPasswordForEmail via anon client.
    if (!/already|registered/i.test(invErr.message)) {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }
    const anon = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } },
    );
    const { error: rErr } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/account/password`,
    });
    if (rErr) return NextResponse.json({ error: `reset failed: ${rErr.message}` }, { status: 500 });
    return NextResponse.json({ ok: true, mode: 'reset_sent' });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
