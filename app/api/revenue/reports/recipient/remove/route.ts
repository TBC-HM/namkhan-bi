import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body { id?: number }

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.rpc('fn_report_recipient_remove', { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ removed: Boolean(data), id });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
