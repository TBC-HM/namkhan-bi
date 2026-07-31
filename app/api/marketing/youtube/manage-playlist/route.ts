// app/api/marketing/youtube/manage-playlist/route.ts
// CRUD for YouTube playlists + playlist item membership.
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { createPlaylist, updatePlaylist, deletePlaylist, addVideoToPlaylist, removeVideoFromPlaylist, isErr } from '@/lib/youtube/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAMKHAN = 260955;

async function getToken() {
  const sb = getSupabaseAdmin();
  try { await sb.rpc('fn_yt_refresh_if_expired', { p_property_id: NAMKHAN }); } catch { /* silent */ }
  return getFreshAccessToken(NAMKHAN);
}

// GET ?action=list — returns all channel playlists as {id, title}[]
// GET ?action=get_items&playlist_id=X — returns video IDs in the playlist for merge
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const tok = await getToken();
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });

  if (action === 'list') {
    try {
      const all: Array<{ id: string; title: string }> = [];
      let pageToken: string | undefined;
      do {
        const qs = new URLSearchParams({ part: 'id,snippet', channelId: tok.channel_id!, maxResults: '50' });
        if (pageToken) qs.set('pageToken', pageToken);
        const r = await fetch('https://www.googleapis.com/youtube/v3/playlists?' + qs, {
          headers: { Authorization: 'Bearer ' + tok.access_token },
        });
        const j = await r.json() as { items?: Array<{ id: string; snippet?: { title?: string } }>; nextPageToken?: string };
        for (const item of j.items ?? []) all.push({ id: item.id, title: item.snippet?.title ?? item.id });
        pageToken = j.nextPageToken;
      } while (pageToken);
      return NextResponse.json({ ok: true, playlists: all });
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch_failed' }, { status: 502 });
    }
  }

  const playlistId = url.searchParams.get('playlist_id') ?? '';
  if (action !== 'get_items' || !playlistId) {
    return NextResponse.json({ error: 'use ?action=list or ?action=get_items&playlist_id=PL...' }, { status: 400 });
  }
  try {
    const all: string[] = [];
    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({ part: 'snippet', playlistId, maxResults: '50' });
      if (pageToken) qs.set('pageToken', pageToken);
      const r = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?' + qs, {
        headers: { Authorization: 'Bearer ' + tok.access_token },
      });
      const j = await r.json() as { items?: Array<{ snippet: { resourceId: { videoId: string } } }>; nextPageToken?: string };
      for (const item of j.items ?? []) all.push(item.snippet.resourceId.videoId);
      pageToken = j.nextPageToken;
    } while (pageToken);
    return NextResponse.json({ ok: true, video_ids: all, count: all.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch_failed' }, { status: 502 });
  }
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
    if (isErr(r)) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
    return NextResponse.json({ ok: true, ...r.data });
  }
  if (action === 'add_video') {
    const r = await addVideoToPlaylist(at, String(body.playlist_id ?? ''), String(body.video_id ?? ''),
      body.position !== undefined ? Number(body.position) : undefined);
    if (isErr(r)) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
    return NextResponse.json({ ok: true, ...r.data });
  }
  if (action === 'remove_video') {
    const r = await removeVideoFromPlaylist(at, String(body.playlist_item_id ?? ''));
    if (isErr(r)) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
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
  if (isErr(r)) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
  return NextResponse.json({ ok: true, ...r.data });
}

export async function DELETE(req: Request) {
  const body = await req.json() as Record<string, unknown>;
  const tok = await getToken();
  if (!tok.ok || !tok.access_token) return NextResponse.json({ error: 'yt_token_missing' }, { status: 401 });
  const r = await deletePlaylist(tok.access_token, String(body.playlist_id ?? ''));
  if (isErr(r)) return NextResponse.json({ error: r.error, detail: r.detail }, { status: 502 });
  return NextResponse.json({ ok: true });
}
