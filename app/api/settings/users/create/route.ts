// app/api/settings/users/create/route.ts
// PBS 2026-07-09 v4:
//   - inviteUserByEmail (creates user + attempts Supabase Auth SMTP delivery)
//   - Generates action_link via admin.generateLink
//   - ALSO fires our own Resend email via the send-report-email edge fn
//     (verify_jwt=false, uses RESEND_API_KEY + NEWSLETTER_FROM_EMAIL). This is
//     the authoritative delivery path — Supabase built-in SMTP is unconfigured.
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

async function sendInviteMail(to: string, name: string, actionLink: string, origin: string): Promise<{ ok: boolean; detail?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const html = `
    <p>Hi ${escapeHtml(name || to)},</p>
    <p>You have been invited to <strong>namkhan-bi</strong>. Click below to set your password and log in:</p>
    <p><a href="${escapeAttr(actionLink)}" style="display:inline-block;padding:10px 18px;background:#084838;color:#FFFFFF;text-decoration:none;border-radius:4px;font-weight:600;">Set my password</a></p>
    <p style="font-size:12px;color:#5A5A5A;">Or paste this link: ${escapeHtml(actionLink)}</p>
    <p style="font-size:12px;color:#5A5A5A;">This link expires in ~1 hour. If it does, an admin can send a new one.</p>
    <p style="font-size:12px;color:#5A5A5A;">Home: <a href="${escapeAttr(origin)}">${escapeHtml(origin)}</a></p>
  `;
  try {
    const res = await fetch(`${url}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: 'Welcome to Namkhan BI — set your password',
        html,
        from_label: 'Namkhan BI',
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, detail: `resend_${res.status}: ${JSON.stringify(j)}` };
    return { ok: true, detail: j?.id ? `resend_id=${j.id}` : 'sent' };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
function escapeAttr(s: string): string { return escapeHtml(s); }

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
    let mailerNote: string | null = null;

    if (sendInvite) {
      const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: name },
        redirectTo,
      });
      if (invErr) {
        if (!/already|registered/i.test(invErr.message)) {
          return NextResponse.json({ error: `invite failed: ${invErr.message}` }, { status: 500 });
        }
        // Existing user — look up + fall through to resend flow.
        const { data: list } = await admin.auth.admin.listUsers({ perPage: 300 });
        const found = (list?.users ?? []).find((u) => u.email === email);
        if (!found) return NextResponse.json({ error: 'user exists but not findable' }, { status: 500 });
        userId = found.id;
        inviteInfo = 'existed; sending recovery link via Resend';
      } else {
        userId = inv!.user!.id;
        inviteInfo = 'user created';
      }

      // Generate the action_link (SMTP-independent — always works).
      try {
        const { data: link } = await admin.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo },
        });
        actionLink = link?.properties?.action_link ?? null;
      } catch { actionLink = null; }

      // Send the mail ourselves via send-report-email (Resend).
      if (actionLink) {
        const mail = await sendInviteMail(email, name, actionLink, origin);
        emailFired = mail.ok;
        mailerNote = mail.detail ?? null;
      }
    } else {
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
      mailer_note: mailerNote,
      action_link: actionLink,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
