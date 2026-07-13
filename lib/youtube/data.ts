// lib/youtube/data.ts
// PBS 2026-07-11 pm — Thin fetch wrappers around YouTube Data API v3.
// Every function accepts an access token and returns a discriminated union
// { ok:true, ... } | { ok:false, error, detail } — never throws.
//
// PBS 2026-07-11 evening — added `isErr<T>` user-defined type predicate so
// callers narrow reliably (TS was failing to narrow the `Ok<T> | ErrShape`
// union at return sites when Ok was a bare type alias, breaking CI).
//
// PBS 2026-07-13 — fetchRecentVideos now paginates: `max` accepted up to 200.
//   Search API caps 50/page → we walk pageToken; Videos API caps 50 IDs/call
//   → we batch. Quota at max=200: search(4) + videos(4) = ~408 units (still
//   under 10 000/day). Callers can request 24 (dashboard uploads list) or
//   200 (deep aggregates for heatmaps + ranking).
//
// Auth: Authorization: Bearer <accessToken>

const API = 'https://www.googleapis.com/youtube/v3';

export interface Thumbnail { url: string; width?: number; height?: number }
export interface Thumbnails { default?: Thumbnail; medium?: Thumbnail; high?: Thumbnail; standard?: Thumbnail; maxres?: Thumbnail }

export interface ChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl: string | null;
  country: string | null;
  publishedAt: string | null;
  thumbnails: Thumbnails;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  keywords: string | null;
  defaultLanguage: string | null;
}

export interface VideoItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnails: Thumbnails;
  duration: string; // ISO 8601, eg PT1M30S
  views: number;
  likes: number;
  comments: number;
}

export interface CommentItem {
  id: string;
  videoId: string;
  textOriginal: string;
  authorDisplayName: string;
  authorProfileImageUrl: string | null;
  publishedAt: string;
  likeCount: number;
  canReply: boolean;
}

export interface ErrShape { ok: false; error: string; detail?: string }
export interface Ok<T> { ok: true; data: T }
export type YtResult<T> = Ok<T> | ErrShape;

/** User-defined type predicate — narrows a YtResult<T> to ErrShape reliably. */
export function isErr<T>(r: YtResult<T>): r is ErrShape {
  return r.ok === false;
}

async function ytFetch<T>(url: string, accessToken: string): Promise<YtResult<T>> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 240);
    return { ok: false, error: `youtube_api_${res.status}`, detail };
  }
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) return { ok: false, error: 'youtube_api_bad_json' };
  return { ok: true, data: json };
}

// ---- channel ---------------------------------------------------------------

interface RawChannelResp {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      publishedAt?: string;
      country?: string;
      thumbnails?: Thumbnails;
    };
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    brandingSettings?: { channel?: { keywords?: string; defaultLanguage?: string } };
  }>;
}

export async function fetchChannel(accessToken: string, channelId: string): Promise<YtResult<ChannelInfo>> {
  const r = await ytFetch<RawChannelResp>(
    `${API}/channels?part=snippet,statistics,brandingSettings&id=${encodeURIComponent(channelId)}`,
    accessToken,
  );
  if (isErr(r)) return { ok: false, error: r.error, detail: r.detail };
  const it = r.data.items?.[0];
  if (!it) return { ok: false, error: 'no_channel_items' };
  const info: ChannelInfo = {
    id:              it.id,
    title:           it.snippet?.title ?? '(untitled)',
    description:     it.snippet?.description ?? '',
    customUrl:       it.snippet?.customUrl ?? null,
    country:         it.snippet?.country ?? null,
    publishedAt:     it.snippet?.publishedAt ?? null,
    thumbnails:      it.snippet?.thumbnails ?? {},
    subscriberCount: Number(it.statistics?.subscriberCount ?? 0),
    viewCount:       Number(it.statistics?.viewCount ?? 0),
    videoCount:      Number(it.statistics?.videoCount ?? 0),
    keywords:        it.brandingSettings?.channel?.keywords ?? null,
    defaultLanguage: it.brandingSettings?.channel?.defaultLanguage ?? null,
  };
  return { ok: true, data: info };
}

// ---- recent videos (paginated up to `max`, cap 200) -----------------------

