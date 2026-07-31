// app/api/marketing/youtube/delete-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function DELETE(req: NextRequest) {
  let video_id: string;
  try { ({ video_id } = await req.json()); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }
  if (!video_id) return NextResponse.json({ error: 'missing video_id' }, { status: 400 });

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
    const body = await res.text().catch(() => '');
    return NextResponse.json({ ok: false, error: `youtube_api_${res.status}`, detail: body.slice(0, 200) }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
