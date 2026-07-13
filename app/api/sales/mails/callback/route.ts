// app/api/sales/mails/callback/route.ts
// GET → OAuth callback for shared mailbox.
// Verifies granted email == expected mailbox_address before persisting.
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, fetchUserinfoEmail, verifyState } from '@/lib/sharedGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function backTo(base: string, params: Record<string, string>): string {
  const u = new URL(base, 'https://namkhan-bi.vercel.app');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.pathname + '?' + u.searchParams.toString();
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const stateRaw = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(new URL(backTo('/sales/mails', { error: oauthError }), req.url));
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(new URL(backTo('/sales/mails', { error: 'missing_code_or_state' }), req.url));
  }
  const state = verifyState(stateRaw);
  if (!state) {
    return NextResponse.redirect(new URL(backTo('/sales/mails', { error: 'invalid_state' }), req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      // Google will omit refresh_token if the account has already granted
      // consent for this client and prompt=consent wasn't honored. Force
      // re-prompt on retry by asking the user to disconnect first.
      return NextResponse.redirect(new URL(backTo('/sales/mails', { error: 'no_refresh_token' }), req.url));
    }
    const grantedEmail = (await fetchUserinfoEmail(tokens.access_token)).toLowerCase();
    if (grantedEmail !== state.mailbox) {
      return NextResponse.redirect(new URL(
        backTo('/sales/mails', { error: 'wrong_mailbox_' + grantedEmail }),
        req.url,
      ));
    }
    if (!grantedEmail.endsWith('@thenamkhan.com')) {
      return NextResponse.redirect(new URL(backTo('/sales/mails', { error: 'domain_not_allowed' }), req.url));
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.rpc('fn_shared_mailbox_connect_finalize', {
      p_mailbox: grantedEmail,
      p_label: state.label,
      p_access: tokens.access_token,
      p_refresh: tokens.refresh_token,
      p_scope: tokens.scope,
      p_expires_seconds: tokens.expires_in ?? 3600,
      p_connected_by: state.connected_by,
    });
    if (error) {
      return NextResponse.redirect(new URL(
        backTo('/sales/mails', { error: 'persist_failed_' + error.message.slice(0, 80) }),
        req.url,
      ));
    }
    return NextResponse.redirect(new URL(backTo('/sales/mails', { connected: grantedEmail }), req.url));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown';
    return NextResponse.redirect(new URL(
      backTo('/sales/mails', { error: 'callback_failed_' + msg.slice(0, 80) }),
      req.url,
    ));
  }
}
