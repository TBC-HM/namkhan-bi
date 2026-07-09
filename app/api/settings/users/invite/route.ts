// app/api/settings/users/invite/route.ts
// PBS 2026-07-09 v3: send invite/reset via Supabase Auth (fires email when
// SMTP is configured) AND return admin.generateLink action_link as the
// SMTP-independent fallback the UI can copy/paste when Supabase Auth email
// delivery isn't set up yet.
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
    const redirectTo = `${origin}/account/password`;

    const admin = getSupabaseAdmin();

    let mode: 'invite_sent' | 'reset_sent' | 'error' = 'error';
    let emailFired = false;

    // Try inviteUserByEmail first (new users → create + fire invite email).
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!invErr) {
      mode = 'invite_sent';
      emailFired = true;
    } else if (/already|registered/i.test(invErr.message)) {
      // Existing user → resetPasswordForEmail fires the reset mail.
      const anon = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } },
      );
      const { error: rErr } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
      if (rErr) return NextResponse.json({ error: `reset failed: ${rErr.message}` }, { status: 500 });
      mode = 'reset_sent';
      emailFired = true;
    } else {
      return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    // SMTP-independent fallback link — always returns a URL, even when SMTP is broken.
    let actionLink: string | null = null;
    try {
      const { data: link } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      actionLink = link?.properties?.action_link ?? null;
    } catch { actionLink = null; }

    return NextResponse.json({
      ok: true,
      mode,
      email_fired: emailFired,
      action_link: actionLink,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
