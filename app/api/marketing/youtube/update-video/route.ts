// app/api/marketing/youtube/update-video/route.ts
// Push audit suggestions (title / description / tags) to YouTube via videos.update.
// GET existing snippet first so we don't wipe categoryId or other fields.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { updateVideoMetadata, isErr } from '@/lib/youtube/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

export async function POST(req: Request) {
  const { video_id, title, description, tags } = await req.json() as {
    video_id: string;
    title?: string;
    description?: string;
    tags?: string[];
  };
  if (!video_id) return NextResponse.json({ error: 'video_id required' }, { status: 400 });
  if (!title && !description && !tags) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

  const sb = getSupabaseAdmin();
  // refresh token
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }
  const tok = await getFreshAccessToken(NAMKHAN);
  if (!tok.ok || !tok.access_token) {
    return NextResponse.json({ error: 'yt_token_missing', detail: 'Reconnect YouTube in Settings' }, { status: 401 });
  }

  const result = await updateVideoMetadata(tok.access_token, video_id, {
    ...(title       !== undefined ? { title }       : {}),
    ...(description !== undefined ? { description } : {}),
    ...(tags        !== undefined ? { tags }        : {}),
  });

  if (isErr(result)) return NextResponse.json({ error: result.error, detail: result.detail }, { status: 502 });
  return NextResponse.json({ ok: true, video_id });
}
