// app/api/settings/users/create/route.ts
// PBS 2026-07-09 v2:
//   - inviteUserByEmail (creates user + sends invite email in one call)
//   - admin gate requires holding_role IN (owner, admin) — plain member can't manage
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

    // Path A: invite (creates user + sends invite email via Supabase Auth)
    // Path B: if user already exists, we just add grants + send reset link
    let userId: string;
    let inviteInfo: string | null = null;

    if (sendInvite) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo: `${origin}/account/password`,
      });
      if (invErr) {
        if (!/already|registered/i.test(invErr.message)) {
          return NextResponse.json({ error: `invite failed: ${invErr.message}` }, { status: 500 });
        }
        // User exists — fall through to lookup + resetPasswordForEmail
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 300 });
        const found = (list?.users ?? []).find((u) => u.email === email);
        if (!found) return NextResponse.json({ error: 'user exists but not findable' }, { status: 500 });
        userId = found.id;
        const anon = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { cookies: { getAll: () => [], setAll: () => {} } },
        );
        const { error: rErr } = await anon.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/account/password`,
        });
        if (rErr) inviteInfo = `existed; reset email failed: ${rErr.message}`;
        else inviteInfo = 'existed; reset link sent';
      } else {
        userId = inv!.user!.id;
        inviteInfo = 'invite sent';
      }
    } else {
      // No invite requested → still need a user row. createUser only, no email.
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

    // Grants (sequential to keep TypeScript simple).
    if (namkhan) await admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: NAMKHAN_PID, p_active: true, p_role: 'staff' });
    if (donna)   await admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: DONNA_PID,   p_active: true, p_role: 'staff' });
    if (holding) await admin.rpc('fn_user_grant_holding',  { p_auth_user_id: userId, p_email: email, p_active: true, p_role: 'member' });

    return NextResponse.json({ ok: true, user_id: userId, invite: inviteInfo });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
