// app/api/marketing/subscribers/update/route.ts
// POST { id, action: 'update'|'unsubscribe'|'delete'|'set_tags'|'add_tag'|'remove_tag', tags?, tag?, name?, notes? }
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.id) return NextResponse.json({ ok: false, error: 'id_required' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_subscriber_update', { p: b });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
