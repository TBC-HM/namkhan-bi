// app/api/user/gmail/status/route.ts
// GET — lightweight connection check for the user dropdown badge.
// Returns { connected: boolean, address?: string }.
import { NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ connected: false }, { status: 200 });
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('v_user_gmail_connections')
      .select('gmail_address, active')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data || !data.active) return NextResponse.json({ connected: false });
    return NextResponse.json({ connected: true, address: (data as { gmail_address: string }).gmail_address });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
