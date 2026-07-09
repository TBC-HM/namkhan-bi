// app/api/settings/users/create/route.ts
// PBS 2026-07-09 v3:
//   - inviteUserByEmail (creates user + fires invite email via Supabase Auth SMTP)
//   - ALSO generates action_link via admin.generateLink so UI can display a
//     "copy link" fallback for when Supabase SMTP isn't configured yet.
//   - admin gate requires holding_role IN (owner, admin)
//   - propagates role param to grant RPCs
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

const NAMKHAN_PID = 260955;
const DONNA_PID = 1000001;

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => (req.headers.get('cookie') ?? '').split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
        const [n, ...r] = s.split('='); return { name: n, value: r.join('=') };
      }),
      setAll: () => {},
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
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
    const name = String(body.name ?? '').trim();
    const namkhan = !!body.namkhan;
    const donna = !!body.donna;
    const holding = !!body.holding;
    const sendInvite = !!body.send_invite;
    if (!email || !name) return NextResponse.json({ error: 'email + name required' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid email' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/account/password`;

    let userId: string;
    let inviteInfo: string | null = null;
    let actionLink: string | null = null;
    let emailFired = false;

    if (sendInvite) {
      // inviteUserByEmail creates user + fires invite email via Supabase SMTP.
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo,
      });
      if (invErr) {
        if (!/already|registered/i.test(invErr.message)) {
          return NextResponse.json({ error: `invite failed: ${invErr.message}` }, { status: 500 });
        }
        // User exists — fall back to reset email + reuse existing user id.
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 300 });
        const found = (list?.users ?? []).find((u) => u.email === email);
        if (!found) return NextResponse.json({ error: 'user exists but not findable' }, { status: 500 });
        userId = found.id;
        const anon = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } },
        );
        const { error: rErr } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
        if (rErr) inviteInfo = `existed; reset email failed: ${rErr.message}`;
        else { inviteInfo = 'existed; reset link sent'; emailFired = true; }
      } else {
        userId = inv!.user!.id;
        inviteInfo = 'invite sent';
        emailFired = true;
      }

      // SMTP-independent fallback link — always returns a URL, even when SMTP is unconfigured.
      // type='recovery' works on any existing user (new or old) since post-invite the user exists.
      try {
        const { data: link } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo },
        });
        actionLink = link?.properties?.action_link ?? null;
      } catch { actionLink = null; }
    } else {
      // No invite requested — silent createUser, no email.
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, email_confirm: true, user_metadata: { full_name: name },
      });
      if (cErr) {
        if (!/already/i.test(cErr.message)) return NextResponse.json({ error: cErr.message }, { status: 500 });
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 300 });
        const found = (list?.users ?? []).find((u) => u.email === email);
        if (!found) return NextResponse.json({ error: 'user exists but not findable' }, { status: 500 });
        userId = found.id;
      } else {
        userId = created!.user!.id;
      }
    }

    if (namkhan) await admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: NAMKHAN_PID, p_active: true, p_role: 'staff' });
    if (donna)   await admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: DONNA_PID,   p_active: true, p_role: 'staff' });
    if (holding) await admin.rpc('fn_user_grant_holding',  { p_auth_user_id: userId, p_email: email, p_active: true, p_role: 'member' });

    return NextResponse.json({
      ok: true,
      user_id: userId,
      invite: inviteInfo,
      email_fired: emailFired,
      action_link: actionLink,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
