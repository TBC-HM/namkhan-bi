// lib/youtube/analytics.ts
// PBS 2026-07-11 late — Thin fetch wrappers around YouTube Analytics API v2.
// Each function accepts an access token and returns a discriminated union
// { ok:true, ... } | { ok:false, error, detail } — never throws.
//
// Auth: Authorization: Bearer <accessToken>
// Requires OAuth scopes: youtube.readonly (for ids=channel==MINE)
//                        + yt-analytics.readonly (for metrics).
// Quota: 200 queries/day per user by default. Each function call = 1 query.
// On 403 with reason 'quotaExceeded' we surface error='analytics_quota_exceeded'.

const API = 'https://youtubeanalytics.googleapis.com/v2/reports';

// ---- shared shapes ---------------------------------------------------------

export interface ErrShape { ok: false; error: string; detail?: string }

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

interface RawReportResp {
  columnHeaders?: Array<{ name: string; dataType?: string; columnType?: string }>;
  rows?: Array<Array<string | number>>;
  errors?: unknown;
}

/**
 * Low-level fetch — every wrapper below funnels through this.
 * Logs query params at debug level (console.debug) so a future consolidation
 * pass can see which calls are hot.
 */
async function analyticsFetch(
  params: Record<string, string | number>,
  accessToken: string,
): Promise<{ ok: true; data: RawReportResp } | ErrShape> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${API}?${qs.toString()}`;
  // eslint-disable-next-line no-console
  console.debug('[yt-analytics] GET', qs.toString());

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 400);
    // Detect quota exhaustion — Analytics API returns 403 with reason quotaExceeded.
    if (res.status === 403 && /quotaExceeded/i.test(detail)) {
      return { ok: false, error: 'analytics_quota_exceeded', detail };
    }
    return { ok: false, error: `analytics_api_${res.status}`, detail };
  }
  const json = (await res.json().catch(() => null)) as RawReportResp | null;
  if (!json) return { ok: false, error: 'analytics_api_bad_json' };
  return { ok: true, data: json };
}

/** Build a name→index map so row extraction is column-name-safe. */
function colIdx(json: RawReportResp): Record<string, number> {
  const map: Record<string, number> = {};
  (json.columnHeaders ?? []).forEach((h, i) => { map[h.name] = i; });
  return map;
}
function n(row: Array<string | number>, idx: number | undefined): number {
  if (idx === undefined) return 0;
  const v = row[idx];
  const num = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(num) ? num : 0;
}
function s(row: Array<string | number>, idx: number | undefined): string {
  if (idx === undefined) return '';
  const v = row[idx];
  return typeof v === 'string' ? v : String(v ?? '');
}

// ---------------------------------------------------------------------------
// 1 · Channel-level day series for the last N days
// ---------------------------------------------------------------------------
/**
 * fetchChannelDaySeries — one row per day with core engagement + sub deltas.
 * Metrics: views, estimatedMinutesWatched, subscribersGained, subscribersLost, likes, comments, shares
 * Quota cost: 1 query.
 */
export async function fetchChannelDaySeries(
  accessToken: string,
  channelId: string,
  days: number = 30,
): Promise<{ ok: true; rows: Array<{ day: string; views: number; watchMinutes: number; subsGained: number; subsLost: number; likes: number; comments: number; shares: number }> } | ErrShape> {
  const r = await analyticsFetch({
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares',
    dimensions: 'day',
    sort: 'day',
  }, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const rows = (r.data.rows ?? []).map((row) => ({
    day:          s(row, idx.day),
    views:        n(row, idx.views),
    watchMinutes: n(row, idx.estimatedMinutesWatched),
    subsGained:   n(row, idx.subscribersGained),
    subsLost:     n(row, idx.subscribersLost),
    likes:        n(row, idx.likes),
    comments:     n(row, idx.comments),
    shares:       n(row, idx.shares),
  }));
  return { ok: true, rows };
}

// ---------------------------------------------------------------------------
// 2 · Per-video totals for the top N videos over the window
// ---------------------------------------------------------------------------
/**
 * fetchPerVideoStats — top N videos ranked by views over the window.
 * Includes impressions + card metrics when the channel has them.
 * Quota cost: 1 query.
 */
export async function fetchPerVideoStats(
  accessToken: string,
  channelId: string,
  days: number,
  maxVideos: number = 20,
): Promise<{ ok: true; videos: Array<{ videoId: string; views: number; watchMinutes: number; avgViewDuration: number; avgViewPercentage: number; likes: number; comments: number; shares: number; subsGained: number; impressions?: number; cardImpressions?: number; cardCTR?: number }> } | ErrShape> {
  const r = await analyticsFetch({
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,impressions,cardImpressions,cardClickRate',
    dimensions: 'video',
    sort: '-views',
    maxResults: maxVideos,
  }, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const videos = (r.data.rows ?? []).map((row) => {
    const impressions     = idx.impressions     !== undefined ? n(row, idx.impressions)     : undefined;
    const cardImpressions = idx.cardImpressions !== undefined ? n(row, idx.cardImpressions) : undefined;
    const cardCTR         = idx.cardClickRate   !== undefined ? n(row, idx.cardClickRate)   : undefined;
    return {
      videoId:            s(row, idx.video),
      views:              n(row, idx.views),
      watchMinutes:       n(row, idx.estimatedMinutesWatched),
      avgViewDuration:    n(row, idx.averageViewDuration),
      avgViewPercentage:  n(row, idx.averageViewPercentage),
      likes:              n(row, idx.likes),
      comments:           n(row, idx.comments),
      shares:             n(row, idx.shares),
      subsGained:         n(row, idx.subscribersGained),
      impressions,
      cardImpressions,
      cardCTR,
    };
  });
  return { ok: true, videos };
}

// ---------------------------------------------------------------------------
// 3 · Traffic sources (channel-wide or per-video)
// ---------------------------------------------------------------------------
const TRAFFIC_LABELS: Record<string, string> = {
  ADVERTISING:       'Advertising',
  ANNOTATION:        'Annotation',
  CAMPAIGN_CARD:     'Campaign card',
  END_SCREEN:        'End screen',
  EXT_URL:           'External',
  HASHTAGS:          'Hashtags',
  LIVE_REDIRECT:     'Live redirect',
  NO_LINK_EMBEDDED:  'Embedded (no link)',
  NO_LINK_OTHER:     'Other (no link)',
  NOTIFICATION:      'Notifications',
  PLAYLIST:          'Playlist',
  PROMOTED:          'Promoted',
  RELATED_VIDEO:     'Suggested videos',
  SHORTS:            'Shorts feed',
  SUBSCRIBER:        'Browse (subs)',
  YT_CHANNEL:        'Channel pages',
  YT_OTHER_PAGE:     'Other YT pages',
  YT_PLAYLIST_PAGE:  'Playlist pages',
  YT_SEARCH:         'YouTube search',
};
/**
 * fetchTrafficSources — grouped by insightTrafficSourceType.
 * Pass videoId to scope to one video; omit for channel-wide.
 * Quota cost: 1 query.
 */
export async function fetchTrafficSources(
  accessToken: string,
  channelId: string,
  days: number,
  videoId?: string,
): Promise<{ ok: true; sources: Array<{ source: string; label: string; views: number; watchMinutes: number }> } | ErrShape> {
  const params: Record<string, string | number> = {
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'insightTrafficSourceType',
    sort: '-views',
  };
  if (videoId) params.filters = `video==${videoId}`;
  const r = await analyticsFetch(params, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const sources = (r.data.rows ?? []).map((row) => {
    const src = s(row, idx.insightTrafficSourceType);
    return {
      source:       src,
      label:        TRAFFIC_LABELS[src] ?? src,
      views:        n(row, idx.views),
      watchMinutes: n(row, idx.estimatedMinutesWatched),
    };
  });
  return { ok: true, sources };
}

// ---------------------------------------------------------------------------
// 4 · Audience retention curve for a specific video
// ---------------------------------------------------------------------------
/**
 * fetchRetentionCurve — points along the video timeline (0.0 → 1.0).
 * audienceWatchRatio: fraction of the starting audience still watching.
 * relativePerf: how it compares to similar-length YT videos.
 * Quota cost: 1 query.
 */
export async function fetchRetentionCurve(
  accessToken: string,
  channelId: string,
  videoId: string,
): Promise<{ ok: true; points: Array<{ ratio: number; audienceWatchRatio: number; relativePerf: number }> } | ErrShape> {
  const r = await analyticsFetch({
    ids: `channel==${channelId}`,
    startDate: '2005-01-01', // lifetime — retention curve is a video-lifetime metric
    endDate: isoToday(),
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    dimensions: 'elapsedVideoTimeRatio',
    sort: 'elapsedVideoTimeRatio',
    filters: `video==${videoId}`,
  }, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const points = (r.data.rows ?? []).map((row) => ({
    ratio:              n(row, idx.elapsedVideoTimeRatio),
    audienceWatchRatio: n(row, idx.audienceWatchRatio),
    relativePerf:       n(row, idx.relativeRetentionPerformance),
  }));
  return { ok: true, points };
}

// ---------------------------------------------------------------------------
// 5 · Geography — top 15 countries
// ---------------------------------------------------------------------------
/**
 * fetchGeography — ISO country codes with views + watch minutes.
 * Pass videoId to scope to one video; omit for channel-wide.
 * Quota cost: 1 query.
 */
export async function fetchGeography(
  accessToken: string,
  channelId: string,
  days: number,
  videoId?: string,
): Promise<{ ok: true; countries: Array<{ code: string; views: number; watchMinutes: number }> } | ErrShape> {
  const params: Record<string, string | number> = {
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'country',
    sort: '-views',
    maxResults: 15,
  };
  if (videoId) params.filters = `video==${videoId}`;
  const r = await analyticsFetch(params, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const countries = (r.data.rows ?? []).map((row) => ({
    code:         s(row, idx.country),
    views:        n(row, idx.views),
    watchMinutes: n(row, idx.estimatedMinutesWatched),
  }));
  return { ok: true, countries };
}

// ---------------------------------------------------------------------------
// 6 · Demographics — age × gender viewer share
// ---------------------------------------------------------------------------
/**
 * fetchDemographics — viewerPercentage buckets (sum ~= 100 across all rows).
 * Pass videoId to scope to one video; omit for channel-wide.
 * Quota cost: 1 query.
 */
export async function fetchDemographics(
  accessToken: string,
  channelId: string,
  days: number,
  videoId?: string,
): Promise<{ ok: true; buckets: Array<{ ageGroup: string; gender: string; percentage: number }> } | ErrShape> {
  const params: Record<string, string | number> = {
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'viewerPercentage',
    dimensions: 'ageGroup,gender',
    sort: 'gender,ageGroup',
  };
  if (videoId) params.filters = `video==${videoId}`;
  const r = await analyticsFetch(params, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const buckets = (r.data.rows ?? []).map((row) => ({
    ageGroup:   s(row, idx.ageGroup),
    gender:     s(row, idx.gender),
    percentage: n(row, idx.viewerPercentage),
  }));
  return { ok: true, buckets };
}

// ---------------------------------------------------------------------------
// 7 · Device types
// ---------------------------------------------------------------------------
/**
 * fetchDeviceTypes — MOBILE / DESKTOP / TABLET / TV / GAME_CONSOLE / UNKNOWN_PLATFORM.
 * Channel-wide (no per-video filter to keep the surface small — add later if needed).
 * Quota cost: 1 query.
 */
export async function fetchDeviceTypes(
  accessToken: string,
  channelId: string,
  days: number,
): Promise<{ ok: true; devices: Array<{ type: string; views: number; watchMinutes: number }> } | ErrShape> {
  const r = await analyticsFetch({
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'deviceType',
    sort: '-views',
  }, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const devices = (r.data.rows ?? []).map((row) => ({
    type:         s(row, idx.deviceType),
    views:        n(row, idx.views),
    watchMinutes: n(row, idx.estimatedMinutesWatched),
  }));
  return { ok: true, devices };
}

// ---------------------------------------------------------------------------
// 8 · Subscriber sources — WORKAROUND
// ---------------------------------------------------------------------------
/**
 * fetchSubscriberSources — where new subs came from.
 *
 * WORKAROUND: the YouTube Analytics API does NOT expose an
 * `insightSubscriptionsSource` dimension. Verified against Google's
 * "Reports: Channel Reports" reference — the closest available dimension
 * is `subscribedStatus` (a boolean filter, not a source breakdown).
 *
 * Instead we group subscribersGained by insightTrafficSourceType. This
 * mirrors the "Subscription source" chart in YT Studio, which is itself
 * derived from traffic-source × subscribersGained.
 *
 * Quota cost: 1 query.
 */
export async function fetchSubscriberSources(
  accessToken: string,
  channelId: string,
  days: number,
): Promise<{ ok: true; sources: Array<{ source: string; subsGained: number }> } | ErrShape> {
  const r = await analyticsFetch({
    ids: `channel==${channelId}`,
    startDate: isoDaysAgo(days),
    endDate: isoToday(),
    metrics: 'subscribersGained',
    dimensions: 'insightTrafficSourceType',
    sort: '-subscribersGained',
  }, accessToken);
  if (r.ok === false) return r;
  const idx = colIdx(r.data);
  const sources = (r.data.rows ?? [])
    .map((row) => ({
      source:     TRAFFIC_LABELS[s(row, idx.insightTrafficSourceType)] ?? s(row, idx.insightTrafficSourceType),
      subsGained: n(row, idx.subscribersGained),
    }))
    .filter((x) => x.subsGained > 0);
  return { ok: true, sources };
}
