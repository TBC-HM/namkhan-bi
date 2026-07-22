// app/api/marketing/audience/group-voice-save/route.ts
// PBS 2026-07-22 · Save per-group voice profile (voice_type + voice_summary).
// The propose-one route reads these from v_subscriber_groups so Claude knows
// how to speak to each audience.

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = String(body?.slug ?? '').trim();
  const voice_type = String(body?.voice_type ?? '').trim();
  const voice_summary = String(body?.voice_summary ?? '');

  if (!slug) return NextResponse.json({ ok: false, error: 'slug required' }, { status: 400 });
  if (!['b2c','b2b','mixed'].includes(voice_type)) {
    return NextResponse.json({ ok: false, error: 'voice_type must be b2c | b2b | mixed' }, { status: 400 });
  }
  if (voice_summary.length > 2000) {
    return NextResponse.json({ ok: false, error: 'voice_summary too long (max 2000)' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_group_voice_upsert', {
    p_slug: slug,
    p_voice_type: voice_type,
    p_voice_summary: voice_summary,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, slug: data });
}
