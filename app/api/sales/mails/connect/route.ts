// app/api/sales/mails/connect/route.ts
// Filter-mode variant: nothing to connect per-mailbox anymore.
// If user has no personal Gmail connection yet, redirect to /settings/gmail.
// Otherwise redirect straight to /sales/mails.
// PBS 2026-08-14: now enforces fn_shared_mailbox_list_active membership.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listUserMailboxes } from '@/lib/sharedGmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const user = await getCurrentAuthUser();
  const next = '/sales/mails';
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=' + encodeURIComponent(next), _req.url));
  }

  // Check if user has Gmail connection
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('v_user_gmail_connections')
    .select('active')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!data || !data.active) {
    return NextResponse.redirect(new URL('/settings/gmail?next=' + encodeURIComponent(next), _req.url));
  }

  // Permission gate: user must have access to at least one mailbox
  const allowedMailboxes = await listUserMailboxes(user.id);
  if (allowedMailboxes.length === 0) {
    return NextResponse.redirect(new URL('/sales/mails?error=no_mailbox_access', _req.url));
  }

  return NextResponse.redirect(new URL(next, _req.url));
}