interface SearchListResp {
  items?: Array<{ id?: { videoId?: string } }>;
  nextPageToken?: string;
}
interface VideosListResp {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: Thumbnails;
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

export async function fetchRecentVideos(
  accessToken: string,
  channelId: string,
  max = 24,
): Promise<YtResult<VideoItem[]>> {
  const cap = Math.max(1, Math.min(max, 200));
  const ids: string[] = [];
  let pageToken: string | null = null;

  // Search API caps maxResults=50; paginate via pageToken until we reach `cap`
  // or exhaust results.
  while (ids.length < cap) {
    const perPage = Math.min(50, cap - ids.length);
    const params = new URLSearchParams({
      part: 'id',
      channelId,
      order: 'date',
      type: 'video',
      maxResults: String(perPage),
    });
    if (pageToken) params.set('pageToken', pageToken);
    const s = await ytFetch<SearchListResp>(`${API}/search?${params.toString()}`, accessToken);
    if (isErr(s)) return { ok: false, error: s.error, detail: s.detail };
    for (const it of s.data.items ?? []) {
      const vid = it.id?.videoId;
      if (vid) ids.push(vid);
    }
    if (!s.data.nextPageToken) break;
    pageToken = s.data.nextPageToken;
  }

  if (ids.length === 0) return { ok: true, data: [] };

  // Videos API caps 50 IDs per call — batch.
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));

  const all: VideoItem[] = [];
  for (const batch of batches) {
    const vidUrl = `${API}/videos?part=snippet,statistics,contentDetails&id=${batch.join(',')}`;
    const v = await ytFetch<VideosListResp>(vidUrl, accessToken);
    if (isErr(v)) return { ok: false, error: v.error, detail: v.detail };
    for (const it of v.data.items ?? []) {
      all.push({
        id:          it.id,
        title:       it.snippet?.title ?? '(untitled)',
        description: it.snippet?.description ?? '',
        publishedAt: it.snippet?.publishedAt ?? '',
        thumbnails:  it.snippet?.thumbnails ?? {},
        duration:    it.contentDetails?.duration ?? 'PT0S',
        views:       Number(it.statistics?.viewCount ?? 0),
        likes:       Number(it.statistics?.likeCount ?? 0),
        comments:    Number(it.statistics?.commentCount ?? 0),
      });
    }
  }

  // Preserve original search order (most recent first)
  const idx = new Map(ids.map((x, i) => [x, i]));
  all.sort((a, b) => (idx.get(a.id) ?? 0) - (idx.get(b.id) ?? 0));

  return { ok: true, data: all };
}

// ---- recent comments -------------------------------------------------------

interface CommentThreadsResp {
  items?: Array<{
    id: string;
    snippet?: {
      videoId?: string;
      canReply?: boolean;
      topLevelComment?: {
        id: string;
        snippet?: {
          textOriginal?: string;
          textDisplay?: string;
          authorDisplayName?: string;
          authorProfileImageUrl?: string;
          publishedAt?: string;
          likeCount?: number;
        };
      };
    };
  }>;
}

export async function fetchRecentComments(
  accessToken: string,
  channelId: string,
  max = 20,
): Promise<YtResult<CommentItem[]>> {
  const url = `${API}/commentThreads?part=snippet&allThreadsRelatedToChannelId=${encodeURIComponent(channelId)}&maxResults=${max}&order=time`;
  const r = await ytFetch<CommentThreadsResp>(url, accessToken);
  if (isErr(r)) return { ok: false, error: r.error, detail: r.detail };

  const mapped: CommentItem[] = (r.data.items ?? []).map((th) => {
    const top = th.snippet?.topLevelComment;
    return {
      id:                    top?.id ?? th.id,
      videoId:               th.snippet?.videoId ?? '',
      textOriginal:          top?.snippet?.textOriginal ?? top?.snippet?.textDisplay ?? '',
      authorDisplayName:     top?.snippet?.authorDisplayName ?? '',
      authorProfileImageUrl: top?.snippet?.authorProfileImageUrl ?? null,
      publishedAt:           top?.snippet?.publishedAt ?? '',
      likeCount:             Number(top?.snippet?.likeCount ?? 0),
      canReply:              Boolean(th.snippet?.canReply),
    };
  });

  return { ok: true, data: mapped };
}

// ---- channel playlists -----------------------------------------------------

export interface PlaylistItem {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  publishedAt: string;
  updatedAt: string | null;
  privacyStatus: string | null;
  thumbnails: Thumbnails;
}

interface PlaylistsListResp {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: Thumbnails;
    };
    contentDetails?: { itemCount?: number };
    status?: { privacyStatus?: string };
  }>;
  nextPageToken?: string;
}

