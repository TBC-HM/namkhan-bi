// app/api/marketing/youtube/delete-video/route.ts
// DELETE a video from YouTube. Only works for videos owned by the channel.
// Third-party videos in playlists must be removed via manage-playlist instead.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function DELETE(req: Request) {
  const body = await req.json() as { video_id?: string };
  const videoId = body.video_id?.trim();
  if (!videoId) return NextResponse.json({ error: 'video_id required' }, { status: 400 });

  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }

  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });

  const res = await fetch('https://www.googleapis.com/youtube/v3/videos?id=' + encodeURIComponent(videoId), {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + tok.access_token },
  });

  // YouTube returns 204 on success, 403 if not owned
  if (res.status === 204 || res.ok) {
    return NextResponse.json({ ok: true, deleted: true });
  }
  if (res.status === 403) {
    return NextResponse.json({
      ok: false, error: 'not_owned',
      detail: 'This video is not owned by your channel. Find which playlist it is in and use "Remove from playlist" instead.',
    }, { status: 403 });
  }
  const errText = await res.text().catch(() => '');
  return NextResponse.json({ ok: false, error: 'yt_error', detail: errText, status: res.status }, { status: 502 });
}
