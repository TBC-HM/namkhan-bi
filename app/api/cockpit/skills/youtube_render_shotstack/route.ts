// app/api/cockpit/skills/youtube_render_shotstack/route.ts
// Ship the EDL to Shotstack /v1/render; return immediately with the render id.
// Poller: /api/cockpit/skills/check_shotstack_renders (cron every 5 min).
// Input : { render_job_id }
// Output: { ok, shotstack_render_id, status }

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getVaultSecret, ok, err } from '@/lib/youtube/skills-common';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ShotstackResp {
  success?: boolean;
  message?: string;
  response?: { id?: string; message?: string };
}

interface RenderJobRow {
  render_job_id:            string;
  property_id:              number;
  edl_json:                 Record<string, unknown>;
  status:                   string;
  guardrail_passed_at_utc:  string | null;
  shotstack_render_id:      string | null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { render_job_id?: string };
    const render_job_id = body.render_job_id;
    if (!render_job_id) return err('render_job_id_required', 400);

    const sb = getSupabaseAdmin();

    const { data: jobRaw, error: loadErr } = await sb
      .from('v_yt_render_jobs')
      .select('render_job_id,property_id,edl_json,status,guardrail_passed_at_utc,shotstack_render_id')
      .eq('render_job_id', render_job_id)
      .maybeSingle();
    if (loadErr) return err('render_job_load_failed', 500, { detail: loadErr.message });
    if (!jobRaw) return err('render_job_not_found', 404);
    const job = jobRaw as RenderJobRow;

    if (!job.guardrail_passed_at_utc) return err('guardrail_not_passed', 403);
    if (job.shotstack_render_id) {
      // idempotent — return the existing id
      return ok({ shotstack_render_id: job.shotstack_render_id, status: job.status, existing: true });
    }

    const shotstackKey = await getVaultSecret('SHOTSTACK_API_KEY');
    if (!shotstackKey) return err('vault_key_missing_SHOTSTACK_API_KEY');

    // Endpoint: v1 stage vs production. We default to production; a stage env can override.
    const shotstackHost = (process.env.SHOTSTACK_HOST ?? 'https://api.shotstack.io/v1').replace(/\/$/, '');
    const url = `${shotstackHost}/render`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key':    shotstackKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(job.edl_json),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 240);
      return err(`shotstack_${res.status}`, 502, { detail });
    }
    const jr = (await res.json().catch(() => null)) as ShotstackResp | null;
    const shotstack_render_id = jr?.response?.id;
    if (!jr?.success || !shotstack_render_id) {
      return err('shotstack_bad_response', 502, {
        detail: (jr?.response?.message ?? jr?.message ?? '').slice(0, 240),
      });
    }

    const { error: updErr } = await sb
      .from('v_yt_render_jobs')
      .update({
        shotstack_render_id,
        status: 'rendering',
      })
      .eq('render_job_id', render_job_id);
    if (updErr) return err('render_job_update_failed', 500, { detail: updErr.message });

    return ok({ shotstack_render_id, status: 'rendering' });
  } catch (e) {
    return err('shotstack_crash', 500, { detail: String((e as Error).message ?? e).slice(0, 240) });
  }
}
