// supabase/functions/social-push/index.ts
// Upload Post publish pipeline — Deno edge function.
// Uses esm.sh SDK to bypass Cloudflare Bot Protection on raw DC-IP fetch.
// Multi-tenancy: profile slug bc{property_id} (bc260955, bc1000001, …).
//
// Auth: requires Authorization header (service_role JWT via sb.functions.invoke).
// Modes: push | poll | sync_profiles | analytics

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { UploadPost } from 'https://esm.sh/upload-post@latest';

function res(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isVideo(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  return ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);
}

function upPlatform(p: string): string {
  return p.replace(/_/g, '-');
}

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

// Supabase Storage buckets require the service role key even when the URL
// says /public/ — add the header only when the URL's hostname exactly matches
// this project's Supabase host (prevents SSRF credential leak via substring bypass).
function storageHeaders(url: string): Record<string, string> {
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!srk || !supabaseUrl) return {};
  try {
    const projectHost = new URL(supabaseUrl).hostname.toLowerCase().replace(/\.$/, '');
    const u = new URL(url);
    if (u.protocol !== 'https:') return {};
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (host === projectHost && u.pathname.startsWith('/storage/')) {
      return { Authorization: `Bearer ${srk}` };
    }
  } catch { /* malformed URL — no headers */ }
  return {};
}

