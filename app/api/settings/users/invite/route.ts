// app/api/settings/users/invite/route.ts
// PBS 2026-07-09 v4: send invite/reset via our own Resend edge fn (send-report-email,
// verify_jwt=false, uses RESEND_API_KEY + NEWSLETTER_FROM_EMAIL). Real deliverable
// email. action_link is ALSO returned so UI can copy/paste as belt-and-braces fallback.
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

async function sendInviteMail(to: string, actionLink: string, origin: string): Promise<{ ok: boolean; detail?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const html = `
    <p>Hi,</p>
    <p>You have been invited to <strong>namkhan-bi</strong>. Click below to set your password and log in:</p>
    <p><a href="${escapeAttr(actionLink)}" style="display:inline-block;padding:10px 18px;background:#084838;color:#FFFFFF;text-decoration:none;border-radius:4px;font-weight:600;">Set my password</a></p>
    <p style="font-size:12px;color:#5A5A5A;">Or paste this link: ${escapeHtml(actionLink)}</p>
    <p style="font-size:12px;color:#5A5A5A;">This link expires in ~1 hour.</p>
    <p style="font-size:12px;color:#5A5A5A;">Home: <a href="${escapeAttr(origin)}">${escapeHtml(origin)}</a></p>
  `;
  try {
    const res = await fetch(`${url}/functions/v1/send-report-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: 'Namkhan BI — set your password',
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
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/account/password`;

    const admin = getSupabaseAdmin();

    // Ensure the user exists (invite creates, or fall through to reset if already there).
    let mode: 'invite_sent' | 'reset_sent' | 'error' = 'error';
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!invErr) mode = 'invite_sent';
    else if (/already|registered/i.test(invErr.message)) mode = 'reset_sent';
    else return NextResponse.json({ error: invErr.message }, { status: 500 });

    // Generate the action_link (SMTP-independent — always works).
    let actionLink: string | null = null;
    try {
      const { data: link } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo },
      });
      actionLink = link?.properties?.action_link ?? null;
    } catch { actionLink = null; }

    // Fire the mail via our Resend edge fn (real delivery).
    let emailFired = false;
    let mailerNote: string | null = null;
    if (actionLink) {
      const mail = await sendInviteMail(email, actionLink, origin);
      emailFired = mail.ok;
      mailerNote = mail.detail ?? null;
    }

    return NextResponse.json({
      ok: true,
      mode,
      email_fired: emailFired,
      mailer_note: mailerNote,
      action_link: actionLink,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
