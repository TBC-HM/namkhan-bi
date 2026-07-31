// app/api/marketing/youtube/log-action/route.ts
// Persists a completed YouTube action (delete/rename/apply/merge) to
// public.yt_action_log so state survives page refreshes and new audit runs.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      entity_type: 'playlist' | 'video';
      entity_id: string;
      action: 'deleted' | 'renamed' | 'applied' | 'merged' | 'kept';
      new_value?: string | null;
    };
    if (!body.entity_type || !body.entity_id || !body.action) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.from('yt_action_log').insert({
      property_id: 260955,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      action: body.action,
      new_value: body.new_value ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}

export async function GET() {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from('yt_action_log')
    .select('entity_type, entity_id, action, new_value, created_at')
    .eq('property_id', 260955)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}