Deno.serve(async (req: Request) => {
  if (!req.headers.get('Authorization')) return res({ ok: false, error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return res({ ok: false, error: 'invalid_json' }, 400); }

  const mode = String(body.mode ?? 'push');

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: apiKey } = await sb.rpc('fn_upload_post_credentials');
  if (!apiKey) return res({ ok: false, error: 'upload_post_key_not_configured' }, 500);

  const up = new UploadPost({ token: apiKey as string });

  // ── PUSH ─────────────────────────────────────────────────────────────────
  if (mode === 'push') {
    const postId = String(body.post_id ?? '');
    if (!postId) return res({ ok: false, error: 'post_id required' }, 400);

    const { data: post, error: pErr } = await sb
      .from('v_social_posts_full').select('*').eq('post_id', postId).single();
    if (pErr || !post) return res({ ok: false, error: pErr?.message ?? 'post_not_found' }, 404);
    const p = post as Record<string, unknown>;

    const { data: profileUsername } = await sb.rpc('fn_social_profile_for_property', {
      p_property_id: p.property_id,
      p_platform:    p.platform,
    });
    if (!profileUsername) {
      return res({ ok: false, error: `no_connected_account: ${p.platform} / property ${p.property_id}` }, 422);
    }

    const tags = Array.isArray(p.hashtags)
      ? (p.hashtags as string[]).map(h => h.startsWith('#') ? h : `#${h}`).join(' ')
      : '';
    const caption = [p.caption ?? p.title ?? '', p.link_url ?? null, tags].filter(Boolean).join('\n\n');
    const mediaUrls: string[] = Array.isArray(p.media_urls)
      ? (p.media_urls as string[]).filter(u => /^https?:\/\//i.test(u))
      : [];

    let result: Record<string, unknown>;
    const scheduleDate = p.scheduled_at ? { schedule_date: p.scheduled_at } : {};

    // ── Pinterest: always images, separate title + description + board_id ──
    try {
    if ((p.platform as string) === 'pinterest') {
      const pinTitle = String(p.title ?? '').slice(0, 100);
      const pinBody  = [String(p.caption ?? p.title ?? ''), tags].filter(Boolean).join('\n\n').slice(0, 500);
      if (mediaUrls.length === 0) {
        return res({ ok: false, error: 'pinterest_requires_image' }, 422);
      }
      const files: File[] = [];
      for (const url of mediaUrls.slice(0, 5)) {
        try {
          const r = await fetch(url, { headers: storageHeaders(url) });
          if (!r.ok) continue;
          const buf = await r.arrayBuffer();
          if (buf.byteLength > MAX_MEDIA_BYTES) continue;
          const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
          files.push(new File([buf], `photo.${ext}`, { type: `image/${ext}` }));
        } catch { /* skip */ }
      }
      if (files.length === 0) return res({ ok: false, error: 'all_media_fetch_failed' }, 502);
      const pinParams: Record<string, unknown> = {
        user:        profileUsername as string,
        platform:    ['pinterest'],
        title:       pinTitle,
        description: pinBody,
        photos:      files,
        ...scheduleDate,
      };
      if (p.link_url)            pinParams.link     = String(p.link_url);
      if (p.pinterest_board_id)  pinParams.board_id = String(p.pinterest_board_id);
      result = await up.uploadPhotos(pinParams) as Record<string, unknown>;
    } else if (mediaUrls.length === 0) {
      result = await up.uploadText({
        user: profileUsername as string,
        platform: [upPlatform(p.platform as string)],
        title: caption,
        ...scheduleDate,
      }) as Record<string, unknown>;
    } else if (mediaUrls.some(isVideo)) {
      const videoUrl = mediaUrls.find(isVideo)!;
      const fetchRes = await fetch(videoUrl, { headers: storageHeaders(videoUrl) });
      if (!fetchRes.ok) return res({ ok: false, error: `media_fetch_failed: ${fetchRes.status}` }, 502);
      const buf = await fetchRes.arrayBuffer();
      if (buf.byteLength > MAX_MEDIA_BYTES) return res({ ok: false, error: 'media_too_large' }, 413);
      const ext = videoUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? 'mp4';
      result = await up.upload({
        user: profileUsername as string,
        platform: [upPlatform(p.platform as string)],
        title: caption,
        media: new File([buf], `video.${ext}`, { type: `video/${ext}` }),
        ...scheduleDate,
      }) as Record<string, unknown>;
    } else {
      const files: File[] = [];
      for (const url of mediaUrls.slice(0, 10)) {
        try {
          const r = await fetch(url, { headers: storageHeaders(url) });
          if (!r.ok) continue;
          const buf = await r.arrayBuffer();
          if (buf.byteLength > MAX_MEDIA_BYTES) continue;
          const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? 'jpg';
          files.push(new File([buf], `photo.${ext}`, { type: `image/${ext}` }));
        } catch { /* skip */ }
      }
      if (files.length === 0) {
        // All image fetches failed (e.g. storage auth) — publish text-only as fallback
        result = await up.uploadText({
          user: profileUsername as string,
          platform: [upPlatform(p.platform as string)],
          title: caption,
          ...scheduleDate,
        }) as Record<string, unknown>;
      } else {
        result = await up.uploadPhotos({
          user: profileUsername as string,
          platform: [upPlatform(p.platform as string)],
          title: caption,
          photos: files,
          ...scheduleDate,
        }) as Record<string, unknown>;
      }
    }
    } catch (upErr) {
      const errMsg = upErr instanceof Error ? upErr.message : String(upErr);
      await sb.rpc('fn_social_post_mark_pushed', {
        p_post_id:       postId,
        p_up_request_id: null,
        p_up_job_id:     null,
        p_up_status:     'error',
        p_up_error:      errMsg,
      }).catch(() => { /* best effort */ });
      return res({ ok: false, error: 'upload_post_sdk_error', detail: errMsg }, 200);
    }

    const requestId  = (result?.request_id ?? result?.id ?? null) as string | null;
    const upError    = result?.error ? String(result.error) : null;

    await sb.rpc('fn_social_post_mark_pushed', {
      p_post_id:       postId,
      p_up_request_id: requestId,
      p_up_job_id:     (result?.job_id ?? null) as string | null,
      p_up_status:     upError ? 'error' : 'queued',
      p_up_error:      upError,
    });

    return res({ ok: !upError, up_request_id: requestId, up_status: upError ? 'error' : 'queued', detail: result });
  }

  // ── POLL ─────────────────────────────────────────────────────────────────
  if (mode === 'poll') {
    const requestId = String(body.request_id ?? '');
    if (!requestId) return res({ ok: false, error: 'request_id required' }, 400);
    const result = await up.getStatus(requestId);
    return res({ ok: true, result });
  }

  // ── SYNC_PROFILES ────────────────────────────────────────────────────────
  if (mode === 'sync_profiles') {
    const propertyId = Number(body.property_id);
    if (!propertyId) return res({ ok: false, error: 'property_id required' }, 400);
    const platforms = (body.platforms as string[] | undefined)
      ?? ['facebook', 'linkedin', 'pinterest', 'google-business'];
    const synced: Array<Record<string, unknown>> = [];

    const listFns: Record<string, () => Promise<unknown>> = {
      facebook:          () => up.getFacebookPages({ user: `bc${propertyId}` }),
      linkedin:          () => up.getLinkedinPages({ user: `bc${propertyId}` }),
      pinterest:         () => up.getPinterestBoards({ user: `bc${propertyId}` }),
      'google-business': () => up.getGoogleBusinessLocations({ user: `bc${propertyId}` }),
    };

    for (const platform of platforms) {
      const fn = listFns[platform];
      if (!fn) { synced.push({ platform, skipped: 'no_list_api' }); continue; }
      try {
        const listRes = await fn() as Record<string, unknown>;
        const items = (listRes?.data ?? listRes?.pages ?? listRes?.boards ?? listRes?.locations ?? []) as Record<string, unknown>[];
        if (items.length > 0) {
          await sb.rpc('fn_social_profile_upsert', {
            p_property_id:  propertyId,
            p_platform:     platform.replace('-', '_'),
            p_up_user_id:   `bc${propertyId}`,
            p_display_name: String(items[0].name ?? ''),
            p_handle:       String(items[0].username ?? items[0].name ?? ''),
            p_avatar_url:   String(items[0].picture ?? items[0].avatar ?? ''),
          });
          // Pinterest: persist all boards so the UI can show a board picker
          if (platform === 'pinterest') {
            try {
              await sb.rpc('fn_pinterest_boards_upsert', {
                p_property_id: propertyId,
                p_boards:      items,
              });
            } catch { /* non-fatal */ }
          }
          synced.push({ platform, ok: true, accounts: items.length });
        } else {
          synced.push({ platform, ok: true, accounts: 0 });
        }
      } catch (e) {
        synced.push({ platform, ok: false, error: String(e) });
      }
    }
    return res({ ok: true, synced });
  }

  // ── ANALYTICS ────────────────────────────────────────────────────────────
  if (mode === 'analytics') {
    const filterPid = body.property_id ? Number(body.property_id) : null;
    const { data: profiles, error: pErr } = await sb.rpc('fn_social_profiles_list', {
      p_property_id: filterPid,
    });
    if (pErr) return res({ ok: false, error: pErr.message }, 500);

    const today = new Date().toISOString().slice(0, 10);
    const results: Array<Record<string, unknown>> = [];

    for (const profile of (profiles as Array<{ property_id: number; platform: string; up_user_id: string }>) ?? []) {
      try {
        const analytics = await up.getAnalytics(profile.up_user_id, {
          platforms: [upPlatform(profile.platform)],
        }) as Record<string, unknown>;
        const d = (analytics?.data ?? analytics) as Record<string, unknown>;

        await sb.rpc('fn_social_analytics_upsert', {
          p_property_id:   profile.property_id,
          p_platform:      profile.platform,
          p_snapshot_date: today,
          p_impressions:   (d.impressions ?? null) as number | null,
          p_likes:         (d.likes ?? null) as number | null,
          p_comments:      (d.comments ?? null) as number | null,
          p_shares:        (d.shares ?? null) as number | null,
          p_reach:         (d.reach ?? null) as number | null,
          p_views:         (d.views ?? null) as number | null,
          p_raw:           d,
        });
        results.push({ property_id: profile.property_id, platform: profile.platform, ok: true });
      } catch (e) {
        results.push({ property_id: profile.property_id, platform: profile.platform, ok: false, error: String(e) });
      }
    }

    return res({ ok: true, synced: results.filter(r => r.ok).length, results });
  }

  return res({ ok: false, error: `unknown_mode: ${mode}` }, 400);
});
