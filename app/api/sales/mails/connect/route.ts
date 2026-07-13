// app/api/sales/mails/connect/route.ts
// Filter-mode variant: nothing to connect per-mailbox anymore.
// If user has no personal Gmail connection yet, redirect to /settings/gmail.
// Otherwise redirect straight to /sales/mails.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const user = await getCurrentAuthUser();
  const next = '/sales/mails';
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent(next), _req.url));
  }
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('v_user_gmail_connections')
    .select('active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data || !data.active) {
    return NextResponse.redirect(new URL('/settings/gmail?next=' + encodeURIComponent(next), _req.url));
  }
  return NextResponse.redirect(new URL(next, _req.url));
}