export async function fetchChannelPlaylists(
  accessToken: string,
  channelId: string,
  max = 50,
): Promise<YtResult<PlaylistItem[]>> {
  const url = `${API}/playlists?part=snippet,contentDetails,status&channelId=${encodeURIComponent(channelId)}&maxResults=${Math.min(max, 50)}`;
  const r = await ytFetch<PlaylistsListResp>(url, accessToken);
  if (isErr(r)) return { ok: false, error: r.error, detail: r.detail };
  const mapped: PlaylistItem[] = (r.data.items ?? []).map((it) => ({
    id:            it.id,
    title:         it.snippet?.title ?? '(untitled)',
    description:   it.snippet?.description ?? '',
    itemCount:     Number(it.contentDetails?.itemCount ?? 0),
    publishedAt:   it.snippet?.publishedAt ?? '',
    updatedAt:     null,
    privacyStatus: it.status?.privacyStatus ?? null,
    thumbnails:    it.snippet?.thumbnails ?? {},
  }));
  mapped.sort((a, b) => b.itemCount - a.itemCount);
  return { ok: true, data: mapped };
}

// ---- playlist items --------------------------------------------------------

export interface PlaylistVideo {
  videoId:      string;
  title:        string;
  description:  string;
  publishedAt:  string;
  thumbnails:   Thumbnails;
  position:     number;
  channelTitle: string;
  views?:       number;
  likes?:       number;
  comments?:    number;
  duration?:    string;
}

interface PlaylistItemsResp {
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      position?: number;
      channelTitle?: string;
      thumbnails?: Thumbnails;
      resourceId?: { videoId?: string };
    };
  }>;
  nextPageToken?: string;
}

export async function fetchPlaylistItemsWithStats(
  accessToken: string,
  playlistId: string,
  max = 50,
): Promise<YtResult<PlaylistVideo[]>> {
  const listUrl = `${API}/playlistItems?part=snippet&playlistId=${encodeURIComponent(playlistId)}&maxResults=${Math.min(max, 50)}`;
  const list = await ytFetch<PlaylistItemsResp>(listUrl, accessToken);
  if (isErr(list)) return { ok: false, error: list.error, detail: list.detail };
  const items: PlaylistVideo[] = (list.data.items ?? [])
    .filter((it) => it.snippet?.resourceId?.videoId)
    .map((it) => ({
      videoId:      it.snippet!.resourceId!.videoId!,
      title:        it.snippet?.title ?? '(untitled)',
      description:  it.snippet?.description ?? '',
      publishedAt:  it.snippet?.publishedAt ?? '',
      thumbnails:   it.snippet?.thumbnails ?? {},
      position:     Number(it.snippet?.position ?? 0),
      channelTitle: it.snippet?.channelTitle ?? '',
    }));
  if (items.length === 0) return { ok: true, data: [] };

  const ids = items.map((i) => i.videoId).slice(0, 50);
  const vidUrl = `${API}/videos?part=statistics,contentDetails&id=${ids.join(',')}`;
  const v = await ytFetch<VideosListResp>(vidUrl, accessToken);
  if (isErr(v)) return { ok: true, data: items };
  const statsById = new Map<string, { views: number; likes: number; comments: number; duration: string }>();
  for (const it of (v.data.items ?? [])) {
    statsById.set(it.id, {
      views:    Number(it.statistics?.viewCount ?? 0),
      likes:    Number(it.statistics?.likeCount ?? 0),
      comments: Number(it.statistics?.commentCount ?? 0),
      duration: String(it.contentDetails?.duration ?? ''),
    });
  }
  for (const it of items) {
    const s = statsById.get(it.videoId);
    if (s) { it.views = s.views; it.likes = s.likes; it.comments = s.comments; it.duration = s.duration; }
  }
  return { ok: true, data: items };
}

// ---- reply to comment ------------------------------------------------------

interface CreatedCommentResp {
  id?: string;
  snippet?: {
    textOriginal?: string;
    parentId?: string;
    authorDisplayName?: string;
    publishedAt?: string;
  };
}

export async function replyToComment(
  accessToken: string,
  parentCommentId: string,
  text: string,
): Promise<YtResult<CreatedCommentResp>> {
  const url = `${API}/comments?part=snippet`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ snippet: { parentId: parentCommentId, textOriginal: text } }),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 240);
    return { ok: false, error: `youtube_api_${res.status}`, detail };
  }
  const json = (await res.json().catch(() => null)) as CreatedCommentResp | null;
  if (!json) return { ok: false, error: 'youtube_api_bad_json' };
  return { ok: true, data: json };
}
