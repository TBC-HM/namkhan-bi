// app/api/cockpit/skills/youtube_publish_scheduled/route.ts
// PBS-approval required. Schedule publish (or publish-now) to YouTube.
// Input : { draft_id, scheduled_publish_utc?, approved_by_email }
// Output: { ok, publication_id?, youtube_video_id?, scheduled_publish_utc?, actual_publish_utc? }
//
// Note: because uploads require youtube.upload scope + the actual MP4 URL,
// the "publish now" branch is currently STUBBED — it records the intent and
// flips the draft to status=pending_upload. A separate uploader (once the
// youtube.upload scope is granted at OAuth time) can complete the row.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getFreshAccessToken } from '@/lib/youtube/token';
import { ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DraftRow {
  draft_id:              string;
  property_id:           number;
  render_job_id:         string;
  title:                 string;
  description:           string;
  tags:                  string[];
  chosen_thumbnail_index: number;
  language:              string;
  approved_by_email:     string | null;
  approved_at_utc:       string | null;
  scheduled_publish_utc: string | null;
  status:                string;
}

interface RenderJobRow {
  output_url: string | null;
}

interface YtInsertResp {
  id?: string;
  status?: { publishAt?: string };
  error?: { message?: string };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      draft_id?:               string;
      publication_id?:         string;   // legacy alias — treat same as draft_id
      scheduled_publish_utc?:  string;
      approved_by_email?:      string;
    };

    const draft_id = body.draft_id ?? body.publication_id;
    const approved_by_email = (body.approved_by_email ?? '').trim();
    if (!draft_id) return err('draft_id_required', 400);
    if (!approved_by_email) return err('approved_by_email_required', 400);

    const sb = getSupabaseAdmin();

    const { data: draftRaw, error: loadErr } = await sb
      .from('v_yt_publication_drafts')
      .select('draft_id,property_id,render_job_id,title,description,tags,chosen_thumbnail_index,language,approved_by_email,approved_at_utc,scheduled_publish_utc,status')
      .eq('draft_id', draft_id)
      .maybeSingle();
    if (loadErr) return err('draft_load_failed', 500, { detail: loadErr.message });
    if (!draftRaw) return err('draft_not_found', 404);
    const draft = draftRaw as DraftRow;

    const now = new Date();
    const scheduled_publish_utc = body.scheduled_publish_utc ?? null;
    const scheduled = scheduled_publish_utc ? new Date(scheduled_publish_utc) : null;
    const isFuture  = scheduled && scheduled.getTime() > now.getTime() + 60_000;

    // Mark as approved
    const approvedAt = new Date().toISOString();
    await sb.from('v_yt_publication_drafts').update({
      approved_by_email,
      approved_at_utc:      approvedAt,
      scheduled_publish_utc: scheduled_publish_utc ?? null,
      status:               isFuture ? 'scheduled' : 'pending_upload',
    }).eq('draft_id', draft_id);

    // Scheduled → just return, cron will pick up at time
    if (isFuture) {
      return ok({
        status:                'scheduled',
        scheduled_publish_utc:  scheduled?.toISOString(),
      });
    }

    // Immediate publish — verify we have a rendered MP4
    const { data: jobRaw } = await sb
      .from('v_yt_render_jobs')
      .select('output_url')
      .eq('render_job_id', draft.render_job_id)
      .maybeSingle();
    const output_url = (jobRaw as RenderJobRow | null)?.output_url ?? null;
    if (!output_url) {
      return err('render_output_url_missing', 409, {
        note: 'The render job has no output_url yet. Run check_shotstack_renders first, or wait for the cron to reconcile.',
      });
    }

    // Fresh access token
    const tokRes = await getFreshAccessToken(draft.property_id);
    if (!tokRes.ok || !tokRes.access_token) {
      return err('access_token_unavailable', 500, { detail: tokRes.error });
    }

    // YouTube resumable upload from URL is not directly supported —
    // we would need to fetch the MP4 bytes into memory / stream. Since this
    // route runs on Vercel with limited memory and no youtube.upload scope
    // is currently granted at OAuth, we STOP here honestly and require an
    // explicit uploader worker.
    return err('publish_now_not_implemented', 501, {
      note: 'Immediate upload requires youtube.upload scope + a streaming uploader worker. The draft is now approved and status=pending_upload. Grant scope and ship the uploader.',
      draft_status: 'pending_upload',
      approved_at_utc: approvedAt,
      output_url,
      access_token_ok: true,
    });
  } catch (e) {
    return err('publish_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
