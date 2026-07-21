// app/api/marketing/audience/blocklist-apply/route.ts
// POST — actually delete subscribers matching a blocklist rule.
// PBS 2026-07-21.
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let sb;
  try { sb = getSupabaseAdmin(); }
  catch (e: any) { return NextResponse.json({ ok: false, error: e.message }, { status: 500 }); }

  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  const { data, error } = await sb.rpc('fn_blocklist_apply', { p_id: id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
  const res = data as any;
  if (!res?.ok) return NextResponse.json({ ok: false, error: res?.error ?? 'apply_failed' }, { status: 400 });
  return NextResponse.json({ ok: true, deleted: res.deleted });
}
