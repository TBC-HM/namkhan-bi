// supabase/functions/social-followers-sync/index.ts v1
// Pulls audience metrics into marketing.social_accounts.
// v1 covers YouTube (subscribers) — the only platform that needs no business
// account / token handshake — plus stubs for IG/FB/TikTok pending tokens.
// verify_jwt=false: callable by pg_cron without secret.
//
// Required env vars (set in Supabase Edge Function secrets):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   YOUTUBE_API_KEY              — Google Cloud Console → YouTube Data API v3
//   META_GRAPH_TOKEN  (optional) — long-lived Page token; unlocks IG + FB sync
//   IG_BUSINESS_ID    (optional) — Instagram Business Account id
//   FB_PAGE_ID        (optional) — Facebook Page id

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const YT_KEY       = Deno.env.get('YOUTUBE_API_KEY') ?? '';
const META_TOKEN   = Deno.env.get('META_GRAPH_TOKEN') ?? '';
const IG_ID        = Deno.env.get('IG_BUSINESS_ID') ?? '';
const FB_ID        = Deno.env.get('FB_PAGE_ID') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

interface Result {
  platform: string;
  ok: boolean;
  metric_value?: number;
  secondary_value?: number | null;
  error?: string;
  skipped?: string;
}

async function setRow(platform: string, patch: Record<string, unknown>) {
  const { error } = await admin
    .schema('marketing')
    .from('social_accounts')
    .update({ ...patch, last_synced_at: new Date().toISOString() })
    .eq('platform', platform);
  if (error) throw new Error(`update ${platform}: ${error.message}`);
}

async function syncYouTube(handle: string | null): Promise<Result> {
  if (!YT_KEY) return { platform: 'youtube', ok: false, skipped: 'YOUTUBE_API_KEY not set' };
  if (!handle) return { platform: 'youtube', ok: false, error: 'no handle in social_accounts' };
  const cleanHandle = handle.replace(/^@/, '');
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${YT_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return { platform: 'youtube', ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
  const j = await res.json();
  const stats = j?.items?.[0]?.statistics;
  if (!stats) return { platform: 'youtube', ok: false, error: 'no items returned' };
  const subs = Number(stats.subscriberCount ?? 0);
  await setRow('youtube', {
    metric_value: subs,
    last_sync_status: 'ok',
    last_sync_error: null,
  });
  return { platform: 'youtube', ok: true, metric_value: subs };
}

async function syncInstagram(): Promise<Result> {
  if (!META_TOKEN || !IG_ID) return { platform: 'instagram', ok: false, skipped: 'META_GRAPH_TOKEN / IG_BUSINESS_ID not set' };
  const url = `https://graph.facebook.com/v20.0/${IG_ID}?fields=followers_count,media_count&access_token=${META_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return { platform: 'instagram', ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
  const j = await res.json();
  const followers = Number(j?.followers_count ?? 0);
  await setRow('instagram', { metric_value: followers, posts: Number(j?.media_count ?? 0), last_sync_status: 'ok', last_sync_error: null });
  return { platform: 'instagram', ok: true, metric_value: followers };
}

async function syncFacebook(): Promise<Result> {
  if (!META_TOKEN || !FB_ID) return { platform: 'facebook', ok: false, skipped: 'META_GRAPH_TOKEN / FB_PAGE_ID not set' };
  const url = `https://graph.facebook.com/v20.0/${FB_ID}?fields=fan_count&access_token=${META_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) return { platform: 'facebook', ok: false, error: `HTTP ${res.status}: ${await res.text()}` };
  const j = await res.json();
  const fans = Number(j?.fan_count ?? 0);
  await setRow('facebook', { metric_value: fans, last_sync_status: 'ok', last_sync_error: null });
  return { platform: 'facebook', ok: true, metric_value: fans };
}

async function syncTikTok(handle: string | null): Promise<Result> {
  // Official TikTok Business API requires app review; stub for now.
  // v2 path: scrape via Nimble (already integrated for compset agent).
  return { platform: 'tiktok', ok: false, skipped: 'no TikTok API token; wire Nimble scrape in v2' };
}

async function syncReviewsBackfill(): Promise<Result[]> {
  // Aggregate marketing.reviews → metric_value (count) + secondary_value (avg rating)
  // for booking/expedia/tripadvisor/google_business.
  const out: Result[] = [];
  const map: Array<[string, string[]]> = [
    ['booking',         ['booking','booking_com']],
    ['expedia',         ['expedia']],
    ['tripadvisor',     ['tripadvisor']],
    ['google_business', ['google','google_business','google_maps']],
  ];
  for (const [platform, sources] of map) {
    const { data, error } = await admin
      .schema('marketing')
      .from('reviews')
      .select('rating_norm')
      .in('source', sources);
    if (error) { out.push({ platform, ok: false, error: error.message }); continue; }
    const ratings = (data ?? []).map(r => Number(r.rating_norm)).filter(n => !isNaN(n));
    const n = ratings.length;
    const avg = n > 0 ? Number((ratings.reduce((a, b) => a + b, 0) / n).toFixed(2)) : null;
    if (n === 0) { out.push({ platform, ok: false, skipped: 'no reviews ingested yet' }); continue; }
    await setRow(platform, { metric_value: n, secondary_value: avg, last_sync_status: 'ok', last_sync_error: null });
    out.push({ platform, ok: true, metric_value: n, secondary_value: avg });
  }
  return out;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

Deno.serve(async () => {
  // Look up handles up-front so each sync function can take what it needs.
  const { data: rows } = await admin
    .schema('marketing')
    .from('social_accounts')
    .select('platform, handle');
  const handle = (p: string) => rows?.find(r => r.platform === p)?.handle ?? null;

  const results: Result[] = [];
  results.push(await syncYouTube(handle('youtube')).catch(e => ({ platform: 'youtube',  ok: false, error: e.message })));
  results.push(await syncInstagram().catch(e => ({ platform: 'instagram', ok: false, error: e.message })));
  results.push(await syncFacebook().catch(e => ({ platform: 'facebook',  ok: false, error: e.message })));
  results.push(await syncTikTok(handle('tiktok')).catch(e => ({ platform: 'tiktok',    ok: false, error: e.message })));
  const reviewRes = await syncReviewsBackfill().catch(e => [{ platform: 'reviews-batch', ok: false, error: e.message }] as Result[]);
  results.push(...reviewRes);

  // Stamp last_sync_error on failed rows so /settings/property/social can surface them
  for (const r of results) {
    if (!r.ok && r.error) {
      await admin.schema('marketing').from('social_accounts')
        .update({ last_sync_status: 'error', last_sync_error: r.error })
        .eq('platform', r.platform).then(() => {});
    } else if (!r.ok && r.skipped) {
      await admin.schema('marketing').from('social_accounts')
        .update({ last_sync_status: 'skipped', last_sync_error: r.skipped })
        .eq('platform', r.platform).then(() => {});
    }
  }

  return json({ ok: true, ts: new Date().toISOString(), results });
});
