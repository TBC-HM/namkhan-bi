// app/api/marketing/subscribers/issue-tokens/route.ts
// POST { ids: number[] }  → issues confirm_token for each pending row, returns list.
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAuthUser } from '@/lib/userGmail';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentAuthUser();
  if (!user) return NextResponse.json({ ok: false, error: 'not_signed_in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { ids?: number[] };
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('fn_subscriber_issue_tokens', { p: { ids: b.ids ?? [] } });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
