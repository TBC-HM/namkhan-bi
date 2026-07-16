// app/api/marketing/subscribers/bulk/route.ts
// POST { ids: number[], action: 'delete'|'add_tag'|'remove_tag'|'unsubscribe', tag? }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_subscriber_bulk_action', { p: b });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
