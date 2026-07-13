// app/api/user/gmail/disconnect/route.ts
import { NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc('fn_gmail_disconnect', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: 'disconnect_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
