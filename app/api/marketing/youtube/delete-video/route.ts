// app/api/marketing/youtube/delete-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null) as { video_id?: string } | null;
  if (!body?.video_id) return NextResponse.json({ error: 'missing video_id' }, { status: 400 });
  const video_id = body.video_id;

  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'no_token' }, { status: 401 });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(video_id)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${tok.access_token}` } }
  );

  if (res.status === 403) return NextResponse.json({ error: 'not_owned' }, { status: 403 });
  if (res.status !== 204 && !res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json({ ok: false, error: `youtube_api_${res.status}`, detail: detail.slice(0, 200) }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
