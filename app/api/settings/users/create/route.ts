// app/api/settings/users/create/route.ts
// PBS 2026-07-09: create auth.users + tenancy grants + optional invite.
// Admin-only — checks caller is holding role.
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
      getAll: () => {
        const raw = req.headers.get('cookie') ?? '';
        return raw.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
          const [name, ...rest] = s.split('=');
          return { name, value: rest.join('=') };
        });
      },
      setAll: () => {},
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, res: NextResponse.json({ error: 'auth required' }, { status: 401 }) };
  // Check holding role via the flat view.
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('v_holding_users_flat').select('role, status').eq('auth_user_id', user.id).maybeSingle();
  if (!data || data.status !== 'active') return { ok: false, res: NextResponse.json({ error: 'holding admin required' }, { status: 403 }) };
  return { ok: true };
}

export async function POST(req: Request) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;
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
    // Create user (idempotent: return existing if email exists)
    let userId: string;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: name },
    });
    if (cErr) {
      if (!/already/i.test(cErr.message)) return NextResponse.json({ error: cErr.message }, { status: 500 });
      // Fetch existing
      const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
      const found = (list?.users ?? []).find((u) => u.email === email);
      if (!found) return NextResponse.json({ error: 'user exists but not findable' }, { status: 500 });
      userId = found.id;
    } else {
      userId = created!.user!.id;
    }

    // Grant scopes
    const grants: Promise<unknown>[] = [];
    if (namkhan) grants.push(admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: NAMKHAN_PID, p_active: true }));
    if (donna)   grants.push(admin.rpc('fn_user_grant_property', { p_user_id: userId, p_email: email, p_property_id: DONNA_PID,   p_active: true }));
    if (holding) grants.push(admin.rpc('fn_user_grant_holding',  { p_auth_user_id: userId, p_email: email, p_active: true }));
    await Promise.all(grants);

    // Optional: send invite (password-reset flow, no password set yet).
    if (sendInvite) {
      const origin = new URL(req.url).origin;
      const { error: iErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${origin}/auth/callback?next=/account/password` },
      });
      if (iErr) return NextResponse.json({ ok: true, invite_error: iErr.message, user_id: userId });
    }
    return NextResponse.json({ ok: true, user_id: userId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
