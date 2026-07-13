// app/api/user/gmail/callback/route.ts
// Google OAuth callback: exchanges the code, fetches the connected Gmail
// address via userinfo, then persists via fn_gmail_connect_finalize.
// Domain guard for @thenamkhan.com is enforced INSIDE the RPC — we surface
// it back to the user as ?error=domain_not_allowed.
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, fetchUserinfoEmail } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function base() {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://namkhan-bi.vercel.app';
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state');
  const err = params.get('error');

  if (err) return NextResponse.redirect(new URL('/settings/gmail?error=' + encodeURIComponent(err), base()));
  if (!code || !state) return NextResponse.redirect(new URL('/settings/gmail?error=missing_code_or_state', base()));

  try {
    const tokens = await exchangeCode(code);
    const gmail = await fetchUserinfoEmail(tokens.access_token);
    const admin = getSupabaseAdmin();
    const { error: rpcErr } = await admin.rpc('fn_gmail_connect_finalize', {
      p_user_id: state,
      p_gmail: gmail,
      p_access: tokens.access_token,
      p_refresh: tokens.refresh_token ?? '',
      p_scope: tokens.scope,
      p_expires_seconds: tokens.expires_in,
    });
    if (rpcErr) {
      const reason = rpcErr.message.includes('domain_not_allowed') ? 'domain_not_allowed' : 'save_failed';
      return NextResponse.redirect(new URL('/settings/gmail?error=' + reason + '&detail=' + encodeURIComponent(rpcErr.message), base()));
    }
    return NextResponse.redirect(new URL('/settings/gmail?connected=1', base()));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.redirect(new URL('/settings/gmail?error=callback_exception&detail=' + encodeURIComponent(msg), base()));
  }
}
