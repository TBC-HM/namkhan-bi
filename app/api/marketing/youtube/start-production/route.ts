// app/api/marketing/youtube/start-production/route.ts
// PBS 2026-07-13 — POST { request_id } to flip a yt_video_requests row
// from 'queued' to 'scripting' + create a cockpit_ticket for Lumen.
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const requestId = String((body as { request_id?: string }).request_id ?? '').trim();
  if (!requestId) return err('request_id_required', 400);

  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc('fn_yt_video_request_start_production', {
    p_request_id: requestId,
  });
  if (error) return err('start_production_failed', 500, { detail: error.message });
  return ok(data ?? {});
}
