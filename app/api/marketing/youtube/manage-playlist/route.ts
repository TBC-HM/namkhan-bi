// app/api/marketing/youtube/manage-playlist/route.ts
// CRUD for YouTube playlists + playlist item membership.
// POST   body: { action: 'create', title, description?, privacy? }
// PUT    body: { action: 'update', playlist_id, title?, description? }
// DELETE body: { action: 'delete', playlist_id }
// POST   body: { action: 'add_video',    playlist_id, video_id, position? }
// POST   body: { action: 'remove_video', playlist_item_id }
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { createPlaylist, updatePlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist } from '@/lib/youtube/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

async function getToken() {
  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }
  return getFreshAccessToken(NAMKHAN);
}

export async function POST(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;
  const tok = await getToken();
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });
  const at = tok.access_token;

  if (action === 'create') {
    const r = await createPlaylist(at, {
      title: String(body.title ?? ''),
      description: body.description ? String(body.description) : undefined,
      privacyStatus: (body.privacy as 'public' | 'unlisted' | 'private') ?? 'public',
    });
    if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
    return NextResponse.json({ ok: true, ...r.data });
  }
  if (action === 'add_video') {
    const r = await addVideoToPlaylist(at, String(body.playlist_id ?? ''), String(body.video_id ?? ''),
      body.position !== undefined ? Number(body.position) : undefined);
    if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
    return NextResponse.json({ ok: true, ...r.data });
  }
  if (action === 'remove_video') {
    const r = await removeVideoFromPlaylist(at, String(body.playlist_item_id ?? ''));
    if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
}

export async function PUT(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const tok = await getToken();
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });
  const r = await updatePlaylist(tok.access_token, String(body.playlist_id ?? ''), {
    ...(body.title       ? { title:       String(body.title) }       : {}),
    ...(body.description ? { description: String(body.description) } : {}),
  });
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
  return NextResponse.json({ ok: true, ...r.data });
}

export async function DELETE(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const tok = await getToken();
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });
  const r = await deletePlaylist(tok.access_token, String(body.playlist_id ?? ''));
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
  return NextResponse.json({ ok: true });
}
